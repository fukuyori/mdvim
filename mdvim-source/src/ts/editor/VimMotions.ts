/**
 * Vim Motions
 * カーソル移動に関する処理
 */

import { isWordChar, isWhitespace, getLineFromPosition, getPositionFromLine, getLineText, splitLines } from '../utils/string';

/**
 * カーソルを左に移動
 */
export function moveLeft(
  textarea: HTMLTextAreaElement,
  count: number = 1
): void {
  const newPos = Math.max(0, textarea.selectionStart - count);
  textarea.selectionStart = newPos;
  textarea.selectionEnd = newPos;
}

/**
 * カーソルを右に移動
 */
export function moveRight(
  textarea: HTMLTextAreaElement,
  count: number = 1
): void {
  const newPos = Math.min(textarea.value.length, textarea.selectionStart + count);
  textarea.selectionStart = newPos;
  textarea.selectionEnd = newPos;
}

/**
 * カーソルを上に移動
 */
export function moveUp(
  textarea: HTMLTextAreaElement,
  count: number = 1
): void {
  const text = textarea.value;
  const pos = textarea.selectionStart;
  const lines = splitLines(text);
  
  let currentLine = 0;
  let lineStart = 0;
  let charCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    if (charCount + lines[i].length >= pos) {
      currentLine = i;
      lineStart = charCount;
      break;
    }
    charCount += lines[i].length + 1;
  }
  
  const column = pos - lineStart;
  const targetLine = Math.max(0, currentLine - count);
  
  let targetPos = 0;
  for (let i = 0; i < targetLine; i++) {
    targetPos += lines[i].length + 1;
  }
  targetPos += Math.min(column, lines[targetLine]?.length || 0);
  
  textarea.selectionStart = targetPos;
  textarea.selectionEnd = targetPos;
}

/**
 * カーソルを下に移動
 */
export function moveDown(
  textarea: HTMLTextAreaElement,
  count: number = 1
): void {
  const text = textarea.value;
  const pos = textarea.selectionStart;
  const lines = splitLines(text);
  
  let currentLine = 0;
  let lineStart = 0;
  let charCount = 0;
  
  for (let i = 0; i < lines.length; i++) {
    if (charCount + lines[i].length >= pos) {
      currentLine = i;
      lineStart = charCount;
      break;
    }
    charCount += lines[i].length + 1;
  }
  
  const column = pos - lineStart;
  const targetLine = Math.min(lines.length - 1, currentLine + count);
  
  let targetPos = 0;
  for (let i = 0; i < targetLine; i++) {
    targetPos += lines[i].length + 1;
  }
  targetPos += Math.min(column, lines[targetLine]?.length || 0);
  
  textarea.selectionStart = targetPos;
  textarea.selectionEnd = targetPos;
}

/**
 * 行頭に移動
 */
export function moveToLineStart(textarea: HTMLTextAreaElement): void {
  const text = textarea.value;
  const pos = textarea.selectionStart;
  const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
  textarea.selectionStart = lineStart;
  textarea.selectionEnd = lineStart;
}

/**
 * 行末に移動
 */
export function moveToLineEnd(textarea: HTMLTextAreaElement): void {
  const text = textarea.value;
  const pos = textarea.selectionStart;
  let lineEnd = text.indexOf('\n', pos);
  if (lineEnd === -1) lineEnd = text.length;
  textarea.selectionStart = lineEnd;
  textarea.selectionEnd = lineEnd;
}

/**
 * 最初の非空白文字に移動
 */
export function moveToFirstNonBlank(textarea: HTMLTextAreaElement): void {
  const text = textarea.value;
  const pos = textarea.selectionStart;
  const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
  let lineEnd = text.indexOf('\n', pos);
  if (lineEnd === -1) lineEnd = text.length;
  
  const line = text.substring(lineStart, lineEnd);
  const match = line.match(/^\s*/);
  const firstNonBlank = lineStart + (match ? match[0].length : 0);
  
  textarea.selectionStart = firstNonBlank;
  textarea.selectionEnd = firstNonBlank;
}

/**
 * 次の単語の先頭に移動
 */
export function moveWordForward(
  textarea: HTMLTextAreaElement,
  count: number = 1
): void {
  const text = textarea.value;
  let pos = textarea.selectionStart;
  
  for (let i = 0; i < count && pos < text.length; i++) {
    // 現在の単語をスキップ
    while (pos < text.length && isWordChar(text[pos])) {
      pos++;
    }
    // 空白をスキップ
    while (pos < text.length && isWhitespace(text[pos])) {
      pos++;
    }
    // 記号をスキップ
    while (pos < text.length && !isWordChar(text[pos]) && !isWhitespace(text[pos])) {
      pos++;
    }
  }
  
  textarea.selectionStart = pos;
  textarea.selectionEnd = pos;
}

/**
 * 前の単語の先頭に移動
 */
export function moveWordBackward(
  textarea: HTMLTextAreaElement,
  count: number = 1
): void {
  const text = textarea.value;
  let pos = textarea.selectionStart;
  
  for (let i = 0; i < count && pos > 0; i++) {
    pos--;
    // 空白をスキップ
    while (pos > 0 && isWhitespace(text[pos])) {
      pos--;
    }
    // 単語の先頭まで移動
    while (pos > 0 && isWordChar(text[pos - 1])) {
      pos--;
    }
  }
  
  textarea.selectionStart = pos;
  textarea.selectionEnd = pos;
}

/**
 * 単語の末尾に移動
 */
export function moveWordEnd(
  textarea: HTMLTextAreaElement,
  count: number = 1
): void {
  const text = textarea.value;
  let pos = textarea.selectionStart;
  
  for (let i = 0; i < count && pos < text.length; i++) {
    pos++;
    // 空白をスキップ
    while (pos < text.length && isWhitespace(text[pos])) {
      pos++;
    }
    // 単語の末尾まで移動
    while (pos < text.length - 1 && isWordChar(text[pos + 1])) {
      pos++;
    }
  }
  
  textarea.selectionStart = pos;
  textarea.selectionEnd = pos;
}

/**
 * 前の単語の末尾に移動 (ge)
 */
export function moveWordEndBackward(
  textarea: HTMLTextAreaElement,
  count: number = 1
): void {
  const text = textarea.value;
  let pos = textarea.selectionStart;
  
  for (let i = 0; i < count && pos > 0; i++) {
    pos--;
    // 空白をスキップ
    while (pos > 0 && isWhitespace(text[pos])) {
      pos--;
    }
    // 単語の末尾（つまり現在の単語文字の先頭-1の位置ではなく、単語の最後の文字）まで移動
    // 今いる位置が単語文字なら、前の単語の末尾を探す
    if (pos > 0 && isWordChar(text[pos])) {
      // 現在の単語の先頭を探す
      while (pos > 0 && isWordChar(text[pos - 1])) {
        pos--;
      }
      // さらに前へ
      if (pos > 0) {
        pos--;
        // 空白をスキップ
        while (pos > 0 && isWhitespace(text[pos])) {
          pos--;
        }
      }
    }
  }
  
  textarea.selectionStart = pos;
  textarea.selectionEnd = pos;
}

/**
 * 文書の先頭に移動
 */
export function moveToDocumentStart(textarea: HTMLTextAreaElement): void {
  textarea.selectionStart = 0;
  textarea.selectionEnd = 0;
}

/**
 * 文書の末尾に移動
 */
export function moveToDocumentEnd(textarea: HTMLTextAreaElement): void {
  const len = textarea.value.length;
  textarea.selectionStart = len;
  textarea.selectionEnd = len;
}

/**
 * 指定行に移動
 */
export function moveToLine(
  textarea: HTMLTextAreaElement,
  lineNumber: number
): void {
  const lines = splitLines(textarea.value);
  const targetLine = Math.max(0, Math.min(lineNumber - 1, lines.length - 1));
  
  let pos = 0;
  for (let i = 0; i < targetLine; i++) {
    pos += lines[i].length + 1;
  }
  
  textarea.selectionStart = pos;
  textarea.selectionEnd = pos;
}

/**
 * 行内検索（f/F）
 */
export function findCharInLine(
  textarea: HTMLTextAreaElement,
  char: string,
  direction: 1 | -1,
  beforeChar: boolean = false,
  count: number = 1
): boolean {
  const text = textarea.value;
  let pos = textarea.selectionStart;
  
  // 行の範囲を取得
  const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
  let lineEnd = text.indexOf('\n', pos);
  if (lineEnd === -1) lineEnd = text.length;
  
  let found = false;
  for (let i = 0; i < count; i++) {
    if (direction === 1) {
      // 前方検索
      const searchStart = pos + 1;
      const idx = text.indexOf(char, searchStart);
      if (idx !== -1 && idx < lineEnd) {
        pos = beforeChar ? idx - 1 : idx;
        found = true;
      }
    } else {
      // 後方検索
      const searchEnd = pos;
      const searchText = text.substring(lineStart, searchEnd);
      const idx = searchText.lastIndexOf(char);
      if (idx !== -1) {
        pos = lineStart + idx + (beforeChar ? 1 : 0);
        found = true;
      }
    }
  }
  
  if (found) {
    textarea.selectionStart = pos;
    textarea.selectionEnd = pos;
  }
  
  return found;
}

/**
 * 対応する括弧に移動
 */
export function moveToMatchingBracket(textarea: HTMLTextAreaElement): boolean {
  const text = textarea.value;
  const pos = textarea.selectionStart;
  const char = text[pos];
  
  const pairs: Record<string, string> = {
    '(': ')', ')': '(',
    '[': ']', ']': '[',
    '{': '}', '}': '{',
    '<': '>', '>': '<'
  };
  
  if (!pairs[char]) return false;
  
  const isOpening = '([{<'.includes(char);
  const target = pairs[char];
  let depth = 1;
  let i = pos + (isOpening ? 1 : -1);
  
  while (i >= 0 && i < text.length && depth > 0) {
    if (text[i] === char) depth++;
    if (text[i] === target) depth--;
    if (depth > 0) i += isOpening ? 1 : -1;
  }
  
  if (depth === 0) {
    textarea.selectionStart = i;
    textarea.selectionEnd = i;
    return true;
  }
  
  return false;
}

/**
 * 現在の行番号を取得
 */
export function getCurrentLine(textarea: HTMLTextAreaElement): number {
  return getLineFromPosition(textarea.value, textarea.selectionStart);
}

/**
 * 現在の列番号を取得
 */
export function getCurrentColumn(textarea: HTMLTextAreaElement): number {
  const text = textarea.value;
  const pos = textarea.selectionStart;
  const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
  return pos - lineStart;
}

/**
 * カーソル位置情報を取得
 */
export function getCursorInfo(textarea: HTMLTextAreaElement): {
  line: number;
  column: number;
  position: number;
} {
  return {
    line: getCurrentLine(textarea) + 1,
    column: getCurrentColumn(textarea) + 1,
    position: textarea.selectionStart
  };
}
