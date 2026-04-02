param()

$ErrorActionPreference = "Stop"

$proxyRoot = "C:\codex-amvera-proxy"
$switchBackScript = Join-Path $proxyRoot "switch-codex-to-openai.ps1"

function Write-Info($text) {
  Write-Host $text -ForegroundColor Cyan
}

function Write-Ok($text) {
  Write-Host $text -ForegroundColor Green
}

if (-not (Test-Path $switchBackScript)) {
  throw "OpenAI restore script not found: $switchBackScript"
}

Write-Info "Restoring Codex default servers..."
& powershell -NoProfile -ExecutionPolicy Bypass -File $switchBackScript

Write-Host ""
Write-Ok "Codex has been switched back to its default servers."
Write-Host "Restart Codex if it is still open." -ForegroundColor Yellow
