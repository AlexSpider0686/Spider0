param(
  [string]$ResendApiKey = '',
  [string]$ResendFrom = '',
  [switch]$DebugMode,
  [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'

$projectRoot = $PSScriptRoot
Set-Location $projectRoot

function Read-RequiredValue {
  param(
    [string]$Prompt,
    [string]$Example = ''
  )

  while ($true) {
    $suffix = if ($Example) { " ($Example)" } else { '' }
    $value = Read-Host "$Prompt$suffix"
    if (-not [string]::IsNullOrWhiteSpace($value)) {
      return $value.Trim()
    }
    Write-Host 'Value is required.' -ForegroundColor Yellow
  }
}

function Read-YesNo {
  param(
    [string]$Prompt,
    [bool]$Default = $true
  )

  $hint = if ($Default) { '[Y/n]' } else { '[y/N]' }
  $raw = Read-Host "$Prompt $hint"
  if ([string]::IsNullOrWhiteSpace($raw)) {
    return $Default
  }

  switch -Regex ($raw.Trim().ToLowerInvariant()) {
    '^(y|yes)$' { return $true }
    '^(n|no)$' { return $false }
    default {
      Write-Host 'Unknown answer. Using default.' -ForegroundColor Yellow
      return $Default
    }
  }
}

function Get-NodeCommand {
  $nodeCmd = Get-Command node -ErrorAction SilentlyContinue
  if (-not $nodeCmd) {
    throw 'Node.js was not found. Install Node.js and run the script again.'
  }
  return $nodeCmd.Source
}

function Get-NpmCommand {
  $npmCmd = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($npmCmd) {
    return $npmCmd.Source
  }

  $npmPs = Get-Command npm -ErrorAction SilentlyContinue
  if ($npmPs) {
    return $npmPs.Source
  }

  throw 'npm was not found. Install Node.js/npm and run the script again.'
}

Write-Host ''
Write-Host 'Preparing Amvera auth settings' -ForegroundColor Cyan
Write-Host "Project: $projectRoot"
Write-Host ''

$nodePath = Get-NodeCommand
$npmPath = Get-NpmCommand

$authSecret = & $nodePath -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
if (-not $authSecret) {
  throw 'Failed to generate AUTH_OTP_SECRET.'
}

$resendApiKey = if ($ResendApiKey) { $ResendApiKey.Trim() } else { Read-RequiredValue -Prompt 'Enter RESEND_API_KEY' }
$resendFrom = if ($ResendFrom) { $ResendFrom.Trim() } else { Read-RequiredValue -Prompt 'Enter RESEND_FROM' -Example 'SmetaCore <noreply@yourdomain.ru>' }
$debugMode = if ($PSBoundParameters.ContainsKey('DebugMode')) { [bool]$DebugMode } else { Read-YesNo -Prompt 'Enable temporary debug mode without real email sending?' -Default $false }

$forceTestMode = if ($debugMode) { '1' } else { '0' }
$rotatingTestCode = if ($debugMode) { '1' } else { '0' }
$staticTestCode = '0'

$envBlock = @(
  "AUTH_OTP_SECRET=$authSecret"
  "RESEND_API_KEY=$resendApiKey"
  "RESEND_FROM=$resendFrom"
  "AUTH_FORCE_TEST_MODE=$forceTestMode"
  "AUTH_ROTATING_TEST_CODE=$rotatingTestCode"
  "AUTH_STATIC_TEST_CODE=$staticTestCode"
  "NODE_ENV=production"
) -join [Environment]::NewLine

$envFile = Join-Path $projectRoot 'amvera-auth-env.txt'
$guideFile = Join-Path $projectRoot 'amvera-auth-next-steps.txt'

Set-Content -Path $envFile -Value $envBlock -Encoding UTF8

$guide = @(
  '1. Open your project in Amvera.'
  '2. Open the environment variables section.'
  '3. Open amvera-auth-env.txt and copy the lines into Amvera.'
  '4. Save the variables.'
  '5. Run a redeploy.'
  '6. Test login on the site after deploy.'
  ''
  'Debug mode:'
  'AUTH_FORCE_TEST_MODE=1'
  'AUTH_ROTATING_TEST_CODE=1'
  'In this mode email is not sent, but the backend returns a test code.'
  ''
  'Production mode:'
  'AUTH_FORCE_TEST_MODE=0'
  'AUTH_ROTATING_TEST_CODE=0'
  'In this mode messages are sent through Resend.'
) -join [Environment]::NewLine

Set-Content -Path $guideFile -Value $guide -Encoding UTF8

if (Get-Command Set-Clipboard -ErrorAction SilentlyContinue) {
  $envBlock | Set-Clipboard
  Write-Host 'The env block was copied to clipboard.' -ForegroundColor Green
}

Write-Host ''
Write-Host 'Created files:' -ForegroundColor Green
Write-Host "  $envFile"
Write-Host "  $guideFile"
Write-Host ''

if (-not $SkipBuild -and (Read-YesNo -Prompt 'Run production build now?' -Default $true)) {
  & $npmPath 'run' 'build'
}

Write-Host ''
Write-Host 'Env block for Amvera:' -ForegroundColor Cyan
Write-Host '----------------------------------------'
Write-Host $envBlock
Write-Host '----------------------------------------'
Write-Host ''
Write-Host 'Next: paste these variables into Amvera and redeploy the app.' -ForegroundColor Yellow
