/**
 * App - Application initialization and global functions
 */

// View mode toggle
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

// Theme setting
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
    VimEditor.showStatus(`Theme: ${theme}`);
  }
}

// Load theme
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

// Help toggle
function toggleHelp() {
  document.getElementById('help-modal').classList.toggle('hidden');
  if (document.getElementById('help-modal').classList.contains('hidden')) {
    VimEditor.editor.focus();
  }
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadTheme();
  VimEditor.init();
  VimEditor.editor.focus();
});

// Confirm on page leave
window.addEventListener('beforeunload', e => {
  if (VimEditor.modified) {
    e.preventDefault();
    e.returnValue = '';
  }
});
