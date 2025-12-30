/**
 * File Utilities
 */

import { normalizeCRLF } from './string';

/**
 * File System Access APIがサポートされているか
 */
export function isFileSystemAccessSupported(): boolean {
  return 'showOpenFilePicker' in window && 'showSaveFilePicker' in window;
}

/**
 * ファイルを開く（File System Access API）
 */
export async function openFile(): Promise<{ content: string; name: string; handle: FileSystemFileHandle } | null> {
  if (!isFileSystemAccessSupported()) {
    return null;
  }
  
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [
        {
          description: 'Markdown files',
          accept: {
            'text/markdown': ['.md', '.markdown'],
            'text/plain': ['.txt']
          }
        }
      ],
      multiple: false
    });
    
    const file = await handle.getFile();
    const content = await file.text();
    
    return {
      content: normalizeCRLF(content),
      name: file.name,
      handle
    };
  } catch (err) {
    // ユーザーがキャンセルした場合
    if ((err as Error).name === 'AbortError') {
      return null;
    }
    throw err;
  }
}

/**
 * ファイルを開く（従来のFile API）
 */
export function openFileWithInput(input: HTMLInputElement): Promise<{ content: string; name: string } | null> {
  return new Promise((resolve) => {
    const handleChange = async () => {
      const file = input.files?.[0];
      if (!file) {
        resolve(null);
        return;
      }
      
      const content = await file.text();
      resolve({
        content: normalizeCRLF(content),
        name: file.name
      });
      
      // リセット
      input.value = '';
    };
    
    input.onchange = handleChange;
    input.click();
  });
}

/**
 * ファイルを保存（File System Access API）
 */
export async function saveFile(
  content: string,
  suggestedName: string,
  existingHandle?: FileSystemFileHandle | null
): Promise<FileSystemFileHandle | null> {
  if (!isFileSystemAccessSupported()) {
    downloadFile(content, suggestedName);
    return null;
  }
  
  try {
    const handle = existingHandle || await window.showSaveFilePicker({
      suggestedName,
      types: [
        {
          description: 'Markdown files',
          accept: { 'text/markdown': ['.md'] }
        },
        {
          description: 'Text files',
          accept: { 'text/plain': ['.txt'] }
        }
      ]
    });
    
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    
    return handle;
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      return null;
    }
    throw err;
  }
}

/**
 * ファイルをダウンロード（フォールバック）
 */
export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  
  URL.revokeObjectURL(url);
}

/**
 * Blobをダウンロード
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  
  URL.revokeObjectURL(url);
}

/**
 * ファイルをドラッグ&ドロップで読み込み
 */
export async function readDroppedFile(
  dataTransfer: DataTransfer
): Promise<{ content: string; name: string; handle?: FileSystemFileHandle } | null> {
  // File System Access API を試す
  const items = dataTransfer.items;
  if (items && items.length > 0 && 'getAsFileSystemHandle' in items[0]) {
    try {
      const handle = await (items[0] as DataTransferItem & { getAsFileSystemHandle(): Promise<FileSystemHandle> }).getAsFileSystemHandle();
      if (handle && handle.kind === 'file') {
        const fileHandle = handle as FileSystemFileHandle;
        const file = await fileHandle.getFile();
        
        if (isTextFile(file)) {
          const content = await file.text();
          return {
            content: normalizeCRLF(content),
            name: file.name,
            handle: fileHandle
          };
        }
      }
    } catch {
      // フォールバック
    }
  }
  
  // 従来のFile APIを使用
  const file = dataTransfer.files[0];
  if (file && isTextFile(file)) {
    const content = await file.text();
    return {
      content: normalizeCRLF(content),
      name: file.name
    };
  }
  
  return null;
}

/**
 * テキストファイルかどうか判定
 */
export function isTextFile(file: File): boolean {
  return (
    file.type.startsWith('text/') ||
    file.name.endsWith('.md') ||
    file.name.endsWith('.markdown') ||
    file.name.endsWith('.txt')
  );
}

/**
 * ファイル名から拡張子を取得
 */
export function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return '';
  return filename.substring(lastDot + 1).toLowerCase();
}

/**
 * ファイル名から拡張子を除去
 */
export function removeExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot === -1) return filename;
  return filename.substring(0, lastDot);
}

/**
 * 安全なファイル名に変換
 */
export function sanitizeFilename(filename: string): string {
  return filename
    .replace(/[<>:"/\\|?*]/g, '_')
    .replace(/\s+/g, '_')
    .substring(0, 255);
}

// Window型拡張（File System Access API）
declare global {
  interface Window {
    showOpenFilePicker(options?: OpenFilePickerOptions): Promise<FileSystemFileHandle[]>;
    showSaveFilePicker(options?: SaveFilePickerOptions): Promise<FileSystemFileHandle>;
  }
  
  interface OpenFilePickerOptions {
    multiple?: boolean;
    excludeAcceptAllOption?: boolean;
    types?: FilePickerAcceptType[];
  }
  
  interface SaveFilePickerOptions {
    suggestedName?: string;
    excludeAcceptAllOption?: boolean;
    types?: FilePickerAcceptType[];
  }
  
  interface FilePickerAcceptType {
    description?: string;
    accept: Record<string, string[]>;
  }
}
