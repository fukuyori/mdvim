/**
 * Block Markdown Parser
 * ブロック要素（見出し、リスト、コードブロックなど）のパース
 */

import { escapeHtml, normalizeCRLF } from '../utils/string';
import { parseInline } from './InlineParser';
import type { TocEntry, AlertType } from '../types';

/** リストアイテム */
interface ListItem {
  type: 'ul' | 'ol';
  indent: number;
  content: string;
  isTask: boolean;
  checked: boolean;
}

/** アラートアイコン */
const ALERT_ICONS: Record<AlertType, string> = {
  'NOTE': 'ℹ️',
  'TIP': '💡',
  'IMPORTANT': '❗',
  'WARNING': '⚠️',
  'CAUTION': '🔴'
};

/** Qiita Note アイコン */
const NOTE_ICONS: Record<string, string> = {
  'info': '✅',
  'warn': '⚠️',
  'alert': '🚫'
};

/**
 * ネストされたリストをパース
 */
function parseNestedList(items: ListItem[]): string {
  if (items.length === 0) return '';
  
  const buildList = (
    items: ListItem[],
    startIdx: number,
    baseIndent: number
  ): { html: string; endIdx: number } => {
    let html = '';
    let i = startIdx;
    const listType = items[i].type;
    const isTask = items[i].isTask;
    
    // リスト開始タグ
    if (listType === 'ol') {
      html += '<ol>';
    } else if (isTask) {
      html += '<ul class="task-list">';
    } else {
      html += '<ul>';
    }
    
    while (i < items.length) {
      const item = items[i];
      
      if (item.indent < baseIndent) {
        break;
      }
      
      if (item.indent === baseIndent) {
        if (item.isTask) {
          const checked = item.checked ? 'checked' : '';
          html += `<li class="task-item"><input type="checkbox" ${checked} disabled>${parseInline(item.content)}`;
        } else {
          html += `<li>${parseInline(item.content)}`;
        }
        
        if (i + 1 < items.length && items[i + 1].indent > baseIndent) {
          const subResult = buildList(items, i + 1, items[i + 1].indent);
          html += subResult.html;
          i = subResult.endIdx;
        } else {
          i++;
        }
        html += '</li>';
      } else {
        i++;
      }
    }
    
    html += listType === 'ol' ? '</ol>' : '</ul>';
    return { html, endIdx: i };
  };
  
  return buildList(items, 0, items[0].indent).html;
}

/**
 * テーブルをパース
 */
function parseTable(rows: string[]): string {
  if (rows.length < 2) return '';
  
  const parseRow = (row: string): string[] => {
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
    return rows.map(row => `<p>${parseInline(row)}</p>`).join('\n');
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
    html += `<th style="text-align: ${align}">${parseInline(cell)}</th>`;
  });
  html += '</tr></thead><tbody>';
  
  for (let i = 2; i < rows.length; i++) {
    const cells = parseRow(rows[i]);
    html += '<tr>';
    cells.forEach((cell, j) => {
      const align = alignments[j] || 'left';
      html += `<td style="text-align: ${align}">${parseInline(cell)}</td>`;
    });
    html += '</tr>';
  }
  
  html += '</tbody></table>';
  return html;
}

/**
 * Markdownをパース
 */
export function parseMarkdown(markdown: string): { html: string; toc: TocEntry[] } {
  // CRLFをLFに正規化
  const normalizedMarkdown = normalizeCRLF(markdown);
  const lines = normalizedMarkdown.split('\n');
  const html: string[] = [];
  const toc: TocEntry[] = [];
  
  // 状態変数
  let inCodeBlock = false;
  let inMathBlock = false;
  let mathBuffer: string[] = [];
  let listBuffer: ListItem[] = [];
  let tableRows: string[] = [];
  let codeLang = '';
  let codeBuffer: string[] = [];
  let inDetails = false;
  let detailsBuffer: string[] = [];
  let detailsSummary = '';
  let blockquoteBuffer: string[] = [];
  let alertType: AlertType | null = null;
  let inNote = false;
  let noteType = '';
  let noteBuffer: string[] = [];
  let headingCount = 0;
  let paragraphBuffer: string[] = [];  // パラグラフバッファを追加
  
  // リストバッファをフラッシュ
  const flushList = (): void => {
    if (listBuffer.length > 0) {
      html.push(parseNestedList(listBuffer));
      listBuffer = [];
    }
  };
  
  // パラグラフバッファをフラッシュ
  const flushParagraph = (): void => {
    if (paragraphBuffer.length > 0) {
      const content = paragraphBuffer.map(line => parseInline(line)).join('<br>\n');
      html.push(`<p>${content}</p>`);
      paragraphBuffer = [];
    }
  };
  
  // リストとパラグラフ両方をフラッシュ
  const flushAll = (): void => {
    flushList();
    flushParagraph();
  };
  
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    
    // 折り畳み開始 :::details タイトル
    const detailsStart = line.match(/^:::details\s*(.*)$/);
    if (detailsStart && !inCodeBlock && !inMathBlock) {
      flushAll();
      inDetails = true;
      detailsSummary = detailsStart[1] || '詳細';
      detailsBuffer = [];
      continue;
    }
    
    // 折り畳み終了 :::
    if (line.trim() === ':::' && inDetails && !inCodeBlock && !inMathBlock) {
      const innerResult = parseMarkdown(detailsBuffer.join('\n'));
      html.push(
        `<details class="collapsible">` +
        `<summary>${parseInline(detailsSummary)}</summary>` +
        `<div class="details-content">${innerResult.html}</div>` +
        `</details>`
      );
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
    
    // Qiita note記法開始
    const noteStart = line.match(/^:::note\s*(info|warn|alert)?$/i);
    if (noteStart && !inCodeBlock && !inMathBlock && !inNote) {
      flushAll();
      inNote = true;
      noteType = (noteStart[1] || 'info').toLowerCase();
      noteBuffer = [];
      continue;
    }
    
    // Qiita note終了
    if (line.trim() === ':::' && inNote && !inCodeBlock && !inMathBlock) {
      const innerResult = parseMarkdown(noteBuffer.join('\n'));
      const icon = NOTE_ICONS[noteType] || NOTE_ICONS['info'];
      html.push(
        `<div class="note note-${noteType}">` +
        `<span class="note-icon">${icon}</span>` +
        `<div class="note-content">${innerResult.html}</div>` +
        `</div>`
      );
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
        if (codeLang === 'mermaid') {
          const mermaidCode = codeBuffer.join('\n');
          html.push(`<div class="mermaid">${mermaidCode}</div>`);
        } else {
          html.push(
            `<pre><code class="language-${codeLang}">` +
            `${codeBuffer.join('\n')}</code></pre>`
          );
        }
        codeBuffer = [];
        inCodeBlock = false;
        codeLang = '';
      } else {
        codeLang = line.slice(3).trim() || 'text';
        inCodeBlock = true;
      }
      continue;
    }
    
    if (inCodeBlock) {
      if (codeLang === 'mermaid') {
        codeBuffer.push(line);
      } else {
        codeBuffer.push(escapeHtml(line));
      }
      continue;
    }
    
    // 数式ブロック $$...$$
    if (line.trim() === '$$') {
      if (inMathBlock) {
        const formula = mathBuffer.join('\n');
        html.push(`<div class="math-block" data-math="${escapeHtml(formula)}"></div>`);
        mathBuffer = [];
        inMathBlock = false;
      } else {
        flushAll();
        inMathBlock = true;
      }
      continue;
    }
    
    // 1行の数式ブロック
    const singleLineMath = line.match(/^\$\$(.+)\$\$$/);
    if (singleLineMath) {
      flushAll();
      html.push(`<div class="math-block" data-math="${escapeHtml(singleLineMath[1])}"></div>`);
      continue;
    }
    
    if (inMathBlock) {
      mathBuffer.push(line);
      continue;
    }
    
    // 見出し
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      flushAll();
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const id = `heading-${++headingCount}`;
      
      toc.push({
        level,
        text,
        id,
        line: lineIndex
      });
      
      html.push(`<h${level} id="${id}">${parseInline(text)}</h${level}>`);
      continue;
    }
    
    // 水平線
    if (/^(---|\*\*\*|___)$/.test(line.trim())) {
      flushAll();
      html.push('<hr>');
      continue;
    }
    
    // 引用（複数行対応 + GitHub Alerts）
    if (line.startsWith('>')) {
      flushAll();
      if (tableRows.length > 0) {
        html.push(parseTable(tableRows));
        tableRows = [];
      }
      
      const content = line.slice(1).trim();
      
      // GitHub Alerts のチェック
      const alertMatch = content.match(/^\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]$/i);
      if (alertMatch && blockquoteBuffer.length === 0) {
        alertType = alertMatch[1].toUpperCase() as AlertType;
        blockquoteBuffer.push('');
        continue;
      }
      
      blockquoteBuffer.push(content);
      continue;
    } else if (blockquoteBuffer.length > 0) {
      const content = blockquoteBuffer.filter(l => l).map(l => parseInline(l)).join('<br>');
      if (alertType) {
        const icon = ALERT_ICONS[alertType];
        html.push(
          `<div class="alert alert-${alertType.toLowerCase()}">` +
          `<span class="alert-title">${icon} ${alertType}</span>` +
          `<p>${content}</p></div>`
        );
      } else {
        html.push(`<blockquote>${content}</blockquote>`);
      }
      blockquoteBuffer = [];
      alertType = null;
    }
    
    // テーブル行の検出
    if (line.trim().startsWith('|') && line.trim().endsWith('|')) {
      flushAll();
      tableRows.push(line);
      continue;
    } else if (tableRows.length > 0) {
      html.push(parseTable(tableRows));
      tableRows = [];
    }
    
    // タスクリスト
    const taskMatch = line.match(/^(\s*)([-*+])\s+\[([ xX])\]\s+(.+)$/);
    if (taskMatch) {
      const indent = taskMatch[1].length;
      const checked = taskMatch[3].toLowerCase() === 'x';
      const content = taskMatch[4];
      listBuffer.push({ type: 'ul', indent, content, isTask: true, checked });
      continue;
    }
    
    // 順序なしリスト
    const ulMatch = line.match(/^(\s*)([-*+])\s+(.+)$/);
    if (ulMatch) {
      const indent = ulMatch[1].length;
      const content = ulMatch[3];
      listBuffer.push({ type: 'ul', indent, content, isTask: false, checked: false });
      continue;
    }
    
    // 順序ありリスト
    const olMatch = line.match(/^(\s*)(\d+)\.\s+(.+)$/);
    if (olMatch) {
      const indent = olMatch[1].length;
      const content = olMatch[3];
      listBuffer.push({ type: 'ol', indent, content, isTask: false, checked: false });
      continue;
    }
    
    // 空行
    if (line.trim() === '') {
      flushAll();
      if (tableRows.length > 0) {
        html.push(parseTable(tableRows));
        tableRows = [];
      }
      continue;
    }
    
    // 通常のパラグラフ
    flushList();  // リストのみフラッシュ（パラグラフは継続）
    if (tableRows.length > 0) {
      html.push(parseTable(tableRows));
      tableRows = [];
    }
    paragraphBuffer.push(line);
  }
  
  // 閉じ処理
  flushAll();
  if (inCodeBlock) {
    html.push(
      `<pre><code class="language-${codeLang || 'text'}">` +
      `${codeBuffer.join('\n')}</code></pre>`
    );
  }
  if (tableRows.length > 0) {
    html.push(parseTable(tableRows));
  }
  if (blockquoteBuffer.length > 0) {
    const content = blockquoteBuffer.filter(l => l).map(l => parseInline(l)).join('<br>');
    if (alertType) {
      const icon = ALERT_ICONS[alertType];
      html.push(
        `<div class="alert alert-${alertType.toLowerCase()}">` +
        `<span class="alert-title">${icon} ${alertType}</span>` +
        `<p>${content}</p></div>`
      );
    } else {
      html.push(`<blockquote>${content}</blockquote>`);
    }
  }
  
  return {
    html: html.join('\n'),
    toc
  };
}
