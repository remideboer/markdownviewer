# Transpile Typhon → Python, then build dist/MarkdownViewer/MarkdownViewer.exe
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$transpilerRoot = "D:\projecten\python-transpiler"
if (-not (Test-Path (Join-Path $transpilerRoot "transpiler"))) {
    throw "Typhon transpiler not found at $transpilerRoot"
}

$env:PYTHONPATH = $transpilerRoot
python -m transpiler deps lock typhon.toml
python -m transpiler transpile src/main.typhon .transpiled/main.py

$site = python -c @"
from pathlib import Path
from transpiler.deps import load_deps, resolve_site_paths
cfg = load_deps(Path(r'$root') / 'src' / 'main.typhon')
paths = resolve_site_paths(cfg)
print(paths[0] if paths else '')
"@
$site = ($site | Select-Object -Last 1).Trim()
if (-not $site) {
    throw "Could not resolve Typhon dependency environment (pyqt6)."
}

$env:PYTHONPATH = "$site;$transpilerRoot;$root\.transpiled"
python -m pip install --quiet pyinstaller
python -m PyInstaller --noconfirm --clean --distpath "$root\dist" --workpath "$root\build" pack/markdownviewer.spec
$out = Join-Path $root "dist\MarkdownViewer"
Write-Host "Built: $out\MarkdownViewer.exe"
Get-ChildItem $out | ForEach-Object {
    if ($_.PSIsContainer) {
        $bytes = (Get-ChildItem $_.FullName -Recurse -File -ErrorAction SilentlyContinue |
            Measure-Object Length -Sum).Sum
    } else {
        $bytes = $_.Length
    }
    [PSCustomObject]@{ Name = $_.Name; MB = [math]::Round(($bytes / 1MB), 1) }
} | Sort-Object MB -Descending | Select-Object -First 15 | Format-Table -AutoSize
$total = (Get-ChildItem $out -Recurse -File | Measure-Object Length -Sum).Sum
Write-Host ("Unpacked: {0:N1} MB" -f ($total / 1MB))
