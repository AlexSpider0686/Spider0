param(
  [switch]$Silent,
  [switch]$NoAutostart,
  [switch]$NoStartNow,
  [int]$Port = 32123,
  [string]$InstallRoot = "",
  [string[]]$AllowedOrigins = @(
    "https://spider0-spider0.amvera.io",
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  )
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
Add-Type -AssemblyName System.Windows.Forms

if (-not $InstallRoot) {
  $InstallRoot = Join-Path $env:LOCALAPPDATA "ProjectCoreLocalBridge"
}

$startupDir = [Environment]::GetFolderPath("Startup")
$agentPath = Join-Path $InstallRoot "projectcore-local-bridge-agent.ps1"
$configPath = Join-Path $InstallRoot "config.json"
$startCmdPath = Join-Path $InstallRoot "start-agent.cmd"
$shortcutPath = Join-Path $startupDir "ProjectCore Local Bridge.lnk"

$agentScript = @'
param(
  [int]$Port = 32123,
  [string]$ConfigPath = ""
)

$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Windows.Forms

if (-not $ConfigPath) {
  $ConfigPath = Join-Path (Split-Path -Parent $PSCommandPath) "config.json"
}

$scriptDir = Split-Path -Parent $PSCommandPath
$statusPath = Join-Path $scriptDir "status.json"

function Write-Status($Patch) {
  $state = [ordered]@{
    ok = $true
    agent = "ProjectCoreLocalBridge"
    version = "1.1.0"
    port = $Port
    installRoot = $scriptDir
    startupEnabled = $false
    msProjectDetected = $false
    msProjectVersion = ""
    lastError = ""
    updatedAt = [DateTime]::UtcNow.ToString("o")
  }

  if (Test-Path -LiteralPath $statusPath) {
    try {
      $existing = Get-Content -LiteralPath $statusPath -Raw | ConvertFrom-Json -AsHashtable
      foreach ($key in $existing.Keys) {
        $state[$key] = $existing[$key]
      }
    } catch {
    }
  }

  foreach ($key in $Patch.Keys) {
    $state[$key] = $Patch[$key]
  }

  ($state | ConvertTo-Json -Depth 8) | Set-Content -LiteralPath $statusPath -Encoding UTF8
}

function Read-JsonBody($Request) {
  $reader = New-Object System.IO.StreamReader($Request.InputStream, $Request.ContentEncoding)
  try {
    return $reader.ReadToEnd()
  } finally {
    $reader.Dispose()
  }
}

function Send-Json($Context, [int]$StatusCode, $Payload, [string]$Origin, [array]$AllowedOrigins) {
  $response = $Context.Response
  if ($Origin -and $AllowedOrigins -contains $Origin) {
    $response.Headers["Access-Control-Allow-Origin"] = $Origin
  }
  $response.Headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
  $response.Headers["Access-Control-Allow-Headers"] = "Content-Type"
  $response.Headers["Access-Control-Allow-Private-Network"] = "true"
  $response.ContentType = "application/json; charset=utf-8"
  $response.StatusCode = $StatusCode
  $bytes = [System.Text.Encoding]::UTF8.GetBytes(($Payload | ConvertTo-Json -Depth 8))
  $response.OutputStream.Write($bytes, 0, $bytes.Length)
  $response.Close()
}

function Test-StartupShortcut() {
  $startupDir = [Environment]::GetFolderPath("Startup")
  $shortcutPath = Join-Path $startupDir "ProjectCore Local Bridge.lnk"
  return Test-Path -LiteralPath $shortcutPath
}

function Get-MsProjectStatus() {
  $app = $null
  try {
    $app = New-Object -ComObject MSProject.Application
    $version = ""
    try { $version = [string]$app.Version } catch {}
    return @{
      msProjectDetected = $true
      msProjectVersion = $version
    }
  } catch {
    return @{
      msProjectDetected = $false
      msProjectVersion = ""
      lastError = $_.Exception.Message
    }
  } finally {
    if ($app -ne $null) {
      try { $app.Quit() | Out-Null } catch {}
      try { [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($app) } catch {}
      [GC]::Collect()
      [GC]::WaitForPendingFinalizers()
    }
  }
}

function Select-TargetFolder([string]$InitialPath, [string]$PreferredPath, [bool]$PromptForFolder) {
  if (-not $PromptForFolder -and $PreferredPath) {
    if (-not (Test-Path -LiteralPath $PreferredPath)) {
      New-Item -ItemType Directory -Path $PreferredPath -Force | Out-Null
    }
    return $PreferredPath
  }

  $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
  $dialog.Description = "Выберите папку для сохранения плана Project.Core в формате MS Project (.mpp)"
  $dialog.ShowNewFolderButton = $true
  if ($PreferredPath -and (Test-Path -LiteralPath $PreferredPath)) {
    $dialog.SelectedPath = $PreferredPath
  } elseif ($InitialPath -and (Test-Path -LiteralPath $InitialPath)) {
    $dialog.SelectedPath = $InitialPath
  }

  $result = $dialog.ShowDialog()
  if ($result -ne [System.Windows.Forms.DialogResult]::OK) {
    throw "Сохранение .mpp отменено пользователем."
  }
  return $dialog.SelectedPath
}

function Convert-XmlToMpp([string]$XmlText, [string]$TargetPath, [bool]$OpenInMsProject) {
  $tmpDir = Join-Path $env:TEMP ("project-core-local-bridge-" + [guid]::NewGuid().Guid)
  $null = New-Item -ItemType Directory -Path $tmpDir -Force
  $xmlPath = Join-Path $tmpDir "project-plan.xml"
  $utf8 = New-Object System.Text.UTF8Encoding($true)
  [System.IO.File]::WriteAllText($xmlPath, $XmlText, $utf8)

  $app = $null
  $keepOpen = $false
  try {
    $app = New-Object -ComObject MSProject.Application
    $app.Visible = $false
    $app.DisplayAlerts = 0
    $null = $app.FileOpen($xmlPath)
    $null = $app.FileSaveAs($TargetPath)

    if (-not (Test-Path -LiteralPath $TargetPath)) {
      throw "Microsoft Project не создал .mpp файл."
    }

    if ($OpenInMsProject) {
      $app.Visible = $true
      $keepOpen = $true
    } else {
      $app.FileCloseAllEx(0) | Out-Null
    }
  } finally {
    if ($app -ne $null) {
      if (-not $keepOpen) {
        try { $app.Quit() | Out-Null } catch {}
      }
      try { [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($app) } catch {}
    }
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
    Remove-Item -LiteralPath $tmpDir -Recurse -Force -ErrorAction SilentlyContinue
  }
}

if (Test-Path -LiteralPath $ConfigPath) {
  $config = Get-Content -LiteralPath $ConfigPath -Raw | ConvertFrom-Json
} else {
  $config = [pscustomobject]@{
    allowedOrigins = @("https://spider0-spider0.amvera.io")
    port = $Port
  }
}

$allowedOrigins = @($config.allowedOrigins)
if (-not $allowedOrigins.Count) {
  $allowedOrigins = @("https://spider0-spider0.amvera.io")
}

$port = if ($config.port) { [int]$config.port } else { $Port }
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://127.0.0.1:$port/")
$listener.Prefixes.Add("http://localhost:$port/")

$projectStatus = Get-MsProjectStatus
Write-Status @{
  port = $port
  startupEnabled = (Test-StartupShortcut)
  msProjectDetected = $projectStatus.msProjectDetected
  msProjectVersion = $projectStatus.msProjectVersion
  lastError = $(if ($null -ne $projectStatus.lastError) { $projectStatus.lastError } else { "" })
}

$listener.Start()

try {
  while ($listener.IsListening) {
    $context = $listener.GetContext()
    $request = $context.Request
    $origin = [string]$request.Headers["Origin"]
    $path = [string]$request.Url.AbsolutePath

    if ($request.HttpMethod -eq "OPTIONS") {
      Send-Json $context 204 @{ ok = $true } $origin $allowedOrigins
      continue
    }

    if ($path -eq "/health" -and $request.HttpMethod -eq "GET") {
      $state = Get-Content -LiteralPath $statusPath -Raw | ConvertFrom-Json
      Send-Json $context 200 $state $origin $allowedOrigins
      continue
    }

    if ($path -ne "/export-mpp" -or $request.HttpMethod -ne "POST") {
      Send-Json $context 404 @{ ok = $false; error = "Маршрут не найден." } $origin $allowedOrigins
      continue
    }

    if ($origin -and -not ($allowedOrigins -contains $origin)) {
      Send-Json $context 403 @{ ok = $false; error = "Источник $origin не разрешен для локального моста." } $origin $allowedOrigins
      continue
    }

    try {
      $rawBody = Read-JsonBody $request
      $payload = if ($rawBody) { $rawBody | ConvertFrom-Json } else { $null }
      if (-not $payload) {
        throw "Не получено тело запроса."
      }

      $xml = [string]$payload.xml
      if ([string]::IsNullOrWhiteSpace($xml)) {
        throw "Не получен XML плана проекта."
      }

      $projectName = [string]$payload.projectName
      $fileName = [string]$payload.fileName
      if ([string]::IsNullOrWhiteSpace($fileName)) {
        $fileName = "project_project_plan.mpp"
      }

      $preferredFolder = [string]$payload.targetFolder
      $promptForFolder = [bool]$payload.promptForFolder
      $targetFolder = Select-TargetFolder "" $preferredFolder $promptForFolder
      $targetPath = Join-Path $targetFolder $fileName
      Convert-XmlToMpp $xml $targetPath ([bool]$payload.openInMsProject)

      Write-Status @{
        ok = $true
        lastError = ""
        lastSavedPath = $targetPath
      }

      Send-Json $context 200 @{
        ok = $true
        savedPath = $targetPath
        projectName = $projectName
      } $origin $allowedOrigins
    } catch {
      $message = $_.Exception.Message
      Write-Status @{
        ok = $false
        lastError = $message
      }
      Send-Json $context 500 @{
        ok = $false
        error = $message
      } $origin $allowedOrigins
    }
  }
} finally {
  try { $listener.Stop() } catch {}
  try { $listener.Close() } catch {}
}
'@

$allowedOriginsJson = ($AllowedOrigins | ConvertTo-Json -Depth 4)
$configJson = @"
{
  "port": $Port,
  "allowedOrigins": $allowedOriginsJson
}
"@

New-Item -ItemType Directory -Path $InstallRoot -Force | Out-Null
[System.IO.File]::WriteAllText($agentPath, $agentScript, [System.Text.UTF8Encoding]::new($true))
[System.IO.File]::WriteAllText($configPath, $configJson, [System.Text.UTF8Encoding]::new($true))
[System.IO.File]::WriteAllText(
  $startCmdPath,
  "@echo off`r`npowershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Minimized -File `"%~dp0projectcore-local-bridge-agent.ps1`" -Port $Port`r`n",
  [System.Text.UTF8Encoding]::new($true)
)

if (-not $NoAutostart) {
  $shell = New-Object -ComObject WScript.Shell
  $shortcut = $shell.CreateShortcut($shortcutPath)
  $shortcut.TargetPath = $startCmdPath
  $shortcut.WorkingDirectory = $InstallRoot
  $shortcut.WindowStyle = 7
  $shortcut.Description = "Project.Core Local Bridge"
  $shortcut.Save()
} elseif (Test-Path -LiteralPath $shortcutPath) {
  Remove-Item -LiteralPath $shortcutPath -Force
}

if (-not $NoStartNow) {
  Start-Process powershell.exe -ArgumentList @(
    "-NoProfile",
    "-ExecutionPolicy", "Bypass",
    "-WindowStyle", "Minimized",
    "-File", $agentPath,
    "-Port", $Port,
    "-ConfigPath", $configPath
  ) -WorkingDirectory $InstallRoot
}

if (-not $Silent) {
  [System.Windows.Forms.MessageBox]::Show(
    "Локальный агент Project.Core установлен.`n`nОн слушает только localhost:$Port и работает для текущего пользователя Windows.`nТеперь можно вернуться в web-версию и повторить экспорт MS Project (.mpp).",
    "Project.Core Local Bridge",
    [System.Windows.Forms.MessageBoxButtons]::OK,
    [System.Windows.Forms.MessageBoxIcon]::Information
  ) | Out-Null
}
