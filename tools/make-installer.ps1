# Build the Windows installer (requires Inno Setup 6 and a packed dist/MarkdownViewer).
$ErrorActionPreference = "Stop"
$root = Split-Path -Parent $PSScriptRoot
$iss = Join-Path $root "pack\installer.iss"
$candidates = @(
    (Join-Path $env:LOCALAPPDATA "Programs\Inno Setup 6\ISCC.exe"),
    (Join-Path ${env:ProgramFiles(x86)} "Inno Setup 6\ISCC.exe"),
    (Join-Path $env:ProgramFiles "Inno Setup 6\ISCC.exe")
)
$iscc = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $iscc) {
    throw "Inno Setup ISCC.exe not found. Install JRSoftware.InnoSetup (winget)."
}
$exe = Join-Path $root "dist\MarkdownViewer\MarkdownViewer.exe"
if (-not (Test-Path $exe)) {
    throw "Packed app missing. Run tools/pack.ps1 first."
}
& $iscc $iss
if ($LASTEXITCODE -ne 0) {
    throw "Inno Setup failed with exit $LASTEXITCODE"
}
Write-Host "Installer: $root\dist\MarkdownViewer-Setup-1.0.1.exe"
