# mdvim

A lightweight, single-file Markdown editor with Vim keybindings.

**[Try Online](https://fukuyori.github.io/mdvim/mdvim.html)** | **[日本語](./README.ja.md)**

**Version 0.8.1**

## Features

- 🎯 **Vim Keybindings** - Full support for Normal, Insert, and Visual modes
- 📝 **Live Preview** - Real-time Markdown rendering with synchronized scrolling
- 📑 **Table of Contents** - Auto-generated, collapsible TOC from headings
- 🖼️ **Image Support** - Drag & drop, paste from clipboard, embedded in exports
- 📦 **Single HTML File** - No server required, runs entirely in the browser
- 🌐 **Multi-language** - English, Japanese, Chinese, Korean, German
- 🎨 **Themes** - Light and Dark mode
- 💾 **Auto-save** - Session recovery with configurable intervals

## Quick Start

### Option 1: Try Online (Recommended)

Open mdvim directly in your browser:

👉 **https://fukuyori.github.io/mdvim/mdvim.html**

No installation required!

### Option 2: Download and Open Locally

1. Go to [GitHub Repository](https://github.com/fukuyori/mdvim)
2. Download `mdvim.html`
3. Open in your browser
4. Start editing!

### Option 3: Build from Source

```bash
git clone https://github.com/fukuyori/mdvim.git
cd mdvim/mdvim-source
npm install
node scripts/build-single.js
# Open dist/mdvim.html in your browser
```

## Vim Commands

### Modes

| Key | Action |
|-----|--------|
| `Esc` | Enter Normal mode |
| `i` | Insert before cursor |
| `a` | Insert after cursor |
| `o` | Open line below |
| `O` | Open line above |
| `v` | Visual mode |
| `V` | Visual line mode |

### Movement

| Key | Action |
|-----|--------|
| `h` `j` `k` `l` | Left, Down, Up, Right |
| `w` `b` | Word forward/backward |
| `e` | End of word |
| `0` `$` | Line start/end |
| `gg` `G` | Document start/end |
| `H` `M` `L` | Screen top/middle/bottom |
| `Ctrl+f` `Ctrl+b` | Page down/up |
| `f{char}` | Find character forward |
| `F{char}` | Find character backward |
| `%` | Matching bracket |

### Editing

| Key | Action |
|-----|--------|
| `x` | Delete character |
| `dd` | Delete line |
| `dw` | Delete word |
| `D` | Delete to end of line |
| `yy` | Yank (copy) line |
| `p` `P` | Paste after/before |
| `u` | Undo |
| `Ctrl+r` | Redo |
| `.` | Repeat last change |
| `r{char}` | Replace character |
| `~` | Toggle case |
| `>>` `<<` | Indent/dedent |
| `J` | Join lines |

### Search

| Key | Action |
|-----|--------|
| `/pattern` | Search forward |
| `?pattern` | Search backward |
| `n` `N` | Next/previous match |
| `*` `#` | Search word under cursor |

### Ex Commands

| Command | Action |
|---------|--------|
| `:w` | Save file |
| `:e {file}` | Open file |
| `:q` | Quit |
| `:wq` | Save and quit |
| `:new` | New file |
| `:export md` | Export as Markdown |
| `:export html` | Export as HTML |
| `:import {url}` | Import from URL |
| `:set wrap` | Enable word wrap |
| `:set nowrap` | Disable word wrap |
| `:noh` | Clear search highlight |
| `:help` | Show help |

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save |
| `Ctrl+O` | Open |
| `Ctrl+N` | New file |
| `Ctrl+P` | Toggle preview |
| `Ctrl+Shift+T` | Toggle TOC |
| `Ctrl+Shift+V` | Toggle Vim mode |
| `F1` | Help |

## Image Handling

### Adding Images

- **Drag & Drop**: Drag image files onto the editor
- **Paste**: `Ctrl+V` to paste from clipboard
- **Markdown**: `![alt](url)` syntax

### Export with Images

- `:export md` - Exports `.mdvim` ZIP containing Markdown and images
- `:export html` - Exports standalone HTML with embedded images

## URL Import

Import Markdown from popular platforms:

```vim
:import https://qiita.com/user/items/xxxxx
:import https://github.com/user/repo/blob/main/README.md
:import https://gist.github.com/user/xxxxx
:import https://example.com/document.md
```

## Word Wrap

When word wrap is enabled (`:set wrap`):

| Key | Action |
|-----|--------|
| `j` `k` | Move by logical line |
| `gj` `gk` | Move by display line |

## Configuration

Click the settings icon (⚙️) to configure:

- **Theme**: Light / Dark
- **Font Size**: 12-24px
- **Auto-save Interval**: Off / 5s / 10s / 30s / 60s
- **Language**: English, 日本語, 中文, 한국어, Deutsch

## Browser Support

- Chrome/Edge 80+
- Firefox 75+
- Safari 13+

## Development

### Project Structure

```
mdvim/
├── src/
│   ├── index.html          # HTML template
│   ├── styles/main.css     # Styles
│   └── ts/
│       ├── main.ts         # Entry point
│       ├── types.ts        # Type definitions
│       ├── editor/         # Vim editor core
│       ├── parser/         # Markdown parser
│       ├── i18n/           # Translations
│       ├── storage/        # Session management
│       └── utils/          # Utilities
├── scripts/
│   └── build-single.js     # Build script
├── dist/
│   └── mdvim.html          # Built file (135KB)
└── package.json
```

### Building

```bash
npm install
node scripts/build-single.js
```

### Dependencies

Runtime (loaded via CDN):
- JSZip - ZIP file handling
- Turndown - HTML to Markdown conversion

Build-time:
- esbuild - TypeScript bundling

## License

MIT License - see [LICENSE](./LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
