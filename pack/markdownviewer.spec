# -*- mode: python ; coding: utf-8 -*-
"""PyInstaller spec for MarkdownViewer (onedir — Qt WebEngine needs QtWebEngineProcess)."""

from pathlib import Path

spec_dir = Path(SPECPATH).resolve()
root = spec_dir.parent
transpiled = root / ".transpiled"

datas = [
    (str(root / "web"), "web"),
    (str(root / "samples"), "samples"),
]

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
    "instance",
    "PyQt6.QtNetwork",
]

excludes = [
    "PyQt6.QtSql",
    "PyQt6.QtMultimedia",
    "PyQt6.QtBluetooth",
    "PyQt6.QtTest",
    "PyQt6.QtSensors",
    "PyQt6.QtNfc",
    "PyQt6.QtPositioning",
    "PyQt6.QtSerialPort",
    "PyQt6.QtDBus",
    "PyQt6.QtDesigner",
    "PyQt6.QtHelp",
    "PyQt6.QtXml",
]

KEEP_QM = {
    "qt_en.qm",
    "qt_nl.qm",
    "qtbase_en.qm",
    "qtbase_nl.qm",
}

KEEP_IMAGEFORMAT = ("qico", "qjpeg", "qpng", "qsvg")

DROP_PATH_PARTS = (
    "/plugins/sqldrivers/",
    "/plugins/multimedia/",
    "/plugins/playlistformats/",
    "/plugins/generic/",
    "/plugins/geometryloaders/",
    "/plugins/renderers/",
    "/plugins/scenegraph/",
    "/plugins/sensors/",
    "/plugins/position/",
    "/plugins/networkinformation/",
    "/plugins/qmltooling/",
    "/plugins/canbus/",
    "/qml/",
)


def _dest_name(item):
    name = item[0] if isinstance(item, (tuple, list)) else str(item)
    return name.replace("\\", "/").lower()


def keep_qt_file(item):
    name = _dest_name(item)
    if "qtwebengine_locales" in name:
        return name.endswith("en-us.pak")
    if ".debug.pak" in name or ".debug.bin" in name:
        return False
    if "devtools_resources" in name:
        return False
    if name.endswith(".qm"):
        return name.rsplit("/", 1)[-1] in KEEP_QM
    for drop in DROP_PATH_PARTS:
        if drop in name:
            return False
    if "/plugins/imageformats/" in name:
        base = name.rsplit("/", 1)[-1]
        return any(token in base for token in KEEP_IMAGEFORMAT)
    base = name.rsplit("/", 1)[-1]
    if base.startswith("qt6quick3d"):
        return False
    return True


a = Analysis(
    [str(transpiled / "main.py")],
    pathex=[str(transpiled)],
    binaries=[],
    datas=datas,
    hiddenimports=hiddenimports,
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[str(spec_dir / "webengine_rth.py")],
    excludes=excludes,
    noarchive=False,
)

a.datas = [item for item in a.datas if keep_qt_file(item)]
a.binaries = [item for item in a.binaries if keep_qt_file(item)]

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
