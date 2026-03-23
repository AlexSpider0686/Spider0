@echo off
setlocal enabledelayedexpansion

echo ============================================
echo   Push local branch to GitHub (HTTPS+PAT)
echo ============================================
echo.

where git >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Git is not installed or not in PATH.
  exit /b 1
)

git rev-parse --is-inside-work-tree >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Current directory is not a git repository.
  echo Open CMD in your project folder and run this script again.
  exit /b 1
)

for /f "delims=" %%i in ('git branch --show-current') do set CURRENT_BRANCH=%%i
if "%CURRENT_BRANCH%"=="" set CURRENT_BRANCH=main

echo Current branch: %CURRENT_BRANCH%
echo.

set /p GITHUB_USER=GitHub username:
set /p GITHUB_TOKEN=GitHub token (PAT):
set /p REPO_OWNER=Repository owner [default: AlexSpider0686]:
set /p REPO_NAME=Repository name [default: Spider0]:
set /p BRANCH_TO_PUSH=Branch to push [default: %CURRENT_BRANCH%]:

if "%REPO_OWNER%"=="" set REPO_OWNER=AlexSpider0686
if "%REPO_NAME%"=="" set REPO_NAME=Spider0
if "%BRANCH_TO_PUSH%"=="" set BRANCH_TO_PUSH=%CURRENT_BRANCH%

set REMOTE_WITH_TOKEN=https://%GITHUB_USER%:%GITHUB_TOKEN%@github.com/%REPO_OWNER%/%REPO_NAME%.git
set REMOTE_CLEAN=https://github.com/%REPO_OWNER%/%REPO_NAME%.git

echo.
echo [1/4] Configure origin remote...
git remote get-url origin >nul 2>&1
if errorlevel 1 (
  git remote add origin %REMOTE_WITH_TOKEN%
) else (
  git remote set-url origin %REMOTE_WITH_TOKEN%
)

echo [2/4] Fetch remote...
git fetch origin
if errorlevel 1 (
  echo [ERROR] git fetch failed.
  exit /b 1
)

echo [3/4] Push branch "%BRANCH_TO_PUSH%"...
git push -u origin %BRANCH_TO_PUSH%
if errorlevel 1 (
  echo [ERROR] git push failed.
  exit /b 1
)

echo [4/4] Remove token from origin URL...
git remote set-url origin %REMOTE_CLEAN%

echo.
echo Done. Branch "%BRANCH_TO_PUSH%" pushed to:
echo %REMOTE_CLEAN%
echo.
echo Next step: open GitHub and create PR (base: main, compare: %BRANCH_TO_PUSH%).

exit /b 0
