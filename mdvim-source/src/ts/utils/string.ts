/**
 * String Utilities
 */

/**
 * CRLFをLFに正規化
 */
export function normalizeCRLF(text: string | null | undefined): string {
  if (!text) return '';
  return text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

/**
 * HTMLエスケープ
 */
export function escapeHtml(text: string): string {
  const escapeMap: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, char => escapeMap[char]);
}

/**
 * 正規表現エスケープ
 */
export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 文字列をスラッグ化（URL用ID生成）
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[\s]+/g, '-')
    .replace(/[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF-]/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * 文字列を指定行数に分割
 */
export function splitLines(text: string): string[] {
  return text.split('\n');
}

/**
 * 行番号から位置を取得
 */
export function getPositionFromLine(text: string, lineNumber: number): number {
  const lines = splitLines(text);
  let pos = 0;
  for (let i = 0; i < lineNumber && i < lines.length; i++) {
    pos += lines[i].length + 1; // +1 for newline
  }
  return pos;
}

/**
 * 位置から行番号を取得
 */
export function getLineFromPosition(text: string, position: number): number {
  const textBefore = text.substring(0, position);
  return (textBefore.match(/\n/g) || []).length;
}

/**
 * 指定行のテキストを取得
 */
export function getLineText(text: string, lineNumber: number): string {
  const lines = splitLines(text);
  return lines[lineNumber] || '';
}

/**
 * 単語境界を検出
 */
export function isWordChar(char: string): boolean {
  return /[\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/.test(char);
}

/**
 * 空白文字を検出
 */
export function isWhitespace(char: string): boolean {
  return /\s/.test(char);
}

/**
 * 文字数をカウント（サロゲートペア対応）
 */
export function countChars(text: string): number {
  return [...text].length;
}

/**
 * 単語数をカウント
 */
export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  // 日本語と英語の両方に対応
  const englishWords = trimmed.match(/[a-zA-Z]+/g) || [];
  const japaneseChars = trimmed.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g) || [];
  return englishWords.length + japaneseChars.length;
}

/**
 * 行数をカウント
 */
export function countLines(text: string): number {
  if (!text) return 0;
  return splitLines(text).length;
}
