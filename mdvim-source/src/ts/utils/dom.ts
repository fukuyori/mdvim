/**
 * DOM Utilities
 */

/**
 * 要素を取得（型安全）
 */
export function getElementById<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) {
    throw new Error(`Element not found: #${id}`);
  }
  return element as T;
}

/**
 * 要素を取得（null許容）
 */
export function getElementByIdOrNull<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

/**
 * クエリセレクタ（型安全）
 */
export function querySelector<T extends HTMLElement>(selector: string, parent: ParentNode = document): T {
  const element = parent.querySelector(selector);
  if (!element) {
    throw new Error(`Element not found: ${selector}`);
  }
  return element as T;
}

/**
 * クエリセレクタ（null許容）
 */
export function querySelectorOrNull<T extends HTMLElement>(selector: string, parent: ParentNode = document): T | null {
  return parent.querySelector(selector) as T | null;
}

/**
 * 全要素取得
 */
export function querySelectorAll<T extends HTMLElement>(selector: string, parent: ParentNode = document): T[] {
  return Array.from(parent.querySelectorAll(selector)) as T[];
}

/**
 * 要素を作成
 */
export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attributes?: Record<string, string>,
  children?: (Node | string)[]
): HTMLElementTagNameMap[K] {
  const element = document.createElement(tag);
  
  if (attributes) {
    for (const [key, value] of Object.entries(attributes)) {
      element.setAttribute(key, value);
    }
  }
  
  if (children) {
    for (const child of children) {
      if (typeof child === 'string') {
        element.appendChild(document.createTextNode(child));
      } else {
        element.appendChild(child);
      }
    }
  }
  
  return element;
}

/**
 * クラスを切り替え
 */
export function toggleClass(element: HTMLElement, className: string, force?: boolean): boolean {
  return element.classList.toggle(className, force);
}

/**
 * クラスを追加
 */
export function addClass(element: HTMLElement, ...classNames: string[]): void {
  element.classList.add(...classNames);
}

/**
 * クラスを削除
 */
export function removeClass(element: HTMLElement, ...classNames: string[]): void {
  element.classList.remove(...classNames);
}

/**
 * クラスを持っているか
 */
export function hasClass(element: HTMLElement, className: string): boolean {
  return element.classList.contains(className);
}

/**
 * 表示/非表示
 */
export function setVisible(element: HTMLElement, visible: boolean): void {
  toggleClass(element, 'hidden', !visible);
}

/**
 * 要素にスクロール
 */
export function scrollIntoView(element: HTMLElement, options?: ScrollIntoViewOptions): void {
  element.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
    ...options
  });
}

/**
 * テキストエリアの選択範囲を設定
 */
export function setSelection(textarea: HTMLTextAreaElement, start: number, end?: number): void {
  textarea.selectionStart = start;
  textarea.selectionEnd = end ?? start;
  textarea.focus();
}

/**
 * テキストエリアの選択範囲を取得
 */
export function getSelection(textarea: HTMLTextAreaElement): { start: number; end: number; text: string } {
  return {
    start: textarea.selectionStart,
    end: textarea.selectionEnd,
    text: textarea.value.substring(textarea.selectionStart, textarea.selectionEnd)
  };
}

/**
 * テキストエリアにテキストを挿入
 */
export function insertText(textarea: HTMLTextAreaElement, text: string): void {
  const start = textarea.selectionStart;
  const end = textarea.selectionEnd;
  const before = textarea.value.substring(0, start);
  const after = textarea.value.substring(end);
  
  textarea.value = before + text + after;
  
  const newPos = start + text.length;
  setSelection(textarea, newPos);
}

/**
 * カスタムイベントを発火
 */
export function dispatchCustomEvent<T>(target: EventTarget, eventName: string, detail?: T): boolean {
  const event = new CustomEvent(eventName, { detail, bubbles: true, cancelable: true });
  return target.dispatchEvent(event);
}

/**
 * debounce関数
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return function (this: unknown, ...args: Parameters<T>) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, wait);
  };
}

/**
 * throttle関数
 */
export function throttle<T extends (...args: unknown[]) => unknown>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle = false;
  
  return function (this: unknown, ...args: Parameters<T>) {
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
      }, limit);
    }
  };
}
