# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for MarkdownViewer (onedir — Qt WebEngine needs QtWebEngineProcess)."""

from pathlib import Path

from PyInstaller.utils.hooks import collect_all

spec_dir = Path(SPECPATH).resolve()
root = spec_dir.parent
transpiled = root / ".transpiled"

datas = [
    (str(root / "web"), "web"),
    (str(root / "samples"), "samples"),
]

binaries = []
hiddenimports = [
    "PyQt6.QtCore",
    "PyQt6.QtGui",
    "PyQt6.QtWidgets",
    "PyQt6.QtWebEngineCore",
    "PyQt6.QtWebEngineWidgets",
    "PyQt6.QtWebChannel",
    "PyQt6.QtPrintSupport",
    "PyQt6.sip",
    "document",
    "ui",
    "bridge",
    "paths",
    "tab",
    "links",
    "i18n",
    "icons",
    "qtlang",
]

for pkg in ("PyQt6.QtWebEngineCore", "PyQt6.QtWebEngineWidgets", "PyQt6.QtWebChannel"):
    pkg_datas, pkg_binaries, pkg_hidden = collect_all(pkg)
    datas += pkg_datas
    binaries += pkg_binaries
    hiddenimports += pkg_hidden

a = Analysis(
    [str(transpiled / "main.py")],
    pathex=[str(transpiled)],
    binaries=binaries,
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[str(spec_dir / "webengine_rth.py")],
    excludes=[],
    noarchive=False,
)

pyz = PYZ(a.pure)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name="MarkdownViewer",
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=False,
    console=False,
    disable_windowed_traceback=False,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.datas,
    name="MarkdownViewer",
)
