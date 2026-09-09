# MarkdownViewer

A standalone desktop app for **reading and editing markdown as it looks**, not as raw source.

Open a `.md` file and you see headings, lists, links, checklists, and Mermaid diagrams already rendered. You edit that page directly; the app keeps a real markdown file underneath and saves it as UTF-8.

The window is a small native shell with a Chromium editor inside. Menus and dialogs follow the OS language (**English** or **Dutch**; anything else uses English). It is meant to be used as `MarkdownViewer.exe`, not as a website.

## What you can do

- Open, save, and save-as markdown (`.md` / `.markdown`)
- Edit the rendered document: bold, headings, links, lists, a horizontal rule, and a task list
- Toggle GFM checkboxes (`- [ ]` / `- [x]`); the change is written back into the file
- Render fenced ` ```mermaid ` diagrams (view-only; there is no visual diagram editor yet)
- Follow links with a normal click:
  - `http` / `https` / `mailto` open in the system browser
  - `#anker` scrolls in the current document
  - a local `.md` / `.markdown` file that exists opens in a **new tab** (or focuses that tab if it is already open)
  - anything else shows a warning and does not navigate away
- Work with several documents in tabs. **New** opens an empty tab; **Open** loads into the current tab. At least one tab stays open. Closing the window asks about every unsaved tab.

Link *text* is edited by selecting it and using the **Link** toolbar button, not by clicking the link.

Try `samples/demo.md`. It includes a rule, a checklist, a link to `samples/linked.md`, an external URL, and a Mermaid flowchart.

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

Qt WebEngine needs that folder layout (it ships `QtWebEngineProcess` next to the app). The build is large, on the order of hundreds of megabytes.

## Tests

No Qt required:

```powershell
$env:PYTHONPATH = "D:\projecten\python-transpiler"
python -m transpiler run tests/test_document.typhon
python -m transpiler run tests/test_links.typhon
python -m transpiler run tests/test_i18n.typhon
```

These cover file load/save, resolving local markdown links, and English/Dutch UI strings.

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
