/**
 * Vim Commands
 * コマンドラインモード（: コマンド）の処理
 */

import type { CommandDefinition, CommandHandler } from '../types';

/** コマンドレジストリ */
const commands: Map<string, CommandDefinition> = new Map();

/**
 * コマンドを登録
 */
export function registerCommand(definition: CommandDefinition): void {
  commands.set(definition.name, definition);
  
  if (definition.aliases) {
    for (const alias of definition.aliases) {
      commands.set(alias, definition);
    }
  }
}

/**
 * コマンドを取得
 */
export function getCommand(name: string): CommandDefinition | undefined {
  return commands.get(name);
}

/**
 * コマンドを実行
 */
export async function executeCommand(
  input: string,
  context: CommandContext
): Promise<CommandResult> {
  const trimmed = input.trim();
  
  // 空のコマンド
  if (!trimmed) {
    return { success: false, message: '' };
  }
  
  // 行番号へのジャンプ
  if (/^\d+$/.test(trimmed)) {
    const lineNumber = parseInt(trimmed, 10);
    context.gotoLine(lineNumber);
    return { success: true, message: `Line ${lineNumber}` };
  }
  
  // コマンドと引数を分離
  const match = trimmed.match(/^(\S+)(?:\s+(.*))?$/);
  if (!match) {
    return { success: false, message: 'Invalid command' };
  }
  
  const [, cmdName, args = ''] = match;
  
  // 置換コマンド (s/old/new/g)
  const substituteMatch = trimmed.match(/^(%)?s\/([^/]*)\/([^/]*)\/([gi]*)$/);
  if (substituteMatch) {
    const [, global, pattern, replacement, flags] = substituteMatch;
    return executeSubstitute(context, pattern, replacement, flags, !!global);
  }
  
  // 登録されたコマンドを検索
  const command = getCommand(cmdName);
  if (command) {
    try {
      await command.handler(args);
      return { success: true };
    } catch (e) {
      return { success: false, message: String(e) };
    }
  }
  
  return { success: false, message: `Unknown command: ${cmdName}` };
}

/**
 * 置換コマンドを実行
 */
function executeSubstitute(
  context: CommandContext,
  pattern: string,
  replacement: string,
  flags: string,
  global: boolean
): CommandResult {
  if (!pattern) {
    return { success: false, message: 'No pattern specified' };
  }
  
  const textarea = context.editor;
  const text = textarea.value;
  
  const regexFlags = flags.includes('i') ? 'gi' : 'g';
  const regex = new RegExp(pattern, regexFlags);
  
  let newText: string;
  let count = 0;
  
  if (global) {
    // 全体置換
    newText = text.replace(regex, () => {
      count++;
      return replacement;
    });
  } else {
    // 現在行のみ置換
    const pos = textarea.selectionStart;
    const lineStart = text.lastIndexOf('\n', pos - 1) + 1;
    let lineEnd = text.indexOf('\n', pos);
    if (lineEnd === -1) lineEnd = text.length;
    
    const line = text.substring(lineStart, lineEnd);
    const newLine = flags.includes('g')
      ? line.replace(regex, () => { count++; return replacement; })
      : line.replace(new RegExp(pattern, flags.includes('i') ? 'i' : ''), () => { count++; return replacement; });
    
    newText = text.substring(0, lineStart) + newLine + text.substring(lineEnd);
  }
  
  if (count > 0) {
    context.saveState();
    textarea.value = newText;
    context.updatePreview();
    return { success: true, message: `${count} substitution(s)` };
  }
  
  return { success: false, message: 'Pattern not found' };
}

/** コマンド実行コンテキスト */
export interface CommandContext {
  editor: HTMLTextAreaElement;
  saveState: () => void;
  updatePreview: () => void;
  gotoLine: (line: number) => void;
  showStatus: (message: string, isError?: boolean) => void;
  openFile: () => void;
  saveFile: () => void;
  newFile: () => void;
  editFile: (filename: string, force?: boolean) => void;
  isModified: () => boolean;
  setTheme: (theme: string) => void;
  setVimMode: (enabled: boolean) => void;
  setWrap: (enabled: boolean) => void;
  quit: () => void;
  exportAs: (format: string) => Promise<void>;
  getImageCount: () => number;
  importFromUrl: (url: string) => Promise<void>;
  importFromClipboard: () => Promise<void>;
  openImportDialog: () => void;
}

/** コマンド実行結果 */
export interface CommandResult {
  success: boolean;
  message?: string;
}

/**
 * 組み込みコマンドを登録
 */
export function registerBuiltinCommands(context: CommandContext): void {
  // ファイル操作
  registerCommand({
    name: 'w',
    aliases: ['write', 'save'],
    handler: () => context.saveFile(),
    description: 'Save file'
  });
  
  registerCommand({
    name: 'e',
    aliases: ['edit'],
    handler: (args) => {
      if (!args) {
        // 引数なし: ファイルを開くダイアログ
        if (context.isModified()) {
          context.showStatus('No write since last change (add ! to override)', true);
          return;
        }
        context.openFile();
      } else {
        // 引数あり: 指定ファイルを新規作成/編集
        if (context.isModified()) {
          context.showStatus('No write since last change (add ! to override)', true);
          return;
        }
        context.editFile(args, false);
      }
    },
    description: 'Edit file (create new if not exists)'
  });
  
  registerCommand({
    name: 'e!',
    aliases: ['edit!'],
    handler: (args) => {
      if (!args) {
        // 引数なし: 強制的にファイルを開くダイアログ
        context.openFile();
      } else {
        // 引数あり: 強制的に指定ファイルを新規作成/編集
        context.editFile(args, true);
      }
    },
    description: 'Edit file (discard changes)'
  });
  
  registerCommand({
    name: 'new',
    handler: () => context.newFile(),
    description: 'New file'
  });
  
  registerCommand({
    name: 'q',
    aliases: ['quit', 'exit'],
    handler: () => context.quit(),
    description: 'Quit'
  });
  
  registerCommand({
    name: 'wq',
    handler: () => {
      context.saveFile();
      context.quit();
    },
    description: 'Save and quit'
  });
  
  // テーマ
  registerCommand({
    name: 'theme',
    handler: (args) => {
      if (args) {
        context.setTheme(args);
      }
    },
    description: 'Set theme (dark/light/original)'
  });
  
  // ヘルプ
  registerCommand({
    name: 'help',
    aliases: ['h'],
    handler: () => {
      // ヘルプモーダルを表示
      const modal = document.getElementById('help-modal');
      if (modal) {
        modal.classList.remove('hidden');
      }
    },
    description: 'Show help'
  });
  
  // 設定
  registerCommand({
    name: 'set',
    handler: (args) => {
      const parts = args.split(/\s+/);
      const option = parts[0];
      const value = parts[1];
      
      switch (option) {
        case 'vim':
          context.setVimMode(true);
          context.showStatus('VIM mode enabled');
          break;
        case 'novim':
          context.setVimMode(false);
          context.showStatus('VIM mode disabled');
          break;
        case 'wrap':
          context.setWrap(true);
          context.showStatus('Word wrap enabled');
          break;
        case 'nowrap':
          context.setWrap(false);
          context.showStatus('Word wrap disabled');
          break;
        default:
          context.showStatus(`Unknown option: ${option}`, true);
      }
    },
    description: 'Set options'
  });
  
  // エクスポート
  registerCommand({
    name: 'export',
    handler: async (args) => {
      const format = args?.trim().split(/\s+/)[0]?.toLowerCase();
      if (!format) {
        context.showStatus('Usage: :export [md|html|docx]', true);
        return;
      }
      await context.exportAs(format);
    },
    description: 'Export document (:export md|html|docx)'
  });
  
  // 画像情報
  registerCommand({
    name: 'images',
    handler: () => {
      const count = context.getImageCount();
      context.showStatus(`${count} image(s) embedded`);
    },
    description: 'Show embedded image count'
  });
  
  // インポート
  registerCommand({
    name: 'import',
    aliases: ['read'],
    handler: async (args) => {
      const arg = args?.trim();
      if (!arg) {
        context.showStatus('Usage: :import [file|clipboard|<url>]', true);
        return;
      }
      
      if (arg === 'file') {
        context.openImportDialog();
      } else if (arg === 'clipboard') {
        await context.importFromClipboard();
      } else {
        // URLとして扱う
        await context.importFromUrl(arg);
      }
    },
    description: 'Import from file/clipboard/URL (:import file|clipboard|<url>)'
  });
}

/**
 * コマンド補完候補を取得
 */
export function getCompletions(input: string): string[] {
  const prefix = input.toLowerCase();
  const results: string[] = [];
  
  for (const [name] of commands) {
    if (name.startsWith(prefix)) {
      results.push(name);
    }
  }
  
  return results.sort();
}

/**
 * コマンド履歴
 */
export class CommandHistory {
  private history: string[] = [];
  private index = -1;
  private maxSize: number;
  
  constructor(maxSize: number = 50) {
    this.maxSize = maxSize;
  }
  
  add(command: string): void {
    if (command && command !== this.history[this.history.length - 1]) {
      this.history.push(command);
      if (this.history.length > this.maxSize) {
        this.history.shift();
      }
    }
    this.index = this.history.length;
  }
  
  previous(): string | undefined {
    if (this.index > 0) {
      this.index--;
      return this.history[this.index];
    }
    return undefined;
  }
  
  next(): string | undefined {
    if (this.index < this.history.length - 1) {
      this.index++;
      return this.history[this.index];
    }
    this.index = this.history.length;
    return '';
  }
  
  reset(): void {
    this.index = this.history.length;
  }
}
