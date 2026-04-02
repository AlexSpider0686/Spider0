param()

$ErrorActionPreference = "Stop"

$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$connectScript = Join-Path $projectRoot "connect-this-project-to-codex-amvera.ps1"
$disconnectScript = Join-Path $projectRoot "disconnect-this-project-from-codex-amvera.ps1"
$statusScript = Join-Path $projectRoot "status-codex-amvera.ps1"

function Show-Header {
  Clear-Host
  Write-Host ""
  Write-Host "  ==============================================================" -ForegroundColor DarkCyan
  Write-Host "                     CODEX / AMVERA CONTROL" -ForegroundColor Cyan
  Write-Host "  ==============================================================" -ForegroundColor DarkCyan
  Write-Host ""
  Write-Host "  Project: $projectRoot" -ForegroundColor Gray
  Write-Host ""
}

function Show-Menu {
  Write-Host "  [1] Connect this project to Codex via Amvera proxy" -ForegroundColor Green
  Write-Host "  [2] Disconnect and restore default Codex servers" -ForegroundColor Yellow
  Write-Host "  [3] Show current status" -ForegroundColor Cyan
  Write-Host "  [4] Open project folder" -ForegroundColor Magenta
  Write-Host "  [0] Exit" -ForegroundColor DarkGray
  Write-Host ""
}

function Pause-Return {
  Write-Host ""
  Read-Host "  Press Enter to return to the menu"
}

function Invoke-SafeScript {
  param(
    [string]$Path
  )

  if (-not (Test-Path $Path)) {
    throw "Script not found: $Path"
  }

  & powershell -NoProfile -ExecutionPolicy Bypass -File $Path
}

while ($true) {
  Show-Header
  Show-Menu
  $choice = Read-Host "  Choose an action"

  try {
    switch ($choice.Trim()) {
      "1" {
        Show-Header
        Write-Host "  Connecting this project to Codex via Amvera..." -ForegroundColor Green
        Write-Host ""
        Invoke-SafeScript -Path $connectScript
        Pause-Return
      }
      "2" {
        Show-Header
        Write-Host "  Restoring default Codex servers..." -ForegroundColor Yellow
        Write-Host ""
        Invoke-SafeScript -Path $disconnectScript
        Pause-Return
      }
      "3" {
        Show-Header
        Write-Host "  Current status" -ForegroundColor Cyan
        Write-Host ""
        Invoke-SafeScript -Path $statusScript
        Pause-Return
      }
      "4" {
        Start-Process explorer.exe $projectRoot | Out-Null
        Show-Header
        Write-Host "  Project folder opened." -ForegroundColor Magenta
        Pause-Return
      }
      "0" {
        break
      }
      default {
        Write-Host ""
        Write-Host "  Unknown option. Choose 0, 1, 2, 3 or 4." -ForegroundColor Red
        Start-Sleep -Seconds 1
      }
    }
  } catch {
    Write-Host ""
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    Pause-Return
  }
}
