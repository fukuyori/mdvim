/**
 * mdvim Type Definitions
 */

// =============================================================================
// Vim Editor Types
// =============================================================================

/** Vimのモード */
export type VimMode = 'normal' | 'insert' | 'visual' | 'command';

/** テーマ */
export type Theme = 'dark' | 'light' | 'original';

/** 自動保存間隔 */
export type AutoSaveInterval = 'off' | '1s' | '5s' | '10s' | '30s' | '60s';

/** 検索方向 */
export type FindDirection = 1 | -1;

/** 検索タイプ */
export type FindType = 'f' | 't';

/** Undo/Redo履歴エントリ */
export interface HistoryEntry {
  text: string;
  pos: number;
}

/** 最後の編集操作 */
export interface LastEdit {
  type: 'insert' | 'delete' | 'change';
  text: string;
  startPos: number;
  endPos: number;
}

/** レジスタ（ヤンク/削除バッファ） */
export type Registers = Record<string, string>;

/** マーク位置 */
export type Marks = Record<string, number>;

/** マクロ */
export interface MacroKey {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
}

export type Macros = Record<string, MacroKey[]>;

/** VimEditorの状態 */
export interface VimEditorState {
  mode: VimMode;
  vimMode: boolean;
  registers: Registers;
  marks: Marks;
  macros: Macros;
  undoStack: HistoryEntry[];
  redoStack: HistoryEntry[];
  modified: boolean;
  searchTerm: string;
  count: string;
  pendingKey: string;
  pendingOperator: string;
  visualStart: number | null;
  visualLine: boolean;
  recordingMacro: string | null;
  macroBuffer: MacroKey[];
  lastMacro: string | null;
  lastFindChar: string | null;
  lastFindDirection: FindDirection;
  lastFindType: FindType;
  lastEdit: LastEdit | null;
  lastEditText: string;
  previousPosition: number | null;
  selectedRegister: string;
  currentFileName: string;
  currentFileHandle: FileSystemFileHandle | null;
  sessionId: string;
  autoSaveInterval: AutoSaveInterval;
  fontSize: number;
  storageAvailable: boolean;
}

/** VimEditorの設定 */
export interface VimEditorConfig {
  defaultFileName: string;
  defaultTheme: Theme;
  defaultFontSize: number;
  defaultAutoSaveInterval: AutoSaveInterval;
  maxUndoStack: number;
  maxSessions: number;
}

// =============================================================================
// Markdown Parser Types
// =============================================================================

/** 目次エントリ */
export interface TocEntry {
  level: number;
  text: string;
  id: string;
  line: number;
}

/** パース結果 */
export interface ParseResult {
  html: string;
  toc: TocEntry[];
  sourceMap?: Map<number, string>;
}

/** コードブロック情報 */
export interface CodeBlockInfo {
  lang: string;
  code: string;
  startLine: number;
  endLine: number;
}

/** アラートタイプ */
export type AlertType = 'NOTE' | 'TIP' | 'IMPORTANT' | 'WARNING' | 'CAUTION';

/** GitHubアラート情報 */
export interface AlertInfo {
  type: AlertType;
  content: string;
}

// =============================================================================
// Storage Types
// =============================================================================

/** セッションデータ */
export interface SessionData {
  content: string;
  filename: string;
  timestamp: number;
}

/** 保存設定 */
export interface StorageSettings {
  theme: Theme;
  fontSize: number;
  vimMode: boolean;
  autoSaveInterval: AutoSaveInterval;
}

// =============================================================================
// Export Types
// =============================================================================

/** エクスポート形式 */
export type ExportFormat = 'html' | 'pdf';

/** エクスポートオプション */
export interface ExportOptions {
  includeStyles: boolean;
  includeTableOfContents: boolean;
  theme: Theme;
  title?: string;
}

// =============================================================================
// DOM Element References
// =============================================================================

/** エディタDOM要素 */
export interface EditorElements {
  editor: HTMLTextAreaElement;
  preview: HTMLElement;
  lineNumbers: HTMLElement;
  modeIndicator: HTMLElement;
  cursorPos: HTMLElement;
  commandLine: HTMLElement;
  commandInput: HTMLInputElement;
  commandPrefix: HTMLElement;
  fileStatus: HTMLElement;
  fileName: HTMLElement;
  macroIndicator: HTMLElement;
  cursorOverlay: HTMLElement;
  fileInput: HTMLInputElement;
  fontSizeDisplay: HTMLElement;
  tocPane: HTMLElement;
  tocContent: HTMLElement;
  tocOpenBtn: HTMLElement;
}

// =============================================================================
// Event Types
// =============================================================================

/** カスタムイベント */
export interface MdvimEvents {
  'mode-change': { mode: VimMode };
  'content-change': { content: string };
  'file-open': { filename: string };
  'file-save': { filename: string };
  'theme-change': { theme: Theme };
}

// =============================================================================
// Utility Types
// =============================================================================

/** コマンドハンドラ */
export type CommandHandler = (args: string) => void | Promise<void>;

/** コマンド定義 */
export interface CommandDefinition {
  name: string;
  aliases?: string[];
  handler: CommandHandler;
  description: string;
}

/** キーバインド */
export interface KeyBinding {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  handler: () => void;
  mode?: VimMode | VimMode[];
}

// =============================================================================
// JSZip Types (CDNから読み込み)
// =============================================================================

declare global {
  interface Window {
    JSZip: typeof JSZip;
  }
  
  class JSZip {
    constructor();
    file(name: string, data: string | Blob | ArrayBuffer, options?: { base64?: boolean }): this;
    file(name: string): JSZipObject | null;
    folder(name: string): JSZip;
    files: Record<string, JSZipObject>;
    generateAsync(options: { type: 'blob' | 'arraybuffer' | 'base64' | 'string' }): Promise<Blob | ArrayBuffer | string>;
    static loadAsync(data: Blob | ArrayBuffer | string): Promise<JSZip>;
  }
  
  interface JSZipObject {
    name: string;
    dir: boolean;
    async(type: 'string' | 'base64' | 'arraybuffer' | 'blob'): Promise<string | ArrayBuffer | Blob>;
  }
  
  
  // Turndown (HTML to Markdown)
  class TurndownService {
    constructor(options?: TurndownOptions);
    turndown(html: string | HTMLElement): string;
    addRule(key: string, rule: TurndownRule): this;
    keep(filter: string | string[]): this;
    remove(filter: string | string[]): this;
  }
  
  interface TurndownOptions {
    headingStyle?: 'setext' | 'atx';
    hr?: string;
    bulletListMarker?: '-' | '+' | '*';
    codeBlockStyle?: 'indented' | 'fenced';
    fence?: '```' | '~~~';
    emDelimiter?: '_' | '*';
    strongDelimiter?: '__' | '**';
    linkStyle?: 'inlined' | 'referenced';
    linkReferenceStyle?: 'full' | 'collapsed' | 'shortcut';
  }
  
  interface TurndownRule {
    filter: string | string[] | ((node: HTMLElement, options: TurndownOptions) => boolean);
    replacement: (content: string, node: HTMLElement, options: TurndownOptions) => string;
  }
  
  // Mammoth (DOCX to HTML)
  namespace mammoth {
    function convertToHtml(input: { arrayBuffer: ArrayBuffer }, options?: MammothOptions): Promise<MammothResult>;
    function extractRawText(input: { arrayBuffer: ArrayBuffer }): Promise<{ value: string }>;
    
    interface MammothOptions {
      styleMap?: string[];
      includeDefaultStyleMap?: boolean;
      convertImage?: ImageConverter;
    }
    
    interface MammothResult {
      value: string;
      messages: MammothMessage[];
    }
    
    interface MammothMessage {
      type: string;
      message: string;
    }
    
    interface ImageConverter {
      (image: MammothImage): Promise<{ src: string }>;
    }
    
    interface MammothImage {
      read(encoding: 'base64'): Promise<string>;
      contentType: string;
    }
    
    namespace images {
      function imgElement(converter: (image: MammothImage) => Promise<{ src: string }>): ImageConverter;
    }
  }
}
