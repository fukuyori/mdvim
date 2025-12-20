/**
 * App - アプリケーション初期化とグローバル関数
 */

// ビューモード切替
function setViewMode(mode) {
  const container = document.getElementById('main-container');
  
  ['edit', 'preview', 'split'].forEach(m => {
    document.getElementById('btn-' + m).classList.remove('active');
  });
  document.getElementById('btn-' + mode).classList.add('active');
  
  container.classList.remove('edit-only', 'preview-only', 'split-view');
  
  if (mode === 'edit') container.classList.add('edit-only');
  else if (mode === 'preview') container.classList.add('preview-only');
  else container.classList.add('split-view');
  
  VimEditor.editor.focus();
}

// テーマ設定
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  
  ['dark', 'light', 'original'].forEach(t => {
    const btn = document.getElementById('btn-theme-' + t);
    if (btn) btn.classList.remove('active');
  });
  const activeBtn = document.getElementById('btn-theme-' + theme);
  if (activeBtn) activeBtn.classList.add('active');
  
  localStorage.setItem('vim-md-theme', theme);
  
  if (typeof VimEditor !== 'undefined' && VimEditor.showStatus) {
    VimEditor.showStatus(`テーマ: ${theme}`);
  }
}

// テーマ読み込み
function loadTheme() {
  const saved = localStorage.getItem('vim-md-theme');
  if (saved && ['dark', 'light', 'original'].includes(saved)) {
    document.documentElement.setAttribute('data-theme', saved);
    const btn = document.getElementById('btn-theme-' + saved);
    if (btn) {
      ['dark', 'light', 'original'].forEach(t => {
        const b = document.getElementById('btn-theme-' + t);
        if (b) b.classList.remove('active');
      });
      btn.classList.add('active');
    }
  }
}

// ヘルプ表示切替
function toggleHelp() {
  document.getElementById('help-modal').classList.toggle('hidden');
  if (document.getElementById('help-modal').classList.contains('hidden')) {
    VimEditor.editor.focus();
  }
}

// 初期化
document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  VimEditor.init();
  VimEditor.editor.focus();
});

// ページ離脱時の確認
window.addEventListener('beforeunload', e => {
  if (VimEditor.modified) {
    e.preventDefault();
    e.returnValue = '';
  }
});
