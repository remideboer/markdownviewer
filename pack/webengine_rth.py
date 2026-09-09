# PyInstaller runtime hook: locate QtWebEngineProcess next to the frozen exe.
import os
import sys
from pathlib import Path

if getattr(sys, "frozen", False):
    exe_dir = Path(sys.executable).resolve().parent
    meipass = Path(getattr(sys, "_MEIPASS", exe_dir))
    for folder in (
        exe_dir,
        meipass,
        exe_dir / "PyQt6" / "Qt6" / "bin",
        meipass / "PyQt6" / "Qt6" / "bin",
    ):
        proc = folder / "QtWebEngineProcess.exe"
        if proc.is_file():
            os.environ["QTWEBENGINEPROCESS_PATH"] = str(proc)
            break
    for folder in (exe_dir / "PyQt6" / "Qt6" / "resources", meipass / "PyQt6" / "Qt6" / "resources"):
        if folder.is_dir():
            os.environ["QTWEBENGINE_RESOURCES_PATH"] = str(folder)
            break
    for folder in (
        exe_dir / "PyQt6" / "Qt6" / "translations" / "qtwebengine_locales",
        meipass / "PyQt6" / "Qt6" / "translations" / "qtwebengine_locales",
    ):
        if folder.is_dir():
            os.environ["QTWEBENGINE_LOCALES_PATH"] = str(folder)
            break
    if "QTWEBENGINE_CHROMIUM_FLAGS" not in os.environ:
        os.environ["QTWEBENGINE_CHROMIUM_FLAGS"] = "--disable-gpu --no-sandbox"
