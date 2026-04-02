param()

$ErrorActionPreference = "Stop"

$proxyRoot = "C:\codex-amvera-proxy"
$codexRoot = Join-Path $env:USERPROFILE ".codex"
$configPath = Join-Path $codexRoot "config.toml"

function Get-ProxyProcesses {
  Get-CimInstance Win32_Process |
    Where-Object {
      $_.Name -match '^node(\.exe)?$' -and
      $_.CommandLine -like "*$proxyRoot*" -and
      $_.CommandLine -like "*server.js*"
    }
}

if (-not (Test-Path $configPath)) {
  throw "Codex config not found: $configPath"
}

$config = Get-Content $configPath -Raw
$isAmvera = $config -match 'model_provider\s*=\s*"amvera_proxy"' -or $config -match '\[model_providers\.amvera_proxy\]'
$proxyProcesses = @(Get-ProxyProcesses)
$proxyRunning = $proxyProcesses.Count -gt 0

Write-Host ""
Write-Host "Codex provider status" -ForegroundColor Cyan
Write-Host "---------------------"

if ($isAmvera) {
  Write-Host "Mode: Amvera proxy" -ForegroundColor Green
} else {
  Write-Host "Mode: Default OpenAI" -ForegroundColor Green
}

if ($proxyRunning) {
  Write-Host "Proxy: running" -ForegroundColor Green
  Write-Host "Proxy root: $proxyRoot"
  Write-Host "Processes: $($proxyProcesses.Count)"
} else {
  Write-Host "Proxy: stopped" -ForegroundColor Yellow
  Write-Host "Proxy root: $proxyRoot"
}

$openAiApiKey = [Environment]::GetEnvironmentVariable("OPENAI_API_KEY", "User")
if ([string]::IsNullOrWhiteSpace($openAiApiKey)) {
  Write-Host "OPENAI_API_KEY: not set" -ForegroundColor Yellow
} elseif ($openAiApiKey -eq "dummy") {
  Write-Host "OPENAI_API_KEY: dummy" -ForegroundColor Yellow
} else {
  Write-Host "OPENAI_API_KEY: set" -ForegroundColor Green
}

Write-Host ""
Write-Host "Config file: $configPath"
