/**
 * Internationalization (i18n) - Translation data
 * 5 languages: en, ja, ko, zh-CN, es
 */

export type Language = 'en' | 'ja' | 'ko' | 'zh-CN' | 'es';

export interface TranslationStrings {
  // App title
  appTitle: string;
  
  // Toolbar buttons
  edit: string;
  preview: string;
  split: string;
  fontSmaller: string;
  fontLarger: string;
  
  // TOC
  toc: string;
  closeToc: string;
  openToc: string;
  
  // Editor controls
  vimModeToggle: string;
  
  // Preview controls
  foldAll: string;
  unfoldAll: string;
  
  // Status bar
  untitled: string;
  helpHint: string;
  modified: string;
  
  // Messages
  saved: string;
  opened: string;
  newFile: string;
  undone: string;
  redone: string;
  noMoreUndo: string;
  noMoreRedo: string;
  yanked: string;
  notFound: string;
  replaced: string;
  macroRecording: string;
  macroSaved: string;
  macroPlayed: string;
  markSet: string;
  
  // Help modal
  helpTitle: string;
  helpModeSwitch: string;
  helpMovement: string;
  helpEditing: string;
  helpTextObjects: string;
  helpMarksAndMacros: string;
  helpSearchReplace: string;
  helpCommands: string;
  helpMarkdown: string;
  helpClose: string;
  
  // Help content - Mode switch
  helpInsertAtCursor: string;
  helpInsertAtLineStart: string;
  helpInsertAfterCursor: string;
  helpInsertAtLineEnd: string;
  helpInsertLineBelow: string;
  helpInsertLineAbove: string;
  helpVisualMode: string;
  helpVisualLineMode: string;
  helpToNormal: string;
  helpCommandMode: string;
  
  // Help content - Movement
  helpLeftDownUpRight: string;
  helpWordMovement: string;
  helpWordEnd: string;
  helpLineStartEnd: string;
  helpFirstNonBlank: string;
  helpFileStartEnd: string;
  helpFindChar: string;
  helpMatchingBracket: string;
  helpPageMovement: string;
  helpHalfPageMovement: string;
  
  // Help content - Editing
  helpDeleteChar: string;
  helpDelete: string;
  helpChange: string;
  helpYank: string;
  helpPaste: string;
  helpUndoRedo: string;
  helpRepeatEdit: string;
  helpToggleCase: string;
  helpJoinLines: string;
  helpIndent: string;
  
  // Help content - Text objects
  helpDeleteWord: string;
  helpDeleteInQuotes: string;
  helpDeleteInParens: string;
  helpDeleteInBrackets: string;
  helpDeleteInBraces: string;
  
  // Help content - Marks & Macros
  helpSetMark: string;
  helpGoToMark: string;
  helpRecordMacro: string;
  helpPlayMacro: string;
  
  // Help content - Search & Replace
  helpForwardSearch: string;
  helpNextPrev: string;
  helpSearchWord: string;
  helpReplaceLine: string;
  helpReplaceAll: string;
  
  // Help content - Commands
  helpSave: string;
  helpOpen: string;
  helpNew: string;
  helpQuit: string;
  helpHelp: string;
  
  // Help content - Markdown
  helpInlineMath: string;
  helpBlockMath: string;
  helpMermaid: string;
  helpDetails: string;
  
  // Language selector
  language: string;
}

export const translations: Record<Language, TranslationStrings> = {
  // English
  en: {
    appTitle: 'mdvim - Vim-style Markdown Editor',
    edit: 'Edit',
    preview: 'Preview',
    split: 'Split',
    fontSmaller: 'Smaller font',
    fontLarger: 'Larger font',
    toc: 'Table of Contents',
    closeToc: 'Close TOC',
    openToc: 'Open TOC',
    vimModeToggle: 'VIM/Edit mode toggle',
    foldAll: '▶ Fold All',
    unfoldAll: '▼ Unfold All',
    untitled: 'Untitled',
    helpHint: ':help to show help',
    modified: '[Modified]',
    saved: 'Saved',
    opened: 'Opened',
    newFile: 'New file',
    undone: 'Undone',
    redone: 'Redone',
    noMoreUndo: 'Nothing to undo',
    noMoreRedo: 'Nothing to redo',
    yanked: 'Yanked',
    notFound: 'Not found',
    replaced: 'Replaced',
    macroRecording: 'Recording @',
    macroSaved: 'Macro saved to @',
    macroPlayed: 'Macro played',
    markSet: "Mark '%s' set",
    helpTitle: '⌨️ Keybinding Help',
    helpModeSwitch: 'Mode Switch',
    helpMovement: 'Movement',
    helpEditing: 'Editing',
    helpTextObjects: 'Text Objects',
    helpMarksAndMacros: 'Marks & Macros',
    helpSearchReplace: 'Search & Replace',
    helpCommands: 'Commands',
    helpMarkdown: 'Markdown',
    helpClose: 'Close (Esc)',
    helpInsertAtCursor: 'Insert (at cursor)',
    helpInsertAtLineStart: 'Insert (line start)',
    helpInsertAfterCursor: 'Insert (after cursor)',
    helpInsertAtLineEnd: 'Insert (line end)',
    helpInsertLineBelow: 'Insert line below',
    helpInsertLineAbove: 'Insert line above',
    helpVisualMode: 'Visual mode',
    helpVisualLineMode: 'Visual line mode',
    helpToNormal: 'To normal mode',
    helpCommandMode: 'Command mode',
    helpLeftDownUpRight: 'Left/Down/Up/Right',
    helpWordMovement: 'Word (next/prev)',
    helpWordEnd: 'Word end',
    helpLineStartEnd: 'Line start/end',
    helpFirstNonBlank: 'First non-blank',
    helpFileStartEnd: 'File start/end',
    helpFindChar: 'Find char in line',
    helpMatchingBracket: 'Matching bracket',
    helpPageMovement: 'Page movement',
    helpHalfPageMovement: 'Half page',
    helpDeleteChar: 'Delete char',
    helpDelete: 'Delete',
    helpChange: 'Change',
    helpYank: 'Yank',
    helpPaste: 'Paste',
    helpUndoRedo: 'Undo/Redo',
    helpRepeatEdit: 'Repeat last edit',
    helpToggleCase: 'Toggle case',
    helpJoinLines: 'Join lines',
    helpIndent: 'Indent',
    helpDeleteWord: 'Delete word',
    helpDeleteInQuotes: 'Delete in "..."',
    helpDeleteInParens: 'Delete in (...)',
    helpDeleteInBrackets: 'Delete in [...]',
    helpDeleteInBraces: 'Delete in {...}',
    helpSetMark: 'Set mark',
    helpGoToMark: 'Go to mark',
    helpRecordMacro: 'Record macro',
    helpPlayMacro: 'Play macro',
    helpForwardSearch: 'Forward search',
    helpNextPrev: 'Next/Prev match',
    helpSearchWord: 'Search word under cursor',
    helpReplaceLine: 'Replace (current line)',
    helpReplaceAll: 'Replace all',
    helpSave: 'Save',
    helpOpen: 'Open file',
    helpNew: 'New file',
    helpQuit: 'Quit',
    helpHelp: 'Show help',
    helpInlineMath: 'Inline math',
    helpBlockMath: 'Block math',
    helpMermaid: 'Mermaid diagram',
    helpDetails: 'Collapsible',
    language: 'Language'
  },
  
  // Japanese
  ja: {
    appTitle: 'mdvim - Vim風マークダウンエディタ',
    edit: '編集',
    preview: 'プレビュー',
    split: '分割',
    fontSmaller: '文字を小さく',
    fontLarger: '文字を大きく',
    toc: '目次',
    closeToc: '目次を閉じる',
    openToc: '目次を開く',
    vimModeToggle: 'VIM/編集モード切替',
    foldAll: '▶ 全て折りたたむ',
    unfoldAll: '▼ 全て展開',
    untitled: '無題',
    helpHint: ':help でヘルプを表示',
    modified: '[変更あり]',
    saved: '保存しました',
    opened: '開きました',
    newFile: '新規ファイル',
    undone: '元に戻しました',
    redone: 'やり直しました',
    noMoreUndo: 'これ以上戻せません',
    noMoreRedo: 'これ以上やり直せません',
    yanked: 'ヤンクしました',
    notFound: '見つかりません',
    replaced: '置換しました',
    macroRecording: '記録中 @',
    macroSaved: 'マクロを保存: @',
    macroPlayed: 'マクロ再生',
    markSet: "マーク '%s' を設定しました",
    helpTitle: '⌨️ キーバインドヘルプ',
    helpModeSwitch: 'モード切替',
    helpMovement: '移動',
    helpEditing: '編集',
    helpTextObjects: 'テキストオブジェクト',
    helpMarksAndMacros: 'マーク・マクロ',
    helpSearchReplace: '検索・置換',
    helpCommands: 'コマンド',
    helpMarkdown: 'Markdown',
    helpClose: '閉じる (Esc)',
    helpInsertAtCursor: '挿入モード（カーソル位置）',
    helpInsertAtLineStart: '挿入モード（行頭）',
    helpInsertAfterCursor: '挿入モード（カーソル後）',
    helpInsertAtLineEnd: '挿入モード（行末）',
    helpInsertLineBelow: '下に新しい行を挿入',
    helpInsertLineAbove: '上に新しい行を挿入',
    helpVisualMode: 'ビジュアルモード',
    helpVisualLineMode: '行ビジュアルモード',
    helpToNormal: 'ノーマルへ',
    helpCommandMode: 'コマンドモード',
    helpLeftDownUpRight: '左/下/上/右',
    helpWordMovement: '単語移動（次/前）',
    helpWordEnd: '単語末尾へ',
    helpLineStartEnd: '行頭/行末',
    helpFirstNonBlank: '最初の非空白文字へ',
    helpFileStartEnd: 'ファイル先頭/末尾',
    helpFindChar: '行内で文字へ',
    helpMatchingBracket: '対応括弧へジャンプ',
    helpPageMovement: '1ページ移動',
    helpHalfPageMovement: '半ページ移動',
    helpDeleteChar: '文字削除',
    helpDelete: '削除',
    helpChange: '変更',
    helpYank: 'ヤンク',
    helpPaste: '貼り付け',
    helpUndoRedo: 'アンドゥ/リドゥ',
    helpRepeatEdit: '直前の編集を繰り返し',
    helpToggleCase: '大文字/小文字切替',
    helpJoinLines: '行を結合',
    helpIndent: 'インデント',
    helpDeleteWord: '単語削除',
    helpDeleteInQuotes: '"..."内を削除',
    helpDeleteInParens: '(...)内を削除',
    helpDeleteInBrackets: '[...]内を削除',
    helpDeleteInBraces: '{...}内を削除',
    helpSetMark: '位置をマーク',
    helpGoToMark: 'マーク行頭へ',
    helpRecordMacro: 'マクロ記録開始/終了',
    helpPlayMacro: 'マクロ再生',
    helpForwardSearch: '前方検索',
    helpNextPrev: '次/前の検索結果',
    helpSearchWord: 'カーソル下の単語を検索',
    helpReplaceLine: '置換（現在行）',
    helpReplaceAll: '全置換',
    helpSave: '保存',
    helpOpen: 'ファイルを開く',
    helpNew: '新規ファイル',
    helpQuit: '終了',
    helpHelp: 'ヘルプ表示',
    helpInlineMath: 'インライン数式',
    helpBlockMath: 'ブロック数式',
    helpMermaid: 'Mermaid図',
    helpDetails: '折り畳み',
    language: '言語'
  },
  
  // Korean
  ko: {
    appTitle: 'mdvim - Vim 스타일 마크다운 에디터',
    edit: '편집',
    preview: '미리보기',
    split: '분할',
    fontSmaller: '글꼴 축소',
    fontLarger: '글꼴 확대',
    toc: '목차',
    closeToc: '목차 닫기',
    openToc: '목차 열기',
    vimModeToggle: 'VIM/편집 모드 전환',
    foldAll: '▶ 모두 접기',
    unfoldAll: '▼ 모두 펼치기',
    untitled: '제목 없음',
    helpHint: ':help 로 도움말 보기',
    modified: '[수정됨]',
    saved: '저장됨',
    opened: '열림',
    newFile: '새 파일',
    undone: '실행 취소됨',
    redone: '다시 실행됨',
    noMoreUndo: '더 이상 취소할 수 없음',
    noMoreRedo: '더 이상 다시 실행할 수 없음',
    yanked: '복사됨',
    notFound: '찾을 수 없음',
    replaced: '대체됨',
    macroRecording: '녹화 중 @',
    macroSaved: '매크로 저장: @',
    macroPlayed: '매크로 재생됨',
    markSet: "마크 '%s' 설정됨",
    helpTitle: '⌨️ 키 바인딩 도움말',
    helpModeSwitch: '모드 전환',
    helpMovement: '이동',
    helpEditing: '편집',
    helpTextObjects: '텍스트 객체',
    helpMarksAndMacros: '마크 & 매크로',
    helpSearchReplace: '검색 & 대체',
    helpCommands: '명령어',
    helpMarkdown: 'Markdown',
    helpClose: '닫기 (Esc)',
    helpInsertAtCursor: '삽입 (커서 위치)',
    helpInsertAtLineStart: '삽입 (줄 시작)',
    helpInsertAfterCursor: '삽입 (커서 뒤)',
    helpInsertAtLineEnd: '삽입 (줄 끝)',
    helpInsertLineBelow: '아래에 새 줄 삽입',
    helpInsertLineAbove: '위에 새 줄 삽입',
    helpVisualMode: '비주얼 모드',
    helpVisualLineMode: '줄 비주얼 모드',
    helpToNormal: '노멀 모드로',
    helpCommandMode: '명령 모드',
    helpLeftDownUpRight: '왼쪽/아래/위/오른쪽',
    helpWordMovement: '단어 (다음/이전)',
    helpWordEnd: '단어 끝',
    helpLineStartEnd: '줄 시작/끝',
    helpFirstNonBlank: '첫 번째 비공백',
    helpFileStartEnd: '파일 시작/끝',
    helpFindChar: '줄에서 문자 찾기',
    helpMatchingBracket: '짝 괄호로',
    helpPageMovement: '페이지 이동',
    helpHalfPageMovement: '반 페이지',
    helpDeleteChar: '문자 삭제',
    helpDelete: '삭제',
    helpChange: '변경',
    helpYank: '복사',
    helpPaste: '붙여넣기',
    helpUndoRedo: '실행 취소/다시 실행',
    helpRepeatEdit: '마지막 편집 반복',
    helpToggleCase: '대소문자 전환',
    helpJoinLines: '줄 합치기',
    helpIndent: '들여쓰기',
    helpDeleteWord: '단어 삭제',
    helpDeleteInQuotes: '"..." 안 삭제',
    helpDeleteInParens: '(...) 안 삭제',
    helpDeleteInBrackets: '[...] 안 삭제',
    helpDeleteInBraces: '{...} 안 삭제',
    helpSetMark: '마크 설정',
    helpGoToMark: '마크로 이동',
    helpRecordMacro: '매크로 녹화',
    helpPlayMacro: '매크로 재생',
    helpForwardSearch: '앞으로 검색',
    helpNextPrev: '다음/이전 결과',
    helpSearchWord: '커서 아래 단어 검색',
    helpReplaceLine: '대체 (현재 줄)',
    helpReplaceAll: '전체 대체',
    helpSave: '저장',
    helpOpen: '파일 열기',
    helpNew: '새 파일',
    helpQuit: '종료',
    helpHelp: '도움말 표시',
    helpInlineMath: '인라인 수식',
    helpBlockMath: '블록 수식',
    helpMermaid: 'Mermaid 다이어그램',
    helpDetails: '접을 수 있는',
    language: '언어'
  },
  
  // Simplified Chinese
  'zh-CN': {
    appTitle: 'mdvim - Vim风格Markdown编辑器',
    edit: '编辑',
    preview: '预览',
    split: '分割',
    fontSmaller: '缩小字体',
    fontLarger: '放大字体',
    toc: '目录',
    closeToc: '关闭目录',
    openToc: '打开目录',
    vimModeToggle: 'VIM/编辑模式切换',
    foldAll: '▶ 全部折叠',
    unfoldAll: '▼ 全部展开',
    untitled: '无标题',
    helpHint: ':help 显示帮助',
    modified: '[已修改]',
    saved: '已保存',
    opened: '已打开',
    newFile: '新建文件',
    undone: '已撤销',
    redone: '已重做',
    noMoreUndo: '无法继续撤销',
    noMoreRedo: '无法继续重做',
    yanked: '已复制',
    notFound: '未找到',
    replaced: '已替换',
    macroRecording: '录制中 @',
    macroSaved: '宏已保存: @',
    macroPlayed: '宏已播放',
    markSet: "标记 '%s' 已设置",
    helpTitle: '⌨️ 快捷键帮助',
    helpModeSwitch: '模式切换',
    helpMovement: '移动',
    helpEditing: '编辑',
    helpTextObjects: '文本对象',
    helpMarksAndMacros: '标记 & 宏',
    helpSearchReplace: '搜索 & 替换',
    helpCommands: '命令',
    helpMarkdown: 'Markdown',
    helpClose: '关闭 (Esc)',
    helpInsertAtCursor: '插入（光标位置）',
    helpInsertAtLineStart: '插入（行首）',
    helpInsertAfterCursor: '插入（光标后）',
    helpInsertAtLineEnd: '插入（行尾）',
    helpInsertLineBelow: '在下方插入新行',
    helpInsertLineAbove: '在上方插入新行',
    helpVisualMode: '可视模式',
    helpVisualLineMode: '行可视模式',
    helpToNormal: '返回普通模式',
    helpCommandMode: '命令模式',
    helpLeftDownUpRight: '左/下/上/右',
    helpWordMovement: '单词（下一个/上一个）',
    helpWordEnd: '单词末尾',
    helpLineStartEnd: '行首/行尾',
    helpFirstNonBlank: '第一个非空白字符',
    helpFileStartEnd: '文件开头/结尾',
    helpFindChar: '行内查找字符',
    helpMatchingBracket: '跳转到匹配括号',
    helpPageMovement: '翻页',
    helpHalfPageMovement: '半页',
    helpDeleteChar: '删除字符',
    helpDelete: '删除',
    helpChange: '修改',
    helpYank: '复制',
    helpPaste: '粘贴',
    helpUndoRedo: '撤销/重做',
    helpRepeatEdit: '重复上次编辑',
    helpToggleCase: '切换大小写',
    helpJoinLines: '合并行',
    helpIndent: '缩进',
    helpDeleteWord: '删除单词',
    helpDeleteInQuotes: '删除"..."内容',
    helpDeleteInParens: '删除(...)内容',
    helpDeleteInBrackets: '删除[...]内容',
    helpDeleteInBraces: '删除{...}内容',
    helpSetMark: '设置标记',
    helpGoToMark: '跳转到标记',
    helpRecordMacro: '录制宏',
    helpPlayMacro: '播放宏',
    helpForwardSearch: '向前搜索',
    helpNextPrev: '下一个/上一个匹配',
    helpSearchWord: '搜索光标下的单词',
    helpReplaceLine: '替换（当前行）',
    helpReplaceAll: '全部替换',
    helpSave: '保存',
    helpOpen: '打开文件',
    helpNew: '新建文件',
    helpQuit: '退出',
    helpHelp: '显示帮助',
    helpInlineMath: '行内公式',
    helpBlockMath: '块级公式',
    helpMermaid: 'Mermaid图表',
    helpDetails: '可折叠',
    language: '语言'
  },
  
  // Spanish
  es: {
    appTitle: 'mdvim - Editor Markdown estilo Vim',
    edit: 'Editar',
    preview: 'Vista previa',
    split: 'Dividir',
    fontSmaller: 'Reducir fuente',
    fontLarger: 'Aumentar fuente',
    toc: 'Índice',
    closeToc: 'Cerrar índice',
    openToc: 'Abrir índice',
    vimModeToggle: 'Alternar modo VIM/Edición',
    foldAll: '▶ Plegar todo',
    unfoldAll: '▼ Desplegar todo',
    untitled: 'Sin título',
    helpHint: ':help para mostrar ayuda',
    modified: '[Modificado]',
    saved: 'Guardado',
    opened: 'Abierto',
    newFile: 'Nuevo archivo',
    undone: 'Deshecho',
    redone: 'Rehecho',
    noMoreUndo: 'Nada que deshacer',
    noMoreRedo: 'Nada que rehacer',
    yanked: 'Copiado',
    notFound: 'No encontrado',
    replaced: 'Reemplazado',
    macroRecording: 'Grabando @',
    macroSaved: 'Macro guardada: @',
    macroPlayed: 'Macro reproducida',
    markSet: "Marca '%s' establecida",
    helpTitle: '⌨️ Ayuda de atajos',
    helpModeSwitch: 'Cambio de modo',
    helpMovement: 'Movimiento',
    helpEditing: 'Edición',
    helpTextObjects: 'Objetos de texto',
    helpMarksAndMacros: 'Marcas y Macros',
    helpSearchReplace: 'Buscar y Reemplazar',
    helpCommands: 'Comandos',
    helpMarkdown: 'Markdown',
    helpClose: 'Cerrar (Esc)',
    helpInsertAtCursor: 'Insertar (en cursor)',
    helpInsertAtLineStart: 'Insertar (inicio de línea)',
    helpInsertAfterCursor: 'Insertar (después del cursor)',
    helpInsertAtLineEnd: 'Insertar (fin de línea)',
    helpInsertLineBelow: 'Insertar línea abajo',
    helpInsertLineAbove: 'Insertar línea arriba',
    helpVisualMode: 'Modo visual',
    helpVisualLineMode: 'Modo visual de línea',
    helpToNormal: 'A modo normal',
    helpCommandMode: 'Modo comando',
    helpLeftDownUpRight: 'Izquierda/Abajo/Arriba/Derecha',
    helpWordMovement: 'Palabra (siguiente/anterior)',
    helpWordEnd: 'Fin de palabra',
    helpLineStartEnd: 'Inicio/Fin de línea',
    helpFirstNonBlank: 'Primer no-blanco',
    helpFileStartEnd: 'Inicio/Fin de archivo',
    helpFindChar: 'Buscar carácter en línea',
    helpMatchingBracket: 'Paréntesis coincidente',
    helpPageMovement: 'Movimiento por página',
    helpHalfPageMovement: 'Media página',
    helpDeleteChar: 'Eliminar carácter',
    helpDelete: 'Eliminar',
    helpChange: 'Cambiar',
    helpYank: 'Copiar',
    helpPaste: 'Pegar',
    helpUndoRedo: 'Deshacer/Rehacer',
    helpRepeatEdit: 'Repetir última edición',
    helpToggleCase: 'Alternar mayúsculas',
    helpJoinLines: 'Unir líneas',
    helpIndent: 'Indentar',
    helpDeleteWord: 'Eliminar palabra',
    helpDeleteInQuotes: 'Eliminar en "..."',
    helpDeleteInParens: 'Eliminar en (...)',
    helpDeleteInBrackets: 'Eliminar en [...]',
    helpDeleteInBraces: 'Eliminar en {...}',
    helpSetMark: 'Establecer marca',
    helpGoToMark: 'Ir a marca',
    helpRecordMacro: 'Grabar macro',
    helpPlayMacro: 'Reproducir macro',
    helpForwardSearch: 'Buscar hacia adelante',
    helpNextPrev: 'Siguiente/Anterior resultado',
    helpSearchWord: 'Buscar palabra bajo cursor',
    helpReplaceLine: 'Reemplazar (línea actual)',
    helpReplaceAll: 'Reemplazar todo',
    helpSave: 'Guardar',
    helpOpen: 'Abrir archivo',
    helpNew: 'Nuevo archivo',
    helpQuit: 'Salir',
    helpHelp: 'Mostrar ayuda',
    helpInlineMath: 'Fórmula en línea',
    helpBlockMath: 'Fórmula en bloque',
    helpMermaid: 'Diagrama Mermaid',
    helpDetails: 'Plegable',
    language: 'Idioma'
  }
};

export const languageNames: Record<Language, string> = {
  'en': 'English',
  'ja': '日本語',
  'ko': '한국어',
  'zh-CN': '简体中文',
  'es': 'Español'
};

export function detectLanguage(): Language {
  const browserLang = navigator.language;
  
  // 完全一致
  if (browserLang in translations) {
    return browserLang as Language;
  }
  
  // プレフィックス一致
  const prefix = browserLang.split('-')[0];
  
  // 中国語は簡体字
  if (prefix === 'zh') {
    return 'zh-CN';
  }
  
  const langMap: Record<string, Language> = {
    'en': 'en',
    'ja': 'ja',
    'ko': 'ko',
    'es': 'es'
  };
  
  return langMap[prefix] || 'en';
}
