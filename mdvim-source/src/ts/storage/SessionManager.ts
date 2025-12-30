/**
 * Session Manager
 * ローカルストレージとセッションストレージの管理
 */

import type { SessionData, StorageSettings, Theme, AutoSaveInterval } from '../types';
import { normalizeCRLF } from '../utils/string';

/** ストレージキー */
const STORAGE_KEYS = {
  SESSIONS: 'vim-md-sessions',
  SESSION_PREFIX: 'vim-md-session-',
  CONTENT_PREFIX: 'vim-md-content-',
  THEME: 'vim-md-theme',
  FONT_SIZE: 'vim-md-font-size',
  VIM_MODE: 'vim-md-vim-mode',
  AUTO_SAVE: 'vim-md-autosave'
} as const;

/** 最大セッション数 */
const MAX_SESSIONS = 10;

/**
 * SessionManager クラス
 */
export class SessionManager {
  private sessionId: string;
  private storageAvailable: boolean;
  
  constructor() {
    this.storageAvailable = this.checkStorageAvailability();
    this.sessionId = this.initSessionId();
  }
  
  /**
   * ストレージが利用可能かチェック
   */
  private checkStorageAvailability(): boolean {
    try {
      const test = '__storage_test__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);
      return true;
    } catch {
      return false;
    }
  }
  
  /**
   * セッションIDを初期化
   */
  private initSessionId(): string {
    if (!this.storageAvailable) {
      return this.generateSessionId();
    }
    
    try {
      let sessionId = sessionStorage.getItem('vim-md-session-id');
      if (!sessionId) {
        sessionId = this.generateSessionId();
        sessionStorage.setItem('vim-md-session-id', sessionId);
      }
      return sessionId;
    } catch {
      return this.generateSessionId();
    }
  }
  
  /**
   * セッションIDを生成
   */
  private generateSessionId(): string {
    return 'session-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
  }
  
  /**
   * セッションIDを取得
   */
  getSessionId(): string {
    return this.sessionId;
  }
  
  /**
   * ストレージが利用可能か
   */
  isStorageAvailable(): boolean {
    return this.storageAvailable;
  }
  
  /**
   * セッションデータを保存
   */
  saveSession(content: string, filename: string): void {
    if (!this.storageAvailable) return;
    
    try {
      // sessionStorageに現在の内容を保存
      sessionStorage.setItem(STORAGE_KEYS.CONTENT_PREFIX + this.sessionId, content);
      
      // localStorageにセッションデータを保存
      const sessionData: SessionData = {
        content,
        filename,
        timestamp: Date.now()
      };
      localStorage.setItem(
        STORAGE_KEYS.SESSION_PREFIX + this.sessionId,
        JSON.stringify(sessionData)
      );
      
      // セッション一覧を更新
      this.updateSessionList();
    } catch (e) {
      console.warn('Failed to save session:', e);
    }
  }
  
  /**
   * セッション一覧を更新
   */
  private updateSessionList(): void {
    try {
      let sessions: string[] = [];
      try {
        sessions = JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSIONS) || '[]');
      } catch {
        sessions = [];
      }
      
      // 現在のセッションを追加
      if (!sessions.includes(this.sessionId)) {
        sessions.push(this.sessionId);
      }
      
      // 古いセッションを削除
      while (sessions.length > MAX_SESSIONS) {
        const oldSession = sessions.shift();
        if (oldSession) {
          localStorage.removeItem(STORAGE_KEYS.SESSION_PREFIX + oldSession);
        }
      }
      
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    } catch (e) {
      console.warn('Failed to update session list:', e);
    }
  }
  
  /**
   * セッションを読み込み
   */
  loadSession(): SessionData | null {
    if (!this.storageAvailable) return null;
    
    try {
      // 1. sessionStorageから復元
      const sessionContent = sessionStorage.getItem(
        STORAGE_KEYS.CONTENT_PREFIX + this.sessionId
      );
      if (sessionContent) {
        const sessionData = this.getSessionData(this.sessionId);
        return {
          content: normalizeCRLF(sessionContent),
          filename: sessionData?.filename || '無題',
          timestamp: sessionData?.timestamp || Date.now()
        };
      }
      
      // 2. localStorageから最新のセッションを探す
      const sessions = this.getSessionList();
      if (sessions.length > 0) {
        let latestSession: SessionData | null = null;
        let latestTimestamp = 0;
        
        for (const sid of sessions) {
          const data = this.getSessionData(sid);
          if (data && data.timestamp > latestTimestamp && data.content) {
            latestTimestamp = data.timestamp;
            latestSession = data;
          }
        }
        
        if (latestSession) {
          return {
            content: normalizeCRLF(latestSession.content),
            filename: latestSession.filename,
            timestamp: latestSession.timestamp
          };
        }
      }
      
      return null;
    } catch (e) {
      console.warn('Failed to load session:', e);
      return null;
    }
  }
  
  /**
   * セッションデータを取得
   */
  private getSessionData(sessionId: string): SessionData | null {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SESSION_PREFIX + sessionId);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }
  
  /**
   * セッション一覧を取得
   */
  getSessionList(): string[] {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEYS.SESSIONS) || '[]');
    } catch {
      return [];
    }
  }
  
  /**
   * セッションを削除
   */
  clearSession(): void {
    if (!this.storageAvailable) return;
    
    try {
      sessionStorage.removeItem(STORAGE_KEYS.CONTENT_PREFIX + this.sessionId);
      localStorage.removeItem(STORAGE_KEYS.SESSION_PREFIX + this.sessionId);
      
      // セッション一覧から削除
      const sessions = this.getSessionList().filter(s => s !== this.sessionId);
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    } catch (e) {
      console.warn('Failed to clear session:', e);
    }
  }
  
  /**
   * 全セッションを削除
   */
  clearAllSessions(): void {
    if (!this.storageAvailable) return;
    
    try {
      const sessions = this.getSessionList();
      for (const sid of sessions) {
        localStorage.removeItem(STORAGE_KEYS.SESSION_PREFIX + sid);
      }
      localStorage.removeItem(STORAGE_KEYS.SESSIONS);
      sessionStorage.removeItem(STORAGE_KEYS.CONTENT_PREFIX + this.sessionId);
    } catch (e) {
      console.warn('Failed to clear all sessions:', e);
    }
  }
  
  /**
   * 設定を保存
   */
  saveSettings(settings: Partial<StorageSettings>): void {
    if (!this.storageAvailable) return;
    
    try {
      if (settings.theme !== undefined) {
        localStorage.setItem(STORAGE_KEYS.THEME, settings.theme);
      }
      if (settings.fontSize !== undefined) {
        localStorage.setItem(STORAGE_KEYS.FONT_SIZE, String(settings.fontSize));
      }
      if (settings.vimMode !== undefined) {
        localStorage.setItem(STORAGE_KEYS.VIM_MODE, String(settings.vimMode));
      }
      if (settings.autoSaveInterval !== undefined) {
        localStorage.setItem(STORAGE_KEYS.AUTO_SAVE, settings.autoSaveInterval);
      }
    } catch (e) {
      console.warn('Failed to save settings:', e);
    }
  }
  
  /**
   * 設定を読み込み
   */
  loadSettings(): StorageSettings {
    const defaults: StorageSettings = {
      theme: 'dark',
      fontSize: 100,
      vimMode: true,  // デフォルトでVIMモードオン
      autoSaveInterval: '1s'
    };
    
    if (!this.storageAvailable) return defaults;
    
    try {
      const theme = localStorage.getItem(STORAGE_KEYS.THEME) as Theme | null;
      const fontSize = localStorage.getItem(STORAGE_KEYS.FONT_SIZE);
      const vimMode = localStorage.getItem(STORAGE_KEYS.VIM_MODE);
      const autoSave = localStorage.getItem(STORAGE_KEYS.AUTO_SAVE) as AutoSaveInterval | null;
      
      return {
        theme: theme || defaults.theme,
        fontSize: fontSize ? parseInt(fontSize, 10) : defaults.fontSize,
        vimMode: vimMode !== null ? vimMode === 'true' : defaults.vimMode,
        autoSaveInterval: autoSave || defaults.autoSaveInterval
      };
    } catch {
      return defaults;
    }
  }
}

// シングルトンインスタンス
export const sessionManager = new SessionManager();
