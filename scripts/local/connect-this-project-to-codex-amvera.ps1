param()

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$proxyRoot = "C:\codex-amvera-proxy"
$switchScript = Join-Path $proxyRoot "switch-codex-to-amvera.ps1"
$appsFolderId = "shell:AppsFolder\OpenAI.Codex_2p2nqsd0c76g0!App"

function Write-Info($text) {
  Write-Host $text -ForegroundColor Cyan
}

function Write-Ok($text) {
  Write-Host $text -ForegroundColor Green
}

if (-not (Test-Path $switchScript)) {
  throw "Amvera switch script not found: $switchScript"
}

Write-Info "Switching Codex to the local Amvera proxy..."
& powershell -NoProfile -ExecutionPolicy Bypass -File $switchScript

if (Get-Command Set-Clipboard -ErrorAction SilentlyContinue) {
  $projectRoot | Set-Clipboard
  Write-Ok "Project path copied to clipboard."
}

Write-Info "Opening this project folder..."
Start-Process explorer.exe $projectRoot | Out-Null

Write-Info "Starting Codex..."
Start-Process explorer.exe $appsFolderId | Out-Null

Write-Host ""
Write-Host "Codex is now pointed to Amvera." -ForegroundColor Green
Write-Host "Project: $projectRoot" -ForegroundColor Green
Write-Host ""
Write-Host "If Codex opens without this folder selected:" -ForegroundColor Yellow
Write-Host "1. In Codex choose Open Folder."
Write-Host "2. Paste the copied path."
Write-Host "3. Select this project."
