# MarkdownViewer

A standalone desktop app for **reading and editing markdown as it looks**, not as raw source.

Open a `.md` file and you see headings, lists, links, checklists, and Mermaid diagrams already rendered. You edit that page directly; the app keeps a real markdown file underneath and saves it as UTF-8.

The window is a small native shell with a Chromium editor inside. Menus and dialogs follow the OS language (**English** or **Dutch**; anything else uses English). It is meant to be used as `MarkdownViewer.exe`, not as a website.

## What you can do

- Open, save, save-as, and **export as PDF**
- Edit the rendered document: bold, italic, strikethrough, headings (H1–H6), quotes, links, images, lists, tables, definition lists, a horizontal rule, and a task list
- Toggle GFM checkboxes (`- [ ]` / `- [x]`); the change is written back into the file
- Insert local or remote images; a local file can be copied into an `images/` folder next to the markdown file
- Render fenced code with syntax highlighting, and ` ```mermaid ` diagrams. Use **Diagram** to insert a type (flowchart, sequence, class, state, ER, C4, pie, gantt, and more). Double-click a diagram to edit it visually; the mermaid source is updated.
- Export PDF from **File**. Diagrams stay on one page (they are scaled down if they would overflow).
- Follow links with a normal click:
  - `http` / `https` / `mailto` open in the system browser
  - `#anker` scrolls in the current document
  - a local `.md` / `.markdown` file that exists opens in a **new tab** (or focuses that tab if it is already open)
  - anything else shows a warning and does not navigate away
- Work with several documents in tabs. **New** opens an empty tab; **Open** loads into the current tab. At least one tab stays open. Closing the window asks about every unsaved tab.

Link *text* is edited by selecting it and using the **Link** toolbar button, not by clicking the link.

Try `samples/demo.md`. It includes headings, a quote, a table, a definition list, an image, a checklist, a link to `samples/linked.md`, an external URL, and several Mermaid diagrams you can double-click to edit.

## Requirements

- Windows
- Python 3.10 or newer
- The Typhon transpiler at `D:\projecten\python-transpiler` (this repo is written in Typhon, which compiles to Python)
- PyQt6 and PyQt6-WebEngine 6.11.0 (installed through Typhon’s dependency lock)

The UI language follows the operating system (English or Dutch).

## Run from source

From the project root, with the transpiler on `PYTHONPATH`:

```powershell
$env:PYTHONPATH = "D:\projecten\python-transpiler"
python -m transpiler deps lock
python -m transpiler run src/main.typhon
```

On this machine a raw Python WebEngine window can crash; the packed exe is the reliable way to actually use the app.

## Build the exe

```powershell
powershell -File tools/pack.ps1
```

That transpiles the Typhon sources and runs PyInstaller. The result is an onedir build:

`dist/MarkdownViewer/MarkdownViewer.exe`

To wrap that folder in a Windows installer (Inno Setup 6):

```powershell
powershell -File tools/make-installer.ps1
```

The setup exe is written to `dist/MarkdownViewer-Setup-1.0.2.exe`. The wizard asks whether to open `.md` files with MarkdownViewer.

Qt WebEngine needs that folder layout (it ships `QtWebEngineProcess` next to the app). The packed build is large because it includes Chromium.

The packed exe uses GPU compositing. If the window fails to open on a given machine, start it with software raster:

```powershell
$env:QTWEBENGINE_CHROMIUM_FLAGS = "--disable-gpu --no-sandbox"
.\dist\MarkdownViewer\MarkdownViewer.exe
```

## Tests

No Qt required:

```powershell
$env:PYTHONPATH = "D:\projecten\python-transpiler"
python -m transpiler run tests/test_document.typhon
python -m transpiler run tests/test_links.typhon
python -m transpiler run tests/test_i18n.typhon
node tests/test_mermaid_flow.js
node tests/test_markdown_extra.js
```

These cover file load/save, resolving local markdown links, English/Dutch UI strings, mermaid diagram round-trips, and GFM tables / definition lists / strikethrough.

## How it is put together

| Part | Role |
| --- | --- |
| `src/` | Typhon desktop shell: window, tabs, document, link resolution, i18n |
| `web/` | Offline HTML editor (`markdown-it`, Turndown, Mermaid) |
| `samples/` | Demo documents |
| `pack/` | PyInstaller spec and WebEngine runtime hook |
| `tests/` | File, link, and i18n unit tests |

Each tab has its own web view and markdown document. The page never leaves `web/editor.html`; clicks on links go to the native side, which opens a browser, scrolls, or opens another tab.

Edits in the page are turned back into markdown (including Mermaid fences and task items) and stored on the document until you save.
