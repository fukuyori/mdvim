/**
 * Vim Editor
 * VIM-like text editor main logic
 */

const VimEditor = {
  mode: 'normal',
  vimMode: false,              // VIM mode enabled/disabled (default: disabled)
  register: '',
  searchTerm: '',
  undoStack: [],
  redoStack: [],
  visualStart: null,
  visualLine: false,
  visualCursor: null,    // Actual cursor position in visual line mode
  visualStartLine: -1,   // Starting line number in visual line mode
  count: '',
  pendingKey: '',
  pendingOperator: '',
  modified: false,
  autoSaveInterval: '1s',      // Auto-save interval: 'off', '1s', '5s', '10s', '30s', '60s'
  
  // 新機能用の状態
  marks: {},                    // マーク
  macros: {},                   // マクロ
  recordingMacro: null,         // 記録中のマクロ名
  macroBuffer: [],              // マクロ記録バッファ
  lastMacro: null,              // 最後に実行したマクロ
  lastFindChar: null,           // f/F/t/T の最後の文字
  lastFindDirection: 1,         // 1: forward, -1: backward
  lastFindType: 'f',            // 'f' or 't'
  lastEdit: null,               // ドットリピート用
  lastEditText: '',             // 挿入されたテキスト
  previousPosition: null,       // '' ジャンプ用
  currentFileName: 'Untitled',
  fileInsertMode: false,        // ファイル挿入モード
  currentFileHandle: null,      // File System Access API用
  
  init() {
    this.editor = document.getElementById('editor');
    this.preview = document.getElementById('preview-content');
    this.modeIndicator = document.getElementById('vim-mode');
    this.cursorPos = document.getElementById('cursor-pos');
    this.commandLine = document.getElementById('command-line');
    this.commandInput = document.getElementById('command-input');
    this.commandPrefix = document.getElementById('command-prefix');
    this.lineNumbers = document.getElementById('line-numbers');
    this.fileStatus = document.getElementById('file-status');
    this.fileName = document.getElementById('file-name');
    this.macroIndicator = document.getElementById('macro-indicator');
    this.cursorOverlay = document.getElementById('cursor-overlay');
    this.fileInput = document.getElementById('file-input');
    this.fontSizeDisplay = document.getElementById('font-size-display');
    
    // セッションID（タブごとに独立）
    this.sessionId = sessionStorage.getItem('vim-md-session-id');
    if (!this.sessionId) {
      this.sessionId = 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
      sessionStorage.setItem('vim-md-session-id', this.sessionId);
    }
    
    // 目次パネル
    this.tocPane = document.getElementById('toc-pane');
    this.tocContent = document.getElementById('toc-content');
    this.tocOpenBtn = document.getElementById('toc-open-btn');
    this.tocVisible = true;
    
    // 見出しハイライトオーバーレイ
    
    // フォントサイズ（%）- これは全タブ共通でOK
    this.fontSize = parseInt(localStorage.getItem('vim-md-font-size')) || 100;
    this.applyFontSize();
    
    // Load VIM mode setting
    this.vimMode = localStorage.getItem('vim-md-vim-mode') === 'true';
    this.updateVimModeUI();
    
    // Load auto-save setting
    const savedAutoSave = localStorage.getItem('vim-md-autosave');
    if (savedAutoSave && ['off', '1s', '5s', '10s', '30s', '60s'].includes(savedAutoSave)) {
      this.autoSaveInterval = savedAutoSave;
    }
    
    // File input event
    this.fileInput.addEventListener('change', e => this.handleFileOpen(e));
    
    // カーソル計測用の隠し要素
    this.measureSpan = document.createElement('span');
    this.measureSpan.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre;
      font-family: inherit;
      font-size: 0.95rem;
      line-height: 1.5;
    `;
    document.body.appendChild(this.measureSpan);
    
    this.setupEventListeners();
    this.loadFromStorage();
    this.updateLineNumbers();
    this.updatePreview();
    this.updateToc();
    this.saveState();
    this.updateCursorOverlay();
    
    // NOVIM mode: set editable state
    if (!this.vimMode) {
      this.mode = 'insert';
      this.editor.readOnly = false;
      this.editor.classList.add('insert-mode');
    }
    
    this.editor.focus();
    this.initialized = true;
  },
  
  setupEventListeners() {
    this.editor.addEventListener('keydown', e => this.handleKeydown(e));
    this.editor.addEventListener('input', e => this.onInput(e));
    this.editor.addEventListener('click', () => this.updateCursorPos());
    this.editor.addEventListener('scroll', () => this.syncScroll());
    this.commandInput.addEventListener('keydown', e => this.handleCommandKey(e));
    
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && !document.getElementById('help-modal').classList.contains('hidden')) {
        toggleHelp();
      }
    });
    
    this.editor.addEventListener('scroll', () => {
      this.lineNumbers.scrollTop = this.editor.scrollTop;
      this.updateCursorOverlay();
    });
  },
  
  loadFromStorage() {
    // 1. Check sessionStorage first (tab restore)
    const sessionContent = sessionStorage.getItem('vim-md-content-' + this.sessionId);
    if (sessionContent) {
      this.editor.value = sessionContent;
      // Restore filename from localStorage session data
      try {
        const sessionData = JSON.parse(localStorage.getItem('vim-md-session-' + this.sessionId) || '{}');
        if (sessionData.filename) {
          this.currentFileName = sessionData.filename;
          this.fileName.textContent = sessionData.filename;
        }
      } catch (e) {}
      this.showStatus('Session restored');
      return;
    }
    
    // 2. For new tabs, restore the latest session from localStorage
    let sessions = [];
    try {
      sessions = JSON.parse(localStorage.getItem('vim-md-sessions') || '[]');
    } catch (e) {
      sessions = [];
    }
    
    if (sessions.length > 0) {
      // Find the latest session
      let latestSession = null;
      let latestTimestamp = 0;
      
      for (const sid of sessions) {
        try {
          const data = JSON.parse(localStorage.getItem('vim-md-session-' + sid) || '{}');
          if (data.timestamp && data.timestamp > latestTimestamp && data.content) {
            latestTimestamp = data.timestamp;
            latestSession = data;
          }
        } catch (e) {}
      }
      
      if (latestSession) {
        this.editor.value = latestSession.content;
        this.currentFileName = latestSession.filename || 'Untitled';
        this.fileName.textContent = this.currentFileName;
        // Copy to current session
        this.saveSessionData();
        this.showStatus('Previous content restored');
        return;
      }
    }
    
    // 3. Migrate from old localStorage format
    const oldContent = localStorage.getItem('vim-md-content');
    if (oldContent) {
      this.editor.value = oldContent;
      const oldFilename = localStorage.getItem('vim-md-filename');
      if (oldFilename) {
        this.currentFileName = oldFilename;
        this.fileName.textContent = oldFilename;
      }
      // Migrate to new format
      this.saveSessionData();
      // Remove old format
      localStorage.removeItem('vim-md-content');
      localStorage.removeItem('vim-md-filename');
      this.showStatus('Previous content restored');
      return;
    }
    
    // 4. Default content for first launch
    this.editor.value = this.getWelcomeContent();
    // Save welcome content to current session
    this.saveSessionData();
  },
  
  // Get welcome document content
  getWelcomeContent() {
    return `# Welcome to mdvim v0.3.4!

**mdvim** is a Vim-style Markdown editor.

## Features

### Vim Operations
- \`h\`/\`j\`/\`k\`/\`l\` cursor movement
- \`i\`/\`a\`/\`o\` insert mode
- \`dd\`/\`yy\`/\`p\` delete/copy/paste
- \`u\`/\`Ctrl+r\` undo/redo

### Search & Replace
- \`/pattern\` search
- \`:s/old/new/g\` replace
- \`:%s/old/new/g\` replace all

### File Operations
- \`:w\` save dialog
- \`:e\` open file
- \`:new\` new file

### Settings Commands
- \`:set vim\` / \`:set novim\` toggle mode
- \`:set autosave=off\` disable auto-save
- \`:set autosave=5s\` 5 second interval (default: 1s)

### Math (LaTeX)

Inline: $E = mc^2$

Block:
$$
\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}
$$

### Table

| Key | Action |
|:----|:-------|
| \`h\` | Move left |
| \`j\` | Move down |
| \`k\` | Move up |
| \`l\` | Move right |

### Mermaid Diagram

\`\`\`mermaid
graph LR
    A[mdvim] --> B[Vim]
    A --> C[Markdown]
    A --> D[Preview]
\`\`\`

### Task List

- [x] Vim operations
- [x] Markdown preview
- [x] Math support
- [x] Mermaid diagrams
- [ ] More features coming

### GitHub Alerts

> [!NOTE]
> This is a note.

> [!WARNING]
> This is a warning.

### Qiita Note Syntax

:::note info
Information
:::

:::note warn
Warning message
:::

### Emoji

:smile: :rocket: :star: :+1:

---

Press \`?\` for help
`;
  },
  
  // Show welcome screen
  showWelcome() {
    this.saveState();
    this.editor.value = this.getWelcomeContent();
    this.fileName.textContent = 'welcome.md';
    this.currentFileName = 'welcome.md';
    this.modified = false;
    this.updateFileStatus();
    this.updateLineNumbers();
    this.updatePreview();
    this.updateToc();
    this.editor.selectionStart = 0;
    this.editor.selectionEnd = 0;
    this.updateCursorPos();
    this.showStatus('Welcome screen displayed');
  },
  
  // マクロ記録
  recordKey(key, e) {
    if (this.recordingMacro && key !== 'q') {
      this.macroBuffer.push({ key, ctrlKey: e?.ctrlKey, shiftKey: e?.shiftKey });
    }
  },
  
  handleKeydown(e) {
    // NOVIM mode - simple processing
    if (this.vimMode !== true) {
      
      // Ctrl+` to switch to VIM mode
      if (e.ctrlKey && e.code === 'Backquote') {
        e.preventDefault();
        this.setVimMode(true);
        return;
      }
      
      // Ctrl+key shortcuts
      if (e.ctrlKey) {
        switch (e.key.toLowerCase()) {
          case 's':
            e.preventDefault();
            this.downloadFile(this.currentFileName || 'Untitled');
            return;
          case 'o':
            e.preventDefault();
            this.openFileDialog(false);
            return;
          case 'a':
            e.preventDefault();
            const filename = prompt('Enter filename:', this.currentFileName || 'Untitled.md');
            if (filename) {
              this.downloadFile(filename);
            }
            return;
          case 'n':
            e.preventDefault();
            if (this.modified) {
              if (confirm('Changes not saved. Create new file?')) {
                this.newFile();
              }
            } else {
              this.newFile();
            }
            return;
        }
        // Other Ctrl+keys use browser default (Ctrl+Z, Ctrl+C, etc.)
        return;
      }
      
      // Tab key
      if (e.key === 'Tab') {
        e.preventDefault();
        this.handleTab(e.shiftKey);
        return;
      }
      
      // Enter key: auto-indent
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleAutoIndent();
        return;
      }
      
      // Escape key
      if (e.key === 'Escape') {
        if (!this.commandLine.classList.contains('hidden')) {
          this.commandLine.classList.add('hidden');
          this.editor.focus();
        }
        return;
      }
      
      // All other keys (including arrow keys) allow default behavior
      return;
    }
    
    // VIM mode (this.vimMode === true) processing below
    
    // Ctrl+` to switch to NOVIM mode
    if (e.ctrlKey && e.code === 'Backquote') {
      e.preventDefault();
      this.setVimMode(false);
      return;
    }
    
    // Ctrl+[ as ESC
    if (e.ctrlKey && e.key === '[') {
      e.preventDefault();
      if (this.mode === 'insert') {
        this.exitInsertMode();
      } else if (this.mode === 'visual') {
        this.setMode('normal');
        this.editor.selectionEnd = this.editor.selectionStart;
      }
      return;
    }
    
    if (this.mode === 'insert') {
      if (e.key === 'Escape') {
        e.preventDefault();
        this.exitInsertMode();
      } else if (e.key === 'Tab') {
        e.preventDefault();
        this.handleTab(e.shiftKey);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        this.handleAutoIndent();
      }
      return;
    }
    
    if (this.mode === 'visual') {
      e.preventDefault();
      this.handleVisualMode(e);
      return;
    }
    
    e.preventDefault();
    this.handleNormalMode(e);
  },
  
  // Tab key handling (indent/unindent)
  handleTab(isShift) {
    const text = this.editor.value;
    const start = this.editor.selectionStart;
    const end = this.editor.selectionEnd;
    const tabChar = '  '; // 2 spaces for indent
    
    // No selection
    if (start === end) {
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      let lineEnd = text.indexOf('\n', start);
      if (lineEnd === -1) lineEnd = text.length;
      const line = text.substring(lineStart, lineEnd);
      
      // Check if list line (bullet, numbered, task list)
      const isListLine = /^(\s*)([-*+]|\d+\.)\s/.test(line);
      
      if (isShift) {
        // Shift+Tab: remove indent from line start
        if (line.startsWith(tabChar)) {
          this.editor.value = text.substring(0, lineStart) + text.substring(lineStart + tabChar.length);
          this.editor.selectionStart = this.editor.selectionEnd = Math.max(lineStart, start - tabChar.length);
        } else if (line.startsWith('\t')) {
          this.editor.value = text.substring(0, lineStart) + text.substring(lineStart + 1);
          this.editor.selectionStart = this.editor.selectionEnd = Math.max(lineStart, start - 1);
        }
      } else if (isListLine) {
        // Tab on list line: add indent at line start
        this.editor.value = text.substring(0, lineStart) + tabChar + text.substring(lineStart);
        this.editor.selectionStart = this.editor.selectionEnd = start + tabChar.length;
      } else {
        // Tab on non-list line: insert tab at cursor
        this.editor.value = text.substring(0, start) + tabChar + text.substring(end);
        this.editor.selectionStart = this.editor.selectionEnd = start + tabChar.length;
      }
    } else {
      // Selection exists: indent/unindent multiple lines
      const lineStart = text.lastIndexOf('\n', start - 1) + 1;
      const lineEnd = text.indexOf('\n', end);
      const actualEnd = lineEnd === -1 ? text.length : lineEnd;
      const selectedLines = text.substring(lineStart, actualEnd);
      const lines = selectedLines.split('\n');
      
      let newLines;
      if (isShift) {
        // Unindent
        newLines = lines.map(line => {
          if (line.startsWith(tabChar)) {
            return line.substring(tabChar.length);
          } else if (line.startsWith('\t')) {
            return line.substring(1);
          }
          return line;
        });
      } else {
        // Indent
        newLines = lines.map(line => tabChar + line);
      }
      
      const newText = newLines.join('\n');
      this.editor.value = text.substring(0, lineStart) + newText + text.substring(actualEnd);
      
      // Maintain selection
      this.editor.selectionStart = lineStart;
      this.editor.selectionEnd = lineStart + newText.length;
    }
    
    this.modified = true;
    this.updateFileStatus();
    this.onInput();
  },
  
  // Auto-indent on Enter key
  handleAutoIndent() {
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    
    // Get current line start position
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    const currentLine = text.substring(lineStart, pos);
    
    // Get indent (leading spaces/tabs)
    const indentMatch = currentLine.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';
    
    // List marker patterns
    const listPatterns = [
      // Task list: - [ ] or - [x]
      { regex: /^(\s*)([-*+])\s+\[([ xX])\]\s*(.*)$/, type: 'task' },
      // Ordered list: 1. 2. etc
      { regex: /^(\s*)(\d+)\.\s+(.*)$/, type: 'ordered' },
      // Unordered list: - * +
      { regex: /^(\s*)([-*+])\s+(.*)$/, type: 'unordered' },
      // Quote: >
      { regex: /^(\s*)(>+)\s*(.*)$/, type: 'quote' }
    ];
    
    let newLineContent = '\n' + indent;
    let shouldClearLine = false;
    
    for (const pattern of listPatterns) {
      const match = currentLine.match(pattern.regex);
      if (match) {
        if (pattern.type === 'task') {
          const [, lineIndent, marker, , content] = match;
          if (content.trim() === '') {
            // Empty task list → end list
            shouldClearLine = true;
          } else {
            newLineContent = '\n' + lineIndent + marker + ' [ ] ';
          }
        } else if (pattern.type === 'ordered') {
          const [, lineIndent, num, content] = match;
          if (content.trim() === '') {
            // Empty ordered list → end list
            shouldClearLine = true;
          } else {
            const nextNum = parseInt(num) + 1;
            newLineContent = '\n' + lineIndent + nextNum + '. ';
          }
        } else if (pattern.type === 'unordered') {
          const [, lineIndent, marker, content] = match;
          if (content.trim() === '') {
            // Empty unordered list → end list
            shouldClearLine = true;
          } else {
            newLineContent = '\n' + lineIndent + marker + ' ';
          }
        } else if (pattern.type === 'quote') {
          const [, lineIndent, markers, content] = match;
          if (content.trim() === '') {
            // Empty quote → end quote
            shouldClearLine = true;
          } else {
            newLineContent = '\n' + lineIndent + markers + ' ';
          }
        }
        break;
      }
    }
    
    if (shouldClearLine) {
      // Remove empty list/quote line and add new line
      this.editor.value = text.substring(0, lineStart) + '\n' + text.substring(pos);
      this.editor.selectionStart = this.editor.selectionEnd = lineStart + 1;
    } else {
      // Add indent (and list marker) to new line
      this.editor.value = text.substring(0, pos) + newLineContent + text.substring(pos);
      this.editor.selectionStart = this.editor.selectionEnd = pos + newLineContent.length;
    }
    
    this.modified = true;
    this.updateFileStatus();
    this.onInput();
    this.scrollToCursor();
  },

  exitInsertMode() {
    // 挿入モード終了時の処理
    if (this.lastEdit && this.lastEdit.type === 'insert') {
      this.lastEdit.insertedText = this.lastEditText;
    }
    this.lastEditText = '';
    
    this.setMode('normal');
    if (this.editor.selectionStart > 0) {
      this.editor.selectionStart--;
      this.editor.selectionEnd = this.editor.selectionStart;
    }
  },
  
  handleNormalMode(e) {
    const key = e.key;
    
    this.recordKey(key, e);
    
    // 数値プレフィックス
    if (/^[1-9]$/.test(key) || (this.count && /^[0-9]$/.test(key))) {
      this.count += key;
      return;
    }
    
    const count = parseInt(this.count) || 1;
    this.count = '';
    
    // オペレーター待ち状態（d, c, y の後）
    if (this.pendingOperator) {
      this.handleOperatorPending(key, count, e);
      return;
    }
    
    // 保留中のキー
    if (this.pendingKey) {
      this.handlePendingKey(key, count);
      return;
    }
    
    // Ctrl組み合わせ
    if (e.ctrlKey) {
      switch(key) {
        case 'r': this.redo(); return;
        case 'd': this.scrollHalfPage(1); return;
        case 'u': this.scrollHalfPage(-1); return;
        case 'f': this.scrollFullPage(1); return;
        case 'b': this.scrollFullPage(-1); return;
      }
    }
    
    switch(key) {
      // モード切替
      case 'i': 
        this.setLastEdit('insert', this.editor.selectionStart);
        this.setMode('insert'); 
        break;
      case 'I': 
        this.moveToFirstNonSpace(); 
        this.setLastEdit('insert', this.editor.selectionStart);
        this.setMode('insert'); 
        break;
      case 'a': 
        if (this.editor.selectionStart < this.editor.value.length) {
          this.editor.selectionStart++;
          this.editor.selectionEnd = this.editor.selectionStart;
        }
        this.setLastEdit('insert', this.editor.selectionStart);
        this.setMode('insert'); 
        break;
      case 'A': 
        this.moveToLineEnd(); 
        this.setLastEdit('insert', this.editor.selectionStart);
        this.setMode('insert'); 
        break;
      case 'o': 
        this.saveState();
        this.moveToLineEnd(); 
        this.insertText('\n'); 
        this.setLastEdit('o');
        this.setMode('insert'); 
        break;
      case 'O': 
        this.saveState();
        this.moveToLineStart(); 
        this.insertText('\n'); 
        this.moveCursor(-1); 
        this.setLastEdit('O');
        this.setMode('insert'); 
        break;
      case 's':
        this.saveState();
        this.deleteChar();
        this.setLastEdit('s');
        this.setMode('insert');
        break;
      case 'S':
        this.saveState();
        this.deleteLineContent();
        this.setLastEdit('S');
        this.setMode('insert');
        break;
      case 'v': 
        this.setMode('visual'); 
        this.visualStart = this.editor.selectionStart; 
        this.visualLine = false; 
        break;
      case 'V': 
        this.visualCursor = this.editor.selectionStart;  // Save cursor position
        // Calculate starting line number
        const textBeforeCursor = this.editor.value.substring(0, this.editor.selectionStart);
        this.visualStartLine = textBeforeCursor.split('\n').length - 1;
        this.setMode('visual'); 
        this.selectCurrentLine(); 
        this.visualLine = true; 
        break;
      case ':': 
        this.setMode('command'); 
        this.commandPrefix.textContent = ':'; 
        break;
      case '/': 
        this.setMode('command'); 
        this.commandPrefix.textContent = '/'; 
        break;
      case '?': 
        toggleHelp(); 
        break;
      
      // 移動
      case 'h': case 'ArrowLeft': this.moveCursor(-count); break;
      case 'l': case 'ArrowRight': this.moveCursor(count); break;
      case 'j': case 'ArrowDown': for (let i = 0; i < count; i++) this.moveVertical(1); break;
      case 'k': case 'ArrowUp': for (let i = 0; i < count; i++) this.moveVertical(-1); break;
      case 'w': for (let i = 0; i < count; i++) this.moveWord(1); break;
      case 'b': for (let i = 0; i < count; i++) this.moveWord(-1); break;
      case 'e': for (let i = 0; i < count; i++) this.moveWordEnd(); break;
      case '0': this.moveToLineStart(); break;
      case '$': this.moveToLineEnd(); break;
      case '^': this.moveToFirstNonSpace(); break;
      case 'g': this.pendingKey = 'g'; break;
      case 'G': if (count > 1) this.gotoLine(count); else this.moveToEnd(); break;
      case 'z': this.pendingKey = 'z'; break;
      
      // 行内検索 (f/F/t/T)
      case 'f': this.pendingKey = 'f'; break;
      case 'F': this.pendingKey = 'F'; break;
      case 't': this.pendingKey = 't'; break;
      case 'T': this.pendingKey = 'T'; break;
      case ';': this.repeatFindChar(1); break;
      case ',': this.repeatFindChar(-1); break;
      
      // 括弧ジャンプ
      case '%': this.jumpToMatchingBracket(); break;
      
      // パラグラフ移動
      case '{': for (let i = 0; i < count; i++) this.moveParagraph(-1); break;
      case '}': for (let i = 0; i < count; i++) this.moveParagraph(1); break;
      
      // マーク
      case 'm': this.pendingKey = 'm'; break;
      case "'": this.pendingKey = "'"; break;
      case '`': this.pendingKey = '`'; break;
      
      // マクロ
      case 'q':
        if (this.recordingMacro) {
          this.stopRecordingMacro();
        } else {
          this.pendingKey = 'q_start';
        }
        break;
      case '@': this.pendingKey = '@'; break;
      
      // 編集
      case 'x': 
        this.saveState(); 
        for (let i = 0; i < count; i++) this.deleteChar(); 
        this.setLastEdit('x', null, count);
        break;
      case 'X': 
        this.saveState(); 
        for (let i = 0; i < count; i++) this.deleteCharBefore(); 
        this.setLastEdit('X', null, count);
        break;
      case 'd': this.pendingOperator = 'd'; break;
      case 'D': 
        this.saveState(); 
        this.deleteToLineEnd(); 
        this.setLastEdit('D');
        break;
      case 'c': this.pendingOperator = 'c'; break;
      case 'C': 
        this.saveState(); 
        this.deleteToLineEnd(); 
        this.setLastEdit('C');
        this.setMode('insert'); 
        break;
      case 'y': this.pendingOperator = 'y'; break;
      case 'Y': this.yankLine(); break;
      case 'p': this.saveState(); this.paste(); break;
      case 'P': this.saveState(); this.pasteBefore(); break;
      case 'u': this.undo(); break;
      case 'J': this.saveState(); this.joinLines(); this.setLastEdit('J'); break;
      case 'r': this.pendingKey = 'r'; break;
      
      // ドットリピート
      case '.': this.repeatLastEdit(count); break;
      
      // 大文字/小文字切替
      case '~': 
        this.saveState(); 
        for (let i = 0; i < count; i++) this.toggleCase(); 
        this.setLastEdit('~', null, count);
        break;
      
      // インデント
      case '>': this.pendingKey = '>'; break;
      case '<': this.pendingKey = '<'; break;
      
      // 検索
      case 'n': this.findNext(); break;
      case 'N': this.findPrev(); break;
      case '*': this.searchWordUnderCursor(); break;
    }
    
    this.updateCursorPos();
  },
  
  // オペレーター待ち状態の処理 (d, c, y の後)
  handleOperatorPending(key, count, e) {
    const op = this.pendingOperator;
    this.pendingOperator = '';
    
    // テキストオブジェクト (i/a)
    if (key === 'i' || key === 'a') {
      this.pendingKey = op + key;  // 例: 'di', 'ca'
      return;
    }
    
    // オペレーターの重複 (dd, cc, yy)
    if (key === op) {
      this.saveState();
      if (op === 'd') {
        for (let i = 0; i < count; i++) this.deleteLine();
        this.setLastEdit('dd', null, count);
      } else if (op === 'c') {
        this.deleteLineContent();
        this.setLastEdit('cc', null, count);
        this.setMode('insert');
      } else if (op === 'y') {
        this.yankLine();
      }
      return;
    }
    
    // モーション
    this.saveState();
    const startPos = this.editor.selectionStart;
    
    switch(key) {
      case 'w':
        for (let i = 0; i < count; i++) this.moveWord(1);
        break;
      case 'b':
        for (let i = 0; i < count; i++) this.moveWord(-1);
        break;
      case 'e':
        for (let i = 0; i < count; i++) this.moveWordEnd();
        this.editor.selectionStart++;
        this.editor.selectionEnd++;
        break;
      case '$':
        this.moveToLineEnd();
        break;
      case '0':
        this.moveToLineStart();
        break;
      case '^':
        this.moveToFirstNonSpace();
        break;
      case 'G':
        this.moveToEnd();
        break;
      case '{':
        this.moveParagraph(-1);
        break;
      case '}':
        this.moveParagraph(1);
        break;
      case 'g':
        this.pendingKey = op + 'g';
        return;
      default:
        return;
    }
    
    const endPos = this.editor.selectionStart;
    const start = Math.min(startPos, endPos);
    const end = Math.max(startPos, endPos);
    
    this.applyOperator(op, start, end, key, count);
    this.updateCursorPos();
  },
  
  applyOperator(op, start, end, motion, count) {
    const text = this.editor.value.substring(start, end);
    
    if (op === 'y') {
      this.setRegister(text);
      this.editor.selectionStart = start;
      this.editor.selectionEnd = start;
      this.showStatus('Yanked');
    } else if (op === 'd') {
      this.register = text;
      this.editor.value = this.editor.value.substring(0, start) + this.editor.value.substring(end);
      this.editor.selectionStart = start;
      this.editor.selectionEnd = start;
      this.setLastEdit('d' + motion, null, count);
      this.onInput();
    } else if (op === 'c') {
      this.register = text;
      this.editor.value = this.editor.value.substring(0, start) + this.editor.value.substring(end);
      this.editor.selectionStart = start;
      this.editor.selectionEnd = start;
      this.setLastEdit('c' + motion, null, count);
      this.setMode('insert');
      this.onInput();
    }
  },
  
  handlePendingKey(key, count) {
    const pending = this.pendingKey;
    this.pendingKey = '';
    
    switch(pending) {
      case 'g':
        if (key === 'g') this.moveToStart();
        break;
      
      case 'z':
        // z Enter, zt - cursor line to top
        if (key === 'Enter' || key === 't') {
          this.scrollCursorToTop();
        }
        // z. zz - cursor line to center
        else if (key === '.' || key === 'z') {
          this.scrollCursorToCenter();
        }
        // z- zb - cursor line to bottom
        else if (key === '-' || key === 'b') {
          this.scrollCursorToBottom();
        }
        break;
        
      case 'd':
        this.saveState();
        if (key === 'd') { for (let i = 0; i < count; i++) this.deleteLine(); this.setLastEdit('dd', null, count); }
        else if (key === 'w') { this.deleteWord(); this.setLastEdit('dw'); }
        else if (key === '$') { this.deleteToLineEnd(); this.setLastEdit('d$'); }
        else if (key === '0') { this.deleteToLineStart(); this.setLastEdit('d0'); }
        break;
        
      case 'y':
        if (key === 'y') this.yankLine();
        else if (key === 'w') this.yankWord();
        break;
        
      case 'c':
        this.saveState();
        if (key === 'c') { this.deleteLineContent(); this.setLastEdit('cc'); this.setMode('insert'); }
        else if (key === 'w') { this.deleteWord(); this.setLastEdit('cw'); this.setMode('insert'); }
        break;
        
      case 'r':
        if (key.length === 1) {
          this.saveState();
          this.replaceChar(key);
          this.setLastEdit('r', key);
        }
        break;
        
      // 行内検索
      case 'f':
        if (key.length === 1) {
          this.findCharInLine(key, 1, false);
          this.lastFindChar = key;
          this.lastFindDirection = 1;
          this.lastFindType = 'f';
        }
        break;
      case 'F':
        if (key.length === 1) {
          this.findCharInLine(key, -1, false);
          this.lastFindChar = key;
          this.lastFindDirection = -1;
          this.lastFindType = 'f';
        }
        break;
      case 't':
        if (key.length === 1) {
          this.findCharInLine(key, 1, true);
          this.lastFindChar = key;
          this.lastFindDirection = 1;
          this.lastFindType = 't';
        }
        break;
      case 'T':
        if (key.length === 1) {
          this.findCharInLine(key, -1, true);
          this.lastFindChar = key;
          this.lastFindDirection = -1;
          this.lastFindType = 't';
        }
        break;
        
      // マーク
      case 'm':
        if (/^[a-z]$/.test(key)) {
          this.marks[key] = this.editor.selectionStart;
          this.showStatus(`Mark set`);
        }
        break;
      case "'":
        if (key === "'") {
          // '' で直前位置へ
          if (this.previousPosition !== null) {
            const current = this.editor.selectionStart;
            this.gotoPosition(this.previousPosition);
            this.previousPosition = current;
            this.moveToFirstNonSpace();
          }
        } else if (/^[a-z]$/.test(key) && this.marks[key] !== undefined) {
          this.previousPosition = this.editor.selectionStart;
          this.gotoPosition(this.marks[key]);
          this.moveToFirstNonSpace();
        }
        break;
      case '`':
        if (/^[a-z]$/.test(key) && this.marks[key] !== undefined) {
          this.previousPosition = this.editor.selectionStart;
          this.gotoPosition(this.marks[key]);
        }
        break;
        
      // マクロ
      case 'q_start':
        if (/^[a-z]$/.test(key)) {
          this.startRecordingMacro(key);
        }
        break;
      case '@':
        if (key === '@' && this.lastMacro) {
          this.playMacro(this.lastMacro);
        } else if (/^[a-z]$/.test(key) && this.macros[key]) {
          this.playMacro(key);
        }
        break;
        
      // インデント
      case '>':
        if (key === '>') {
          this.saveState();
          for (let i = 0; i < count; i++) this.indentLine(1);
          this.setLastEdit('>>', null, count);
        }
        break;
      case '<':
        if (key === '<') {
          this.saveState();
          for (let i = 0; i < count; i++) this.indentLine(-1);
          this.setLastEdit('<<', null, count);
        }
        break;
        
      // テキストオブジェクト (di, da, ci, ca, yi, ya)
      case 'di': case 'da': case 'ci': case 'ca': case 'yi': case 'ya':
        this.handleTextObject(pending, key);
        break;
        
      // dg, cg, yg
      case 'dg':
        if (key === 'g') {
          this.saveState();
          const pos = this.editor.selectionStart;
          this.register = this.editor.value.substring(0, pos);
          this.editor.value = this.editor.value.substring(pos);
          this.editor.selectionStart = 0;
          this.editor.selectionEnd = 0;
          this.onInput();
        }
        break;
    }
    
    this.updateCursorPos();
  },
  
  // テキストオブジェクト処理
  handleTextObject(opType, objChar) {
    const op = opType[0];  // 'd', 'c', 'y'
    const inner = opType[1] === 'i';  // true: inner, false: around
    
    let range = null;
    
    switch(objChar) {
      case 'w':
        range = this.getWordRange(inner);
        break;
      case '"':
      case "'":
      case '`':
        range = this.getQuoteRange(objChar, inner);
        break;
      case '(':
      case ')':
      case 'b':
        range = this.getBracketRange('(', ')', inner);
        break;
      case '[':
      case ']':
        range = this.getBracketRange('[', ']', inner);
        break;
      case '{':
      case '}':
      case 'B':
        range = this.getBracketRange('{', '}', inner);
        break;
      case '<':
      case '>':
        range = this.getBracketRange('<', '>', inner);
        break;
    }
    
    if (range) {
      this.saveState();
      const text = this.editor.value.substring(range.start, range.end);
      
      if (op === 'y') {
        this.setRegister(text);
        this.showStatus('Yanked');
      } else {
        this.register = text;
        this.editor.value = this.editor.value.substring(0, range.start) + this.editor.value.substring(range.end);
        this.editor.selectionStart = range.start;
        this.editor.selectionEnd = range.start;
        this.setLastEdit(opType + objChar);
        
        if (op === 'c') {
          this.setMode('insert');
        }
        this.onInput();
      }
    }
  },
  
  getWordRange(inner) {
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    
    let start = pos;
    let end = pos;
    
    // 単語の境界を見つける
    while (start > 0 && /\w/.test(text[start - 1])) start--;
    while (end < text.length && /\w/.test(text[end])) end++;
    
    if (!inner) {
      // around: 後続の空白も含める
      while (end < text.length && /\s/.test(text[end]) && text[end] !== '\n') end++;
    }
    
    if (start === end) return null;
    return { start, end };
  },
  
  getQuoteRange(quote, inner) {
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    
    // 現在行を取得
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    let lineEnd = text.indexOf('\n', pos);
    if (lineEnd === -1) lineEnd = text.length;
    const line = text.substring(lineStart, lineEnd);
    const colPos = pos - lineStart;
    
    // 引用符のペアを探す
    let start = -1;
    let end = -1;
    let inQuote = false;
    let quoteStart = -1;
    
    for (let i = 0; i < line.length; i++) {
      if (line[i] === quote && (i === 0 || line[i-1] !== '\\')) {
        if (!inQuote) {
          quoteStart = i;
          inQuote = true;
        } else {
          if (colPos >= quoteStart && colPos <= i) {
            start = quoteStart;
            end = i;
            break;
          }
          inQuote = false;
        }
      }
    }
    
    if (start === -1 || end === -1) return null;
    
    if (inner) {
      return { start: lineStart + start + 1, end: lineStart + end };
    } else {
      return { start: lineStart + start, end: lineStart + end + 1 };
    }
  },
  
  getBracketRange(open, close, inner) {
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    
    // 対応する括弧を探す
    let depth = 0;
    let start = -1;
    let end = -1;
    
    // 開き括弧を後ろに探す
    for (let i = pos; i >= 0; i--) {
      if (text[i] === close) depth++;
      else if (text[i] === open) {
        if (depth === 0) {
          start = i;
          break;
        }
        depth--;
      }
    }
    
    if (start === -1) return null;
    
    // 閉じ括弧を前に探す
    depth = 0;
    for (let i = start; i < text.length; i++) {
      if (text[i] === open) depth++;
      else if (text[i] === close) {
        depth--;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }
    
    if (end === -1) return null;
    
    if (inner) {
      return { start: start + 1, end: end };
    } else {
      return { start: start, end: end + 1 };
    }
  },
  
  handleVisualMode(e) {
    const key = e.key;
    
    this.recordKey(key, e);
    
    if (key === 'Escape' || (e.ctrlKey && key === '[')) {
      this.setMode('normal');
      this.editor.selectionEnd = this.editor.selectionStart;
      this.visualCursor = null;
      this.visualStartLine = -1;
      return;
    }
    
    const start = Math.min(this.visualStart, this.editor.selectionStart);
    const end = Math.max(this.visualStart, this.editor.selectionEnd);
    
    // Get actual cursor position in visual mode
    let cursorPos;
    if (this.visualLine && this.visualCursor !== null) {
      // In visual line mode, use saved cursor position
      cursorPos = this.visualCursor;
    } else if (this.editor.selectionStart < this.visualStart) {
      cursorPos = this.editor.selectionStart;
    } else {
      cursorPos = this.editor.selectionEnd;
    }
    
    // For movement commands, set cursor position before moving
    const isMovementKey = ['h', 'l', 'j', 'k', 'w', 'b', '0', '$', 'G', '{', '}', 
                           'ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp'].includes(key);
    if (isMovementKey) {
      this.editor.selectionStart = cursorPos;
      this.editor.selectionEnd = cursorPos;
    }
    
    switch(key) {
      case 'h': case 'ArrowLeft': this.moveCursor(-1); break;
      case 'l': case 'ArrowRight': this.moveCursor(1); break;
      case 'j': case 'ArrowDown': this.moveVertical(1); break;
      case 'k': case 'ArrowUp': this.moveVertical(-1); break;
      case 'w': this.moveWord(1); break;
      case 'b': this.moveWord(-1); break;
      case '0': this.moveToLineStart(); break;
      case '$': this.moveToLineEnd(); break;
      case 'G': this.moveToEnd(); break;
      case 'g': this.pendingKey = 'g'; break;
      case '{': this.moveParagraph(-1); break;
      case '}': this.moveParagraph(1); break;
      
      // Indent
      case '>':
        this.saveState();
        this.indentSelection(1);
        this.setMode('normal');
        return;
      case '<':
        this.saveState();
        this.indentSelection(-1);
        this.setMode('normal');
        return;
        
      case 'd': case 'x':
        this.saveState();
        this.editor.selectionStart = start;
        this.editor.selectionEnd = end;
        this.register = this.editor.value.substring(start, end);
        this.deleteSelection();
        this.setMode('normal');
        return;
      case 'y':
        this.setRegister(this.editor.value.substring(start, end));
        this.setMode('normal');
        this.editor.selectionEnd = this.editor.selectionStart;
        this.showStatus('Yanked');
        return;
      case 'c':
        this.saveState();
        this.editor.selectionStart = start;
        this.editor.selectionEnd = end;
        this.register = this.editor.value.substring(start, end);
        this.deleteSelection();
        this.setMode('insert');
        return;
      case '~':
        this.saveState();
        this.toggleCaseSelection(start, end);
        this.setMode('normal');
        return;
      case 'U':
        this.saveState();
        this.changeCaseSelection(start, end, 'upper');
        this.setMode('normal');
        return;
      case 'u':
        this.saveState();
        this.changeCaseSelection(start, end, 'lower');
        this.setMode('normal');
        return;
    }
    
    // Update selection range
    if (this.mode === 'visual') {
      const newCurPos = this.editor.selectionStart;
      if (this.visualLine) {
        // Visual line mode: calculate selection based on line numbers
        this.visualCursor = newCurPos;
        const text = this.editor.value;
        const allLines = text.split('\n');
        
        // Calculate current cursor line
        const textBeforeCursor = text.substring(0, newCurPos);
        const currentLine = textBeforeCursor.split('\n').length - 1;
        
        // Determine start and end lines
        const fromLine = Math.min(this.visualStartLine, currentLine);
        const toLine = Math.max(this.visualStartLine, currentLine);
        
        // Calculate line start/end positions
        let startPos = 0;
        for (let i = 0; i < fromLine; i++) {
          startPos += allLines[i].length + 1;
        }
        let endPos = startPos;
        for (let i = fromLine; i <= toLine; i++) {
          endPos += allLines[i].length + 1;
        }
        // Adjust if last line has no newline
        if (endPos > text.length) endPos = text.length;
        
        this.editor.selectionStart = startPos;
        this.editor.selectionEnd = endPos;
      } else {
        this.editor.selectionStart = Math.min(this.visualStart, newCurPos);
        this.editor.selectionEnd = Math.max(this.visualStart, newCurPos);
      }
    }
    
    this.updateCursorPos();
  },
  
  handleCommandKey(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = this.commandInput.value;
      const prefix = this.commandPrefix.textContent;
      this.commandInput.value = '';
      this.setMode('normal');
      
      if (prefix === ':') this.executeCommand(cmd);
      else if (prefix === '/') this.search(cmd);
    } else if (e.key === 'Escape' || (e.ctrlKey && e.key === '[')) {
      e.preventDefault();
      this.commandInput.value = '';
      this.setMode('normal');
    }
  },
  
  executeCommand(cmd) {
    // 置換コマンドのパース
    const substituteMatch = cmd.match(/^(%)?s\/(.+?)\/(.*)\/([gic]*)$/);
    if (substituteMatch) {
      this.substitute(substituteMatch);
      return;
    }
    
    // 範囲指定置換
    const rangeSubMatch = cmd.match(/^(\d+),(\d+)s\/(.+?)\/(.*)\/([gic]*)$/);
    if (rangeSubMatch) {
      this.substituteRange(rangeSubMatch);
      return;
    }
    
    const parts = cmd.trim().split(/\s+/);
    const command = parts[0];
    
    switch(command) {
      case 'w':
        if (parts[1]) {
          // Filename specified - download directly
          this.downloadFile(parts[1]);
        } else {
          // No filename - overwrite current file (or show dialog)
          this.saveToCurrentFile();
        }
        break;
      case 'q':
        if (this.modified) {
          this.showStatus('Unsaved changes! Use :q! to force quit');
        } else {
          this.showStatus('Close the browser to exit');
        }
        break;
      case 'q!':
        this.showStatus('Close the browser to exit');
        break;
      case 'wq': case 'x':
        this.saveWithDialog();
        break;
      case 'e': case 'edit': case 'open':
        if (parts[1]) {
          // ファイル名指定 → New fileとして扱う
          if (this.modified) {
            this.showStatus('Unsaved changes! Use :e! to force');
          } else {
            this.editor.value = '';
            this.fileName.textContent = parts[1];
            this.currentFileName = parts[1];
            this.modified = false;
            this.updateFileStatus();
            this.onInput();
          }
        } else {
          // ファイル選択ダイアログを開く
          this.openWithDialog();
        }
        break;
      case 'e!':
        // 強制的に新規/開く
        if (parts[1]) {
          this.editor.value = '';
          this.fileName.textContent = parts[1];
          this.currentFileName = parts[1];
          this.modified = false;
          this.updateFileStatus();
          this.onInput();
        } else {
          this.openWithDialog();
        }
        break;
      case 'saveas': case 'sav':
        if (parts[1]) {
          this.downloadFile(parts[1]);
        } else {
          this.saveWithDialog();
        }
        break;
      case 'read': case 'r':
        // カーソル位置にファイルを挿入
        this.openFileDialog(true);
        break;
      case 'new':
        // New file
        if (this.modified) {
          this.showStatus('Unsaved changes!');
        } else {
          this.newFile();
        }
        break;
      case 'new!':
        this.newFile();
        break;
      case 'welcome':
        // Show welcome screen
        this.showWelcome();
        break;
      case 'set':
        if (parts[1] === 'nu' || parts[1] === 'number') {
          this.lineNumbers.style.display = 'block';
        } else if (parts[1] === 'nonu' || parts[1] === 'nonumber') {
          this.lineNumbers.style.display = 'none';
        } else if (parts[1] === 'vim') {
          this.setVimMode(true);
        } else if (parts[1] === 'novim') {
          this.setVimMode(false);
        } else if (parts[1] && parts[1].startsWith('theme=')) {
          const theme = parts[1].split('=')[1];
          if (['dark', 'light', 'original'].includes(theme)) {
            setTheme(theme);
          } else {
            this.showStatus('Invalid theme: choose dark, light, or original');
          }
        } else if (parts[1] === 'theme') {
          const current = document.documentElement.getAttribute('data-theme') || 'dark';
          this.showStatus(`Current theme: ${current}`);
        } else if (parts[1] && parts[1].startsWith('autosave=')) {
          const value = parts[1].split('=')[1];
          if (['off', '1s', '5s', '10s', '30s', '60s'].includes(value)) {
            this.autoSaveInterval = value;
            localStorage.setItem('vim-md-autosave', value);
            if (value === 'off') {
              this.showStatus('Auto-save: disabled');
            } else {
              this.showStatus(`Auto-save: ${value} interval`);
            }
          } else {
            this.showStatus('Invalid value: choose off, 1s, 5s, 10s, 30s, 60s');
          }
        } else if (parts[1] === 'autosave') {
          if (this.autoSaveInterval === 'off') {
            this.showStatus('Auto-save: disabled');
          } else {
            this.showStatus(`Auto-save: ${this.autoSaveInterval} interval`);
          }
        }
        break;
      case 'theme':
        if (parts[1] && ['dark', 'light', 'original'].includes(parts[1])) {
          setTheme(parts[1]);
        } else {
          this.showStatus('Usage: :theme dark|light|original');
        }
        break;
      case 'dark':
        setTheme('dark');
        break;
      case 'light':
        setTheme('light');
        break;
      case 'original':
        setTheme('original');
        break;
      case 'marks':
        this.showMarks();
        break;
      case 'help': case 'h':
        toggleHelp();
        break;
      case 'ls':
        this.save();
        this.showStatus('ローカルストレージにSaved');
        break;
      default:
        const lineNum = parseInt(command);
        if (!isNaN(lineNum)) {
          this.gotoLine(lineNum);
        } else {
          this.showStatus('Unknown command: ' + command);
        }
    }
  },
  
  // 置換コマンド
  substitute(match) {
    const [, global, pattern, replacement, flags] = match;
    const isGlobal = flags.includes('g');
    
    this.saveState();
    
    if (global === '%') {
      // 全置換
      const regex = new RegExp(pattern, isGlobal ? 'g' : '');
      const oldValue = this.editor.value;
      this.editor.value = oldValue.replace(regex, replacement);
      const count = (oldValue.match(new RegExp(pattern, 'g')) || []).length;
      this.showStatus(`${count} replacements made`);
    } else {
      // 現在行のみ
      const text = this.editor.value;
      const pos = this.editor.selectionStart;
      const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
      let lineEnd = text.indexOf('\n', pos);
      if (lineEnd === -1) lineEnd = text.length;
      
      const line = text.substring(lineStart, lineEnd);
      const regex = new RegExp(pattern, isGlobal ? 'g' : '');
      const newLine = line.replace(regex, replacement);
      
      this.editor.value = text.substring(0, lineStart) + newLine + text.substring(lineEnd);
      this.showStatus('Replaced');
    }
    
    this.onInput();
  },
  
  substituteRange(match) {
    const [, startLine, endLine, pattern, replacement, flags] = match;
    const isGlobal = flags.includes('g');
    const start = parseInt(startLine);
    const end = parseInt(endLine);
    
    this.saveState();
    
    const lines = this.editor.value.split('\n');
    const regex = new RegExp(pattern, isGlobal ? 'g' : '');
    let count = 0;
    
    for (let i = start - 1; i < end && i < lines.length; i++) {
      const matches = lines[i].match(new RegExp(pattern, 'g'));
      if (matches) count += matches.length;
      lines[i] = lines[i].replace(regex, replacement);
    }
    
    this.editor.value = lines.join('\n');
    this.showStatus(`${count} replacements made`);
    this.onInput();
  },
  
  showMarks() {
    const markList = Object.entries(this.marks)
      .map(([k, v]) => `'${k}: ${v}`)
      .join(', ');
    this.showStatus(markList || 'No marks');
  },
  
  // 行内検索
  findCharInLine(char, direction, beforeChar) {
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    let lineEnd = text.indexOf('\n', pos);
    if (lineEnd === -1) lineEnd = text.length;
    
    let newPos = -1;
    
    if (direction > 0) {
      // 前方検索
      for (let i = pos + 1; i < lineEnd; i++) {
        if (text[i] === char) {
          newPos = beforeChar ? i - 1 : i;
          break;
        }
      }
    } else {
      // 後方検索
      for (let i = pos - 1; i >= lineStart; i--) {
        if (text[i] === char) {
          newPos = beforeChar ? i + 1 : i;
          break;
        }
      }
    }
    
    if (newPos >= lineStart && newPos < lineEnd) {
      this.editor.selectionStart = newPos;
      this.editor.selectionEnd = newPos;
    }
  },
  
  repeatFindChar(directionMultiplier) {
    if (this.lastFindChar) {
      const direction = this.lastFindDirection * directionMultiplier;
      const beforeChar = this.lastFindType === 't';
      this.findCharInLine(this.lastFindChar, direction, beforeChar);
    }
  },
  
  // パラグラフ移動
  moveParagraph(direction) {
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    const lines = text.split('\n');
    
    // 現在の行番号を計算
    let currentLine = 0;
    let charCount = 0;
    for (let i = 0; i < lines.length; i++) {
      if (charCount + lines[i].length >= pos) {
        currentLine = i;
        break;
      }
      charCount += lines[i].length + 1;
    }
    
    let targetLine = currentLine;
    
    if (direction > 0) {
      // 次の空行を探す（}）
      // まず現在の空行ブロックをスキップ
      while (targetLine < lines.length && lines[targetLine].trim() === '') {
        targetLine++;
      }
      // 次の空行を見つける
      while (targetLine < lines.length && lines[targetLine].trim() !== '') {
        targetLine++;
      }
    } else {
      // 前の空行を探す（{）
      // まず現在行から1つ戻る
      targetLine--;
      // 現在の空行ブロックをスキップ
      while (targetLine >= 0 && lines[targetLine].trim() === '') {
        targetLine--;
      }
      // 前の空行を見つける
      while (targetLine >= 0 && lines[targetLine].trim() !== '') {
        targetLine--;
      }
      // 見つからなければ先頭へ
      if (targetLine < 0) targetLine = 0;
    }
    
    // targetLineが範囲外なら補正
    targetLine = Math.max(0, Math.min(targetLine, lines.length - 1));
    
    // 新しい位置を計算
    let newPos = 0;
    for (let i = 0; i < targetLine; i++) {
      newPos += lines[i].length + 1;
    }
    
    this.previousPosition = pos;
    this.editor.selectionStart = newPos;
    this.editor.selectionEnd = newPos;
    this.scrollToCursor();
    this.updateCursorPos();
  },
  
  // 括弧ジャンプ
  jumpToMatchingBracket() {
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    const char = text[pos];
    
    const pairs = { '(': ')', ')': '(', '[': ']', ']': '[', '{': '}', '}': '{', '<': '>', '>': '<' };
    const openBrackets = '([{<';
    
    if (!pairs[char]) {
      // 現在位置に括弧がない場合、行内で最初の括弧を探す
      const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
      let lineEnd = text.indexOf('\n', pos);
      if (lineEnd === -1) lineEnd = text.length;
      
      for (let i = pos; i < lineEnd; i++) {
        if (pairs[text[i]]) {
          this.editor.selectionStart = i;
          this.editor.selectionEnd = i;
          this.jumpToMatchingBracket();
          return;
        }
      }
      return;
    }
    
    const target = pairs[char];
    const isOpen = openBrackets.includes(char);
    let depth = 0;
    
    if (isOpen) {
      for (let i = pos; i < text.length; i++) {
        if (text[i] === char) depth++;
        else if (text[i] === target) {
          depth--;
          if (depth === 0) {
            this.previousPosition = pos;
            this.editor.selectionStart = i;
            this.editor.selectionEnd = i;
            this.scrollToCursor();
            return;
          }
        }
      }
    } else {
      for (let i = pos; i >= 0; i--) {
        if (text[i] === char) depth++;
        else if (text[i] === target) {
          depth--;
          if (depth === 0) {
            this.previousPosition = pos;
            this.editor.selectionStart = i;
            this.editor.selectionEnd = i;
            this.scrollToCursor();
            return;
          }
        }
      }
    }
  },
  
  // マクロ
  startRecordingMacro(name) {
    this.recordingMacro = name;
    this.macroBuffer = [];
    this.macroIndicator.classList.add('active');
    this.modeIndicator.classList.add('recording');
    this.showStatus(`マクロ '${name}' recording started`);
  },
  
  stopRecordingMacro() {
    this.macros[this.recordingMacro] = [...this.macroBuffer];
    this.showStatus(`マクロ '${this.recordingMacro}' recording complete (${this.macroBuffer.length} キー)`);
    this.recordingMacro = null;
    this.macroBuffer = [];
    this.macroIndicator.classList.remove('active');
    this.modeIndicator.classList.remove('recording');
  },
  
  playMacro(name) {
    const macro = this.macros[name];
    if (!macro || macro.length === 0) return;
    
    this.lastMacro = name;
    
    // マクロ再生中は記録しない
    const wasRecording = this.recordingMacro;
    this.recordingMacro = null;
    
    for (const keyInfo of macro) {
      const event = new KeyboardEvent('keydown', {
        key: keyInfo.key,
        ctrlKey: keyInfo.ctrlKey || false,
        shiftKey: keyInfo.shiftKey || false
      });
      
      if (this.mode === 'insert') {
        if (keyInfo.key === 'Escape') {
          this.exitInsertMode();
        } else if (keyInfo.key.length === 1) {
          this.insertText(keyInfo.key);
        }
      } else {
        this.handleNormalMode(event);
      }
    }
    
    this.recordingMacro = wasRecording;
  },
  
  // ドットリピート
  setLastEdit(type, char = null, count = 1) {
    this.lastEdit = { type, char, count, insertedText: '' };
  },
  
  repeatLastEdit(count) {
    if (!this.lastEdit) return;
    
    const repeat = count || this.lastEdit.count || 1;
    
    for (let i = 0; i < repeat; i++) {
      this.saveState();
      
      switch(this.lastEdit.type) {
        case 'x':
          this.deleteChar();
          break;
        case 'X':
          this.deleteCharBefore();
          break;
        case 'dd':
          this.deleteLine();
          break;
        case 'dw':
          this.deleteWord();
          break;
        case 'd$':
        case 'D':
          this.deleteToLineEnd();
          break;
        case 'd0':
          this.deleteToLineStart();
          break;
        case 'cc':
        case 'S':
          this.deleteLineContent();
          this.insertText(this.lastEdit.insertedText || '');
          break;
        case 'cw':
          this.deleteWord();
          this.insertText(this.lastEdit.insertedText || '');
          break;
        case 'C':
          this.deleteToLineEnd();
          this.insertText(this.lastEdit.insertedText || '');
          break;
        case 'r':
          this.replaceChar(this.lastEdit.char);
          break;
        case 's':
          this.deleteChar();
          this.insertText(this.lastEdit.insertedText || '');
          break;
        case 'o':
          this.moveToLineEnd();
          this.insertText('\n' + (this.lastEdit.insertedText || ''));
          break;
        case 'O':
          this.moveToLineStart();
          this.insertText((this.lastEdit.insertedText || '') + '\n');
          this.moveVertical(-1);
          break;
        case 'insert':
          this.insertText(this.lastEdit.insertedText || '');
          break;
        case '~':
          this.toggleCase();
          break;
        case '>>':
          this.indentLine(1);
          break;
        case '<<':
          this.indentLine(-1);
          break;
        case 'J':
          this.joinLines();
          break;
        // テキストオブジェクト
        case 'diw': case 'daw': case 'ciw': case 'caw':
        case 'di"': case 'da"': case "di'": case "da'":
        case 'di(': case 'da(': case 'di[': case 'da[':
        case 'di{': case 'da{': case 'di`': case 'da`':
          const op = this.lastEdit.type[0];
          const inner = this.lastEdit.type[1] === 'i';
          const objChar = this.lastEdit.type[2];
          this.handleTextObject(op + (inner ? 'i' : 'a'), objChar);
          if (op === 'c') {
            this.insertText(this.lastEdit.insertedText || '');
          }
          break;
      }
    }
  },
  
  // 大文字/小文字切替
  toggleCase() {
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    
    if (pos < text.length) {
      const char = text[pos];
      let newChar;
      if (char === char.toLowerCase()) {
        newChar = char.toUpperCase();
      } else {
        newChar = char.toLowerCase();
      }
      
      this.editor.value = text.substring(0, pos) + newChar + text.substring(pos + 1);
      this.editor.selectionStart = pos + 1;
      this.editor.selectionEnd = pos + 1;
      this.onInput();
    }
  },
  
  toggleCaseSelection(start, end) {
    const text = this.editor.value;
    let result = '';
    
    for (let i = start; i < end; i++) {
      const char = text[i];
      if (char === char.toLowerCase()) {
        result += char.toUpperCase();
      } else {
        result += char.toLowerCase();
      }
    }
    
    this.editor.value = text.substring(0, start) + result + text.substring(end);
    this.editor.selectionStart = start;
    this.editor.selectionEnd = start;
    this.onInput();
  },
  
  changeCaseSelection(start, end, caseType) {
    const text = this.editor.value;
    const selected = text.substring(start, end);
    const changed = caseType === 'upper' ? selected.toUpperCase() : selected.toLowerCase();
    
    this.editor.value = text.substring(0, start) + changed + text.substring(end);
    this.editor.selectionStart = start;
    this.editor.selectionEnd = start;
    this.onInput();
  },
  
  // インデント
  indentLine(direction) {
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    let lineEnd = text.indexOf('\n', pos);
    if (lineEnd === -1) lineEnd = text.length;
    
    const line = text.substring(lineStart, lineEnd);
    let newLine;
    
    if (direction > 0) {
      newLine = '  ' + line;
    } else {
      newLine = line.replace(/^  /, '').replace(/^\t/, '');
    }
    
    this.editor.value = text.substring(0, lineStart) + newLine + text.substring(lineEnd);
    this.editor.selectionStart = lineStart;
    this.editor.selectionEnd = lineStart;
    this.onInput();
  },
  
  indentSelection(direction) {
    const text = this.editor.value;
    const start = this.editor.selectionStart;
    const end = this.editor.selectionEnd;
    
    const lineStart = text.lastIndexOf('\n', start - 1) + 1;
    let lineEnd = text.indexOf('\n', end - 1);
    if (lineEnd === -1) lineEnd = text.length;
    
    const selectedLines = text.substring(lineStart, lineEnd).split('\n');
    const newLines = selectedLines.map(line => {
      if (direction > 0) {
        return '  ' + line;
      } else {
        return line.replace(/^  /, '').replace(/^\t/, '');
      }
    });
    
    this.editor.value = text.substring(0, lineStart) + newLines.join('\n') + text.substring(lineEnd);
    this.editor.selectionStart = lineStart;
    this.editor.selectionEnd = lineStart;
    this.onInput();
  },
  
  // 移動系
  moveCursor(delta) {
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    const newPos = Math.max(0, Math.min(text.length, pos + delta));
    this.editor.selectionStart = newPos;
    this.editor.selectionEnd = newPos;
  },
  
  moveVertical(direction) {
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    const lines = text.substring(0, pos).split('\n');
    const currentLine = lines.length - 1;
    const currentCol = lines[lines.length - 1].length;
    const allLines = text.split('\n');
    
    const targetLine = currentLine + direction;
    if (targetLine < 0 || targetLine >= allLines.length) return;
    
    let newPos = 0;
    for (let i = 0; i < targetLine; i++) newPos += allLines[i].length + 1;
    newPos += Math.min(currentCol, allLines[targetLine].length);
    
    this.editor.selectionStart = newPos;
    this.editor.selectionEnd = newPos;
  },
  
  moveWord(direction) {
    const text = this.editor.value;
    let pos = this.editor.selectionStart;
    
    if (direction > 0) {
      const match = text.substring(pos).match(/^\s*\S+\s*/);
      if (match) pos += match[0].length;
    } else {
      const before = text.substring(0, pos);
      const match = before.match(/\S+\s*$/);
      if (match) pos -= match[0].length;
    }
    
    this.editor.selectionStart = pos;
    this.editor.selectionEnd = pos;
  },
  
  moveWordEnd() {
    const text = this.editor.value;
    let pos = this.editor.selectionStart;
    const match = text.substring(pos + 1).match(/^\s*\S*/);
    if (match) pos += match[0].length;
    this.editor.selectionStart = pos;
    this.editor.selectionEnd = pos;
  },
  
  moveToLineStart() {
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    this.editor.selectionStart = lineStart;
    this.editor.selectionEnd = lineStart;
  },
  
  moveToLineEnd() {
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    let lineEnd = text.indexOf('\n', pos);
    if (lineEnd === -1) lineEnd = text.length;
    this.editor.selectionStart = lineEnd;
    this.editor.selectionEnd = lineEnd;
  },
  
  moveToFirstNonSpace() {
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    let lineEnd = text.indexOf('\n', pos);
    if (lineEnd === -1) lineEnd = text.length;
    const line = text.substring(lineStart, lineEnd);
    const match = line.match(/^\s*/);
    const newPos = lineStart + (match ? match[0].length : 0);
    this.editor.selectionStart = newPos;
    this.editor.selectionEnd = newPos;
  },
  
  moveToStart() { 
    this.previousPosition = this.editor.selectionStart;
    this.editor.selectionStart = 0; 
    this.editor.selectionEnd = 0;
    this.editor.scrollTop = 0;
  },
  
  moveToEnd() { 
    this.previousPosition = this.editor.selectionStart;
    const len = this.editor.value.length; 
    this.editor.selectionStart = len; 
    this.editor.selectionEnd = len;
    this.editor.scrollTop = this.editor.scrollHeight;
  },
  
  gotoLine(lineNum) {
    this.previousPosition = this.editor.selectionStart;
    const lines = this.editor.value.split('\n');
    const targetLine = Math.min(Math.max(1, lineNum), lines.length) - 1;
    let pos = 0;
    for (let i = 0; i < targetLine; i++) pos += lines[i].length + 1;
    this.editor.selectionStart = pos;
    this.editor.selectionEnd = pos;
    this.scrollToCursor();
    this.editor.focus();
    this.updateCursorPos();
  },
  
  gotoPosition(pos) {
    this.editor.selectionStart = pos;
    this.editor.selectionEnd = pos;
    this.scrollToCursor();
    this.editor.focus();
    this.updateCursorPos();
  },
  
  selectCurrentLine() {
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    let lineEnd = text.indexOf('\n', pos);
    if (lineEnd === -1) lineEnd = text.length;
    else lineEnd++;
    this.visualStart = lineStart;
    this.editor.selectionStart = lineStart;
    this.editor.selectionEnd = lineEnd;
  },
  
  // 編集系
  insertText(text) {
    const pos = this.editor.selectionStart;
    const before = this.editor.value.substring(0, pos);
    const after = this.editor.value.substring(this.editor.selectionEnd);
    this.editor.value = before + text + after;
    this.editor.selectionStart = pos + text.length;
    this.editor.selectionEnd = this.editor.selectionStart;
    this.onInput();
  },
  
  deleteChar() {
    const pos = this.editor.selectionStart;
    const text = this.editor.value;
    if (pos < text.length) {
      this.editor.value = text.substring(0, pos) + text.substring(pos + 1);
      this.editor.selectionStart = pos;
      this.editor.selectionEnd = pos;
      this.onInput();
    }
    this.editor.focus();
    this.updateCursorPos();
  },
  
  deleteCharBefore() {
    const pos = this.editor.selectionStart;
    if (pos > 0) {
      this.editor.value = this.editor.value.substring(0, pos - 1) + this.editor.value.substring(pos);
      this.editor.selectionStart = pos - 1;
      this.editor.selectionEnd = pos - 1;
      this.onInput();
    }
    this.editor.focus();
    this.updateCursorPos();
  },
  
  deleteLine() {
    const text = this.editor.value;
    if (text.length === 0) return;
    
    const pos = this.editor.selectionStart;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    let lineEnd = text.indexOf('\n', pos);
    
    if (lineEnd === -1) {
      lineEnd = text.length;
      if (lineStart > 0) {
        this.register = text.substring(lineStart, lineEnd) + '\n';
        this.editor.value = text.substring(0, lineStart - 1);
        this.editor.selectionStart = Math.max(0, lineStart - 1);
        this.editor.selectionEnd = this.editor.selectionStart;
      } else {
        this.register = text.substring(lineStart, lineEnd) + '\n';
        this.editor.value = '';
        this.editor.selectionStart = 0;
        this.editor.selectionEnd = 0;
      }
    } else {
      lineEnd++;
      this.register = text.substring(lineStart, lineEnd);
      this.editor.value = text.substring(0, lineStart) + text.substring(lineEnd);
      const newPos = Math.min(lineStart, this.editor.value.length);
      this.editor.selectionStart = newPos;
      this.editor.selectionEnd = newPos;
    }
    
    this.editor.focus();
    this.onInput();
    this.updateCursorPos();
  },
  
  deleteLineContent() {
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    let lineEnd = text.indexOf('\n', pos);
    if (lineEnd === -1) lineEnd = text.length;
    
    // インデントを保持
    const line = text.substring(lineStart, lineEnd);
    const indent = line.match(/^\s*/)[0];
    
    this.register = line;
    this.editor.value = text.substring(0, lineStart) + indent + text.substring(lineEnd);
    this.editor.selectionStart = lineStart + indent.length;
    this.editor.selectionEnd = lineStart + indent.length;
    this.onInput();
  },
  
  deleteWord() {
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    const match = text.substring(pos).match(/^\S*\s*/);
    if (match) {
      this.register = match[0];
      this.editor.value = text.substring(0, pos) + text.substring(pos + match[0].length);
      this.onInput();
    }
  },
  
  deleteToLineEnd() {
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    let lineEnd = text.indexOf('\n', pos);
    if (lineEnd === -1) lineEnd = text.length;
    
    this.register = text.substring(pos, lineEnd);
    this.editor.value = text.substring(0, pos) + text.substring(lineEnd);
    
    // Set cursor position (stay at deletion start)
    const newText = this.editor.value;
    const lineStart = newText.lastIndexOf('\n', pos - 1) + 1;
    let newLineEnd = newText.indexOf('\n', lineStart);
    if (newLineEnd === -1) newLineEnd = newText.length;
    
    // Adjust to not exceed line end
    const newPos = Math.min(pos, Math.max(lineStart, newLineEnd - 1));
    this.editor.selectionStart = Math.max(lineStart, newPos);
    this.editor.selectionEnd = Math.max(lineStart, newPos);
    
    this.onInput();
  },
  
  deleteToLineStart() {
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    
    this.register = text.substring(lineStart, pos);
    this.editor.value = text.substring(0, lineStart) + text.substring(pos);
    this.editor.selectionStart = lineStart;
    this.editor.selectionEnd = lineStart;
    this.onInput();
  },
  
  deleteSelection() {
    const start = this.editor.selectionStart;
    const end = this.editor.selectionEnd;
    this.editor.value = this.editor.value.substring(0, start) + this.editor.value.substring(end);
    this.editor.selectionStart = start;
    this.editor.selectionEnd = start;
    this.onInput();
  },
  
  replaceChar(char) {
    const pos = this.editor.selectionStart;
    const text = this.editor.value;
    if (pos < text.length) {
      this.editor.value = text.substring(0, pos) + char + text.substring(pos + 1);
      this.onInput();
    }
  },
  
  joinLines() {
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    let lineEnd = text.indexOf('\n', pos);
    if (lineEnd === -1) return;
    
    // 次の行の先頭の空白を取得
    const nextLineStart = lineEnd + 1;
    const nextLineMatch = text.substring(nextLineStart).match(/^\s*/);
    const nextLineIndent = nextLineMatch ? nextLineMatch[0].length : 0;
    
    this.editor.value = text.substring(0, lineEnd) + ' ' + text.substring(nextLineStart + nextLineIndent);
    this.editor.selectionStart = lineEnd;
    this.editor.selectionEnd = lineEnd;
    this.onInput();
  },
  
  // Yank/Paste
  // Set register and copy to clipboard
  setRegister(text) {
    this.register = text;
    navigator.clipboard.writeText(text).catch(() => {});
  },
  
  yankLine() {
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    let lineEnd = text.indexOf('\n', pos);
    if (lineEnd === -1) lineEnd = text.length;
    else lineEnd++;
    
    this.setRegister(text.substring(lineStart, lineEnd));
    this.showStatus('Line yanked');
  },
  
  yankWord() {
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    const match = text.substring(pos).match(/^\S+/);
    if (match) {
      this.setRegister(match[0]);
      this.showStatus('Yanked');
    }
  },
  
  paste() {
    if (!this.register) return;
    
    if (this.register.endsWith('\n')) {
      let lineEnd = this.editor.value.indexOf('\n', this.editor.selectionStart);
      if (lineEnd === -1) lineEnd = this.editor.value.length;
      this.editor.selectionStart = lineEnd;
      this.editor.selectionEnd = lineEnd;
      this.insertText('\n' + this.register.slice(0, -1));
    } else {
      this.moveCursor(1);
      this.insertText(this.register);
    }
  },
  
  pasteBefore() {
    if (!this.register) return;
    
    if (this.register.endsWith('\n')) {
      this.moveToLineStart();
      this.insertText(this.register);
      this.moveToLineStart();
    } else {
      this.insertText(this.register);
    }
  },
  
  // アンドゥ/リドゥ
  saveState() {
    this.undoStack.push({ text: this.editor.value, pos: this.editor.selectionStart });
    this.redoStack = [];
    if (this.undoStack.length > 100) this.undoStack.shift();
  },
  
  undo() {
    if (this.undoStack.length === 0) { this.showStatus('Nothing to undo'); return; }
    this.redoStack.push({ text: this.editor.value, pos: this.editor.selectionStart });
    const state = this.undoStack.pop();
    this.editor.value = state.text;
    this.editor.selectionStart = state.pos;
    this.editor.selectionEnd = state.pos;
    this.onInput();
    this.showStatus('Undone');
  },
  
  redo() {
    if (this.redoStack.length === 0) { this.showStatus('Nothing to redo'); return; }
    this.undoStack.push({ text: this.editor.value, pos: this.editor.selectionStart });
    const state = this.redoStack.pop();
    this.editor.value = state.text;
    this.editor.selectionStart = state.pos;
    this.editor.selectionEnd = state.pos;
    this.onInput();
    this.showStatus('Redone');
  },
  
  // 検索
  search(term) { this.searchTerm = term; this.findNext(); },
  
  searchWordUnderCursor() {
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    
    let start = pos;
    let end = pos;
    while (start > 0 && /\w/.test(text[start - 1])) start--;
    while (end < text.length && /\w/.test(text[end])) end++;
    
    if (start < end) {
      this.searchTerm = text.substring(start, end);
      this.findNext();
    }
  },
  
  findNext() {
    if (!this.searchTerm) return;
    const text = this.editor.value;
    const pos = this.editor.selectionStart + 1;
    let idx = text.indexOf(this.searchTerm, pos);
    
    if (idx === -1) idx = text.indexOf(this.searchTerm);
    
    if (idx !== -1) {
      this.previousPosition = this.editor.selectionStart;
      this.editor.selectionStart = idx;
      this.editor.selectionEnd = idx + this.searchTerm.length;
      this.scrollToCursor();
      this.showStatus('/' + this.searchTerm);
    } else {
      this.showStatus('Not found: ' + this.searchTerm);
    }
    this.editor.focus();
    this.updateCursorPos();
  },
  
  findPrev() {
    if (!this.searchTerm) return;
    const text = this.editor.value;
    const pos = this.editor.selectionStart - 1;
    let idx = text.lastIndexOf(this.searchTerm, pos);
    
    if (idx === -1) idx = text.lastIndexOf(this.searchTerm);
    
    if (idx !== -1) {
      this.previousPosition = this.editor.selectionStart;
      this.editor.selectionStart = idx;
      this.editor.selectionEnd = idx + this.searchTerm.length;
      this.scrollToCursor();
      this.showStatus('/' + this.searchTerm);
    } else {
      this.showStatus('Not found: ' + this.searchTerm);
    }
    this.editor.focus();
    this.updateCursorPos();
  },
  
  // Save
  save() {
    this.saveSessionData();
    this.modified = false;
    this.updateFileStatus();
    this.showStatus('Saved');
  },
  
  // Save session data
  saveSessionData() {
    // Save to sessionStorage (for tab restore)
    sessionStorage.setItem('vim-md-content-' + this.sessionId, this.editor.value);
    
    // Save to localStorage per session
    const sessionData = {
      content: this.editor.value,
      filename: this.currentFileName || 'Untitled',
      timestamp: Date.now()
    };
    localStorage.setItem('vim-md-session-' + this.sessionId, JSON.stringify(sessionData));
    
    // Update session list
    let sessions = [];
    try {
      sessions = JSON.parse(localStorage.getItem('vim-md-sessions') || '[]');
    } catch (e) {
      sessions = [];
    }
    if (!sessions.includes(this.sessionId)) {
      sessions.push(this.sessionId);
      localStorage.setItem('vim-md-sessions', JSON.stringify(sessions));
    }
    
    // Cleanup old sessions (older than 7 days)
    this.cleanupOldSessions();
  },
  
  // Remove old sessions
  cleanupOldSessions() {
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
    const now = Date.now();
    let sessions = [];
    try {
      sessions = JSON.parse(localStorage.getItem('vim-md-sessions') || '[]');
    } catch (e) {
      return;
    }
    
    const validSessions = sessions.filter(sid => {
      if (sid === this.sessionId) return true; // Keep current session
      try {
        const data = JSON.parse(localStorage.getItem('vim-md-session-' + sid) || '{}');
        if (data.timestamp && (now - data.timestamp) > maxAge) {
          localStorage.removeItem('vim-md-session-' + sid);
          return false;
        }
        return true;
      } catch (e) {
        localStorage.removeItem('vim-md-session-' + sid);
        return false;
      }
    });
    
    if (validSessions.length !== sessions.length) {
      localStorage.setItem('vim-md-sessions', JSON.stringify(validSessions));
    }
  },
  
  // Auto-save
  autoSave() {
    this.saveSessionData();
  },
  
  // Save to current file (overwrite)
  async saveToCurrentFile() {
    if (!this.currentFileHandle) {
      // No file handle - open save dialog
      return this.saveWithDialog();
    }
    
    try {
      const writable = await this.currentFileHandle.createWritable();
      await writable.write(this.editor.value);
      await writable.close();
      
      this.modified = false;
      this.updateFileStatus();
      this.showStatus(`"${this.currentFileName}" saved`);
    } catch (err) {
      // Permission error - fallback to save dialog
      if (err.name === 'NotAllowedError') {
        this.showStatus('No write permission. Saving as new file...');
        return this.saveWithDialog();
      }
      this.showStatus('Save failed');
      console.error('Save error:', err);
    }
  },
  
  // ダイアログで保存
  async saveWithDialog() {
    // File System Access API が使えるか確認
    if ('showSaveFilePicker' in window) {
      try {
        const handle = await window.showSaveFilePicker({
          suggestedName: this.currentFileName || 'document.md',
          types: [{
            description: 'Markdown Files',
            accept: { 'text/markdown': ['.md', '.markdown'] }
          }, {
            description: 'Text Files',
            accept: { 'text/plain': ['.txt'] }
          }]
        });
        
        const writable = await handle.createWritable();
        await writable.write(this.editor.value);
        await writable.close();
        
        this.currentFileName = handle.name;
        this.fileName.textContent = handle.name;
        this.currentFileHandle = handle;
        this.modified = false;
        this.updateFileStatus();
        this.showStatus(`"${handle.name}" をSaved`);
      } catch (err) {
        if (err.name !== 'AbortError') {
          this.showStatus('Save cancelled');
        }
      }
    } else {
      // フォールバック: プロンプトでファイル名を入力
      const filename = prompt('Enter filename:', this.currentFileName || 'document.md');
      if (filename) {
        this.downloadFile(filename);
      }
    }
  },
  
  // ダイアログでファイルを開く
  async openWithDialog() {
    // File System Access API
    if ('showOpenFilePicker' in window) {
      try {
        const [handle] = await window.showOpenFilePicker({
          types: [{
            description: 'Markdown Files',
            accept: { 'text/markdown': ['.md', '.markdown'] }
          }, {
            description: 'Text Files',
            accept: { 'text/plain': ['.txt'] }
          }],
          multiple: false
        });
        
        const file = await handle.getFile();
        const content = await file.text();
        
        this.undoStack = [];
        this.redoStack = [];
        this.editor.value = content;
        this.fileName.textContent = file.name;
        this.currentFileName = file.name;
        this.currentFileHandle = handle;
        this.modified = false;
        this.updateFileStatus();
        this.updateLineNumbers();
        this.updatePreview();
        this.updateToc();  // Update TOC
        this.editor.selectionStart = 0;
        this.editor.selectionEnd = 0;
        this.updateCursorPos();
        this.saveState();
        this.showStatus(`"${file.name}" opened`);
      } catch (err) {
        if (err.name !== 'AbortError') {
          this.showStatus('Failed to open file');
        }
      }
    } else {
      // Fallback: use input element
      this.openFileDialog(false);
    }
  },
  
  // New file
  newFile() {
    this.undoStack = [];
    this.redoStack = [];
    this.editor.value = '';
    this.fileName.textContent = 'Untitled';
    this.currentFileName = 'Untitled';
    this.currentFileHandle = null;
    this.modified = false;
    this.updateFileStatus();
    this.updateLineNumbers();
    this.updatePreview();
    this.updateToc();
    this.editor.selectionStart = 0;
    this.editor.selectionEnd = 0;
    this.updateCursorPos();
    this.saveState();
    this.showStatus('New file');
  },
  
  // ファイルダウンロード
  downloadFile(filename) {
    // 拡張子がなければ .md を追加
    if (!filename.includes('.')) {
      filename += '.md';
    }
    
    const blob = new Blob([this.editor.value], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    this.fileName.textContent = filename;
    this.currentFileName = filename;
    this.modified = false;
    this.updateFileStatus();
    this.showStatus(`"${filename}" をSaved`);
  },
  
  // ファイル選択ダイアログを開く
  openFileDialog(insertMode = false) {
    this.fileInsertMode = insertMode;
    this.fileInput.click();
  },
  
  // ファイルを開く
  handleFileOpen(e) {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target.result;
      
      if (this.fileInsertMode) {
        // Insert at cursor position
        this.saveState();
        this.insertText(content);
        this.updateToc();
        this.showStatus(`"${file.name}" inserted`);
      } else {
        // Replace entire file
        this.undoStack = [];
        this.redoStack = [];
        this.editor.value = content;
        this.fileName.textContent = file.name;
        this.currentFileName = file.name;
        this.modified = false;
        this.updateFileStatus();
        this.updateLineNumbers();
        this.updatePreview();
        this.updateToc();
        this.editor.selectionStart = 0;
        this.editor.selectionEnd = 0;
        this.updateCursorPos();
        this.saveState();
        this.showStatus(`"${file.name}" opened`);
      }
      
      this.fileInsertMode = false;
    };
    
    reader.onerror = () => {
      this.showStatus('Failed to read file');
    };
    
    reader.readAsText(file);
    
    // Reset to allow selecting the same file again
    this.fileInput.value = '';
  },
  
  // UI
  setMode(mode) {
    this.mode = mode;
    if (this.vimMode) {
      this.modeIndicator.textContent = mode.toUpperCase();
      this.modeIndicator.className = mode;
      this.modeIndicator.style.opacity = '';
      if (this.recordingMacro) this.modeIndicator.classList.add('recording');
    }
    
    if (mode === 'command') {
      this.commandLine.classList.remove('hidden');
      this.commandInput.focus();
    } else {
      this.commandLine.classList.add('hidden');
      this.editor.focus();
    }
    
    // VIMモードの場合のみreadOnlyを制御
    if (this.vimMode) {
      this.editor.readOnly = (mode !== 'insert');
    } else {
      this.editor.readOnly = false;
    }
    
    // カーソル表示の更新
    if (mode === 'insert') {
      this.editor.classList.add('insert-mode');
    } else {
      this.editor.classList.remove('insert-mode');
    }
    this.updateCursorOverlay();
  },
  
  onInput(e) {
    this.modified = true;
    this.updateFileStatus();
    
    // Light processing runs immediately
    this.updateCursorPos();
    
    // Heavy processing is debounced (150ms)
    clearTimeout(this.heavyUpdateTimer);
    this.heavyUpdateTimer = setTimeout(() => {
      this.updateLineNumbers();
      this.updatePreview();
      this.updateToc();
    }, 150);
    
    // Track text in insert mode
    if (this.mode === 'insert' && e && e.data) {
      this.lastEditText += e.data;
    }
    
    // Auto-save (configurable interval)
    clearTimeout(this.autoSaveTimer);
    const intervals = {
      'off': null,
      '1s': 1000,
      '5s': 5000,
      '10s': 10000,
      '30s': 30000,
      '60s': 60000
    };
    const interval = intervals[this.autoSaveInterval];
    if (interval) {
      this.autoSaveTimer = setTimeout(() => this.autoSave(), interval);
    }
  },
  
  updateCursorPos() {
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    const lines = text.substring(0, pos).split('\n');
    const line = lines.length;
    const col = lines[lines.length - 1].length + 1;
    this.cursorPos.textContent = `${line}:${col}`;
    this.updateCursorOverlay();
    
    // VIM mode: scroll to keep cursor visible
    if (this.vimMode) {
      this.scrollToCursor();
    }
    
    // プレビューを現在行に同期
    this.syncPreviewToLine(line - 1);
    
    // 目次のアクティブ状態を更新
    this.updateTocActive(line - 1);
  },
  
  updateCursorOverlay() {
    if (!this.cursorOverlay) return;
    
    // NOVIM mode: hide cursor overlay
    if (!this.vimMode) {
      this.cursorOverlay.style.display = 'none';
      return;
    }
    
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    
    // Calculate current line and column
    const textBeforeCursor = text.substring(0, pos);
    const lines = textBeforeCursor.split('\n');
    const currentLineIndex = lines.length - 1;
    const currentCol = lines[currentLineIndex];
    
    // Get line height and padding
    const style = getComputedStyle(this.editor);
    const lineHeight = parseFloat(style.lineHeight);
    const paddingTop = parseFloat(style.paddingTop);
    const paddingLeft = parseFloat(style.paddingLeft);
    
    // Measure character width
    this.measureSpan.textContent = currentCol || ' ';
    const charWidth = this.measureSpan.getBoundingClientRect().width / (currentCol.length || 1);
    const textWidth = currentCol.length * charWidth;
    
    // Calculate cursor position
    const top = paddingTop + (currentLineIndex * lineHeight) - this.editor.scrollTop;
    const left = paddingLeft + textWidth - this.editor.scrollLeft;
    
    // Character at cursor (for block cursor)
    const charAtCursor = text[pos] || ' ';
    const cursorWidth = charAtCursor === '\n' || charAtCursor === ' ' || pos >= text.length 
      ? charWidth 
      : charWidth;
    
    // Position overlay
    this.cursorOverlay.style.top = `${top}px`;
    this.cursorOverlay.style.left = `${left}px`;
    this.cursorOverlay.style.width = `${cursorWidth}px`;
    this.cursorOverlay.style.height = `${lineHeight}px`;
    
    // Set class based on mode
    this.cursorOverlay.className = this.mode;
    
    // Hide if off-screen
    if (top < 0 || top > this.editor.clientHeight) {
      this.cursorOverlay.style.display = 'none';
    } else {
      this.cursorOverlay.style.display = 'block';
    }
  },
  
  updateFileStatus() { this.fileStatus.textContent = this.modified ? '[+]' : ''; },
  
  // Show status message
  showStatus(message, duration = 2000) {
    const helpHint = document.getElementById('help-hint');
    if (helpHint) {
      const originalText = 'Press ? for help';
      helpHint.textContent = message;
      if (this.statusTimeout) {
        clearTimeout(this.statusTimeout);
      }
      this.statusTimeout = setTimeout(() => {
        helpHint.textContent = originalText;
      }, duration);
    }
  },
  
  updateLineNumbers() {
    const lines = this.editor.value.split('\n');
    let html = '';
    let inCodeBlock = false;
    
    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const line = lines[i];
      
      // コードブロックの開始/終了を追跡
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
      }
      
      // コードブロック外で見出し行かどうか判定
      const headingMatch = !inCodeBlock && line.match(/^(#{1,6})\s+.+/);
      
      if (headingMatch) {
        const level = headingMatch[1].length;
        html += `<span class="line-num heading-h${level}">${lineNum}</span>`;
      } else {
        html += `<span class="line-num">${lineNum}</span>`;
      }
    }
    
    this.lineNumbers.innerHTML = html;
  },
  
  updatePreview() {
    this.preview.innerHTML = MarkdownParser.parse(this.editor.value);
    this.renderMath();
    this.renderMermaid();
    this.setupHeadingFold();
    this.highlightCode();
  },
  
  // シンタックスハイライト
  highlightCode() {
    if (typeof hljs !== 'undefined') {
      this.preview.querySelectorAll('pre code').forEach(block => {
        hljs.highlightElement(block);
      });
    }
  },
  
  // 目次を更新
  updateToc() {
    if (!this.tocContent) return;
    
    const lines = this.editor.value.split('\n');
    let html = '';
    let inCodeBlock = false;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.trim().startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        continue;
      }
      if (inCodeBlock) continue;
      
      const match = line.match(/^(#{1,6})\s+(.+)/);
      if (match) {
        const level = match[1].length;
        const text = match[2].trim();
        html += `<div class="toc-item h${level}" data-line="${i}" title="${text}">${text}</div>`;
      }
    }
    
    this.tocContent.innerHTML = html || '<div style="padding: 0.5rem; color: var(--text-secondary); font-size: 0.85rem;">見出しがありません</div>';
    
    // クリックイベントを設定
    this.tocContent.querySelectorAll('.toc-item').forEach(item => {
      item.addEventListener('click', () => {
        const lineNum = parseInt(item.dataset.line);
        this.jumpToLine(lineNum);
      });
    });
  },
  
  // フォントサイズを適用
  applyFontSize() {
    const scale = this.fontSize / 100;
    const baseFontSize = 0.95 * scale;
    const basePreviewSize = 1 * scale;
    
    if (this.editor) {
      this.editor.style.fontSize = `${baseFontSize}rem`;
    }
    if (this.lineNumbers) {
      this.lineNumbers.style.fontSize = `${baseFontSize}rem`;
    }
    if (this.preview) {
      this.preview.style.fontSize = `${basePreviewSize}rem`;
    }
    
    if (this.fontSizeDisplay) {
      this.fontSizeDisplay.textContent = `${this.fontSize}%`;
    }
    
    // 見出しハイライトのフォントサイズも更新
    }
    
    // 初期化完了後のみ表示を更新
    if (this.initialized) {
      this.updateCursorOverlay();
    }
  },
  
  // フォントサイズを大きく
  increaseFontSize() {
    if (this.fontSize < 200) {
      this.fontSize += 10;
      this.applyFontSize();
      localStorage.setItem('vim-md-font-size', this.fontSize);
    }
  },
  
  // フォントサイズを小さく
  decreaseFontSize() {
    if (this.fontSize > 50) {
      this.fontSize -= 10;
      this.applyFontSize();
      localStorage.setItem('vim-md-font-size', this.fontSize);
    }
  },
  
  // VIMモードを設定
  setVimMode(enabled) {
    this.vimMode = enabled;
    localStorage.setItem('vim-md-vim-mode', enabled);
    if (enabled) {
      this.mode = 'normal';
      this.editor.classList.remove('insert-mode');
      this.showStatus('VIM mode enabled');
    } else {
      this.mode = 'insert';
      this.editor.classList.add('insert-mode');
      this.showStatus('Normal edit mode');
    }
    this.updateVimModeUI();
    this.updateCursorOverlay();
    this.editor.focus();
  },
  
  // Update VIM mode UI
  updateVimModeUI() {
    const btn = document.getElementById('btn-vim-mode');
    if (btn) {
      btn.textContent = this.vimMode ? 'VIM' : 'NOVIM';
      btn.classList.toggle('active', this.vimMode);
    }
    if (this.modeIndicator) {
      if (this.vimMode) {
        this.modeIndicator.textContent = this.mode.toUpperCase();
        this.modeIndicator.className = this.mode;
      } else {
        this.modeIndicator.textContent = 'EDIT';
        this.modeIndicator.className = 'edit-mode';
      }
    }
    // NOVIM mode: readOnly=false, show cursor
    if (this.editor) {
      if (this.vimMode) {
        this.editor.readOnly = (this.mode !== 'insert');
        if (this.mode === 'insert') {
          this.editor.classList.add('insert-mode');
        } else {
          this.editor.classList.remove('insert-mode');
        }
      } else {
        this.editor.readOnly = false;
        this.editor.classList.add('insert-mode');
      }
    }
  },
  
  // Toggle VIM mode
  toggleVimMode() {
    this.setVimMode(!this.vimMode);
  },
  
  // 目次の開閉
  toggleToc() {
    this.tocVisible = !this.tocVisible;
    
    if (this.tocVisible) {
      this.tocPane.classList.remove('collapsed');
      this.tocOpenBtn.classList.add('hidden');
    } else {
      this.tocPane.classList.add('collapsed');
      this.tocOpenBtn.classList.remove('hidden');
    }
  },
  
  // 指定行にジャンプ
  jumpToLine(lineNum) {
    const lines = this.editor.value.split('\n');
    
    // 行の先頭位置を計算
    let pos = 0;
    for (let i = 0; i < lineNum; i++) {
      pos += lines[i].length + 1;
    }
    
    // カーソルを移動
    this.editor.focus();
    this.editor.setSelectionRange(pos, pos);
    
    // エディタをスクロール
    const lineHeight = parseFloat(getComputedStyle(this.editor).lineHeight);
    const scrollTop = lineNum * lineHeight - this.editor.clientHeight / 3;
    this.editor.scrollTop = Math.max(0, scrollTop);
    
    // プレビューも同期
    this.syncPreviewToLine(lineNum);
    
    // 目次のアクティブ状態を更新
    this.updateTocActive(lineNum);
    
    // カーソル位置を更新
    this.updateCursorPos();
    this.updateCursorOverlay();
  },
  
  // プレビューを指定行に同期
  syncPreviewToLine(lineNum) {
    const lines = this.editor.value.split('\n');
    let targetHeadingText = null;
    let targetLevel = null;
    let inCodeBlock = false;
    
    // 指定行が見出しかチェック
    const currentLine = lines[lineNum];
    if (currentLine && /^#{1,6}\s+/.test(currentLine)) {
      targetHeadingText = currentLine.replace(/^#+\s+/, '').trim();
      targetLevel = currentLine.match(/^(#{1,6})/)[1].length;
    } else {
      // 指定行以前で最も近い見出しを探す
      for (let i = lineNum; i >= 0; i--) {
        const line = lines[i];
        if (line.trim().startsWith('```')) {
          inCodeBlock = !inCodeBlock;
        }
        if (!inCodeBlock && /^#{1,6}\s+/.test(line)) {
          targetHeadingText = line.replace(/^#+\s+/, '').trim();
          targetLevel = line.match(/^(#{1,6})/)[1].length;
          break;
        }
      }
    }
    
    if (targetHeadingText) {
      // プレビュー内で該当する見出しを探してスクロール
      const headings = this.preview.querySelectorAll('h1, h2, h3, h4, h5, h6');
      for (const h of headings) {
        const text = h.textContent.replace(/^[▼▶]\s*/, '').trim();
        if (text === targetHeadingText) {
          // プレビューコンテンツ内でのスクロール
          const previewContent = document.getElementById('preview-content');
          const rect = h.getBoundingClientRect();
          const containerRect = previewContent.getBoundingClientRect();
          const scrollOffset = rect.top - containerRect.top + previewContent.scrollTop - 50;
          previewContent.scrollTop = Math.max(0, scrollOffset);
          break;
        }
      }
    }
  },
  
  // 目次のアクティブ状態を更新
  updateTocActive(lineNum) {
    if (!this.tocContent) return;
    
    const items = this.tocContent.querySelectorAll('.toc-item');
    let activeItem = null;
    
    // 現在行以前で最も近い見出しをアクティブに
    items.forEach(item => {
      item.classList.remove('active');
      const itemLine = parseInt(item.dataset.line);
      if (itemLine <= lineNum) {
        activeItem = item;
      }
    });
    
    if (activeItem) {
      activeItem.classList.add('active');
      // 目次内でアクティブ項目が見えるようにスクロール
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  },
  
  // プレビューの見出し折り畳み機能
  setupHeadingFold() {
    const headings = this.preview.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    headings.forEach(heading => {
      // 折り畳みインジケーターを追加
      if (!heading.querySelector('.fold-indicator')) {
        const indicator = document.createElement('span');
        indicator.className = 'fold-indicator';
        indicator.textContent = '▼';
        heading.insertBefore(indicator, heading.firstChild);
      }
      
      // クリックイベント
      heading.style.cursor = 'pointer';
      heading.onclick = (e) => {
        e.stopPropagation();
        this.toggleHeadingFold(heading);
      };
    });
  },
  
  toggleHeadingFold(heading) {
    const level = parseInt(heading.tagName[1]);
    const indicator = heading.querySelector('.fold-indicator');
    const isFolded = heading.classList.contains('folded');
    
    if (isFolded) {
      // 展開する場合 - 直接の子レベルのみ表示
      heading.classList.remove('folded');
      indicator.textContent = '▼';
      
      let sibling = heading.nextElementSibling;
      let directChildLevel = null; // 直接の子レベル
      
      while (sibling) {
        if (/^H[1-6]$/.test(sibling.tagName)) {
          const siblingLevel = parseInt(sibling.tagName[1]);
          
          // 同レベル以上の見出しで停止
          if (siblingLevel <= level) break;
          
          // 最初に見つかった子見出しのレベルを直接の子レベルとする
          if (directChildLevel === null) {
            directChildLevel = siblingLevel;
          }
          
          // 直接の子レベルの見出しのみ表示
          if (siblingLevel === directChildLevel) {
            sibling.style.display = '';
            sibling.classList.remove('heading-hidden');
            // 子見出しは折りたたまれた状態を維持
          }
          // それ以外（孫以下）は非表示のまま
        } else {
          // 見出し以外の要素 - 直接の子レベルが見つかる前なら表示
          if (directChildLevel === null) {
            sibling.style.display = '';
            sibling.classList.remove('heading-hidden');
          }
        }
        sibling = sibling.nextElementSibling;
      }
    } else {
      // 折りたたむ場合
      heading.classList.add('folded');
      indicator.textContent = '▶';
      
      let sibling = heading.nextElementSibling;
      while (sibling) {
        if (/^H[1-6]$/.test(sibling.tagName)) {
          const siblingLevel = parseInt(sibling.tagName[1]);
          if (siblingLevel <= level) break;
        }
        sibling.style.display = 'none';
        sibling.classList.add('heading-hidden');
        sibling = sibling.nextElementSibling;
      }
    }
  },
  
  // 全ての見出しを折りたたむ
  foldAllHeadings() {
    const headings = this.preview.querySelectorAll('h1, h2, h3, h4, h5, h6');
    headings.forEach(heading => {
      if (!heading.classList.contains('folded')) {
        this.toggleHeadingFold(heading);
      }
    });
  },
  
  // 全ての見出しを展開する
  unfoldAllHeadings() {
    const headings = this.preview.querySelectorAll('h1, h2, h3, h4, h5, h6');
    // 逆順で展開（ネストされた見出しを正しく展開するため）
    const headingsArray = Array.from(headings).reverse();
    headingsArray.forEach(heading => {
      if (heading.classList.contains('folded')) {
        this.toggleHeadingFold(heading);
      }
    });
  },
  
  renderMermaid() {
    // Mermaidが読み込まれているか確認
    if (typeof mermaid === 'undefined') return;
    
    const mermaidDivs = this.preview.querySelectorAll('.mermaid');
    if (mermaidDivs.length === 0) return;
    
    // 各Mermaid要素にユニークIDを付与してレンダリング
    mermaidDivs.forEach((el, i) => {
      el.setAttribute('id', `mermaid-${Date.now()}-${i}`);
    });
    
    try {
      mermaid.run({
        nodes: mermaidDivs
      });
    } catch (e) {
      console.error('Mermaid rendering error:', e);
    }
  },
  
  renderMath() {
    // KaTeXが読み込まれているか確認
    if (typeof katex === 'undefined') return;
    
    // インライン数式をレンダリング
    const inlineMath = this.preview.querySelectorAll('.math-inline');
    inlineMath.forEach(el => {
      const formula = el.getAttribute('data-math');
      try {
        katex.render(formula, el, {
          throwOnError: false,
          displayMode: false
        });
      } catch (e) {
        el.innerHTML = `<span class="math-error">${formula}</span>`;
      }
    });
    
    // ブロック数式をレンダリング
    const blockMath = this.preview.querySelectorAll('.math-block');
    blockMath.forEach(el => {
      const formula = el.getAttribute('data-math');
      try {
        katex.render(formula, el, {
          throwOnError: false,
          displayMode: true
        });
      } catch (e) {
        el.innerHTML = `<span class="math-error">${formula}</span>`;
      }
    });
  },
  
  syncScroll() {
    const editor = this.editor;
    const preview = document.getElementById('preview-pane');
    const ratio = editor.scrollTop / (editor.scrollHeight - editor.clientHeight || 1);
    preview.scrollTop = ratio * (preview.scrollHeight - preview.clientHeight);
  },
  
  scrollHalfPage(direction) {
    const height = this.editor.clientHeight / 2;
    this.editor.scrollTop += height * direction;
    this.moveCursorToVisibleArea(direction);
  },
  
  scrollFullPage(direction) {
    const height = this.editor.clientHeight;
    this.editor.scrollTop += height * direction;
    this.moveCursorToVisibleArea(direction);
  },
  
  // カーソルを表示領域内に移動
  moveCursorToVisibleArea(direction) {
    const lineHeight = parseFloat(getComputedStyle(this.editor).lineHeight);
    const visibleTop = this.editor.scrollTop;
    const visibleBottom = visibleTop + this.editor.clientHeight;
    
    // 現在のカーソル行を計算
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    const linesBeforeCursor = text.substring(0, pos).split('\n').length - 1;
    const cursorTop = linesBeforeCursor * lineHeight;
    
    // カーソルが見えない場合、見える位置に移動
    if (cursorTop < visibleTop || cursorTop > visibleBottom - lineHeight) {
      const targetLine = Math.floor((direction > 0 ? visibleTop : visibleBottom - lineHeight) / lineHeight);
      const lines = text.split('\n');
      const clampedLine = Math.max(0, Math.min(targetLine, lines.length - 1));
      
      let newPos = 0;
      for (let i = 0; i < clampedLine; i++) {
        newPos += lines[i].length + 1;
      }
      
      this.editor.selectionStart = newPos;
      this.editor.selectionEnd = newPos;
      this.updateCursorPos();
    }
  },
  
  // Scroll to cursor position
  scrollToCursor() {
    const style = getComputedStyle(this.editor);
    const lineHeight = parseFloat(style.lineHeight);
    const paddingLeft = parseFloat(style.paddingLeft);
    const text = this.editor.value;
    
    // Visual mode: cursor is on opposite side of visualStart
    let pos;
    if (this.mode === 'visual' && this.visualStart !== undefined) {
      if (this.editor.selectionStart < this.visualStart) {
        pos = this.editor.selectionStart;
      } else {
        pos = this.editor.selectionEnd;
      }
    } else {
      pos = this.editor.selectionStart;
    }
    
    const lines = text.substring(0, pos).split('\n');
    const linesBeforeCursor = lines.length - 1;
    const cursorTop = linesBeforeCursor * lineHeight;
    
    // === Vertical scroll ===
    const visibleTop = this.editor.scrollTop;
    const visibleBottom = visibleTop + this.editor.clientHeight;
    
    if (cursorTop < visibleTop) {
      this.editor.scrollTop = cursorTop - this.editor.clientHeight / 4;
    } else if (cursorTop > visibleBottom - lineHeight * 2) {
      this.editor.scrollTop = cursorTop - this.editor.clientHeight * 3 / 4;
    }
    
    // === Horizontal scroll ===
    const currentLineText = lines[lines.length - 1];
    
    // Measure text width
    this.measureSpan.textContent = currentLineText || 'M';
    const textWidth = this.measureSpan.getBoundingClientRect().width;
    const cursorLeft = currentLineText.length > 0 ? textWidth : 0;
    
    const visibleLeft = this.editor.scrollLeft;
    const visibleRight = visibleLeft + this.editor.clientWidth - paddingLeft - 20;
    
    // Cursor beyond right edge
    if (cursorLeft > visibleRight) {
      this.editor.scrollLeft = cursorLeft - this.editor.clientWidth + paddingLeft + 100;
    }
    // Cursor before left edge
    else if (cursorLeft < visibleLeft) {
      this.editor.scrollLeft = Math.max(0, cursorLeft - 50);
    }
  },
  
  // z Enter, zt - cursor line to top
  scrollCursorToTop() {
    const lineHeight = parseFloat(getComputedStyle(this.editor).lineHeight);
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    const linesBeforeCursor = text.substring(0, pos).split('\n').length - 1;
    const cursorTop = linesBeforeCursor * lineHeight;
    
    this.editor.scrollTop = cursorTop;
    this.updateCursorPos();
  },
  
  // z. zz - cursor line to center
  scrollCursorToCenter() {
    const lineHeight = parseFloat(getComputedStyle(this.editor).lineHeight);
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    const linesBeforeCursor = text.substring(0, pos).split('\n').length - 1;
    const cursorTop = linesBeforeCursor * lineHeight;
    
    this.editor.scrollTop = cursorTop - (this.editor.clientHeight / 2) + lineHeight;
    this.updateCursorPos();
  },
  
  // z- zb - cursor line to bottom
  scrollCursorToBottom() {
    const lineHeight = parseFloat(getComputedStyle(this.editor).lineHeight);
    const text = this.editor.value;
    const pos = this.editor.selectionStart;
    const linesBeforeCursor = text.substring(0, pos).split('\n').length - 1;
    const cursorTop = linesBeforeCursor * lineHeight;
    
    this.editor.scrollTop = cursorTop - this.editor.clientHeight + lineHeight * 2;
    this.updateCursorPos();
  }
};
