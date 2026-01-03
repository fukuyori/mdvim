/**
 * VimEditor - Main Editor Class
 * Vim-style Markdown Editor
 */

import type {
  VimMode,
  Theme,
  AutoSaveInterval,
  HistoryEntry,
  Registers,
  Marks,
  Macros,
  MacroKey,
  EditorElements,
  FindDirection,
  FindType
} from '../types';

import { normalizeCRLF } from '../utils/string';
import { getElementById, debounce, setSelection } from '../utils/dom';
import { openFile, saveFile, readDroppedFile, isFileSystemAccessSupported } from '../utils/file';
import { markdownParser } from '../parser';
import { sessionManager } from '../storage';
import {
  translations,
  languageNames,
  detectLanguage,
  type Language,
  type TranslationStrings
} from '../i18n';
import {
  moveLeft, moveRight, moveUp, moveDown,
  moveToLineStart, moveToLineEnd, moveToFirstNonBlank,
  moveWordForward, moveWordBackward, moveWordEnd, moveWordEndBackward,
  moveToDocumentStart, moveToDocumentEnd, moveToLine,
  findCharInLine, moveToMatchingBracket,
  getCursorInfo
} from './VimMotions';
import {
  insertText as insertTextOp,
  deleteRange, deleteLine, deleteWord, deleteToLineEnd,
  yankLine, pasteAfter, pasteBefore, joinLines, toggleCase,
  indentLine, dedentLine,
  saveToHistory, undo, redo,
  saveToRegister, getFromRegister
} from './VimOperators';
import {
  executeCommand,
  registerBuiltinCommands,
  CommandHistory,
  type CommandContext
} from './VimCommands';

/** VimEditorクラス */
export class VimEditor {
  // DOM要素
  private elements!: EditorElements;
  
  // 状態
  private mode: VimMode = 'normal';
  private vimMode = true;  // デフォルトでVIMモードオン
  private wrapEnabled = false;  // ワードラップ
  private modified = false;
  private currentFileName = '無題';
  private currentFileHandle: FileSystemFileHandle | null = null;
  
  // ドキュメントメタデータ（MDebook互換）
  private documentMetadata: {
    title: string;
    author: string;
    language: string;
  } = {
    title: '',
    author: '',
    language: 'ja'
  };
  
  // 画像管理
  private uploadedImages: Map<string, string> = new Map();
  
  // Vim状態
  private registers: Registers = {};
  private marks: Marks = {};
  private macros: Macros = {};
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];
  
  private count = '';
  private pendingKey = '';
  private pendingOperator = '';
  private visualStart: number | null = null;
  private visualLine = false;
  private selectedRegister = '"';
  
  // 検索
  private searchTerm = '';
  private searchBackward = false;  // 後方検索フラグ
  
  // マクロ
  private recordingMacro: string | null = null;
  private macroBuffer: MacroKey[] = [];
  private lastMacro: string | null = null;
  
  // f/t検索
  private lastFindChar: string | null = null;
  private lastFindDirection: FindDirection = 1;
  private lastFindType: FindType = 'f';
  
  // ドット繰り返し用コマンド記録
  private lastCommand: {
    type: 'insert';        // i, a, o, O, I, A
    command: string;       // 実行したコマンド（i, a, o, O, I, A）
    text: string;          // 挿入したテキスト
    count: number;
  } | {
    type: 'delete';        // x, X, dd, dw, d$, D
    command: string;
    count: number;
  } | {
    type: 'change';        // cw, cc, c$, C, s, S
    command: string;
    text: string;          // 変更後のテキスト
    count: number;
  } | {
    type: 'replace';       // r
    char: string;
    count: number;
  } | {
    type: 'other';         // ~, J, >>, <<
    command: string;
    count: number;
  } | null = null;
  
  // 挿入モード中のテキスト記録用
  private insertStartPos = 0;
  private insertCommand = '';
  
  // 設定
  private fontSize = 100;
  private autoSaveInterval: AutoSaveInterval = '1s';
  private autoSaveTimer: ReturnType<typeof setInterval> | null = null;
  
  // 多言語対応
  private currentLanguage: Language = 'en';
  private t: TranslationStrings = translations['en'];
  
  // その他
  private commandHistory = new CommandHistory();
  private previousPosition: number | null = null;
  private measureSpan: HTMLSpanElement | null = null;
  private cursorUpdateScheduled = false;
  private isScrollSyncing = false;
  
  constructor() {
    this.initElements();
    this.loadSettings();
    this.setupEventListeners();
    this.loadFromStorage();
    this.registerCommands();
    this.startAutoSave();
    this.updateLineNumbers();
    this.updatePreview();
    this.updateCursorOverlay();
  }
  
  /** DOM要素を初期化 */
  private initElements(): void {
    this.elements = {
      editor: getElementById<HTMLTextAreaElement>('editor'),
      preview: getElementById('preview-content'),
      lineNumbers: getElementById('line-numbers'),
      modeIndicator: getElementById('vim-mode'),
      cursorPos: getElementById('cursor-pos'),
      commandLine: getElementById('command-line'),
      commandInput: getElementById<HTMLInputElement>('command-input'),
      commandPrefix: getElementById('command-prefix'),
      fileStatus: getElementById('file-status'),
      fileName: getElementById('file-name'),
      macroIndicator: getElementById('macro-indicator'),
      cursorOverlay: getElementById('cursor-overlay'),
      fileInput: getElementById<HTMLInputElement>('file-input'),
      fontSizeDisplay: getElementById('font-size-display'),
      tocPane: getElementById('toc-pane'),
      tocContent: getElementById('toc-content'),
      tocOpenBtn: getElementById('toc-open-btn')
    };
    
    // カーソル計測用の隠し要素
    this.measureSpan = document.createElement('span');
    this.measureSpan.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre;
      pointer-events: none;
    `;
    document.body.appendChild(this.measureSpan);
  }
  
  /** 設定を読み込み */
  private loadSettings(): void {
    const settings = sessionManager.loadSettings();
    this.fontSize = settings.fontSize;
    this.vimMode = settings.vimMode;
    this.autoSaveInterval = settings.autoSaveInterval;
    
    // 言語設定を読み込み
    const savedLang = localStorage.getItem('mdvim-language') as Language | null;
    this.currentLanguage = savedLang || detectLanguage();
    this.t = translations[this.currentLanguage];
    this.updateUIText();
    
    this.applyFontSize();
    this.updateVimModeButton();
    
    // VIMモードに応じてモード表示を更新
    if (this.vimMode) {
      this.mode = 'normal';
      this.elements.modeIndicator.textContent = 'NORMAL';
      this.elements.modeIndicator.className = '';
      this.elements.editor.classList.remove('insert-mode');
    } else {
      this.mode = 'insert';
      this.elements.modeIndicator.textContent = 'EDIT';
      this.elements.modeIndicator.className = 'edit-mode';
      this.elements.editor.classList.add('insert-mode');
    }
    
    // テーマ適用
    document.body.setAttribute('data-theme', settings.theme);
  }
  
  /** イベントリスナーを設定 */
  private setupEventListeners(): void {
    const editor = this.elements.editor;
    
    editor.addEventListener('keydown', (e) => this.handleKeydown(e));
    editor.addEventListener('input', () => this.onInput());
    editor.addEventListener('click', () => {
      this.updateCursorPos();
      this.updateCursorOverlay();
    });
    editor.addEventListener('scroll', () => this.syncScroll());
    
    // IME入力完了時の処理（f/t/r コマンドで全角文字をサポート）
    editor.addEventListener('compositionend', (e) => this.handleCompositionEnd(e));
    
    // selectionchangeイベントでカーソル位置変更を検知
    document.addEventListener('selectionchange', () => {
      if (document.activeElement === editor) {
        this.updateCursorPos();
        this.updateCursorOverlay();
      }
    });
    
    // プレビュークリック後にエディタにフォーカスを戻す
    this.elements.preview.addEventListener('click', () => {
      editor.focus();
    });
    
    // 目次ペインクリック後にエディタにフォーカスを戻す（個別エントリ以外）
    this.elements.tocPane.addEventListener('click', (e) => {
      // toc-entryのクリックは別途処理されるのでここでは無視
      if (!(e.target as HTMLElement).classList.contains('toc-entry')) {
        editor.focus();
      }
    });
    
    this.elements.commandInput.addEventListener('keydown', (e) => this.handleCommandKey(e));
    
    // グローバルキーボードショートカット
    document.addEventListener('keydown', (e) => {
      // Escapeでヘルプを閉じる
      if (e.key === 'Escape') {
        const helpModal = document.getElementById('help-modal');
        if (helpModal && !helpModal.classList.contains('hidden')) {
          helpModal.classList.add('hidden');
        }
      }
      
      // Ctrl+Shift+V: VIM/NOVIMモード切り替え
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        e.preventDefault();
        this.toggleVimMode();
      }
      
      // Ctrl+` : VIM/NOVIMモード切り替え
      if (e.ctrlKey && e.code === 'Backquote') {
        e.preventDefault();
        this.toggleVimMode();
      }
      
      // F2: VIM/NOVIMモード切り替え
      if (e.key === 'F2') {
        e.preventDefault();
        this.toggleVimMode();
      }
      
      // Ctrl+S: 保存
      if (e.ctrlKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        this.saveCurrentFile();
      }
      
      // Ctrl+O: ファイルを開く
      if (e.ctrlKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        this.openFileDialog();
      }
      
      // Ctrl+N: 新規ファイル
      if (e.ctrlKey && e.key.toLowerCase() === 'n') {
        e.preventDefault();
        this.newFile();
      }
    });
    
    // エディタスクロール時にプレビューを同期
    editor.addEventListener('scroll', () => {
      this.elements.lineNumbers.scrollTop = editor.scrollTop;
      this.updateCursorOverlay();
      this.syncScrollToPreview();
    });
    
    // プレビュースクロール時にエディタを同期
    this.elements.preview.addEventListener('scroll', () => {
      this.syncScrollToEditor();
    });
    
    // ペースト時のCRLF正規化 & 画像ペースト
    editor.addEventListener('paste', async (e) => {
      const clipboardData = e.clipboardData;
      if (!clipboardData) return;
      
      // 画像ペーストをチェック
      const items = clipboardData.items;
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            await this.handleImageFile(file);
          }
          return;
        }
      }
      
      // テキストペースト（CRLF正規化）
      const pastedText = clipboardData.getData('text');
      if (pastedText && pastedText.includes('\r')) {
        e.preventDefault();
        const normalized = normalizeCRLF(pastedText);
        
        const start = editor.selectionStart;
        const end = editor.selectionEnd;
        const before = editor.value.substring(0, start);
        const after = editor.value.substring(end);
        
        editor.value = before + normalized + after;
        
        const newPos = start + normalized.length;
        setSelection(editor, newPos);
        
        this.modified = true;
        this.updateFileStatus();
        this.updatePreview();
        this.updateLineNumbers();
      }
    });
    
    // ファイル選択
    this.elements.fileInput.addEventListener('change', (e) => this.handleFileOpen(e));
    
    // ドラッグ&ドロップ
    this.setupDragDrop();
    
    // リサイズ時に行番号を更新（ワードラップ対応）
    const resizeObserver = new ResizeObserver(() => {
      if (this.wrapEnabled) {
        this.updateLineNumbers();
      }
    });
    resizeObserver.observe(editor);
  }
  
  /** ドラッグ&ドロップを設定 */
  private setupDragDrop(): void {
    const body = document.body;
    
    body.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.stopPropagation();
      body.classList.add('drag-over');
    });
    
    body.addEventListener('dragleave', (e) => {
      e.preventDefault();
      e.stopPropagation();
      body.classList.remove('drag-over');
    });
    
    body.addEventListener('drop', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      body.classList.remove('drag-over');
      
      if (!e.dataTransfer) return;
      
      const files = e.dataTransfer.files;
      
      for (const file of files) {
        // 画像ファイルの場合
        if (file.type.startsWith('image/')) {
          await this.handleImageFile(file);
          continue;
        }
        
        // .mdvimファイルの場合
        if (file.name.endsWith('.mdvim')) {
          await this.loadMdvimFile(file);
          continue;
        }
        
        // .docxファイルの場合
        if (file.name.endsWith('.docx')) {
          await this.importFromDocx(file);
          continue;
        }
        
        // .htmlファイルの場合
        if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
          await this.importFromHtmlFile(file);
          continue;
        }
        
        // その他のテキストファイル
        const result = await readDroppedFile(e.dataTransfer);
        if (result) {
          this.uploadedImages.clear();
          this.elements.editor.value = result.content;
          this.currentFileName = result.name;
          this.elements.fileName.textContent = result.name;
          this.currentFileHandle = result.handle || null;
          this.modified = false;
          this.updateFileStatus();
          this.updateLineNumbers();
          this.updatePreview();
          this.updateToc();
          this.showStatus(`${result.name} - ${this.t.opened}`);
          this.elements.editor.focus();
        }
      }
    });
  }
  
  /** DOCXファイルをインポート */
  private async importFromDocx(file: File): Promise<void> {
    try {
      if (typeof mammoth === 'undefined') {
        this.showStatus('mammoth library not loaded', true);
        return;
      }
      
      this.showStatus('Importing DOCX...');
      
      const arrayBuffer = await file.arrayBuffer();
      
      // 画像を抽出して保存
      const imageMap = new Map<string, string>();
      let imageCounter = 0;
      
      const result = await mammoth.convertToHtml(
        { arrayBuffer },
        {
          convertImage: mammoth.images.imgElement(async (image) => {
            const base64 = await image.read('base64');
            const ext = image.contentType.split('/')[1] || 'png';
            const filename = `docx_img_${++imageCounter}.${ext}`;
            const dataUrl = `data:${image.contentType};base64,${base64}`;
            imageMap.set(filename, dataUrl);
            return { src: `images/${filename}` };
          })
        }
      );
      
      // HTML→Markdown変換
      const markdown = this.htmlToMarkdown(result.value);
      
      // 画像をuploadedImagesに追加
      this.uploadedImages.clear();
      imageMap.forEach((dataUrl, filename) => {
        this.uploadedImages.set(filename, dataUrl);
      });
      
      // エディタに設定
      this.elements.editor.value = markdown;
      this.currentFileName = file.name.replace(/\.docx$/i, '.md');
      this.elements.fileName.textContent = this.currentFileName;
      this.currentFileHandle = null;
      this.modified = true;
      this.updateFileStatus();
      this.updateLineNumbers();
      this.updatePreview();
      this.updateToc();
      
      const imgMsg = imageMap.size > 0 ? ` (${imageMap.size} images)` : '';
      this.showStatus(`Imported: ${file.name}${imgMsg}`);
    } catch (err) {
      this.showStatus('DOCX import failed', true);
      console.error(err);
    }
  }
  
  /** HTMLファイルをインポート */
  private async importFromHtmlFile(file: File): Promise<void> {
    try {
      const html = await file.text();
      await this.importFromHtml(html, file.name);
    } catch (err) {
      this.showStatus('HTML import failed', true);
      console.error(err);
    }
  }
  
  /** HTMLをMarkdownに変換してインポート */
  private async importFromHtml(html: string, sourceName?: string): Promise<void> {
    try {
      if (typeof TurndownService === 'undefined') {
        this.showStatus('Turndown library not loaded', true);
        return;
      }
      
      // 画像を抽出
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, 'text/html');
      const images = doc.querySelectorAll('img');
      let imageCounter = 0;
      
      // Base64画像を抽出してuploadedImagesに保存
      this.uploadedImages.clear();
      images.forEach((img) => {
        const src = img.getAttribute('src');
        if (src && src.startsWith('data:image/')) {
          const match = src.match(/^data:image\/(\w+);base64,/);
          if (match) {
            const ext = match[1];
            const filename = `html_img_${++imageCounter}.${ext}`;
            this.uploadedImages.set(filename, src);
            img.setAttribute('src', `images/${filename}`);
          }
        }
      });
      
      // HTML→Markdown変換
      const markdown = this.htmlToMarkdown(doc.body.innerHTML);
      
      // エディタに設定
      this.elements.editor.value = markdown;
      if (sourceName) {
        this.currentFileName = sourceName.replace(/\.html?$/i, '.md');
        this.elements.fileName.textContent = this.currentFileName;
      }
      this.currentFileHandle = null;
      this.modified = true;
      this.updateFileStatus();
      this.updateLineNumbers();
      this.updatePreview();
      this.updateToc();
      
      const imgMsg = this.uploadedImages.size > 0 ? ` (${this.uploadedImages.size} images)` : '';
      this.showStatus(`Imported HTML${imgMsg}`);
    } catch (err) {
      this.showStatus('HTML import failed', true);
      console.error(err);
    }
  }
  
  /** HTML→Markdown変換 */
  private htmlToMarkdown(html: string): string {
    const turndownService = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      fence: '```',
      bulletListMarker: '-',
      strongDelimiter: '**',
      emDelimiter: '*'
    });
    
    // テーブル対応
    turndownService.addRule('table', {
      filter: 'table',
      replacement: function(content, node) {
        const table = node as HTMLTableElement;
        const rows: string[][] = [];
        
        table.querySelectorAll('tr').forEach((tr) => {
          const cells: string[] = [];
          tr.querySelectorAll('th, td').forEach((cell) => {
            cells.push(cell.textContent?.trim() || '');
          });
          if (cells.length > 0) {
            rows.push(cells);
          }
        });
        
        if (rows.length === 0) return '';
        
        const colCount = Math.max(...rows.map(r => r.length));
        let md = '\n';
        
        // ヘッダー行
        md += '| ' + rows[0].map(c => c || ' ').join(' | ') + ' |\n';
        md += '| ' + Array(colCount).fill('---').join(' | ') + ' |\n';
        
        // データ行
        for (let i = 1; i < rows.length; i++) {
          md += '| ' + rows[i].map(c => c || ' ').join(' | ') + ' |\n';
        }
        
        return md + '\n';
      }
    });
    
    // コードブロック対応
    turndownService.addRule('pre', {
      filter: 'pre',
      replacement: function(content, node) {
        const code = node.querySelector('code');
        const lang = code?.className.match(/language-(\w+)/)?.[1] || '';
        const text = code?.textContent || node.textContent || '';
        return '\n```' + lang + '\n' + text.trim() + '\n```\n';
      }
    });
    
    return turndownService.turndown(html).trim();
  }
  
  /** URLからインポート */
  private async importFromUrl(url: string): Promise<void> {
    try {
      this.showStatus('Fetching URL...');
      
      // CORSプロキシを使用
      const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
      
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const contentType = response.headers.get('content-type') || '';
      const text = await response.text();
      
      if (contentType.includes('text/html') || text.trim().startsWith('<!') || text.trim().startsWith('<html')) {
        // HTML→Markdown変換
        await this.importFromHtml(text, url);
      } else if (contentType.includes('text/markdown') || url.endsWith('.md')) {
        // Markdownファイル
        this.uploadedImages.clear();
        this.elements.editor.value = text;
        this.currentFileName = url.split('/').pop() || 'imported.md';
        this.elements.fileName.textContent = this.currentFileName;
        this.currentFileHandle = null;
        this.modified = true;
        this.updateFileStatus();
        this.updateLineNumbers();
        this.updatePreview();
        this.updateToc();
        this.showStatus(`Imported: ${this.currentFileName}`);
      } else {
        // プレーンテキスト
        this.uploadedImages.clear();
        this.elements.editor.value = text;
        this.currentFileName = 'imported.md';
        this.elements.fileName.textContent = this.currentFileName;
        this.modified = true;
        this.updateFileStatus();
        this.updateLineNumbers();
        this.updatePreview();
        this.updateToc();
        this.showStatus('Imported as plain text');
      }
    } catch (err) {
      this.showStatus(`Import failed: ${err}`, true);
      console.error(err);
    }
  }
  
  /** クリップボードのHTMLをインポート */
  private async importFromClipboard(): Promise<void> {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        if (item.types.includes('text/html')) {
          const blob = await item.getType('text/html');
          const html = await blob.text();
          await this.importFromHtml(html, 'clipboard');
          return;
        }
      }
      this.showStatus('No HTML in clipboard', true);
    } catch (err) {
      this.showStatus('Clipboard access denied', true);
      console.error(err);
    }
  }
  
  /** ファイル選択ダイアログでインポート */
  private openImportDialog(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.docx,.html,.htm';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      
      if (file.name.endsWith('.docx')) {
        await this.importFromDocx(file);
      } else if (file.name.endsWith('.html') || file.name.endsWith('.htm')) {
        await this.importFromHtmlFile(file);
      }
    };
    input.click();
  }

  /** 画像ファイルを処理 */
  private async handleImageFile(file: File): Promise<void> {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const filename = this.generateImageName(file.name);
        this.uploadedImages.set(filename, dataUrl);
        
        // エディタに画像参照を挿入
        const editor = this.elements.editor;
        const pos = editor.selectionStart;
        const before = editor.value.substring(0, pos);
        const after = editor.value.substring(pos);
        const imageMarkdown = `![${file.name}](images/${filename})`;
        
        editor.value = before + imageMarkdown + after;
        const newPos = pos + imageMarkdown.length;
        setSelection(editor, newPos);
        
        this.modified = true;
        this.updateFileStatus();
        this.updatePreview();
        this.updateLineNumbers();
        this.showStatus(`Image added: ${filename}`);
        resolve();
      };
      reader.readAsDataURL(file);
    });
  }
  
  /** 画像ファイル名を生成 */
  private generateImageName(originalName: string): string {
    const ext = originalName.split('.').pop()?.toLowerCase() || 'png';
    const baseName = originalName.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_-]/g, '_');
    let name = `${baseName}.${ext}`;
    let counter = 1;
    
    while (this.uploadedImages.has(name)) {
      name = `${baseName}_${counter}.${ext}`;
      counter++;
    }
    
    return name;
  }
  
  /** コマンドを登録 */
  private registerCommands(): void {
    const context: CommandContext = {
      editor: this.elements.editor,
      saveState: () => this.saveState(),
      updatePreview: () => this.updatePreview(),
      gotoLine: (line) => this.gotoLine(line),
      showStatus: (msg, isError) => this.showStatus(msg, isError),
      openFile: () => this.openFileDialog(),
      saveFile: () => this.saveCurrentFile(),
      newFile: () => this.newFile(),
      setTheme: (theme) => this.setTheme(theme as Theme),
      setVimMode: (enabled) => this.setVimModeEnabled(enabled),
      setWrap: (enabled) => this.setWrapEnabled(enabled),
      quit: () => this.quit(),
      exportAs: (format) => this.exportAs(format),
      getImageCount: () => this.uploadedImages.size,
      importFromUrl: (url) => this.importFromUrl(url),
      importFromClipboard: () => this.importFromClipboard(),
      openImportDialog: () => this.openImportDialog()
    };
    
    registerBuiltinCommands(context);
  }
  
  /** ストレージから読み込み */
  private loadFromStorage(): void {
    const session = sessionManager.loadSession();
    if (session) {
      this.elements.editor.value = session.content;
      this.currentFileName = session.filename;
      this.elements.fileName.textContent = session.filename;
      this.showStatus('セッションを復元しました');
    } else {
      this.elements.editor.value = this.getWelcomeContent();
    }
  }
  
  /** ウェルカムコンテンツ */
  private getWelcomeContent(): string {
    return `# Welcome to mdvim!

Edit Markdown with Vim-style keybindings.

## Quick Start

- \`:help\` to show help
- \`:w\` to save
- \`:e\` to open file

## Features

- Real-time preview
- Syntax highlighting
- KaTeX math support
- Mermaid diagram support

Give it a try!
`;
  }
  
  /** 自動保存を開始 */
  private startAutoSave(): void {
    if (this.autoSaveTimer) {
      clearInterval(this.autoSaveTimer);
    }
    
    if (this.autoSaveInterval === 'off') return;
    
    const intervals: Record<AutoSaveInterval, number> = {
      'off': 0,
      '1s': 1000,
      '5s': 5000,
      '10s': 10000,
      '30s': 30000,
      '60s': 60000
    };
    
    const ms = intervals[this.autoSaveInterval];
    if (ms > 0) {
      this.autoSaveTimer = setInterval(() => {
        this.saveSessionData();
      }, ms);
    }
  }
  
  /** セッションデータを保存 */
  private saveSessionData(): void {
    sessionManager.saveSession(this.elements.editor.value, this.currentFileName);
  }
  
  // ========== キーボード処理 ==========
  
  /** キーダウンハンドラ */
  private handleKeydown(e: KeyboardEvent): void {
    if (!this.vimMode) {
      // 通常編集モード
      if (e.key === 'Escape') {
        this.enterNormalMode();
      }
      return;
    }
    
    // マクロ記録
    if (this.recordingMacro && e.key !== 'q') {
      this.macroBuffer.push({
        key: e.key,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey
      });
    }
    
    switch (this.mode) {
      case 'normal':
        this.handleNormalMode(e);
        break;
      case 'insert':
        this.handleInsertMode(e);
        break;
      case 'visual':
        this.handleVisualMode(e);
        break;
      case 'command':
        // コマンドモードはcommandInputで処理
        break;
    }
    
    this.updateCursorPos();
    this.updateCursorOverlay();
  }
  
  /** IME入力完了ハンドラ（f/t/r コマンドで全角文字をサポート） */
  private handleCompositionEnd(e: CompositionEvent): void {
    const editor = this.elements.editor;
    const inputChar = e.data;
    
    if (!inputChar || inputChar.length === 0) return;
    
    // 最初の1文字を使用
    const char = inputChar[0];
    
    // f/F/t/Tコマンドの処理
    if (this.pendingKey === 'f' || this.pendingKey === 'F' ||
        this.pendingKey === 't' || this.pendingKey === 'T') {
      const count = this.getCount();
      const direction: FindDirection = this.pendingKey === 'f' || this.pendingKey === 't' ? 1 : -1;
      const beforeChar = this.pendingKey === 't' || this.pendingKey === 'T';
      
      // IMEで入力された文字を削除（エディタに入力されてしまっているため）
      const pos = editor.selectionStart;
      editor.value = editor.value.substring(0, pos - inputChar.length) + editor.value.substring(pos);
      editor.selectionStart = pos - inputChar.length;
      editor.selectionEnd = pos - inputChar.length;
      
      if (findCharInLine(editor, char, direction, beforeChar, count)) {
        this.lastFindChar = char;
        this.lastFindDirection = direction;
        this.lastFindType = beforeChar ? 't' : 'f';
      }
      
      this.pendingKey = '';
      this.count = '';
      this.updateCursorPos();
      this.updateCursorOverlay();
      this.updatePreview();
      return;
    }
    
    // rコマンドの処理
    if (this.pendingKey === 'r') {
      // IMEで入力された文字は既にエディタに入力されている
      // その文字を使って置換を行う（入力された文字分を削除して、1文字置換を行う）
      const pos = editor.selectionStart;
      const targetPos = pos - inputChar.length;
      
      if (targetPos >= 0 && targetPos < editor.value.length) {
        // IME入力分を削除し、置換対象の1文字も削除して、新しい文字を挿入
        const before = editor.value.substring(0, targetPos);
        const after = editor.value.substring(targetPos + 1 + inputChar.length - 1);
        editor.value = before + char + after;
        editor.selectionStart = targetPos + 1;
        editor.selectionEnd = targetPos + 1;
      }
      
      this.pendingKey = '';
      this.count = '';
      this.updateCursorPos();
      this.updateCursorOverlay();
      this.updatePreview();
      return;
    }
  }

  /** ノーマルモード処理 */
  private handleNormalMode(e: KeyboardEvent): void {
    const key = e.key;
    const editor = this.elements.editor;
    
    // Ctrl系
    if (e.ctrlKey) {
      switch (key) {
        case 'r':
          e.preventDefault();
          this.redoAction();
          return;
        case 'f':
          e.preventDefault();
          this.pageDown();
          return;
        case 'b':
          e.preventDefault();
          this.pageUp();
          return;
        case 'd':
          e.preventDefault();
          this.halfPageDown();
          return;
        case 'u':
          e.preventDefault();
          this.halfPageUp();
          return;
        case '[':
          e.preventDefault();
          this.enterNormalMode();
          return;
      }
    }
    
    // 数字（カウント）- ただしf/F/t/T/r待機中は文字として扱う
    if (/^[1-9]$/.test(key) || (this.count && key === '0')) {
      // f/F/t/T/r待機中は数字も検索/置換対象の文字として扱う
      if (this.pendingKey === 'f' || this.pendingKey === 'F' ||
          this.pendingKey === 't' || this.pendingKey === 'T' ||
          this.pendingKey === 'r' || this.pendingKey === 'R') {
        // 下のpendingKey処理に任せる
      } else {
        this.count += key;
        e.preventDefault();
        return;
      }
    }
    
    // ペンディングオペレータの処理
    if (this.pendingOperator) {
      this.handlePendingOperator(e);
      return;
    }
    
    // レジスタ選択
    if (this.pendingKey === '"') {
      this.selectedRegister = key;
      this.pendingKey = '';
      e.preventDefault();
      return;
    }
    
    // マーク設定
    if (this.pendingKey === 'm') {
      if (/[a-zA-Z]/.test(key)) {
        this.marks[key] = editor.selectionStart;
        this.showStatus(this.t.markSet.replace('%s', key));
      }
      this.pendingKey = '';
      e.preventDefault();
      return;
    }
    
    // マークへジャンプ
    if (this.pendingKey === "'" || this.pendingKey === '`') {
      if (key === "'") {
        // '' で前の位置へ
        if (this.previousPosition !== null) {
          const currentPos = editor.selectionStart;
          setSelection(editor, this.previousPosition);
          this.previousPosition = currentPos;
        }
      } else if (this.marks[key] !== undefined) {
        this.previousPosition = editor.selectionStart;
        setSelection(editor, this.marks[key]);
        if (this.pendingKey === "'") {
          moveToFirstNonBlank(editor);
        }
      }
      this.pendingKey = '';
      e.preventDefault();
      return;
    }
    
    // f/F/t/T
    if (this.pendingKey === 'f' || this.pendingKey === 'F' ||
        this.pendingKey === 't' || this.pendingKey === 'T') {
      // 修飾キーだけの場合は無視
      if (key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta') {
        return;
      }
      const count = this.getCount();
      const direction: FindDirection = this.pendingKey === 'f' || this.pendingKey === 't' ? 1 : -1;
      const beforeChar = this.pendingKey === 't' || this.pendingKey === 'T';
      
      if (findCharInLine(editor, key, direction, beforeChar, count)) {
        this.lastFindChar = key;
        this.lastFindDirection = direction;
        this.lastFindType = beforeChar ? 't' : 'f';
      }
      
      this.pendingKey = '';
      this.count = '';
      e.preventDefault();
      return;
    }
    
    // rで1文字置換
    if (this.pendingKey === 'r') {
      // 修飾キーだけの場合は無視
      if (key === 'Shift' || key === 'Control' || key === 'Alt' || key === 'Meta') {
        return;
      }
      if (key.length === 1) {
        this.saveState();
        const pos = editor.selectionStart;
        const count = this.getCount();
        for (let i = 0; i < count && pos + i < editor.value.length; i++) {
          editor.value = editor.value.substring(0, pos + i) + key + editor.value.substring(pos + i + 1);
        }
        setSelection(editor, pos);
        this.lastCommand = { type: 'replace', char: key, count };
        this.updatePreview();
      }
      this.pendingKey = '';
      this.count = '';
      e.preventDefault();
      return;
    }
    
    // マクロ
    if (this.pendingKey === 'q') {
      if (/[a-zA-Z]/.test(key)) {
        if (this.recordingMacro) {
          this.stopMacroRecording();
        } else {
          this.startMacroRecording(key);
        }
      }
      this.pendingKey = '';
      e.preventDefault();
      return;
    }
    
    if (this.pendingKey === '@') {
      if (key === '@' && this.lastMacro) {
        this.playMacro(this.lastMacro);
      } else if (/[a-zA-Z]/.test(key) && this.macros[key]) {
        this.playMacro(key);
        this.lastMacro = key;
      }
      this.pendingKey = '';
      e.preventDefault();
      return;
    }
    
    e.preventDefault();
    const count = this.getCount();
    
    // gコマンド
    if (this.pendingKey === 'g') {
      switch (key) {
        case 'g': moveToDocumentStart(editor); break;
        case 'e': moveWordEndBackward(editor, count); break; // ge - 前の単語末尾へ
        case 'j': this.moveDisplayLine(1, count); break;  // gj - 表示行で下へ
        case 'k': this.moveDisplayLine(-1, count); break; // gk - 表示行で上へ
      }
      this.pendingKey = '';
      this.count = '';
      return;
    }
    
    // zコマンド（スクロール）
    if (this.pendingKey === 'z') {
      switch (key) {
        case 'z':
        case '.':
          this.scrollCursorToCenter();
          break;
        case 't':
        case 'Enter':
          this.scrollCursorToTop();
          break;
        case 'b':
        case '-':
          this.scrollCursorToBottom();
          break;
      }
      this.pendingKey = '';
      this.count = '';
      return;
    }
    
    switch (key) {
      // 移動（Vimキー）
      case 'h': moveLeft(editor, count); break;
      case 'j': moveDown(editor, count); break;
      case 'k': moveUp(editor, count); break;
      case 'l': moveRight(editor, count); break;
      
      // 移動（矢印キー）
      case 'ArrowLeft': moveLeft(editor, count); break;
      case 'ArrowDown': moveDown(editor, count); break;
      case 'ArrowUp': moveUp(editor, count); break;
      case 'ArrowRight': moveRight(editor, count); break;
      
      case 'w': moveWordForward(editor, count); break;
      case 'b': moveWordBackward(editor, count); break;
      case 'e': moveWordEnd(editor, count); break;
      case '0': moveToLineStart(editor); break;
      case '$': moveToLineEnd(editor); break;
      case '^': moveToFirstNonBlank(editor); break;
      case 'G': 
        if (this.count) {
          moveToLine(editor, parseInt(this.count));
        } else {
          moveToDocumentEnd(editor);
        }
        break;
      case '%': moveToMatchingBracket(editor); break;
      
      // 画面内移動
      case 'H': this.moveToScreenTop(); break;
      case 'M': this.moveToScreenMiddle(); break;
      case 'L': this.moveToScreenBottom(); break;
      
      // 挿入モード
      case 'i': this.enterInsertMode('i'); break;
      case 'I': moveToFirstNonBlank(editor); this.enterInsertMode('I'); break;
      case 'a': moveRight(editor); this.enterInsertMode('a'); break;
      case 'A': moveToLineEnd(editor); this.enterInsertMode('A'); break;
      case 'o': this.insertLineBelow(); break;
      case 'O': this.insertLineAbove(); break;
      
      // 編集
      case 'x': this.deleteChar(count); break;
      case 'X': this.deleteCharBefore(count); break;
      case 'p': this.pasteAfter(); break;
      case 'P': this.pasteBefore(); break;
      case 'u': this.undoAction(); break;
      case 'J': 
        this.saveState(); 
        joinLines(editor, count); 
        this.lastCommand = { type: 'other', command: 'J', count };
        this.updatePreview(); 
        break;
      case '~': 
        this.saveState(); 
        toggleCase(editor, count); 
        this.lastCommand = { type: 'other', command: '~', count };
        this.updatePreview(); 
        break;
      case '.': this.repeatLastEdit(); break;
      
      // オペレータ
      case 'd': this.pendingOperator = 'd'; break;
      case 'y': this.pendingOperator = 'y'; break;
      case 'c': this.pendingOperator = 'c'; break;
      case '>': this.pendingOperator = '>'; break;
      case '<': this.pendingOperator = '<'; break;
      
      // ペンディングキー
      case 'g': this.pendingKey = 'g'; break;
      case 'z': this.pendingKey = 'z'; break;
      case '"': this.pendingKey = '"'; break;
      case 'm': this.pendingKey = 'm'; break;
      case "'": this.pendingKey = "'"; break;
      case '`': this.pendingKey = '`'; break;
      case 'f': this.pendingKey = 'f'; break;
      case 'F': this.pendingKey = 'F'; break;
      case 't': this.pendingKey = 't'; break;
      case 'T': this.pendingKey = 'T'; break;
      case 'r': this.pendingKey = 'r'; break;
      case 'q': 
        if (this.recordingMacro) {
          this.stopMacroRecording();
        } else {
          this.pendingKey = 'q';
        }
        break;
      case '@': this.pendingKey = '@'; break;
      
      // ビジュアルモード
      case 'v': this.enterVisualMode(); break;
      case 'V': this.enterVisualLineMode(); break;
      
      // 検索
      case '/': this.startSearch(false); break;  // 前方検索
      case '?': this.startSearch(true); break;   // 後方検索
      case 'n': this.searchNext(); break;
      case 'N': this.searchPrev(); break;
      case '*': this.searchWordUnderCursor(); break;
      
      // コマンドモード
      case ':': this.enterCommandMode(); break;
      
      // f/t繰り返し
      case ';': 
        if (this.lastFindChar) {
          findCharInLine(editor, this.lastFindChar, this.lastFindDirection, this.lastFindType === 't', count);
        }
        break;
      case ',':
        if (this.lastFindChar) {
          const reverseDir: FindDirection = this.lastFindDirection === 1 ? -1 : 1;
          findCharInLine(editor, this.lastFindChar, reverseDir, this.lastFindType === 't', count);
        }
        break;
      
      // パラグラフ移動
      case '{': this.moveParagraphUp(count); break;
      case '}': this.moveParagraphDown(count); break;
      
      // D/C/Y/S
      case 'D': 
        this.saveState(); 
        deleteToLineEnd(editor); 
        saveToRegister(this.registers, '', '"', true); 
        this.lastCommand = { type: 'delete', command: 'D', count: 1 };
        this.updatePreview(); 
        break;
      case 'C': this.saveState(); deleteToLineEnd(editor); this.enterInsertMode('C'); break;
      case 'Y': saveToRegister(this.registers, yankLine(editor, count), this.selectedRegister); this.showStatus(this.t.yanked); break;
      case 'S': this.saveState(); this.clearLine(); this.enterInsertMode('S'); break;
    }
    
    this.count = '';
  }
  
  // ========== スクロール ==========
  
  /** カーソル行を画面中央に */
  private scrollCursorToCenter(): void {
    const editor = this.elements.editor;
    const lineHeight = parseFloat(getComputedStyle(editor).lineHeight);
    const text = editor.value;
    const pos = editor.selectionStart;
    const linesBeforeCursor = text.substring(0, pos).split('\n').length - 1;
    const cursorTop = linesBeforeCursor * lineHeight;
    
    editor.scrollTop = cursorTop - (editor.clientHeight / 2) + lineHeight;
    this.updateCursorPos();
    this.updateCursorOverlay();
  }
  
  /** カーソル行を画面上部に */
  private scrollCursorToTop(): void {
    const editor = this.elements.editor;
    const lineHeight = parseFloat(getComputedStyle(editor).lineHeight);
    const text = editor.value;
    const pos = editor.selectionStart;
    const linesBeforeCursor = text.substring(0, pos).split('\n').length - 1;
    const cursorTop = linesBeforeCursor * lineHeight;
    
    editor.scrollTop = cursorTop;
    this.updateCursorPos();
    this.updateCursorOverlay();
  }
  
  /** カーソル行を画面下部に */
  private scrollCursorToBottom(): void {
    const editor = this.elements.editor;
    const lineHeight = parseFloat(getComputedStyle(editor).lineHeight);
    const text = editor.value;
    const pos = editor.selectionStart;
    const linesBeforeCursor = text.substring(0, pos).split('\n').length - 1;
    const cursorTop = linesBeforeCursor * lineHeight;
    
    editor.scrollTop = cursorTop - editor.clientHeight + lineHeight * 2;
    this.updateCursorPos();
    this.updateCursorOverlay();
  }
  
  /** 画面最上行へ移動 (H) */
  private moveToScreenTop(): void {
    const editor = this.elements.editor;
    const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 20;
    const text = editor.value;
    const lines = text.split('\n');
    
    // 画面上部に表示されている行を計算
    const topLine = Math.floor(editor.scrollTop / lineHeight);
    const targetLine = Math.min(topLine, lines.length - 1);
    
    // その行の先頭に移動
    let pos = 0;
    for (let i = 0; i < targetLine; i++) {
      pos += lines[i].length + 1;
    }
    setSelection(editor, pos);
    moveToFirstNonBlank(editor);
  }
  
  /** 画面中央行へ移動 (M) */
  private moveToScreenMiddle(): void {
    const editor = this.elements.editor;
    const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 20;
    const text = editor.value;
    const lines = text.split('\n');
    
    // 画面中央に表示されている行を計算
    const topLine = Math.floor(editor.scrollTop / lineHeight);
    const visibleLines = Math.floor(editor.clientHeight / lineHeight);
    const middleLine = Math.min(topLine + Math.floor(visibleLines / 2), lines.length - 1);
    
    // その行の先頭に移動
    let pos = 0;
    for (let i = 0; i < middleLine; i++) {
      pos += lines[i].length + 1;
    }
    setSelection(editor, pos);
    moveToFirstNonBlank(editor);
  }
  
  /** 画面最下行へ移動 (L) */
  private moveToScreenBottom(): void {
    const editor = this.elements.editor;
    const lineHeight = parseFloat(getComputedStyle(editor).lineHeight) || 20;
    const text = editor.value;
    const lines = text.split('\n');
    
    // 画面下部に表示されている行を計算
    const topLine = Math.floor(editor.scrollTop / lineHeight);
    const visibleLines = Math.floor(editor.clientHeight / lineHeight);
    const bottomLine = Math.min(topLine + visibleLines - 1, lines.length - 1);
    
    // その行の先頭に移動
    let pos = 0;
    for (let i = 0; i < bottomLine; i++) {
      pos += lines[i].length + 1;
    }
    setSelection(editor, pos);
    moveToFirstNonBlank(editor);
  }
  
  // ========== ユーティリティ ==========
  
  /** カウントを取得 */
  private getCount(): number {
    return this.count ? parseInt(this.count) : 1;
  }
  
  /** ステータスを表示 */
  showStatus(message: string, isError = false): void {
    const status = this.elements.fileStatus;
    status.textContent = message;
    status.style.color = isError ? 'var(--accent-red)' : 'var(--accent-green)';
    setTimeout(() => {
      status.textContent = '';
      status.style.color = '';
    }, 3000);
  }
  
  /** 状態を保存 */
  private saveState(): void {
    saveToHistory(this.elements.editor, this.undoStack);
    this.redoStack = [];
  }
  
  /** アンドゥ */
  private undoAction(): void {
    if (undo(this.elements.editor, this.undoStack, this.redoStack)) {
      this.updatePreview();
      this.updateLineNumbers();
      this.showStatus(this.t.undone);
    } else {
      this.showStatus(this.t.noMoreUndo);
    }
  }
  
  /** リドゥ */
  private redoAction(): void {
    if (redo(this.elements.editor, this.undoStack, this.redoStack)) {
      this.updatePreview();
      this.updateLineNumbers();
      this.showStatus(this.t.redone);
    } else {
      this.showStatus(this.t.noMoreRedo);
    }
  }
  
  // ========== モード切替 ==========
  
  /** ノーマルモードへ */
  private enterNormalMode(): void {
    // insertモードからの遷移の場合、入力テキストを記録
    if (this.mode === 'insert' && this.insertCommand) {
      const editor = this.elements.editor;
      const endPos = editor.selectionStart;
      const insertedText = editor.value.substring(this.insertStartPos, endPos);
      
      if (insertedText.length > 0 || this.insertCommand === 'o' || this.insertCommand === 'O') {
        this.lastCommand = {
          type: 'insert',
          command: this.insertCommand,
          text: insertedText,
          count: 1
        };
      }
    }
    
    this.mode = 'normal';
    this.visualStart = null;
    this.visualLine = false;
    this.elements.modeIndicator.textContent = 'NORMAL';
    this.elements.modeIndicator.className = '';
    this.elements.editor.classList.remove('insert-mode');
    this.elements.cursorOverlay.classList.remove('insert', 'visual');
    this.updateCursorOverlay();
  }
  
  /** 挿入モードへ */
  private enterInsertMode(command: string = 'i'): void {
    this.mode = 'insert';
    this.elements.modeIndicator.textContent = 'INSERT';
    this.elements.modeIndicator.className = 'insert';
    this.elements.editor.classList.add('insert-mode');
    this.elements.cursorOverlay.classList.add('insert');
    this.elements.cursorOverlay.classList.remove('visual');
    
    // 挿入開始位置とコマンドを記録
    this.insertStartPos = this.elements.editor.selectionStart;
    this.insertCommand = command;
  }
  
  /** ビジュアルモードへ */
  private enterVisualMode(): void {
    this.mode = 'visual';
    this.visualStart = this.elements.editor.selectionStart;
    this.visualLine = false;
    this.elements.modeIndicator.textContent = 'VISUAL';
    this.elements.modeIndicator.className = 'visual';
    this.elements.cursorOverlay.classList.add('visual');
  }
  
  /** 行ビジュアルモードへ */
  private enterVisualLineMode(): void {
    this.mode = 'visual';
    this.visualStart = this.elements.editor.selectionStart;
    this.visualLine = true;
    this.elements.modeIndicator.textContent = 'V-LINE';
    this.elements.modeIndicator.className = 'visual';
    this.elements.cursorOverlay.classList.add('visual');
  }
  
  /** コマンドモードへ */
  private enterCommandMode(): void {
    this.mode = 'command';
    this.elements.commandLine.classList.remove('hidden');
    this.elements.commandPrefix.textContent = ':';
    this.elements.commandInput.value = '';
    this.elements.commandInput.focus();
    this.elements.modeIndicator.textContent = 'COMMAND';
    this.elements.modeIndicator.className = 'command';
  }
  
  // ========== 挿入モード処理 ==========
  
  /** 挿入モード処理 */
  private handleInsertMode(e: KeyboardEvent): void {
    if (e.key === 'Escape' || (e.ctrlKey && e.key === '[')) {
      e.preventDefault();
      this.enterNormalMode();
      moveLeft(this.elements.editor);
      return;
    }
    
    // Tabキー
    if (e.key === 'Tab') {
      e.preventDefault();
      const editor = this.elements.editor;
      const start = editor.selectionStart;
      const end = editor.selectionEnd;
      
      if (e.shiftKey) {
        // Shift+Tab: デデント
        dedentLine(editor);
      } else {
        // Tab: タブまたはスペースを挿入
        const tab = '  '; // 2スペース
        editor.value = editor.value.substring(0, start) + tab + editor.value.substring(end);
        editor.selectionStart = editor.selectionEnd = start + tab.length;
      }
      this.updateLineNumbers();
      return;
    }
    
    // 挿入モードでは通常の入力を許可
  }
  
  // ========== ビジュアルモード処理 ==========
  
  /** ビジュアルモード処理 */
  private handleVisualMode(e: KeyboardEvent): void {
    const editor = this.elements.editor;
    const key = e.key;
    
    if (key === 'Escape' || (e.ctrlKey && key === '[')) {
      e.preventDefault();
      this.enterNormalMode();
      return;
    }
    
    e.preventDefault();
    const count = this.getCount();
    
    // gコマンド（gj/gk）の処理
    if (this.pendingKey === 'g') {
      switch (key) {
        case 'g': moveToDocumentStart(editor); break;
        case 'j': this.moveDisplayLine(1, count); break;
        case 'k': this.moveDisplayLine(-1, count); break;
      }
      this.pendingKey = '';
      this.count = '';
      // 選択範囲を更新
      if (this.visualStart !== null) {
        const newCursorPos = editor.selectionStart;
        const start = Math.min(this.visualStart, newCursorPos);
        const end = Math.max(this.visualStart, newCursorPos);
        editor.setSelectionRange(start, end + 1);
      }
      return;
    }
    
    // ビジュアルモードでのカーソル位置を取得
    // 選択範囲の開始点(visualStart)と現在のカーソル位置を分離して管理
    let cursorPos = editor.selectionEnd;
    // visualStartより左にカーソルがある場合
    if (this.visualStart !== null && editor.selectionStart < this.visualStart) {
      cursorPos = editor.selectionStart;
    }
    // 選択が1文字以上の場合、endは+1されているので調整
    if (this.visualStart !== null && cursorPos > this.visualStart) {
      cursorPos = editor.selectionEnd - 1;
    }
    
    // 一時的にカーソル位置を単一点に設定（移動関数用）
    editor.selectionStart = cursorPos;
    editor.selectionEnd = cursorPos;
    
    // 移動
    switch (key) {
      case 'h': 
      case 'ArrowLeft': 
        moveLeft(editor, count); break;
      case 'j': 
      case 'ArrowDown': 
        moveDown(editor, count); break;
      case 'k': 
      case 'ArrowUp': 
        moveUp(editor, count); break;
      case 'l': 
      case 'ArrowRight': 
        moveRight(editor, count); break;
      case 'w': moveWordForward(editor, count); break;
      case 'b': moveWordBackward(editor, count); break;
      case '0': moveToLineStart(editor); break;
      case '$': moveToLineEnd(editor); break;
      case 'G': moveToDocumentEnd(editor); break;
      case 'g':
        this.pendingKey = 'g';
        this.count = '';
        return;  // 選択範囲の更新をスキップ
      
      // 操作
      case 'd':
      case 'x':
        // 操作時は選択範囲を復元してから実行
        if (this.visualStart !== null) {
          const start = Math.min(this.visualStart, cursorPos);
          const end = Math.max(this.visualStart, cursorPos);
          editor.setSelectionRange(start, end + 1);
        }
        this.saveState();
        this.deleteVisualSelection();
        this.enterNormalMode();
        this.count = '';
        return;
      case 'y':
        if (this.visualStart !== null) {
          const start = Math.min(this.visualStart, cursorPos);
          const end = Math.max(this.visualStart, cursorPos);
          editor.setSelectionRange(start, end + 1);
        }
        this.yankVisualSelection();
        this.enterNormalMode();
        this.count = '';
        return;
      case 'c':
        if (this.visualStart !== null) {
          const start = Math.min(this.visualStart, cursorPos);
          const end = Math.max(this.visualStart, cursorPos);
          editor.setSelectionRange(start, end + 1);
        }
        this.saveState();
        this.deleteVisualSelection();
        this.enterInsertMode('c');
        this.count = '';
        return;
      case '>':
        if (this.visualStart !== null) {
          const start = Math.min(this.visualStart, cursorPos);
          const end = Math.max(this.visualStart, cursorPos);
          editor.setSelectionRange(start, end + 1);
        }
        this.saveState();
        this.indentVisualSelection();
        this.enterNormalMode();
        this.count = '';
        return;
      case '<':
        if (this.visualStart !== null) {
          const start = Math.min(this.visualStart, cursorPos);
          const end = Math.max(this.visualStart, cursorPos);
          editor.setSelectionRange(start, end + 1);
        }
        this.saveState();
        this.dedentVisualSelection();
        this.enterNormalMode();
        this.count = '';
        return;
    }
    
    // 選択範囲を更新（移動後）
    if (this.visualStart !== null) {
      const newCursorPos = editor.selectionStart;
      const start = Math.min(this.visualStart, newCursorPos);
      const end = Math.max(this.visualStart, newCursorPos);
      editor.setSelectionRange(start, end + 1);
    }
    
    this.count = '';
  }
  
  // ========== オペレータ処理 ==========
  
  /** ペンディングオペレータ処理 */
  private handlePendingOperator(e: KeyboardEvent): void {
    const key = e.key;
    const editor = this.elements.editor;
    const op = this.pendingOperator;
    const count = this.getCount();
    
    e.preventDefault();
    
    // dd, yy, cc, >>, <<
    if (key === op) {
      this.saveState();
      switch (op) {
        case 'd':
          saveToRegister(this.registers, deleteLine(editor, count), this.selectedRegister, true);
          this.lastCommand = { type: 'delete', command: 'dd', count };
          break;
        case 'y':
          saveToRegister(this.registers, yankLine(editor, count), this.selectedRegister);
          this.showStatus(this.t.yanked);
          break;
        case 'c':
          deleteLine(editor, count);
          this.enterInsertMode('cc');
          break;
        case '>':
          for (let i = 0; i < count; i++) {
            indentLine(editor);
          }
          this.lastCommand = { type: 'other', command: '>>', count };
          break;
        case '<':
          for (let i = 0; i < count; i++) {
            dedentLine(editor);
          }
          this.lastCommand = { type: 'other', command: '<<', count };
          break;
      }
      this.updatePreview();
      this.updateLineNumbers();
      this.pendingOperator = '';
      this.count = '';
      this.selectedRegister = '"';
      return;
    }
    
    // dw, cw, yw など
    if (key === 'w') {
      this.saveState();
      const deleted = deleteWord(editor, true);
      if (op === 'd' || op === 'c') {
        saveToRegister(this.registers, deleted, this.selectedRegister, op === 'd');
        if (op === 'd') {
          this.lastCommand = { type: 'delete', command: 'dw', count };
        }
      } else if (op === 'y') {
        saveToRegister(this.registers, deleted, this.selectedRegister);
        this.showStatus(this.t.yanked);
      }
      if (op === 'c') {
        this.enterInsertMode('cw');
      }
      this.updatePreview();
    }
    
    // テキストオブジェクト (diw, daw, di", da", etc.)
    if (key === 'i' || key === 'a') {
      this.pendingKey = key;
      return;
    }
    
    if (this.pendingKey === 'i' || this.pendingKey === 'a') {
      const inner = this.pendingKey === 'i';
      this.handleTextObject(op, key, inner);
      this.pendingKey = '';
    }
    
    this.pendingOperator = '';
    this.count = '';
    this.selectedRegister = '"';
  }
  
  /** テキストオブジェクト処理 */
  private handleTextObject(op: string, obj: string, inner: boolean): void {
    const editor = this.elements.editor;
    const text = editor.value;
    const pos = editor.selectionStart;
    
    let start = -1;
    let end = -1;
    
    // 単語
    if (obj === 'w') {
      start = pos;
      end = pos;
      
      // 単語の開始を探す
      while (start > 0 && /\w/.test(text[start - 1])) start--;
      // 単語の終了を探す
      while (end < text.length && /\w/.test(text[end])) end++;
      
      if (!inner) {
        // 後ろの空白も含める
        while (end < text.length && /\s/.test(text[end])) end++;
      }
    }
    
    // 括弧系
    const pairs: Record<string, [string, string]> = {
      '(': ['(', ')'], ')': ['(', ')'],
      '[': ['[', ']'], ']': ['[', ']'],
      '{': ['{', '}'], '}': ['{', '}'],
      '<': ['<', '>'], '>': ['<', '>'],
      '"': ['"', '"'],
      "'": ["'", "'"],
      '`': ['`', '`']
    };
    
    if (pairs[obj]) {
      const [open, close] = pairs[obj];
      
      // 開き括弧を探す
      let depth = 0;
      for (let i = pos; i >= 0; i--) {
        if (text[i] === close && i !== pos) depth++;
        if (text[i] === open) {
          if (depth === 0) {
            start = i;
            break;
          }
          depth--;
        }
      }
      
      // 閉じ括弧を探す
      depth = 0;
      for (let i = pos; i < text.length; i++) {
        if (text[i] === open && i !== pos) depth++;
        if (text[i] === close) {
          if (depth === 0) {
            end = i + 1;
            break;
          }
          depth--;
        }
      }
      
      if (inner && start !== -1 && end !== -1) {
        start++;
        end--;
      }
    }
    
    if (start !== -1 && end !== -1 && start < end) {
      this.saveState();
      const deleted = text.substring(start, end);
      
      if (op === 'd' || op === 'c') {
        editor.value = text.substring(0, start) + text.substring(end);
        setSelection(editor, start);
        saveToRegister(this.registers, deleted, this.selectedRegister, op === 'd');
      } else if (op === 'y') {
        saveToRegister(this.registers, deleted, this.selectedRegister);
        this.showStatus(this.t.yanked);
      }
      
      if (op === 'c') {
        this.enterInsertMode('c' + (inner ? 'i' : 'a') + obj);
      }
      
      this.updatePreview();
      this.updateLineNumbers();
    }
  }
  
  // ========== 編集操作 ==========
  
  /** 文字削除 */
  private deleteChar(count: number): void {
    const editor = this.elements.editor;
    this.saveState();
    const deleted = deleteRange(editor, editor.selectionStart, editor.selectionStart + count);
    saveToRegister(this.registers, deleted, this.selectedRegister, true);
    this.lastCommand = { type: 'delete', command: 'x', count };
    this.updatePreview();
    this.updateLineNumbers();
  }
  
  /** 前の文字削除 */
  private deleteCharBefore(count: number): void {
    const editor = this.elements.editor;
    const pos = editor.selectionStart;
    if (pos === 0) return;
    
    this.saveState();
    const start = Math.max(0, pos - count);
    const deleted = deleteRange(editor, start, pos);
    saveToRegister(this.registers, deleted, this.selectedRegister, true);
    this.lastCommand = { type: 'delete', command: 'X', count };
    this.updatePreview();
    this.updateLineNumbers();
  }
  
  /** 下に新しい行を挿入 */
  private insertLineBelow(): void {
    const editor = this.elements.editor;
    this.saveState();
    moveToLineEnd(editor);
    insertTextOp(editor, '\n');
    this.enterInsertMode('o');
    this.updateLineNumbers();
  }
  
  /** 上に新しい行を挿入 */
  private insertLineAbove(): void {
    const editor = this.elements.editor;
    this.saveState();
    moveToLineStart(editor);
    const pos = editor.selectionStart;
    editor.value = editor.value.substring(0, pos) + '\n' + editor.value.substring(pos);
    setSelection(editor, pos);
    this.enterInsertMode('O');
    this.updateLineNumbers();
  }
  
  /** 行をクリア */
  private clearLine(): void {
    const editor = this.elements.editor;
    const text = editor.value;
    const pos = editor.selectionStart;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    let lineEnd = text.indexOf('\n', pos);
    if (lineEnd === -1) lineEnd = text.length;
    
    editor.value = text.substring(0, lineStart) + text.substring(lineEnd);
    setSelection(editor, lineStart);
  }
  
  /** 後方にペースト */
  private async pasteAfter(): Promise<void> {
    const regName = this.selectedRegister;
    this.selectedRegister = '"';
    
    let content: string;
    
    if ((regName === '*' || regName === '+') && navigator.clipboard) {
      try {
        content = await navigator.clipboard.readText();
        this.registers['*'] = content;
        this.registers['+'] = content;
      } catch {
        content = getFromRegister(this.registers, regName);
      }
    } else {
      content = getFromRegister(this.registers, regName);
    }
    
    if (!content) return;
    
    content = normalizeCRLF(content);
    this.saveState();
    pasteAfter(this.elements.editor, content);
    this.updatePreview();
    this.updateLineNumbers();
  }
  
  /** 前方にペースト */
  private async pasteBefore(): Promise<void> {
    const regName = this.selectedRegister;
    this.selectedRegister = '"';
    
    let content: string;
    
    if ((regName === '*' || regName === '+') && navigator.clipboard) {
      try {
        content = await navigator.clipboard.readText();
        this.registers['*'] = content;
        this.registers['+'] = content;
      } catch {
        content = getFromRegister(this.registers, regName);
      }
    } else {
      content = getFromRegister(this.registers, regName);
    }
    
    if (!content) return;
    
    content = normalizeCRLF(content);
    this.saveState();
    pasteBefore(this.elements.editor, content);
    this.updatePreview();
    this.updateLineNumbers();
  }
  
  /** 直前の編集を繰り返し (.) */
  private repeatLastEdit(): void {
    if (!this.lastCommand) return;
    
    this.saveState();
    const editor = this.elements.editor;
    const cmd = this.lastCommand;
    
    switch (cmd.type) {
      case 'insert':
        // 挿入コマンドの繰り返し
        switch (cmd.command) {
          case 'i':
            insertTextOp(editor, cmd.text);
            break;
          case 'a':
            moveRight(editor);
            insertTextOp(editor, cmd.text);
            break;
          case 'I':
            moveToFirstNonBlank(editor);
            insertTextOp(editor, cmd.text);
            break;
          case 'A':
            moveToLineEnd(editor);
            insertTextOp(editor, cmd.text);
            break;
          case 'o':
            moveToLineEnd(editor);
            insertTextOp(editor, '\n' + cmd.text);
            break;
          case 'O':
            moveToLineStart(editor);
            const pos = editor.selectionStart;
            editor.value = editor.value.substring(0, pos) + cmd.text + '\n' + editor.value.substring(pos);
            setSelection(editor, pos + cmd.text.length);
            break;
          case 'C':
            deleteToLineEnd(editor);
            insertTextOp(editor, cmd.text);
            break;
          case 'S':
            this.clearLine();
            insertTextOp(editor, cmd.text);
            break;
          case 'cc':
            deleteLine(editor, 1);
            insertTextOp(editor, cmd.text);
            break;
          case 'cw':
            deleteWord(editor, true);
            insertTextOp(editor, cmd.text);
            break;
          default:
            // 他のcコマンド（ciw, ci"など）
            if (cmd.command.startsWith('c')) {
              insertTextOp(editor, cmd.text);
            }
            break;
        }
        break;
        
      case 'delete':
        // 削除コマンドの繰り返し
        for (let i = 0; i < cmd.count; i++) {
          switch (cmd.command) {
            case 'x':
              this.deleteCharInternal(1);
              break;
            case 'X':
              this.deleteCharBeforeInternal(1);
              break;
            case 'dd':
              deleteLine(editor, 1);
              break;
            case 'dw':
              deleteWord(editor, true);
              break;
            case 'D':
              deleteToLineEnd(editor);
              break;
          }
        }
        break;
        
      case 'replace':
        // 置換コマンドの繰り返し
        const rPos = editor.selectionStart;
        for (let i = 0; i < cmd.count; i++) {
          if (rPos + i < editor.value.length) {
            editor.value = editor.value.substring(0, rPos + i) + cmd.char + editor.value.substring(rPos + i + 1);
          }
        }
        setSelection(editor, rPos);
        break;
        
      case 'other':
        // その他のコマンドの繰り返し
        for (let i = 0; i < cmd.count; i++) {
          switch (cmd.command) {
            case '~':
              toggleCase(editor, 1);
              break;
            case 'J':
              joinLines(editor, 1);
              break;
            case '>>':
              indentLine(editor);
              break;
            case '<<':
              dedentLine(editor);
              break;
          }
        }
        break;
    }
    
    this.updatePreview();
    this.updateLineNumbers();
  }
  
  /** 内部用: 1文字削除（lastCommand記録なし）*/
  private deleteCharInternal(count: number): void {
    const editor = this.elements.editor;
    const pos = editor.selectionStart;
    const text = editor.value;
    const deleteCount = Math.min(count, text.length - pos);
    const deleted = text.substring(pos, pos + deleteCount);
    editor.value = text.substring(0, pos) + text.substring(pos + deleteCount);
    setSelection(editor, pos);
    saveToRegister(this.registers, deleted, this.selectedRegister, true);
  }
  
  /** 内部用: 前の文字を削除（lastCommand記録なし）*/
  private deleteCharBeforeInternal(count: number): void {
    const editor = this.elements.editor;
    const pos = editor.selectionStart;
    const text = editor.value;
    const deleteCount = Math.min(count, pos);
    const deleted = text.substring(pos - deleteCount, pos);
    editor.value = text.substring(0, pos - deleteCount) + text.substring(pos);
    setSelection(editor, pos - deleteCount);
    saveToRegister(this.registers, deleted, this.selectedRegister, true);
  }
  
  // ========== ビジュアル選択操作 ==========
  
  /** ビジュアル選択を削除 */
  private deleteVisualSelection(): void {
    const editor = this.elements.editor;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const deleted = editor.value.substring(start, end);
    
    editor.value = editor.value.substring(0, start) + editor.value.substring(end);
    setSelection(editor, start);
    
    saveToRegister(this.registers, deleted, this.selectedRegister, true);
    this.updatePreview();
    this.updateLineNumbers();
  }
  
  /** ビジュアル選択をヤンク */
  private yankVisualSelection(): void {
    const editor = this.elements.editor;
    const start = editor.selectionStart;
    const end = editor.selectionEnd;
    const yanked = editor.value.substring(start, end);
    
    saveToRegister(this.registers, yanked, this.selectedRegister);
    setSelection(editor, start);
    this.showStatus(this.t.yanked);
  }
  
  /** ビジュアル選択をインデント */
  private indentVisualSelection(): void {
    // 簡易実装
    indentLine(this.elements.editor);
    this.updatePreview();
    this.updateLineNumbers();
  }
  
  /** ビジュアル選択をデデント */
  private dedentVisualSelection(): void {
    dedentLine(this.elements.editor);
    this.updatePreview();
    this.updateLineNumbers();
  }
  
  // ========== ページ移動 ==========
  
  private pageDown(): void {
    const editor = this.elements.editor;
    const lineHeight = parseInt(getComputedStyle(editor).lineHeight);
    const visibleLines = Math.floor(editor.clientHeight / lineHeight);
    moveDown(editor, visibleLines);
  }
  
  private pageUp(): void {
    const editor = this.elements.editor;
    const lineHeight = parseInt(getComputedStyle(editor).lineHeight);
    const visibleLines = Math.floor(editor.clientHeight / lineHeight);
    moveUp(editor, visibleLines);
  }
  
  private halfPageDown(): void {
    const editor = this.elements.editor;
    const lineHeight = parseInt(getComputedStyle(editor).lineHeight);
    const visibleLines = Math.floor(editor.clientHeight / lineHeight / 2);
    moveDown(editor, visibleLines);
  }
  
  private halfPageUp(): void {
    const editor = this.elements.editor;
    const lineHeight = parseInt(getComputedStyle(editor).lineHeight);
    const visibleLines = Math.floor(editor.clientHeight / lineHeight / 2);
    moveUp(editor, visibleLines);
  }
  
  private moveParagraphUp(count: number): void {
    const editor = this.elements.editor;
    const text = editor.value;
    let pos = editor.selectionStart;
    
    for (let i = 0; i < count; i++) {
      pos--;
      while (pos > 0 && text[pos] !== '\n') pos--;
      while (pos > 0 && text[pos] === '\n') pos--;
      while (pos > 0 && text[pos - 1] !== '\n') pos--;
    }
    
    setSelection(editor, Math.max(0, pos));
  }
  
  private moveParagraphDown(count: number): void {
    const editor = this.elements.editor;
    const text = editor.value;
    let pos = editor.selectionStart;
    
    for (let i = 0; i < count; i++) {
      while (pos < text.length && text[pos] !== '\n') pos++;
      while (pos < text.length && text[pos] === '\n') pos++;
    }
    
    setSelection(editor, pos);
  }
  
  // ========== 検索 ==========
  
  private startSearch(backward: boolean = false): void {
    this.searchBackward = backward;
    this.enterCommandMode();
    this.elements.commandPrefix.textContent = backward ? '?' : '/';
  }
  
  private searchNext(): void {
    if (!this.searchTerm) return;
    
    const editor = this.elements.editor;
    const text = editor.value;
    
    if (this.searchBackward) {
      // 後方検索の「次」は上方向
      const end = editor.selectionStart;
      let idx = text.lastIndexOf(this.searchTerm, end - 1);
      if (idx === -1) {
        idx = text.lastIndexOf(this.searchTerm);
      }
      if (idx !== -1) {
        setSelection(editor, idx);
        this.showStatus(`?${this.searchTerm}`);
      } else {
        this.showStatus(this.t.notFound, true);
      }
    } else {
      // 前方検索の「次」は下方向
      const start = editor.selectionStart + 1;
      let idx = text.indexOf(this.searchTerm, start);
      if (idx === -1) {
        idx = text.indexOf(this.searchTerm);
      }
      if (idx !== -1) {
        setSelection(editor, idx);
        this.showStatus(`/${this.searchTerm}`);
      } else {
        this.showStatus(this.t.notFound, true);
      }
    }
  }
  
  private searchPrev(): void {
    if (!this.searchTerm) return;
    
    const editor = this.elements.editor;
    const text = editor.value;
    
    if (this.searchBackward) {
      // 後方検索の「前」は下方向
      const start = editor.selectionStart + 1;
      let idx = text.indexOf(this.searchTerm, start);
      if (idx === -1) {
        idx = text.indexOf(this.searchTerm);
      }
      if (idx !== -1) {
        setSelection(editor, idx);
        this.showStatus(`?${this.searchTerm}`);
      } else {
        this.showStatus(this.t.notFound, true);
      }
    } else {
      // 前方検索の「前」は上方向
      const end = editor.selectionStart;
      let idx = text.lastIndexOf(this.searchTerm, end - 1);
      if (idx === -1) {
        idx = text.lastIndexOf(this.searchTerm);
      }
      if (idx !== -1) {
        setSelection(editor, idx);
        this.showStatus(`/${this.searchTerm}`);
      } else {
        this.showStatus(this.t.notFound, true);
      }
    }
  }
  
  private searchWordUnderCursor(): void {
    const editor = this.elements.editor;
    const text = editor.value;
    const pos = editor.selectionStart;
    
    let start = pos;
    let end = pos;
    
    while (start > 0 && /\w/.test(text[start - 1])) start--;
    while (end < text.length && /\w/.test(text[end])) end++;
    
    const word = text.substring(start, end);
    if (word) {
      this.searchTerm = word;
      this.searchNext();
    }
  }
  
  // ========== コマンドライン ==========
  
  private handleCommandKey(e: KeyboardEvent): void {
    if (e.key === 'Escape') {
      this.exitCommandMode();
      return;
    }
    
    if (e.key === 'Enter') {
      e.preventDefault();
      const input = this.elements.commandInput.value;
      const prefix = this.elements.commandPrefix.textContent;
      
      if (prefix === '/') {
        this.searchTerm = input;
        this.searchNext();
      } else {
        this.executeCommandLine(input);
      }
      
      this.commandHistory.add(input);
      this.exitCommandMode();
      return;
    }
    
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = this.commandHistory.previous();
      if (prev !== undefined) {
        this.elements.commandInput.value = prev;
      }
      return;
    }
    
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = this.commandHistory.next();
      if (next !== undefined) {
        this.elements.commandInput.value = next;
      }
      return;
    }
  }
  
  private exitCommandMode(): void {
    this.elements.commandLine.classList.add('hidden');
    this.elements.commandInput.value = '';
    this.elements.editor.focus();
    this.enterNormalMode();
    this.commandHistory.reset();
  }
  
  private async executeCommandLine(input: string): Promise<void> {
    const context: CommandContext = {
      editor: this.elements.editor,
      saveState: () => this.saveState(),
      updatePreview: () => this.updatePreview(),
      gotoLine: (line) => this.gotoLine(line),
      showStatus: (msg, isError) => this.showStatus(msg, isError),
      openFile: () => this.openFileDialog(),
      saveFile: () => this.saveCurrentFile(),
      newFile: () => this.newFile(),
      setTheme: (theme) => this.setTheme(theme as Theme),
      setVimMode: (enabled) => this.setVimModeEnabled(enabled),
      setWrap: (enabled) => this.setWrapEnabled(enabled),
      quit: () => this.quit(),
      exportAs: (format) => this.exportAs(format),
      getImageCount: () => this.uploadedImages.size,
      importFromUrl: (url) => this.importFromUrl(url),
      importFromClipboard: () => this.importFromClipboard(),
      openImportDialog: () => this.openImportDialog()
    };
    
    const result = await executeCommand(input, context);
    if (result.message) {
      this.showStatus(result.message, !result.success);
    }
  }
  
  // ========== ファイル操作 ==========
  
  private async openFileDialog(): Promise<void> {
    if (isFileSystemAccessSupported()) {
      const result = await openFile();
      if (result) {
        this.elements.editor.value = result.content;
        this.currentFileName = result.name;
        this.elements.fileName.textContent = result.name;
        this.currentFileHandle = result.handle;
        this.modified = false;
        this.updateFileStatus();
        this.updateLineNumbers();
        this.updatePreview();
        this.updateToc();
        this.showStatus(`${result.name} - ${this.t.opened}`);
      }
    } else {
      this.elements.fileInput.click();
    }
  }
  
  private async handleFileOpen(e: Event): Promise<void> {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    
    // .mdvimファイルの場合
    if (file.name.endsWith('.mdvim')) {
      await this.loadMdvimFile(file);
      input.value = '';
      return;
    }
    
    // 通常のテキストファイル
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = normalizeCRLF(event.target?.result as string);
      this.uploadedImages.clear();
      this.elements.editor.value = content;
      this.currentFileName = file.name;
      this.elements.fileName.textContent = file.name;
      this.modified = false;
      this.updateFileStatus();
      this.updateLineNumbers();
      this.updatePreview();
      this.updateToc();
      this.showStatus(`${file.name} - ${this.t.opened}`);
    };
    reader.readAsText(file);
    
    input.value = '';
  }
  
  /** .mdvimファイルを読み込み（新旧形式対応） */
  private async loadMdvimFile(file: File): Promise<void> {
    try {
      const zip = await JSZip.loadAsync(file);
      
      // manifest.jsonを読み込み
      let contentFileName = 'content.md';
      const manifestFile = zip.file('manifest.json');
      if (manifestFile) {
        try {
          const manifestText = await manifestFile.async('string');
          const manifest = JSON.parse(manifestText);
          
          // メタデータを読み込み（新形式の場合）
          if (manifest.metadata) {
            this.documentMetadata = {
              title: manifest.metadata.title || '',
              author: manifest.metadata.author || '',
              language: manifest.metadata.language || 'ja'
            };
          } else {
            // 旧形式の場合はデフォルト値
            this.documentMetadata = {
              title: file.name.replace(/\.mdvim$/i, ''),
              author: '',
              language: 'ja'
            };
          }
          
          // コンテンツファイル名（指定があれば使用）
          if (manifest.content) {
            contentFileName = manifest.content;
          }
        } catch (e) {
          console.warn('Failed to parse manifest.json:', e);
        }
      }
      
      // コンテンツを読み込み
      const contentFile = zip.file(contentFileName);
      if (contentFile) {
        const content = await contentFile.async('string');
        this.elements.editor.value = normalizeCRLF(content);
      }
      
      // 画像を読み込み
      this.uploadedImages.clear();
      for (const [path, zipEntry] of Object.entries(zip.files)) {
        if (path.startsWith('images/') && !zipEntry.dir) {
          const name = path.replace('images/', '');
          const data = await zipEntry.async('base64');
          const ext = name.split('.').pop()?.toLowerCase() || 'png';
          const mimeMap: Record<string, string> = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml',
            'bmp': 'image/bmp'
          };
          const mime = mimeMap[ext] || 'image/png';
          this.uploadedImages.set(name, `data:${mime};base64,${data}`);
        }
      }
      
      this.currentFileName = file.name;
      this.elements.fileName.textContent = file.name;
      this.currentFileHandle = null;
      this.modified = false;
      this.updateFileStatus();
      this.updateLineNumbers();
      this.updatePreview();
      this.updateToc();
      this.showStatus(`${file.name} - ${this.t.opened} (${this.uploadedImages.size} images)`);
    } catch (err) {
      this.showStatus('Failed to load .mdvim file', true);
      console.error(err);
    }
  }
  
  private async saveCurrentFile(): Promise<void> {
    const content = this.elements.editor.value;
    
    // 画像がある場合は.mdvim形式で保存
    if (this.uploadedImages.size > 0) {
      await this.saveMdvimFile();
      return;
    }
    
    // 画像がない場合は.md形式で保存
    // ファイル名を.mdに変換（.mdvimから開いた場合も.mdで保存）
    let filename = this.currentFileName.replace(/\.(md|mdvim)$/i, '') + '.md';
    if (filename === '.md' || filename === '無題.md' || filename === 'Untitled.md') {
      filename = 'document.md';
    }
    
    // 通常の.md保存
    const handle = await saveFile(content, filename, this.currentFileHandle);
    
    if (handle) {
      this.currentFileHandle = handle;
      this.currentFileName = handle.name;
      this.elements.fileName.textContent = handle.name;
    }
    
    this.modified = false;
    this.updateFileStatus();
    this.showStatus(this.t.saved);
  }
  
  /** .mdvim形式で保存（MDebook互換） */
  private async saveMdvimFile(): Promise<void> {
    try {
      const zip = new JSZip();
      
      // ファイル名からタイトルを取得（メタデータが空の場合）
      let filename = this.currentFileName.replace(/\.(md|mdvim)$/i, '');
      if (!filename || filename === '無題' || filename === 'Untitled') {
        filename = 'document';
      }
      
      // タイトルをメタデータに設定（空の場合はファイル名から）
      const title = this.documentMetadata.title || filename;
      
      // 画像ファイル名一覧を作成
      const imageList: string[] = [];
      this.uploadedImages.forEach((_, name) => {
        imageList.push(name);
      });
      
      // manifest.jsonを追加（MDebook互換形式）
      const manifest = {
        version: '0.8.2',
        app: 'mdvim',
        created: new Date().toISOString(),
        metadata: {
          title: title,
          author: this.documentMetadata.author,
          language: this.documentMetadata.language || this.currentLanguage
        },
        content: 'content.md',
        images: imageList
      };
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));
      
      // content.mdを追加
      zip.file('content.md', this.elements.editor.value);
      
      // 画像を追加
      const imagesFolder = zip.folder('images');
      this.uploadedImages.forEach((dataUrl, name) => {
        const base64 = dataUrl.split(',')[1];
        imagesFolder!.file(name, base64, { base64: true });
      });
      
      // ZIPを生成してダウンロード
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }) as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      a.download = `${filename}.mdvim`;
      a.click();
      URL.revokeObjectURL(url);
      
      this.currentFileName = `${filename}.mdvim`;
      this.elements.fileName.textContent = this.currentFileName;
      this.modified = false;
      this.updateFileStatus();
      this.showStatus(`${this.t.saved} (${this.uploadedImages.size} images)`);
    } catch (err) {
      this.showStatus('Failed to save .mdvim file', true);
      console.error(err);
    }
  }
  
  /** エクスポート */
  private async exportAs(format: string): Promise<void> {
    switch (format) {
      case 'md':
        await this.exportMarkdownZip();
        break;
      case 'html':
        await this.exportHtml();
        break;
      default:
        this.showStatus(`Unknown format: ${format}. Use md or html`, true);
    }
  }
  
  /** Markdown + 画像をZIPでエクスポート */
  private async exportMarkdownZip(): Promise<void> {
    try {
      let filename = this.currentFileName.replace(/\.(md|mdvim)$/i, '');
      if (!filename || filename === '無題' || filename === 'Untitled') {
        filename = 'document';
      }
      
      // 画像がない場合は単純な.mdファイルとしてエクスポート
      if (this.uploadedImages.size === 0) {
        const blob = new Blob([this.elements.editor.value], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.md`;
        a.click();
        URL.revokeObjectURL(url);
        this.showStatus(`Exported: ${filename}.md`);
        return;
      }
      
      // 画像がある場合は.mdvim形式でエクスポート
      const zip = new JSZip();
      
      // manifest.jsonを追加
      const imageList: string[] = [];
      this.uploadedImages.forEach((_, name) => {
        imageList.push(name);
      });
      
      const manifest = {
        version: '0.8.2',
        app: 'mdvim',
        created: new Date().toISOString(),
        metadata: {
          title: this.documentMetadata.title || filename,
          author: this.documentMetadata.author,
          language: this.documentMetadata.language || this.currentLanguage
        },
        content: 'content.md',
        images: imageList
      };
      zip.file('manifest.json', JSON.stringify(manifest, null, 2));
      
      // Markdown本文
      zip.file('content.md', this.elements.editor.value);
      
      // 画像
      const imagesFolder = zip.folder('images');
      this.uploadedImages.forEach((dataUrl, name) => {
        const base64 = dataUrl.split(',')[1];
        imagesFolder!.file(name, base64, { base64: true });
      });
      
      // ZIPを生成してダウンロード
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE' }) as Blob;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.mdvim`;
      a.click();
      URL.revokeObjectURL(url);
      
      this.showStatus(`Exported: ${filename}.mdvim (${this.uploadedImages.size} images)`);
    } catch (err) {
      this.showStatus('Export failed', true);
      console.error(err);
    }
  }
  
  /** HTMLエクスポート */
  private async exportHtml(): Promise<void> {
    try {
      const result = markdownParser.parse(this.elements.editor.value);
      let html = result.html;
      
      // 画像をBase64埋め込み
      html = this.replaceImagePaths(html);
      
      // 完全なHTMLドキュメントを生成
      const fullHtml = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${this.currentFileName}</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/styles/atom-one-dark.min.css">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 2rem; line-height: 1.6; }
    pre { background: #282c34; padding: 1rem; border-radius: 6px; overflow-x: auto; }
    code { font-family: 'Fira Code', Consolas, monospace; }
    img { max-width: 100%; height: auto; }
    blockquote { border-left: 4px solid #7aa2f7; padding-left: 1rem; margin-left: 0; color: #666; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; }
  </style>
</head>
<body>
${html}
  <script src="https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js"></script>
  <script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11.9.0/build/highlight.min.js"></script>
  <script>hljs.highlightAll();</script>
</body>
</html>`;
      
      // ダウンロード
      const blob = new Blob([fullHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      let filename = this.currentFileName.replace(/\.(md|mdvim)$/i, '');
      if (!filename || filename === '無題' || filename === 'Untitled') {
        filename = 'document';
      }
      
      a.download = `${filename}.html`;
      a.click();
      URL.revokeObjectURL(url);
      
      this.showStatus(`Exported: ${filename}.html`);
    } catch (err) {
      this.showStatus('Export failed', true);
      console.error(err);
    }
  }
  
  
  private newFile(): void {
    if (this.modified) {
      if (!confirm('変更を破棄しますか？')) return;
    }
    
    this.elements.editor.value = '';
    this.currentFileName = '無題';
    this.elements.fileName.textContent = '無題';
    this.currentFileHandle = null;
    this.uploadedImages.clear();  // 画像もクリア
    this.documentMetadata = { title: '', author: '', language: 'ja' };  // メタデータをリセット
    this.modified = false;
    this.undoStack = [];
    this.redoStack = [];
    this.updateFileStatus();
    this.updateLineNumbers();
    this.updatePreview();
    this.updateToc();
    this.showStatus(this.t.newFile);
  }
  
  private quit(): void {
    if (this.modified) {
      if (!confirm('変更を保存せずに終了しますか？')) return;
    }
    window.close();
  }
  
  // ========== マクロ ==========
  
  private startMacroRecording(name: string): void {
    this.recordingMacro = name;
    this.macroBuffer = [];
    this.elements.macroIndicator.classList.add('active');
    this.elements.modeIndicator.classList.add('recording');
    this.showStatus(`${this.t.macroRecording}${name}`);
  }
  
  private stopMacroRecording(): void {
    if (this.recordingMacro) {
      this.macros[this.recordingMacro] = [...this.macroBuffer];
      this.showStatus(`${this.t.macroSaved}${this.recordingMacro}`);
      this.recordingMacro = null;
      this.macroBuffer = [];
      this.elements.macroIndicator.classList.remove('active');
      this.elements.modeIndicator.classList.remove('recording');
    }
  }
  
  private playMacro(name: string): void {
    const macro = this.macros[name];
    if (!macro) return;
    
    for (const keyEvent of macro) {
      const event = new KeyboardEvent('keydown', {
        key: keyEvent.key,
        ctrlKey: keyEvent.ctrlKey,
        shiftKey: keyEvent.shiftKey,
        bubbles: true
      });
      this.handleKeydown(event);
    }
  }
  
  // ========== UI更新 ==========
  
  private onInput(): void {
    this.modified = true;
    this.updateFileStatus();
    this.updateLineNumbers();
    this.updatePreview();
    this.updateCursorPos();
  }
  
  private updateLineNumbers(): void {
    const editor = this.elements.editor;
    const lines = editor.value.split('\n');
    const numbers: string[] = [];
    
    if (this.wrapEnabled) {
      // ワードラップ時：各行の実際の高さを計算
      const lineHeight = this.getLineHeight();
      const editorWidth = editor.clientWidth - 16; // padding分を引く
      
      // 測定用要素を作成
      const measureDiv = document.createElement('div');
      measureDiv.style.cssText = `
        position: absolute;
        visibility: hidden;
        white-space: pre-wrap;
        overflow-wrap: break-word;
        font-family: ${getComputedStyle(editor).fontFamily};
        font-size: ${getComputedStyle(editor).fontSize};
        line-height: ${getComputedStyle(editor).lineHeight};
        width: ${editorWidth}px;
        padding: 0;
        margin: 0;
        border: none;
      `;
      document.body.appendChild(measureDiv);
      
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let className = 'line-num';
        
        // 見出し行のハイライト
        const headingMatch = line.match(/^(#{1,6})\s/);
        if (headingMatch) {
          className += ` heading-h${headingMatch[1].length}`;
        }
        
        // 行の高さを測定
        measureDiv.textContent = line || ' '; // 空行は最低1行分
        const measuredHeight = measureDiv.offsetHeight;
        const wrappedLines = Math.max(1, Math.round(measuredHeight / lineHeight));
        const height = wrappedLines * lineHeight;
        
        numbers.push(`<span class="${className}" style="height: ${height}px;">${i + 1}</span>`);
      }
      
      document.body.removeChild(measureDiv);
    } else {
      // 通常モード：単純な行番号表示
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        let className = 'line-num';
        
        // 見出し行のハイライト
        const headingMatch = line.match(/^(#{1,6})\s/);
        if (headingMatch) {
          className += ` heading-h${headingMatch[1].length}`;
        }
        
        numbers.push(`<span class="${className}">${i + 1}</span>`);
      }
    }
    
    this.elements.lineNumbers.innerHTML = numbers.join('');
  }
  
  /** 1行の高さを取得 */
  private getLineHeight(): number {
    const editor = this.elements.editor;
    const computed = getComputedStyle(editor);
    const lineHeight = computed.lineHeight;
    
    if (lineHeight === 'normal') {
      // normalの場合はfont-sizeの約1.2倍
      return parseFloat(computed.fontSize) * 1.2;
    }
    
    return parseFloat(lineHeight);
  }
  
  private updatePreview(): void {
    const result = markdownParser.parse(this.elements.editor.value);
    let html = result.html;
    
    // 画像パスをdata URLに置換
    html = this.replaceImagePaths(html);
    
    this.elements.preview.innerHTML = html;
    
    // シンタックスハイライト
    this.elements.preview.querySelectorAll('pre code').forEach((block) => {
      if (typeof hljs !== 'undefined') {
        hljs.highlightElement(block as HTMLElement);
      }
    });
    
    // KaTeX
    this.renderMath();
    
    // Mermaid
    this.renderMermaid();
    
    // 見出し折りたたみ機能をセットアップ
    this.setupHeadingFold();
  }
  
  /** HTMLの画像パスをdata URLに置換 */
  private replaceImagePaths(html: string): string {
    // images/xxx.png 形式のパスを置換
    return html.replace(/src="images\/([^"]+)"/g, (match, filename) => {
      const dataUrl = this.uploadedImages.get(filename);
      if (dataUrl) {
        return `src="${dataUrl}"`;
      }
      return match;
    });
  }
  
  /** 見出し折りたたみ機能をセットアップ */
  private setupHeadingFold(): void {
    const headings = this.elements.preview.querySelectorAll('h1, h2, h3, h4, h5, h6');
    
    headings.forEach((heading) => {
      // インジケータがなければ追加
      if (!heading.querySelector('.fold-indicator')) {
        const indicator = document.createElement('span');
        indicator.className = 'fold-indicator';
        indicator.textContent = '▼';
        heading.insertBefore(indicator, heading.firstChild);
      }
      
      // クリックハンドラを設定
      (heading as HTMLElement).onclick = () => {
        this.toggleHeadingFold(heading as HTMLElement);
      };
    });
  }
  
  /** 個別の見出しの折りたたみを切り替え */
  private toggleHeadingFold(heading: HTMLElement): void {
    const level = parseInt(heading.tagName[1]);
    const indicator = heading.querySelector('.fold-indicator');
    const isFolded = heading.classList.contains('folded');
    
    if (isFolded) {
      // 展開する場合
      heading.classList.remove('folded');
      if (indicator) indicator.textContent = '▼';
      
      let sibling = heading.nextElementSibling as HTMLElement | null;
      let directChildLevel: number | null = null;
      
      while (sibling) {
        if (/^H[1-6]$/.test(sibling.tagName)) {
          const siblingLevel = parseInt(sibling.tagName[1]);
          
          // 同レベル以上の見出しで停止
          if (siblingLevel <= level) break;
          
          // 最初に見つかった子見出しのレベルを直接の子レベルとする
          if (directChildLevel === null) {
            directChildLevel = siblingLevel;
          }
          
          // 直接の子レベルの見出しのみ表示（折りたたみ状態は維持）
          if (siblingLevel === directChildLevel) {
            sibling.style.display = '';
            sibling.classList.remove('heading-hidden');
          }
        } else {
          // 見出し以外の要素 - 直接の子レベルが見つかる前なら表示
          if (directChildLevel === null) {
            sibling.style.display = '';
            sibling.classList.remove('heading-hidden');
          }
        }
        sibling = sibling.nextElementSibling as HTMLElement | null;
      }
    } else {
      // 折りたたむ場合
      heading.classList.add('folded');
      if (indicator) indicator.textContent = '▶';
      
      let sibling = heading.nextElementSibling as HTMLElement | null;
      while (sibling) {
        if (/^H[1-6]$/.test(sibling.tagName)) {
          const siblingLevel = parseInt(sibling.tagName[1]);
          if (siblingLevel <= level) break;
          
          // 下位の見出しも折りたたみ状態にする
          sibling.classList.add('folded');
          const sibIndicator = sibling.querySelector('.fold-indicator');
          if (sibIndicator) sibIndicator.textContent = '▶';
        }
        sibling.style.display = 'none';
        sibling.classList.add('heading-hidden');
        sibling = sibling.nextElementSibling as HTMLElement | null;
      }
    }
  }
  
  private renderMath(): void {
    if (typeof katex === 'undefined') return;
    
    // インライン数式
    this.elements.preview.querySelectorAll('.math-inline').forEach((el) => {
      const formula = el.getAttribute('data-math');
      if (formula) {
        try {
          katex.render(formula, el as HTMLElement, { throwOnError: false });
        } catch (e) {
          el.textContent = formula;
        }
      }
    });
    
    // ブロック数式
    this.elements.preview.querySelectorAll('.math-block').forEach((el) => {
      const formula = el.getAttribute('data-math');
      if (formula) {
        try {
          katex.render(formula, el as HTMLElement, { throwOnError: false, displayMode: true });
        } catch (e) {
          el.textContent = formula;
        }
      }
    });
  }
  
  private renderMermaid(): void {
    if (typeof mermaid === 'undefined') return;
    
    mermaid.init(undefined, this.elements.preview.querySelectorAll('.mermaid'));
  }
  
  updateToc(): void {
    const result = markdownParser.parse(this.elements.editor.value);
    const tocHtml = markdownParser.generateTocHtml(result.toc);
    this.elements.tocContent.innerHTML = tocHtml;
    
    // 目次クリックイベント
    this.elements.tocContent.querySelectorAll('.toc-entry').forEach((entry) => {
      entry.addEventListener('click', (e) => {
        e.preventDefault();
        const line = parseInt(entry.getAttribute('data-line') || '0');
        this.gotoLine(line + 1);
        this.elements.editor.focus();
      });
    });
  }
  
  toggleToc(): void {
    const tocPane = this.elements.tocPane;
    const openBtn = this.elements.tocOpenBtn;
    
    if (tocPane.classList.contains('hidden')) {
      tocPane.classList.remove('hidden');
      openBtn.classList.add('hidden');
    } else {
      tocPane.classList.add('hidden');
      openBtn.classList.remove('hidden');
    }
  }
  
  private updateCursorPos(): void {
    const info = getCursorInfo(this.elements.editor);
    this.elements.cursorPos.textContent = `${info.line}:${info.column}`;
  }
  
  /** カーソルオーバーレイの更新をスケジュール */
  private updateCursorOverlay(): void {
    if (this.cursorUpdateScheduled) return;
    this.cursorUpdateScheduled = true;
    
    requestAnimationFrame(() => {
      this.cursorUpdateScheduled = false;
      this.renderCursorOverlay();
    });
  }
  
  /** カーソルオーバーレイを実際に描画 */
  private renderCursorOverlay(): void {
    const editor = this.elements.editor;
    const overlay = this.elements.cursorOverlay;
    
    // NOVIMモードではカーソルオーバーレイを非表示、ネイティブキャレットを表示
    if (!this.vimMode) {
      overlay.style.display = 'none';
      editor.style.caretColor = 'var(--accent)';
      return;
    }
    
    // ネイティブキャレットを非表示
    editor.style.caretColor = 'transparent';
    
    const text = editor.value;
    const pos = editor.selectionStart;
    
    // スタイルを取得
    const style = getComputedStyle(editor);
    const paddingTop = parseFloat(style.paddingTop) || 0;
    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const fontSize = parseFloat(style.fontSize) || 16;
    
    // lineHeightを計算（normalの場合はfontSize * 1.5）
    let lineHeight = parseFloat(style.lineHeight);
    if (isNaN(lineHeight)) {
      lineHeight = fontSize * 1.5;
    }
    
    // 1文字の幅を測定
    let charWidth = fontSize * 0.6;
    if (this.measureSpan) {
      this.measureSpan.style.fontFamily = style.fontFamily;
      this.measureSpan.style.fontSize = style.fontSize;
      this.measureSpan.style.fontWeight = style.fontWeight;
      this.measureSpan.style.letterSpacing = style.letterSpacing;
      this.measureSpan.style.lineHeight = style.lineHeight;
      this.measureSpan.textContent = 'M';
      charWidth = this.measureSpan.getBoundingClientRect().width;
    }
    
    let top: number;
    let left: number;
    
    if (this.wrapEnabled) {
      // ワードラップモード: ミラー要素で位置を測定
      const coords = this.measureCursorPosition(pos);
      top = paddingTop + coords.top - editor.scrollTop;
      left = paddingLeft + coords.left - editor.scrollLeft;
    } else {
      // 通常モード: 論理行で計算
      const textBeforeCursor = text.substring(0, pos);
      const lines = textBeforeCursor.split('\n');
      const currentLineIndex = lines.length - 1;
      const currentCol = lines[currentLineIndex];
      
      // テキスト幅を測定
      let textWidth = 0;
      if (this.measureSpan && currentCol.length > 0) {
        this.measureSpan.textContent = currentCol;
        textWidth = this.measureSpan.getBoundingClientRect().width;
      }
      
      top = paddingTop + (currentLineIndex * lineHeight) - editor.scrollTop;
      left = paddingLeft + textWidth - editor.scrollLeft;
    }
    
    // オーバーレイを配置
    overlay.style.top = `${top}px`;
    overlay.style.left = `${left}px`;
    overlay.style.width = `${charWidth}px`;
    overlay.style.height = `${lineHeight}px`;
    
    // モードに応じてクラスを設定
    overlay.className = this.mode;
    
    // 画面外なら非表示（少し余裕を持たせる）
    if (top < -lineHeight || top > editor.clientHeight) {
      overlay.style.display = 'none';
    } else {
      overlay.style.display = 'block';
    }
  }
  
  /** ワードラップ時のカーソル位置を測定 */
  private measureCursorPosition(pos: number): { top: number; left: number } {
    const editor = this.elements.editor;
    const text = editor.value;
    const style = getComputedStyle(editor);
    
    // エディタのパディングを取得
    const paddingLeft = parseFloat(style.paddingLeft) || 0;
    const paddingRight = parseFloat(style.paddingRight) || 0;
    
    // コンテンツ幅（パディングを除く）
    const contentWidth = editor.clientWidth - paddingLeft - paddingRight;
    
    // ミラー要素を作成（textareaと同じスタイルを適用）
    const mirror = document.createElement('pre');
    mirror.style.cssText = `
      position: absolute;
      visibility: hidden;
      white-space: pre-wrap;
      overflow-wrap: break-word;
      word-break: break-word;
      font-family: ${style.fontFamily};
      font-size: ${style.fontSize};
      font-weight: ${style.fontWeight};
      letter-spacing: ${style.letterSpacing};
      line-height: ${style.lineHeight};
      tab-size: ${style.tabSize || '4'};
      padding: 0;
      margin: 0;
      border: none;
      width: ${contentWidth}px;
      box-sizing: border-box;
    `;
    
    // カーソル位置までのテキスト
    const textBefore = text.substring(0, pos);
    
    // カーソル位置の文字（または仮の文字）
    const charAtCursor = text[pos] || 'X';
    
    // preタグ内でテキストを設定（空白を保持）
    // テキストノードとマーカー用spanを追加
    const textNode = document.createTextNode(textBefore);
    const marker = document.createElement('span');
    marker.id = 'cursor-marker';
    marker.textContent = charAtCursor === '\n' ? ' ' : charAtCursor;
    
    mirror.appendChild(textNode);
    mirror.appendChild(marker);
    
    document.body.appendChild(mirror);
    
    // マーカーの左端（＝カーソル位置）を取得
    const mirrorRect = mirror.getBoundingClientRect();
    const markerRect = marker.getBoundingClientRect();
    
    const result = {
      top: markerRect.top - mirrorRect.top,
      left: markerRect.left - mirrorRect.left
    };
    
    document.body.removeChild(mirror);
    
    return result;
  }
  
  /** 表示行で上下に移動（ワードラップ対応 - 方法B: 右/左移動による境界検出） */
  private moveDisplayLine(direction: number, count: number = 1): void {
    const editor = this.elements.editor;
    const text = editor.value;
    
    for (let c = 0; c < count; c++) {
      const pos = editor.selectionStart;
      
      // 現在位置のY座標と目標X座標を記録
      const currentCoords = this.measureCursorPosition(pos);
      const targetX = currentCoords.left;
      const currentY = currentCoords.top;
      
      if (direction > 0) {
        // 下に移動: 右に進んでY座標が変わるポイントを探す
        let newPos = pos;
        
        // 右に移動してY座標が変わる位置を探す
        for (let i = pos + 1; i <= text.length; i++) {
          const coords = this.measureCursorPosition(i);
          if (coords.top > currentY + 2) { // 少し余裕を持たせる
            // 次の表示行の先頭に到達
            newPos = i;
            break;
          }
          // 改行に到達した場合も次の行へ
          if (text[i - 1] === '\n') {
            newPos = i;
            break;
          }
        }
        
        if (newPos === pos) {
          // 移動できなかった（最終行）
          return;
        }
        
        // 目標X座標に近い位置を探す
        const newLineY = this.measureCursorPosition(newPos).top;
        let bestPos = newPos;
        let bestDist = Math.abs(this.measureCursorPosition(newPos).left - targetX);
        
        for (let i = newPos; i <= text.length; i++) {
          const coords = this.measureCursorPosition(i);
          // 同じ表示行内のみ
          if (coords.top > newLineY + 2) break;
          if (text[i - 1] === '\n') break;
          
          const dist = Math.abs(coords.left - targetX);
          if (dist < bestDist) {
            bestDist = dist;
            bestPos = i;
          }
        }
        
        editor.selectionStart = bestPos;
        editor.selectionEnd = bestPos;
        
      } else {
        // 上に移動: 左に進んでY座標が変わるポイントを探す
        let newPos = pos;
        
        // 左に移動してY座標が変わる位置を探す
        for (let i = pos - 1; i >= 0; i--) {
          const coords = this.measureCursorPosition(i);
          if (coords.top < currentY - 2) { // 少し余裕を持たせる
            // 前の表示行に到達
            newPos = i;
            break;
          }
          // 改行を超えた場合
          if (text[i] === '\n') {
            newPos = i;
            break;
          }
        }
        
        if (newPos === pos) {
          // 移動できなかった（最初の行）
          return;
        }
        
        // 前の表示行の先頭を探す
        const prevLineY = this.measureCursorPosition(newPos).top;
        let lineStart = newPos;
        for (let i = newPos - 1; i >= 0; i--) {
          const coords = this.measureCursorPosition(i);
          if (coords.top < prevLineY - 2) break;
          if (text[i] === '\n') {
            lineStart = i + 1;
            break;
          }
          lineStart = i;
        }
        
        // 目標X座標に近い位置を探す
        let bestPos = lineStart;
        let bestDist = Math.abs(this.measureCursorPosition(lineStart).left - targetX);
        
        for (let i = lineStart; i <= newPos; i++) {
          const coords = this.measureCursorPosition(i);
          if (coords.top > prevLineY + 2) break;
          
          const dist = Math.abs(coords.left - targetX);
          if (dist < bestDist) {
            bestDist = dist;
            bestPos = i;
          }
        }
        
        editor.selectionStart = bestPos;
        editor.selectionEnd = bestPos;
      }
    }
  }
  
  private measureCharWidth(): number {
    if (this.measureSpan) {
      this.measureSpan.textContent = 'M';
      return this.measureSpan.getBoundingClientRect().width;
    }
    return 8;
  }
  
  /** エディタ→プレビューのスクロール同期 */
  private syncScrollToPreview(): void {
    if (this.isScrollSyncing) return;
    this.isScrollSyncing = true;
    
    const editor = this.elements.editor;
    const preview = this.elements.preview;
    
    const maxEditorScroll = editor.scrollHeight - editor.clientHeight;
    if (maxEditorScroll > 0) {
      const scrollPercent = editor.scrollTop / maxEditorScroll;
      const maxPreviewScroll = preview.scrollHeight - preview.clientHeight;
      preview.scrollTop = scrollPercent * maxPreviewScroll;
    }
    
    requestAnimationFrame(() => {
      this.isScrollSyncing = false;
    });
  }
  
  /** プレビュー→エディタのスクロール同期 */
  private syncScrollToEditor(): void {
    if (this.isScrollSyncing) return;
    this.isScrollSyncing = true;
    
    const editor = this.elements.editor;
    const preview = this.elements.preview;
    
    const maxPreviewScroll = preview.scrollHeight - preview.clientHeight;
    if (maxPreviewScroll > 0) {
      const scrollPercent = preview.scrollTop / maxPreviewScroll;
      const maxEditorScroll = editor.scrollHeight - editor.clientHeight;
      editor.scrollTop = scrollPercent * maxEditorScroll;
      this.elements.lineNumbers.scrollTop = editor.scrollTop;
      this.updateCursorOverlay();
    }
    
    requestAnimationFrame(() => {
      this.isScrollSyncing = false;
    });
  }
  
  private syncScroll(): void {
    this.syncScrollToPreview();
  }
  
  private updateFileStatus(): void {
    this.elements.fileStatus.textContent = this.modified ? '[変更あり]' : '';
  }
  
  private gotoLine(line: number): void {
    moveToLine(this.elements.editor, line);
    this.updateCursorPos();
    this.updateCursorOverlay();
  }
  
  // ========== テーマ・フォント ==========
  
  setTheme(theme: Theme): void {
    document.body.setAttribute('data-theme', theme);
    sessionManager.saveSettings({ theme });
    
    // ボタン状態更新
    document.querySelectorAll('[id^="btn-theme-"]').forEach((btn) => {
      btn.classList.remove('active');
    });
    document.getElementById(`btn-theme-${theme}`)?.classList.add('active');
  }
  
  // ========== 多言語対応 ==========
  
  /** 言語を設定 */
  setLanguage(lang: Language): void {
    this.currentLanguage = lang;
    this.t = translations[lang];
    localStorage.setItem('mdvim-language', lang);
    this.updateUIText();
    this.updateHelpModal();
    
    // 言語セレクタを更新
    const selector = document.getElementById('language-selector') as HTMLSelectElement | null;
    if (selector) {
      selector.value = lang;
    }
  }
  
  /** 現在の言語を取得 */
  getLanguage(): Language {
    return this.currentLanguage;
  }
  
  /** UI テキストを更新 */
  private updateUIText(): void {
    const t = this.t;
    
    // ツールバーボタン
    const btnEdit = document.getElementById('btn-edit');
    const btnPreview = document.getElementById('btn-preview');
    const btnSplit = document.getElementById('btn-split');
    if (btnEdit) btnEdit.textContent = t.edit;
    if (btnPreview) btnPreview.textContent = t.preview;
    if (btnSplit) btnSplit.textContent = t.split;
    
    // フォントサイズボタン
    const btnFontSmaller = document.querySelector('[onclick*="decreaseFontSize"]');
    const btnFontLarger = document.querySelector('[onclick*="increaseFontSize"]');
    if (btnFontSmaller) btnFontSmaller.setAttribute('title', t.fontSmaller);
    if (btnFontLarger) btnFontLarger.setAttribute('title', t.fontLarger);
    
    // 目次
    const tocHeader = document.querySelector('#toc-header span');
    const tocToggle = document.getElementById('toc-toggle');
    const tocOpenBtn = document.getElementById('toc-open-btn');
    if (tocHeader) tocHeader.textContent = t.toc;
    if (tocToggle) tocToggle.setAttribute('title', t.closeToc);
    if (tocOpenBtn) tocOpenBtn.setAttribute('title', t.openToc);
    
    // プレビューコントロール
    const btnFoldAll = document.querySelector('[onclick*="foldAllHeadings"]');
    const btnUnfoldAll = document.querySelector('[onclick*="unfoldAllHeadings"]');
    if (btnFoldAll) btnFoldAll.textContent = t.foldAll;
    if (btnUnfoldAll) btnUnfoldAll.textContent = t.unfoldAll;
    
    // VIMモードボタン
    const btnVimMode = document.getElementById('btn-vim-mode');
    if (btnVimMode) btnVimMode.setAttribute('title', t.vimModeToggle);
    
    // ステータスバー
    if (!this.currentFileName) {
      this.elements.fileName.textContent = t.untitled;
    }
    const helpHint = document.getElementById('help-hint');
    if (helpHint) helpHint.textContent = t.helpHint;
    
    // ヘルプモーダルの閉じるボタン
    const helpCloseBtn = document.querySelector('#help-modal button');
    if (helpCloseBtn) helpCloseBtn.textContent = t.helpClose;
    
    // タイトル
    document.title = `mdvim v0.8.2 - ${t.appTitle.split(' - ')[1] || t.appTitle}`;
    
    // 言語セレクタを更新
    const selector = document.getElementById('language-selector') as HTMLSelectElement | null;
    if (selector) {
      selector.value = this.currentLanguage;
    }
  }
  
  /** ヘルプモーダルの内容を更新 */
  private updateHelpModal(): void {
    const t = this.t;
    const modal = document.getElementById('help-modal');
    if (!modal) return;
    
    // ヘルプタイトル
    const title = modal.querySelector('h2');
    if (title) title.textContent = t.helpTitle;
    
    // 各セクションのh3を更新
    const sections = modal.querySelectorAll('.help-section');
    const sectionTitles = [
      t.helpModeSwitch,
      t.helpMovement,
      t.helpEditing,
      t.helpTextObjects,
      t.helpSearchReplace,
      t.helpMarkdown
    ];
    
    sections.forEach((section, index) => {
      const h3 = section.querySelector('h3');
      if (h3 && sectionTitles[index]) {
        h3.textContent = sectionTitles[index];
      }
    });
  }
  
  increaseFontSize(): void {
    this.fontSize = Math.min(200, this.fontSize + 10);
    this.applyFontSize();
    sessionManager.saveSettings({ fontSize: this.fontSize });
  }
  
  decreaseFontSize(): void {
    this.fontSize = Math.max(50, this.fontSize - 10);
    this.applyFontSize();
    sessionManager.saveSettings({ fontSize: this.fontSize });
  }
  
  private applyFontSize(): void {
    const scale = this.fontSize / 100;
    this.elements.editor.style.fontSize = `${0.95 * scale}rem`;
    this.elements.lineNumbers.style.fontSize = `${0.95 * scale}rem`;
    this.elements.preview.style.fontSize = `${1 * scale}rem`;
    this.elements.fontSizeDisplay.textContent = `${this.fontSize}%`;
    
    // ワードラップ時は行番号を再計算
    if (this.wrapEnabled) {
      // フォントサイズ変更が反映されてから再計算
      requestAnimationFrame(() => this.updateLineNumbers());
    }
  }
  
  // ========== VIMモード切替 ==========
  
  toggleVimMode(): void {
    this.vimMode = !this.vimMode;
    this.updateVimModeButton();
    sessionManager.saveSettings({ vimMode: this.vimMode });
    
    if (this.vimMode) {
      this.enterNormalMode();
      this.showStatus('VIMモード ON (Ctrl+Shift+V または F2 で切替)');
    } else {
      this.mode = 'insert';
      this.elements.modeIndicator.textContent = 'EDIT';
      this.elements.modeIndicator.className = 'edit-mode';
      this.elements.editor.classList.add('insert-mode');
      this.showStatus('VIMモード OFF (Ctrl+Shift+V または F2 で切替)');
    }
  }
  
  /** VIMモードを設定（コマンドから呼び出し用） */
  private setVimModeEnabled(enabled: boolean): void {
    if (this.vimMode === enabled) return;
    this.toggleVimMode();
  }
  
  /** ワードラップを設定 */
  private setWrapEnabled(enabled: boolean): void {
    this.wrapEnabled = enabled;
    const editor = this.elements.editor;
    const lineNumbers = this.elements.lineNumbers;
    
    if (enabled) {
      editor.style.whiteSpace = 'pre-wrap';
      editor.style.overflowWrap = 'break-word';
      lineNumbers.classList.add('wrap-mode');
    } else {
      editor.style.whiteSpace = 'pre';
      editor.style.overflowWrap = 'normal';
      lineNumbers.classList.remove('wrap-mode');
    }
    
    this.updateLineNumbers();
  }
  
  private updateVimModeButton(): void {
    const btn = document.getElementById('btn-vim-mode');
    if (btn) {
      btn.textContent = this.vimMode ? 'VIM' : 'NOVIM';
      btn.classList.toggle('active', this.vimMode);
    }
  }
  
  // ========== ヘルプ ==========
  
  private toggleHelp(): void {
    const modal = document.getElementById('help-modal');
    if (modal) {
      modal.classList.toggle('hidden');
    }
  }
  
  // ========== 見出し折りたたみ ==========
  
  foldAllHeadings(): void {
    this.elements.preview.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading) => {
      heading.classList.add('folded');
      this.foldHeadingContent(heading as HTMLElement);
    });
  }
  
  unfoldAllHeadings(): void {
    this.elements.preview.querySelectorAll('h1, h2, h3, h4, h5, h6').forEach((heading) => {
      heading.classList.remove('folded');
    });
    this.elements.preview.querySelectorAll('.heading-hidden').forEach((el) => {
      el.classList.remove('heading-hidden');
    });
  }
  
  private foldHeadingContent(heading: HTMLElement): void {
    const level = parseInt(heading.tagName.substring(1));
    let el = heading.nextElementSibling;
    
    while (el) {
      if (/^H[1-6]$/.test(el.tagName)) {
        const nextLevel = parseInt(el.tagName.substring(1));
        if (nextLevel <= level) break;
      }
      el.classList.add('heading-hidden');
      el = el.nextElementSibling;
    }
  }
}

// グローバル変数の型定義
declare const hljs: { highlightElement: (el: HTMLElement) => void };
declare const katex: { render: (tex: string, el: HTMLElement, options: object) => void };
declare const mermaid: { init: (config: undefined, elements: NodeListOf<Element>) => void };

