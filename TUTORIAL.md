# mdvim Tutorial

This tutorial will guide you through the basics of using mdvim, from first launch to advanced features.

## Table of Contents

1. [Getting Started](#getting-started)
2. [Understanding Modes](#understanding-modes)
3. [Basic Editing](#basic-editing)
4. [Navigation](#navigation)
5. [Search and Replace](#search-and-replace)
6. [Working with Files](#working-with-files)
7. [Markdown Features](#markdown-features)
8. [Image Handling](#image-handling)
9. [Advanced Features](#advanced-features)
10. [Tips and Tricks](#tips-and-tricks)

---

## Getting Started

### First Launch

When you first open mdvim, you'll see:

```
+------------------+------------------+------------------+
|   Line Numbers   |     Editor       |    Preview       |
|                  |                  |                  |
|        1         |  (cursor here)   |                  |
|        2         |                  |                  |
|        3         |                  |                  |
+------------------+------------------+------------------+
|  NORMAL          |  Untitled        |  Ln 1, Col 1     |
+------------------+------------------+------------------+
```

The interface consists of:
- **Left**: Line numbers
- **Center**: Editor pane (where you type)
- **Right**: Live preview pane
- **Bottom**: Status bar showing mode, filename, and cursor position

### The Status Bar

The status bar shows important information:
- **Mode indicator**: NORMAL, INSERT, VISUAL, or COMMAND
- **Filename**: Current file name (or "Untitled")
- **Cursor position**: Line and column number
- **Modified indicator**: Shows `[+]` when file has unsaved changes

---

## Understanding Modes

mdvim has four modes, just like Vim:

### Normal Mode (default)

This is where you start. In Normal mode:
- Keys are commands, not text input
- Navigate, delete, copy, paste
- Press `i` to enter Insert mode
- Press `:` to enter Command mode
- Press `v` to enter Visual mode

### Insert Mode

For typing text:
- Type normally like any editor
- Press `Esc` to return to Normal mode
- Status bar shows `INSERT`

### Visual Mode

For selecting text:
- Move cursor to select text
- Apply commands to selection
- Press `Esc` to cancel
- Status bar shows `VISUAL`

### Command Mode

For Ex commands:
- Enter by pressing `:` in Normal mode
- Type command and press Enter
- Status bar shows `COMMAND`

### Mode Transitions

```
                    i, a, o, O
        ┌─────────────────────────┐
        │                         ▼
    NORMAL ◄──────────────── INSERT
        │         Esc             
        │                         
        │ v, V                    
        │         Esc             
        ▼─────────────────────────►
    VISUAL                        

        : (colon)     Enter/Esc
    NORMAL ──────► COMMAND ──────► NORMAL
```

---

## Basic Editing

### Entering Insert Mode

| Key | Action | Mnemonic |
|-----|--------|----------|
| `i` | Insert before cursor | **i**nsert |
| `a` | Insert after cursor | **a**ppend |
| `I` | Insert at line start | |
| `A` | Insert at line end | |
| `o` | Open line below | **o**pen |
| `O` | Open line above | |

### Example: Writing Your First Document

1. Press `i` to enter Insert mode
2. Type: `# My First Document`
3. Press `Enter` twice
4. Type: `This is my first paragraph.`
5. Press `Esc` to return to Normal mode

Your document now looks like:
```markdown
# My First Document

This is my first paragraph.
```

And the preview shows it formatted!

### Deleting Text

| Key | Action |
|-----|--------|
| `x` | Delete character under cursor |
| `X` | Delete character before cursor |
| `dd` | Delete entire line |
| `dw` | Delete word |
| `d$` or `D` | Delete to end of line |
| `d0` | Delete to start of line |

### Copy and Paste

| Key | Action |
|-----|--------|
| `yy` | Yank (copy) current line |
| `yw` | Yank word |
| `y$` | Yank to end of line |
| `p` | Paste after cursor |
| `P` | Paste before cursor |

### Undo and Redo

| Key | Action |
|-----|--------|
| `u` | Undo last change |
| `Ctrl+r` | Redo |
| `.` | Repeat last change |

### Practice Exercise

Try this sequence:
1. Type `i` then `Hello World` then `Esc`
2. Press `yy` to copy the line
3. Press `p` to paste below
4. Press `dd` to delete the pasted line
5. Press `u` to undo the deletion

---

## Navigation

### Basic Movement

```
         k
         ↑
    h ←     → l
         ↓
         j
```

| Key | Action |
|-----|--------|
| `h` | Move left |
| `j` | Move down |
| `k` | Move up |
| `l` | Move right |

**Tip**: You can use arrow keys too, but `hjkl` keeps your hands on the home row.

### Word Movement

| Key | Action |
|-----|--------|
| `w` | Move to start of next word |
| `b` | Move to start of previous word |
| `e` | Move to end of current/next word |
| `ge` | Move to end of previous word |

### Line Movement

| Key | Action |
|-----|--------|
| `0` | Move to start of line |
| `^` | Move to first non-blank character |
| `$` | Move to end of line |

### Document Movement

| Key | Action |
|-----|--------|
| `gg` | Go to first line |
| `G` | Go to last line |
| `{number}G` | Go to line {number} |
| `H` | Go to top of screen |
| `M` | Go to middle of screen |
| `L` | Go to bottom of screen |

### Scrolling

| Key | Action |
|-----|--------|
| `Ctrl+f` | Page down |
| `Ctrl+b` | Page up |
| `Ctrl+d` | Half page down |
| `Ctrl+u` | Half page up |
| `zz` | Center cursor on screen |
| `zt` | Move cursor to top of screen |
| `zb` | Move cursor to bottom of screen |

### Using Counts

Most commands accept a count prefix:
- `5j` - Move down 5 lines
- `3w` - Move forward 3 words
- `10G` - Go to line 10
- `2dd` - Delete 2 lines

---

## Search and Replace

### Basic Search

| Key | Action |
|-----|--------|
| `/pattern` | Search forward |
| `?pattern` | Search backward |
| `n` | Go to next match |
| `N` | Go to previous match |
| `*` | Search for word under cursor (forward) |
| `#` | Search for word under cursor (backward) |

### Search Example

1. Press `/` to start search
2. Type `markdown` and press Enter
3. Press `n` to find next occurrence
4. Press `N` to find previous occurrence
5. Press `:noh` to clear highlighting

### Character Search

| Key | Action |
|-----|--------|
| `f{char}` | Find character forward |
| `F{char}` | Find character backward |
| `t{char}` | Move to just before character (forward) |
| `T{char}` | Move to just after character (backward) |
| `;` | Repeat last f/F/t/T |
| `,` | Repeat last f/F/t/T (opposite direction) |

### Search Tips

- Search is case-sensitive by default
- Use `\c` at the end of pattern for case-insensitive: `/pattern\c`
- Both half-width and full-width characters can be searched with `f`

---

## Working with Files

### Basic File Operations

| Command | Action |
|---------|--------|
| `:w` | Save current file |
| `:w filename` | Save as filename |
| `:e filename` | Open filename |
| `:new` | Create new file |
| `:q` | Quit |
| `:q!` | Quit without saving |
| `:wq` | Save and quit |

### Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+S` | Save |
| `Ctrl+O` | Open file dialog |
| `Ctrl+N` | New file |

### Export Options

| Command | Format |
|---------|--------|
| `:export md` | Markdown (`.md` or `.mdvim` ZIP with images) |
| `:export html` | Standalone HTML with embedded images |

### Import from URL

```vim
:import https://example.com/document.md
```

Supported platforms:
- Qiita articles
- GitHub files
- GitHub Gists
- Any direct `.md` URL

---

## Markdown Features

### Supported Syntax

mdvim supports standard Markdown:

```markdown
# Heading 1
## Heading 2
### Heading 3

**bold** and *italic* and ~~strikethrough~~

- Bullet list
- Item 2
  - Nested item

1. Numbered list
2. Item 2

> Blockquote

`inline code`

​```javascript
// Code block
const x = 1;
​```

[Link](https://example.com)

![Image](image.png)

| Table | Header |
|-------|--------|
| Cell  | Cell   |
```

### Live Preview

The right pane shows rendered Markdown in real-time:
- Synchronized scrolling between editor and preview
- Click on preview to focus editor
- Toggle preview with `Ctrl+P`

### Table of Contents

- Auto-generated from headings
- Click heading to jump to location
- Collapse sections with click on arrows
- Toggle TOC with `Ctrl+Shift+T`

---

## Image Handling

### Adding Images

**Method 1: Drag and Drop**
1. Drag an image file from your file explorer
2. Drop it onto the editor
3. Markdown image syntax is inserted automatically

**Method 2: Paste from Clipboard**
1. Copy an image (screenshot, etc.)
2. Press `Ctrl+V` in Insert mode
3. Image is embedded and syntax is inserted

**Method 3: Manual Syntax**
```markdown
![Alt text](https://example.com/image.png)
```

### Image Storage

Images are stored as Base64 data within the document. When you export:
- `:export md` - Creates a `.mdvim` ZIP file containing the Markdown and all images as separate files
- `:export html` - Creates a standalone HTML with all images embedded

---

## Advanced Features

### Visual Mode Operations

1. Press `v` to enter Visual mode
2. Move cursor to select text
3. Apply operation:

| Key | Action |
|-----|--------|
| `d` | Delete selection |
| `y` | Yank selection |
| `>` | Indent selection |
| `<` | Dedent selection |
| `~` | Toggle case |

### Macros

Record and replay sequences of commands:

| Key | Action |
|-----|--------|
| `q{a-z}` | Start recording macro to register |
| `q` | Stop recording |
| `@{a-z}` | Play macro |
| `@@` | Repeat last macro |

**Example**: Record a macro to add `- ` at the start of each line:
1. `qa` - Start recording to register 'a'
2. `I- Esc j` - Insert "- " at start, go to next line
3. `q` - Stop recording
4. `5@a` - Repeat 5 times

### Marks

Set bookmarks in your document:

| Key | Action |
|-----|--------|
| `m{a-z}` | Set mark |
| `` `{a-z} `` | Jump to mark (exact position) |
| `'{a-z}` | Jump to mark (line start) |

### Registers

Use named registers for multiple clipboards:

| Key | Action |
|-----|--------|
| `"{a-z}yy` | Yank to register |
| `"{a-z}p` | Paste from register |

### Word Wrap Mode

Enable with `:set wrap`:
- Long lines wrap visually
- `j`/`k` move by logical line
- `gj`/`gk` move by display line

---

## Tips and Tricks

### Productivity Tips

1. **Stay in Normal mode** - Only enter Insert mode to type, then return to Normal
2. **Use counts** - `5dd` is faster than pressing `dd` five times
3. **Use `.` (dot)** - Repeat your last change with a single keystroke
4. **Learn motions** - `dw`, `d$`, `d}` - combine delete with any motion

### Common Workflows

**Converting text to a list:**
1. Visual select the lines (`V` then `j`)
2. Type `:` to enter command mode
3. Use substitution (coming in future version)

**Quick formatting:**
- `~` on a character toggles case
- `gUw` uppercase word (Normal mode)
- `guw` lowercase word (Normal mode)

### Settings

Click ⚙️ to access settings:
- **Theme**: Light or Dark
- **Font Size**: 12-24px
- **Auto-save**: Configurable interval
- **Language**: Choose your preferred language

### Vim Mode Toggle

- Press `Ctrl+Shift+V` to toggle between Vim mode and normal editing mode
- In normal editing mode (NOVIM), you can type without modes
- Click the VIM/NOVIM button in the toolbar to toggle

---

## Conclusion

You now know the essentials of mdvim! Remember:

1. **Modes are fundamental** - Normal for commands, Insert for typing
2. **Motions are powerful** - Combine them with operators
3. **Practice makes perfect** - The more you use Vim commands, the faster you'll become

Happy editing! 🚀
