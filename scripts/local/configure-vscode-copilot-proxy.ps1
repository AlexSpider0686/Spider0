# Скрипт для автоматической настройки VS Code на локальный прокси
# Автор: Gemini для Александра

$settingsPath = "$env:APPDATA\Code\User\settings.json"

# Проверяем, существует ли папка настроек
if (-not (Test-Path (Split-Path $settingsPath))) {
    Write-Host "[-] VS Code не найден или еще не был запущен. Сначала установите и запустите его." -ForegroundColor Red
    exit
}

# Если файла settings.json нет, создаем пустой объект
if (-not (Test-Path $settingsPath)) {
    $settings = @{}
} else {
    # Читаем текущие настройки
    try {
        $content = Get-Content $settingsPath -Raw
        if ([string]::IsNullOrWhiteSpace($content)) {
            $settings = @{}
        } else {
            $settings = $content | ConvertFrom-Json -ErrorAction Stop
        }
    } catch {
        Write-Host "[!] Ошибка чтения settings.json. Возможно, файл поврежден. Создаю резервную копию." -ForegroundColor Yellow
        Copy-Item $settingsPath "$settingsPath.bak"
        $settings = @{}
    }
}

# Добавляем или обновляем настройки для Copilot
$settings."github.copilot.advanced" = @{
    "debug.overrideEngineUrl" = "http://localhost:3000";
    "debug.testOverrideProxyUrl" = "http://localhost:3000";
    "debug.overrideProxyUrl" = "http://localhost:3000"
}

# Отключаем строгую проверку SSL (часто нужно для локальных прокси)
$settings."http.proxyStrictSSL" = $false

# Сохраняем обратно в JSON
$settings | ConvertTo-Json -Depth 10 | Out-File $settingsPath -Encoding utf8

Write-Host "[+] Настройки успешно применены!" -ForegroundColor Green
Write-Host "[*] Теперь ПЕРЕЗАПУСТИ VS Code, чтобы изменения вступили в силу." -ForegroundColor Cyan