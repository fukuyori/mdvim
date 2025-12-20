/**
 * Markdown Parser
 * マークダウンをHTMLに変換するパーサー
 */
const MarkdownParser = {
  escapeHtml(text) {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },
  
  parseInline(text) {
    let result = text;
    
    // インライン数式 $...$ を処理（$$を除外）
    result = result.replace(/(?<!\$)\$(?!\$)([^$\n]+?)\$(?!\$)/g, (match, formula) => {
      return `<span class="math-inline" data-math="${this.escapeHtml(formula)}"></span>`;
    });
    
    result = result.replace(/`([^`]+)`/g, '<code>$1</code>');
    result = result.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    result = result.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    result = result.replace(/_([^_]+)_/g, '<em>$1</em>');
    result = result.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
    result = result.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');
    
    // 自動リンク（URLを自動でリンク化）
    result = result.replace(/(?<!href="|src="|<a[^>]*>)(https?:\/\/[^\s<>"']+)/g, '<a href="$1">$1</a>');
    
    // 絵文字ショートコード
    result = this.parseEmoji(result);
    
    return result;
  },
  
  // 絵文字変換
  parseEmoji(text) {
    const emojiMap = {
      ':smile:': '😄', ':laughing:': '😆', ':blush:': '😊', ':smiley:': '😃',
      ':relaxed:': '☺️', ':smirk:': '😏', ':heart_eyes:': '😍', ':kissing_heart:': '😘',
      ':kissing:': '😗', ':flushed:': '😳', ':relieved:': '😌', ':satisfied:': '😆',
      ':grin:': '😁', ':wink:': '😉', ':stuck_out_tongue_winking_eye:': '😜',
      ':stuck_out_tongue:': '😛', ':sleeping:': '😴', ':worried:': '😟',
      ':frowning:': '😦', ':anguished:': '😧', ':open_mouth:': '😮', ':grimacing:': '😬',
      ':confused:': '😕', ':hushed:': '😯', ':expressionless:': '😑', ':unamused:': '😒',
      ':sweat_smile:': '😅', ':sweat:': '😓', ':weary:': '😩', ':pensive:': '😔',
      ':disappointed:': '😞', ':confounded:': '😖', ':fearful:': '😨', ':cold_sweat:': '😰',
      ':persevere:': '😣', ':cry:': '😢', ':sob:': '😭', ':joy:': '😂', ':astonished:': '😲',
      ':scream:': '😱', ':tired_face:': '😫', ':angry:': '😠', ':rage:': '😡',
      ':triumph:': '😤', ':sleepy:': '😪', ':yum:': '😋', ':mask:': '😷',
      ':sunglasses:': '😎', ':dizzy_face:': '😵', ':imp:': '👿', ':smiling_imp:': '😈',
      ':neutral_face:': '😐', ':no_mouth:': '😶', ':innocent:': '😇', ':alien:': '👽',
      ':heart:': '❤️', ':broken_heart:': '💔', ':star:': '⭐', ':star2:': '🌟',
      ':sparkles:': '✨', ':zap:': '⚡', ':fire:': '🔥', ':boom:': '💥',
      ':+1:': '👍', ':thumbsup:': '👍', ':-1:': '👎', ':thumbsdown:': '👎',
      ':ok_hand:': '👌', ':punch:': '👊', ':fist:': '✊', ':v:': '✌️',
      ':wave:': '👋', ':hand:': '✋', ':clap:': '👏', ':pray:': '🙏',
      ':point_up:': '☝️', ':point_down:': '👇', ':point_left:': '👈', ':point_right:': '👉',
      ':rocket:': '🚀', ':warning:': '⚠️', ':x:': '❌', ':white_check_mark:': '✅',
      ':heavy_check_mark:': '✔️', ':question:': '❓', ':exclamation:': '❗',
      ':bulb:': '💡', ':memo:': '📝', ':book:': '📖', ':bookmark:': '🔖',
      ':link:': '🔗', ':wrench:': '🔧', ':hammer:': '🔨', ':nut_and_bolt:': '🔩',
      ':gear:': '⚙️', ':package:': '📦', ':tada:': '🎉', ':100:': '💯',
      ':bug:': '🐛', ':construction:': '🚧', ':rotating_light:': '🚨',
      ':lock:': '🔒', ':unlock:': '🔓', ':key:': '🔑', ':mag:': '🔍',
      ':email:': '📧', ':phone:': '📱', ':computer:': '💻', ':desktop_computer:': '🖥️',
      ':folder:': '📁', ':file_folder:': '📂', ':clipboard:': '📋',
      ':calendar:': '📅', ':clock:': '🕐', ':hourglass:': '⌛',
      ':sun:': '☀️', ':moon:': '🌙', ':cloud:': '☁️', ':umbrella:': '☂️',
      ':snowflake:': '❄️', ':coffee:': '☕', ':beer:': '🍺', ':pizza:': '🍕'
    };
    
    return text.replace(/:([a-z0-9_+-]+):/g, (match, code) => {
      return emojiMap[match] || match;
    });
  },
  
  parse(markdown) {
    const lines = markdown.split('\n');
    const html = [];
    let inCodeBlock = false;
    let inMathBlock = false;
    let mathBuffer = [];
    let inList = null;
    let tableRows = [];
    let codeLang = '';
    let codeBuffer = [];
    let inDetails = false;
    let detailsBuffer = [];
    let detailsSummary = '';
    let blockquoteBuffer = [];
    let alertType = null;
    let inNote = false;
    let noteType = '';
    let noteBuffer = [];
    
    for (const line of lines) {
      // 折り畳み開始 :::details タイトル
      const detailsStart = line.match(/^:::details\s*(.*)$/);
      if (detailsStart && !inCodeBlock && !inMathBlock) {
        if (inList) { html.push(inList === 'ol' ? '</ol>' : '</ul>'); inList = null; }
        inDetails = true;
        detailsSummary = detailsStart[1] || '詳細';
        detailsBuffer = [];
        continue;
      }
      
      // 折り畳み終了 :::
      if (line.trim() === ':::' && inDetails && !inCodeBlock && !inMathBlock) {
        const innerHtml = this.parse(detailsBuffer.join('\n'));
        html.push(`<details class="collapsible"><summary>${this.parseInline(detailsSummary)}</summary><div class="details-content">${innerHtml}</div></details>`);
        inDetails = false;
        detailsBuffer = [];
        detailsSummary = '';
        continue;
      }
      
      // 折り畳み内部
      if (inDetails) {
        detailsBuffer.push(line);
        continue;
      }
      
      // Qiita note記法開始 :::note [info|warn|alert]
      const noteStart = line.match(/^:::note\s*(info|warn|alert)?$/i);
      if (noteStart && !inCodeBlock && !inMathBlock && !inNote) {
        if (inList) { html.push(inList === 'ol' ? '</ol>' : '</ul>'); inList = null; }
        inNote = true;
        noteType = (noteStart[1] || 'info').toLowerCase();
        noteBuffer = [];
        continue;
      }
      
      // Qiita note終了 :::
      if (line.trim() === ':::' && inNote && !inCodeBlock && !inMathBlock) {
        const innerHtml = this.parse(noteBuffer.join('\n'));
        const noteIcons = { 'info': '✅', 'warn': '⚠️', 'alert': '🚫' };
        html.push(`<div class="note note-${noteType}"><span class="note-icon">${noteIcons[noteType]}</span><div class="note-content">${innerHtml}</div></div>`);
        inNote = false;
        noteBuffer = [];
        noteType = '';
        continue;
      }
      
      // note内部
      if (inNote) {
        noteBuffer.push(line);
        continue;
      }
      
      // コードブロック
      if (line.startsWith('```')) {
        if (inCodeBlock) {
          // Mermaidブロックの場合
          if (codeLang === 'mermaid') {
            const mermaidCode = codeBuffer.join('\n');
            html.push(`<div class="mermaid">${mermaidCode}</div>`);
          } else {
            html.push('</code></pre>');
          }
          codeBuffer = [];
          inCodeBlock = false;
        } else {
          codeLang = line.slice(3).trim() || 'text';
          if (codeLang !== 'mermaid') {
            html.push(`<pre><code class="language-${codeLang}">`);
          }
          inCodeBlock = true;
        }
        continue;
      }
      
      if (inCodeBlock) {
        if (codeLang === 'mermaid') {
          codeBuffer.push(line);
        } else {
          html.push(this.escapeHtml(line));
          html.push('\n');
        }
        continue;
      }
      
      // 数式ブロック $$...$$ 
      if (line.trim() === '$$') {
        if (inMathBlock) {
          const formula = mathBuffer.join('\n');
          html.push(`<div class="math-block" data-math="${this.escapeHtml(formula)}"></div>`);
          mathBuffer = [];
          inMathBlock = false;
        } else {
          if (inList) { html.push(inList === 'ol' ? '</ol>' : '</ul>'); inList = null; }
          inMathBlock = true;
        }
        continue;
      }
      
      // 1行の数式ブロック $$...$$
      const singleLineMath = line.match(/^\$\$(.+)\$\$$/);
      if (singleLineMath) {
        if (inList) { html.push(inList === 'ol' ? '</ol>' : '</ul>'); inList = null; }
        html.push(`<div class="math-block" data-math="${this.escapeHtml(singleLineMath[1])}"></div>`);
        continue;
      }
      
      if (inMathBlock) {
        mathBuffer.push(line);
        continue;
      }
      
      // 見出し
      const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
      if (headingMatch) {
        if (inList) { html.push(inList === 'ol' ? '</ol>' : '</ul>'); inList = null; }
        const level = headingMatch[1].length;
        html.push(`<h${level}>${this.parseInline(headingMatch[2])}</h${level}>`);
        continue;
      }
      
      // 水平線
      if (/^(---|\*\*\*|___)$/.test(line.trim())) {
        if (inList) { html.push(inList === 'ol' ? '</ol>' : '</ul>'); inList = null; }
        html.push('<hr>');
        continue;
      }
      
      // 引用（複数行対応 + GitHub Alerts）
      if (line.startsWith('>')) {
        if (inList) { html.push(inList === 'ol' ? '</ol>' : '</ul>'); inList = null; }
        if (tableRows.length > 0) { html.push(this.parseTable(tableRows)); tableRows = []; }
        
        const content = line.slice(1).trim();
        
        // GitHub Alerts のチェック
        const alertMatch = content.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]$/i);
        if (alertMatch && blockquoteBuffer.length === 0) {
          alertType = alertMatch[1].toUpperCase();
          blockquoteBuffer.push('');
          continue;
        }
        
        blockquoteBuffer.push(content);
        continue;
      } else if (blockquoteBuffer.length > 0) {
        // 引用ブロックを出力
        const content = blockquoteBuffer.filter(l => l).map(l => this.parseInline(l)).join('<br>');
        if (alertType) {
          const alertIcons = {
            'NOTE': 'ℹ️',
            'TIP': '💡', 
            'IMPORTANT': '❗',
            'WARNING': '⚠️',
            'CAUTION': '🔴'
          };
          html.push(`<div class="alert alert-${alertType.toLowerCase()}"><span class="alert-title">${alertIcons[alertType]} ${alertType}</span><p>${content}</p></div>`);
        } else {
          html.push(`<blockquote>${content}</blockquote>`);
        }
        blockquoteBuffer = [];
        alertType = null;
      }
      
      // テーブル行の検出
      if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
        if (inList) { html.push(inList === 'ol' ? '</ol>' : '</ul>'); inList = null; }
        tableRows.push(line);
        continue;
      } else if (tableRows.length > 0) {
        html.push(this.parseTable(tableRows));
        tableRows = [];
      }
      
      // タスクリスト（チェックボックス）
      const taskMatch = line.match(/^[-*+]\s+\[([ xX])\]\s+(.+)$/);
      if (taskMatch) {
        if (inList !== 'ul') {
          if (inList) html.push('</ol>');
          html.push('<ul class="task-list">');
          inList = 'ul';
        }
        const checked = taskMatch[1].toLowerCase() === 'x' ? 'checked' : '';
        html.push(`<li class="task-item"><input type="checkbox" ${checked} disabled>${this.parseInline(taskMatch[2])}</li>`);
        continue;
      }
      
      // 順序なしリスト
      const ulMatch = line.match(/^[-*+]\s+(.+)$/);
      if (ulMatch) {
        if (inList !== 'ul') {
          if (inList) html.push('</ol>');
          html.push('<ul>');
          inList = 'ul';
        }
        html.push(`<li>${this.parseInline(ulMatch[1])}</li>`);
        continue;
      }
      
      // 順序ありリスト
      const olMatch = line.match(/^\d+\.\s+(.+)$/);
      if (olMatch) {
        if (inList !== 'ol') {
          if (inList) html.push('</ul>');
          html.push('<ol>');
          inList = 'ol';
        }
        html.push(`<li>${this.parseInline(olMatch[1])}</li>`);
        continue;
      }
      
      // 空行
      if (line.trim() === '') {
        if (inList) {
          html.push(inList === 'ol' ? '</ol>' : '</ul>');
          inList = null;
        }
        if (tableRows.length > 0) {
          html.push(this.parseTable(tableRows));
          tableRows = [];
        }
        continue;
      }
      
      // 通常のパラグラフ
      if (inList) { html.push(inList === 'ol' ? '</ol>' : '</ul>'); inList = null; }
      if (tableRows.length > 0) { html.push(this.parseTable(tableRows)); tableRows = []; }
      html.push(`<p>${this.parseInline(line)}</p>`);
    }
    
    // 閉じタグの処理
    if (inList) html.push(inList === 'ol' ? '</ol>' : '</ul>');
    if (inCodeBlock) html.push('</code></pre>');
    if (tableRows.length > 0) html.push(this.parseTable(tableRows));
    if (blockquoteBuffer.length > 0) {
      const content = blockquoteBuffer.filter(l => l).map(l => this.parseInline(l)).join('<br>');
      if (alertType) {
        const alertIcons = { 'NOTE': 'ℹ️', 'TIP': '💡', 'IMPORTANT': '❗', 'WARNING': '⚠️', 'CAUTION': '🔴' };
        html.push(`<div class="alert alert-${alertType.toLowerCase()}"><span class="alert-title">${alertIcons[alertType]} ${alertType}</span><p>${content}</p></div>`);
      } else {
        html.push(`<blockquote>${content}</blockquote>`);
      }
    }
    
    return html.join('\n');
  },
  
  parseTable(rows) {
    if (rows.length < 2) return '';
    
    const parseRow = (row) => {
      return row.trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map(cell => cell.trim());
    };
    
    const headerCells = parseRow(rows[0]);
    
    // 2行目が区切り行かチェック
    const separatorRow = rows[1].trim();
    if (!/^\|[\s\-:|]+\|$/.test(separatorRow)) {
      return rows.map(row => `<p>${this.parseInline(row)}</p>`).join('\n');
    }
    
    // アライメントを解析
    const alignments = parseRow(rows[1]).map(cell => {
      if (cell.startsWith(':') && cell.endsWith(':')) return 'center';
      if (cell.endsWith(':')) return 'right';
      return 'left';
    });
    
    let html = '<table><thead><tr>';
    headerCells.forEach((cell, i) => {
      const align = alignments[i] || 'left';
      html += `<th style="text-align: ${align}">${this.parseInline(cell)}</th>`;
    });
    html += '</tr></thead><tbody>';
    
    // データ行
    for (let i = 2; i < rows.length; i++) {
      const cells = parseRow(rows[i]);
      html += '<tr>';
      cells.forEach((cell, j) => {
        const align = alignments[j] || 'left';
        html += `<td style="text-align: ${align}">${this.parseInline(cell)}</td>`;
      });
      html += '</tr>';
    }
    
    html += '</tbody></table>';
    return html;
  }
};
