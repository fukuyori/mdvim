/**
 * mdvim - Vim-style Markdown Editor
 * Main Entry Point
 */

// Types
export * from './types';

// Utils - 選択的エクスポート
export {
  normalizeCRLF,
  escapeHtml,
  escapeRegex,
  slugify,
  splitLines,
  getPositionFromLine,
  getLineFromPosition,
  getLineText,
  isWordChar,
  isWhitespace,
  countChars,
  countWords,
  countLines
} from './utils/string';

export {
  getElementById,
  getElementByIdOrNull,
  querySelector,
  querySelectorOrNull,
  querySelectorAll,
  createElement,
  toggleClass,
  addClass,
  removeClass,
  hasClass,
  setVisible,
  scrollIntoView,
  setSelection,
  getSelection,
  debounce,
  throttle,
  dispatchCustomEvent
} from './utils/dom';

export {
  isFileSystemAccessSupported,
  openFile,
  openFileWithInput,
  saveFile,
  downloadFile,
  downloadBlob,
  readDroppedFile,
  isTextFile,
  getExtension,
  removeExtension,
  sanitizeFilename
} from './utils/file';

// Parser
export { MarkdownParser, markdownParser, parseMarkdown, parseInline } from './parser';

// Storage
export { SessionManager, sessionManager } from './storage';

// Editor
export { VimEditor } from './editor';
export * from './editor/VimMotions';
export {
  deleteRange,
  deleteLine,
  deleteWord,
  deleteToLineEnd,
  yankLine,
  pasteAfter,
  pasteBefore,
  joinLines,
  toggleCase,
  indentLine,
  dedentLine,
  saveToHistory,
  undo,
  redo,
  saveToRegister,
  getFromRegister
} from './editor/VimOperators';
export * from './editor/VimCommands';

// Version
export const VERSION = '0.8.0';

// Re-export VimEditor for global access
import { VimEditor } from './editor';
export { VimEditor as default };
