/**
 * Vim Operators
 * 編集操作（削除、ヤンク、ペースト等）
 */

import { normalizeCRLF, splitLines } from '../utils/string';
import type { Registers, HistoryEntry } from '../types';

/**
 * テキストを挿入
 */
export function insertText(
  textarea: HTMLTextAreaElement,
  text: string
): void {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.substring(0, start);
  const after = textarea.value.substring(end);
  
  textarea.value = before + text + after;
  
  const newPos = start + text.length;
  textarea.selectionStart = newPos;
  textarea.selectionEnd = newPos;
}

/**
 * 範囲を削除
 */
export function deleteRange(
  textarea: HTMLTextAreaElement,
  start: number,
  end: number
): string {
  const text = textarea.value;
  const deleted = text.substring(start, end);
  
  textarea.value = text.substring(0, start) + text.substring(end);
  textarea.selectionStart = start;
  textarea.selectionEnd = start;
  
  return deleted;
}

/**
 * 現在の行を削除
 */
export function deleteLine(
  textarea: HTMLTextAreaElement,
  count: number = 1
): string {
  const text = textarea.value;
  const pos = textarea.selectionStart;
  const lines = splitLines(text);
  
  // 現在の行を特定
  let currentLine = 0;
  let charCount = 0;
  for (let i = 0; i < lines.length; i++) {
    if (charCount + lines[i].length >= pos) {
      currentLine = i;
      break;
    }
    charCount += lines[i].length + 1;
  }
  
  // 削除する行の範囲
  const startLine = currentLine;
  const endLine = Math.min(currentLine + count, lines.length);
  
  // 削除するテキストを取得
  const deletedLines = lines.slice(startLine, endLine);
  const deleted = deletedLines.join('\n') + '\n';
  
  // 新しいテキストを構築
  const newLines = [
    ...lines.slice(0, startLine),
    ...lines.slice(endLine)
  ];
  
  textarea.value = newLines.join('\n');
  
  // カーソル位置を調整
  let newPos = 0;
  for (let i = 0; i < startLine && i < newLines.length; i++) {
    newPos += newLines[i].length + 1;
  }
  textarea.selectionStart = newPos;
  textarea.selectionEnd = newPos;
  
  return deleted;
}

/**
 * 単語を削除
 */
export function deleteWord(
  textarea: HTMLTextAreaElement,
  forward: boolean = true
): string {
  const text = textarea.value;
  const pos = textarea.selectionStart;
  
  if (forward) {
    // 前方削除（dw）
    let end = pos;
    // 単語文字をスキップ
    while (end < text.length && /\w/.test(text[end])) {
      end++;
    }
    // 空白をスキップ
    while (end < text.length && /\s/.test(text[end])) {
      end++;
    }
    
    if (end === pos) end = pos + 1;
    return deleteRange(textarea, pos, end);
  } else {
    // 後方削除（db）
    let start = pos;
    // 空白をスキップ
    while (start > 0 && /\s/.test(text[start - 1])) {
      start--;
    }
    // 単語文字をスキップ
    while (start > 0 && /\w/.test(text[start - 1])) {
      start--;
    }
    
    if (start === pos) start = Math.max(0, pos - 1);
    return deleteRange(textarea, start, pos);
  }
}

/**
 * 行末まで削除
 */
export function deleteToLineEnd(textarea: HTMLTextAreaElement): string {
  const text = textarea.value;
  const pos = textarea.selectionStart;
  let lineEnd = text.indexOf('\n', pos);
  if (lineEnd === -1) lineEnd = text.length;
  
  return deleteRange(textarea, pos, lineEnd);
}

/**
 * 現在の行をヤンク
 */
export function yankLine(
  textarea: HTMLTextAreaElement,
  count: number = 1
): string {
  const text = textarea.value;
  const pos = textarea.selectionStart;
  const lines = splitLines(text);
  
  // 現在の行を特定
  let currentLine = 0;
  let charCount = 0;
  for (let i = 0; i < lines.length; i++) {
    if (charCount + lines[i].length >= pos) {
      currentLine = i;
      break;
    }
    charCount += lines[i].length + 1;
  }
  
  const endLine = Math.min(currentLine + count, lines.length);
  const yankedLines = lines.slice(currentLine, endLine);
  
  return yankedLines.join('\n') + '\n';
}

/**
 * 後方にペースト
 */
export function pasteAfter(
  textarea: HTMLTextAreaElement,
  content: string
): void {
  const normalized = normalizeCRLF(content);
  
  if (normalized.endsWith('\n')) {
    // 行単位のペースト
    const text = textarea.value;
    let lineEnd = text.indexOf('\n', textarea.selectionStart);
    if (lineEnd === -1) lineEnd = text.length;
    
    textarea.selectionStart = lineEnd;
    textarea.selectionEnd = lineEnd;
    insertText(textarea, '\n' + normalized.slice(0, -1));
  } else {
    // 文字単位のペースト
    textarea.selectionStart++;
    textarea.selectionEnd = textarea.selectionStart;
    insertText(textarea, normalized);
  }
}

/**
 * 前方にペースト
 */
export function pasteBefore(
  textarea: HTMLTextAreaElement,
  content: string
): void {
  const normalized = normalizeCRLF(content);
  
  if (normalized.endsWith('\n')) {
    // 行単位のペースト
    const text = textarea.value;
    const lineStart = text.lastIndexOf('\n', textarea.selectionStart - 1) + 1;
    
    textarea.selectionStart = lineStart;
    textarea.selectionEnd = lineStart;
    insertText(textarea, normalized);
    
    // カーソルを行頭に
    textarea.selectionStart = lineStart;
    textarea.selectionEnd = lineStart;
  } else {
    // 文字単位のペースト
    insertText(textarea, normalized);
  }
}

/**
 * 行を結合
 */
export function joinLines(
  textarea: HTMLTextAreaElement,
  count: number = 1
): void {
  const text = textarea.value;
  const pos = textarea.selectionStart;
  
  for (let i = 0; i < count; i++) {
    let lineEnd = textarea.value.indexOf('\n', textarea.selectionStart);
    if (lineEnd === -1) break;
    
    // 次の行の先頭空白を取得
    const nextLineStart = lineEnd + 1;
    let nextLineFirstNonBlank = nextLineStart;
    while (
      nextLineFirstNonBlank < textarea.value.length &&
      /\s/.test(textarea.value[nextLineFirstNonBlank]) &&
      textarea.value[nextLineFirstNonBlank] !== '\n'
    ) {
      nextLineFirstNonBlank++;
    }
    
    // 改行と空白を削除してスペースに置換
    textarea.value =
      textarea.value.substring(0, lineEnd) +
      ' ' +
      textarea.value.substring(nextLineFirstNonBlank);
    
    textarea.selectionStart = lineEnd;
    textarea.selectionEnd = lineEnd;
  }
}

/**
 * 大文字/小文字を切り替え
 */
export function toggleCase(
  textarea: HTMLTextAreaElement,
  count: number = 1
): void {
  const text = textarea.value;
  const pos = textarea.selectionStart;
  const end = Math.min(pos + count, text.length);
  
  let result = '';
  for (let i = pos; i < end; i++) {
    const char = text[i];
    if (char === char.toLowerCase()) {
      result += char.toUpperCase();
    } else {
      result += char.toLowerCase();
    }
  }
  
  textarea.value = text.substring(0, pos) + result + text.substring(end);
  textarea.selectionStart = end;
  textarea.selectionEnd = end;
}

/**
 * インデントを追加
 */
export function indentLine(
  textarea: HTMLTextAreaElement,
  count: number = 1,
  width: number = 2
): void {
  const text = textarea.value;
  const pos = textarea.selectionStart;
  const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
  
  const indent = ' '.repeat(width * count);
  textarea.value = text.substring(0, lineStart) + indent + text.substring(lineStart);
  
  textarea.selectionStart = pos + indent.length;
  textarea.selectionEnd = textarea.selectionStart;
}

/**
 * インデントを削除
 */
export function dedentLine(
  textarea: HTMLTextAreaElement,
  count: number = 1,
  width: number = 2
): void {
  const text = textarea.value;
  const pos = textarea.selectionStart;
  const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
  
  // 行頭の空白を取得
  let spaceEnd = lineStart;
  while (spaceEnd < text.length && text[spaceEnd] === ' ') {
    spaceEnd++;
  }
  
  const currentIndent = spaceEnd - lineStart;
  const removeCount = Math.min(currentIndent, width * count);
  
  if (removeCount > 0) {
    textarea.value =
      text.substring(0, lineStart) +
      text.substring(lineStart + removeCount);
    
    textarea.selectionStart = Math.max(lineStart, pos - removeCount);
    textarea.selectionEnd = textarea.selectionStart;
  }
}

/**
 * Undo履歴に保存
 */
export function saveToHistory(
  textarea: HTMLTextAreaElement,
  undoStack: HistoryEntry[],
  maxSize: number = 100
): void {
  undoStack.push({
    text: textarea.value,
    pos: textarea.selectionStart
  });
  
  if (undoStack.length > maxSize) {
    undoStack.shift();
  }
}

/**
 * Undo
 */
export function undo(
  textarea: HTMLTextAreaElement,
  undoStack: HistoryEntry[],
  redoStack: HistoryEntry[]
): boolean {
  if (undoStack.length === 0) return false;
  
  redoStack.push({
    text: textarea.value,
    pos: textarea.selectionStart
  });
  
  const state = undoStack.pop()!;
  textarea.value = state.text;
  textarea.selectionStart = state.pos;
  textarea.selectionEnd = state.pos;
  
  return true;
}

/**
 * Redo
 */
export function redo(
  textarea: HTMLTextAreaElement,
  undoStack: HistoryEntry[],
  redoStack: HistoryEntry[]
): boolean {
  if (redoStack.length === 0) return false;
  
  undoStack.push({
    text: textarea.value,
    pos: textarea.selectionStart
  });
  
  const state = redoStack.pop()!;
  textarea.value = state.text;
  textarea.selectionStart = state.pos;
  textarea.selectionEnd = state.pos;
  
  return true;
}

/**
 * レジスタに保存
 */
export function saveToRegister(
  registers: Registers,
  text: string,
  registerName: string = '"',
  isDelete: boolean = false
): void {
  // デフォルトレジスタに保存
  registers['"'] = text;
  
  if (!isDelete) {
    // ヤンクレジスタに保存
    registers['0'] = text;
  }
  
  // 名前付きレジスタへの保存
  if (registerName !== '"' && /[a-zA-Z]/.test(registerName)) {
    if (registerName === registerName.toUpperCase()) {
      // 大文字は追記
      const lowerReg = registerName.toLowerCase();
      registers[lowerReg] = (registers[lowerReg] || '') + text;
    } else {
      registers[registerName] = text;
    }
  }
  
  // クリップボードにもコピー（ヤンク時のみ）
  if (!isDelete && text && navigator.clipboard) {
    navigator.clipboard.writeText(text).catch(() => {
      // クリップボードAPIが使えない場合は無視
    });
  }
}

/**
 * レジスタから取得
 */
export function getFromRegister(
  registers: Registers,
  registerName: string = '"'
): string {
  if (registerName === '"') {
    return registers['"'] || '';
  }
  return registers[registerName.toLowerCase()] || registers['"'] || '';
}
