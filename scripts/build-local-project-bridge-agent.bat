@echo off
setlocal

set "ROOT=%~dp0.."
set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
set "SOURCE=%ROOT%\desktop\local-bridge-agent\ProjectCoreLocalBridgeAgent.cs"
set "OUTPUT=%ROOT%\public\downloads\ProjectCoreLocalBridgeAgent.exe"

if not exist "%CSC%" (
  echo csc.exe not found: %CSC%
  exit /b 1
)

if not exist "%SOURCE%" (
  echo Source file not found: %SOURCE%
  exit /b 1
)

"%CSC%" /nologo /target:winexe /optimize+ /platform:anycpu ^
  /r:System.dll ^
  /r:System.Core.dll ^
  /r:System.Windows.Forms.dll ^
  /r:System.Web.Extensions.dll ^
  /r:Microsoft.CSharp.dll ^
  /out:"%OUTPUT%" ^
  "%SOURCE%"

if errorlevel 1 exit /b %errorlevel%

echo Built %OUTPUT%
