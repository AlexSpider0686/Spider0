const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const https = require("https");
const os = require("os");
const { spawn } = require("child_process");
const Store = require("electron-store").default;

const store = new Store({
  name: "projectcore-agent-shell",
  defaults: {
    provider: "gigachat",
    modelByProvider: {
      gigachat: "GigaChat-2-Max"
    },
    workspacePath: process.cwd(),
    gitProvider: "github",
    remotes: {
      github: "",
      gitverse: ""
    },
    credentials: {
      gigachatAuthorizationKey: "",
      gigachatClientId: "",
      gigachatClientSecret: "",
      gigachatScope: "GIGACHAT_API_PERS",
      gigachatAllowInsecureTls: false
    }
  }
});

const TEXT_FILE_EXTENSIONS = new Set([
  ".txt", ".md", ".markdown", ".json", ".js", ".jsx", ".ts", ".tsx", ".css", ".scss",
  ".html", ".htm", ".xml", ".yml", ".yaml", ".ini", ".env", ".csv", ".log", ".sql",
  ".py", ".java", ".kt", ".c", ".cpp", ".h", ".hpp", ".cs", ".go", ".rs", ".php",
  ".rb", ".sh", ".ps1", ".bat"
]);

const MIME_TYPES = {
  ".txt": "text/plain",
  ".md": "text/markdown",
  ".json": "application/json",
  ".js": "application/javascript",
  ".jsx": "text/javascript",
  ".ts": "application/typescript",
  ".tsx": "text/typescript",
  ".css": "text/css",
  ".html": "text/html",
  ".htm": "text/html",
  ".xml": "application/xml",
  ".yml": "application/x-yaml",
  ".yaml": "application/x-yaml",
  ".csv": "text/csv",
  ".pdf": "application/pdf",
  ".doc": "application/msword",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ".ppt": "application/ppt",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".bmp": "image/bmp",
  ".tif": "image/tiff",
  ".tiff": "image/tiff",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".mp3": "audio/mp3",
  ".mp4": "audio/mp4",
  ".wav": "audio/wav"
};

function createWindow() {
  const window = new BrowserWindow({
    width: 1540,
    height: 960,
    minWidth: 1220,
    minHeight: 760,
    backgroundColor: "#0c1017",
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  window.loadFile(path.join(__dirname, "..", "renderer", "index.html"));
}

function ensureDirectory(dirPath) {
  const resolved = path.resolve(dirPath || process.cwd());
  if (!fs.existsSync(resolved)) {
    throw new Error("Рабочая папка не найдена.");
  }
  if (!fs.statSync(resolved).isDirectory()) {
    throw new Error("Указанный путь не является папкой.");
  }
  return resolved;
}

function ensureFile(filePath) {
  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    throw new Error(`Файл не найден: ${resolved}`);
  }
  if (!fs.statSync(resolved).isFile()) {
    throw new Error(`Путь не является файлом: ${resolved}`);
  }
  return resolved;
}

function resolvePath(basePath, inputPath = "") {
  const trimmed = String(inputPath || "").trim();
  if (!trimmed) {
    return ensureDirectory(basePath || process.cwd());
  }
  return path.isAbsolute(trimmed) ? path.resolve(trimmed) : path.resolve(basePath || process.cwd(), trimmed);
}

function getMimeType(filePath) {
  const extension = path.extname(String(filePath || "")).toLowerCase();
  return MIME_TYPES[extension] || "application/octet-stream";
}

function isImageMime(mimeType) {
  return String(mimeType || "").startsWith("image/");
}

function isTextLikeFile(filePath, mimeType = "") {
  const extension = path.extname(String(filePath || "")).toLowerCase();
  return TEXT_FILE_EXTENSIONS.has(extension) || String(mimeType || "").startsWith("text/");
}

function listFilesRecursive(rootPath, maxEntries = 250) {
  const results = [];
  const queue = [rootPath];
  const skip = new Set([".git", "node_modules", "dist", "release", ".idea", ".vscode", ".next", "coverage"]);

  while (queue.length && results.length < maxEntries) {
    const current = queue.shift();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      if (skip.has(entry.name)) {
        continue;
      }
      const fullPath = path.join(current, entry.name);
      const relativePath = path.relative(rootPath, fullPath);
      if (entry.isDirectory()) {
        queue.push(fullPath);
      } else {
        results.push(relativePath || entry.name);
        if (results.length >= maxEntries) {
          break;
        }
      }
    }
  }

  return results;
}

function listPathEntries(targetPath, maxEntries = 120) {
  const resolved = resolvePath(process.cwd(), targetPath);
  const stat = fs.statSync(resolved);
  if (!stat.isDirectory()) {
    return {
      path: resolved,
      type: "file",
      size: stat.size,
      mimeType: getMimeType(resolved)
    };
  }

  const entries = fs.readdirSync(resolved, { withFileTypes: true }).slice(0, maxEntries).map((entry) => {
    const fullPath = path.join(resolved, entry.name);
    let size = 0;
    try {
      size = fs.statSync(fullPath).size;
    } catch {
      size = 0;
    }

    return {
      name: entry.name,
      kind: entry.isDirectory() ? "directory" : "file",
      size
    };
  });

  return {
    path: resolved,
    type: "directory",
    entries
  };
}

function readFileAny(basePath, targetPath) {
  const resolved = ensureFile(resolvePath(basePath, targetPath));
  return {
    path: resolved,
    content: fs.readFileSync(resolved, "utf8")
  };
}

function writeFileAny(basePath, targetPath, content) {
  const resolved = resolvePath(basePath, targetPath);
  fs.mkdirSync(path.dirname(resolved), { recursive: true });
  fs.writeFileSync(resolved, String(content || ""), "utf8");
  return { ok: true, path: resolved };
}

function replaceInFileAny(basePath, targetPath, searchValue, replaceValue, replaceAll = true) {
  const resolved = ensureFile(resolvePath(basePath, targetPath));
  const source = fs.readFileSync(resolved, "utf8");
  const needle = String(searchValue || "");

  if (!needle) {
    throw new Error("Для replace_in_file нужно передать непустое значение search.");
  }

  if (!source.includes(needle)) {
    throw new Error(`Строка не найдена в файле: ${needle}`);
  }

  const updated = replaceAll
    ? source.split(needle).join(String(replaceValue || ""))
    : source.replace(needle, String(replaceValue || ""));

  fs.writeFileSync(resolved, updated, "utf8");

  return {
    ok: true,
    path: resolved,
    replacedAll: replaceAll,
    occurrences: replaceAll ? source.split(needle).length - 1 : 1
  };
}

function searchText(basePath, pattern, rootPath = "") {
  const root = resolvePath(basePath, rootPath || basePath);
  const files = listFilesRecursive(root, 1000);
  const matches = [];
  const lowerPattern = String(pattern || "").toLowerCase();

  for (const relativePath of files) {
    if (matches.length >= 120) {
      break;
    }

    const filePath = path.join(root, relativePath);
    try {
      if (!isTextLikeFile(filePath, getMimeType(filePath))) {
        continue;
      }
      const text = fs.readFileSync(filePath, "utf8");
      const lines = text.split(/\r?\n/);
      lines.forEach((line, index) => {
        if (matches.length >= 120) {
          return;
        }
        if (line.toLowerCase().includes(lowerPattern)) {
          matches.push({
            path: filePath,
            lineNumber: index + 1,
            line: line.slice(0, 240)
          });
        }
      });
    } catch {
      continue;
    }
  }

  return matches;
}

function readCodeSample(basePath, targetPath, startLine = 1, lineCount = 120) {
  const resolved = ensureFile(resolvePath(basePath, targetPath));
  const text = fs.readFileSync(resolved, "utf8");
  const lines = text.split(/\r?\n/);
  const start = Math.max(1, Number(startLine || 1));
  const count = Math.max(1, Number(lineCount || 120));

  return {
    path: resolved,
    lines: lines.slice(start - 1, start - 1 + count).map((line, index) => ({
      lineNumber: start + index,
      line
    }))
  };
}

function truncateText(text, limit = 5000) {
  const normalized = String(text || "");
  if (normalized.length <= limit) {
    return normalized;
  }
  return `${normalized.slice(0, limit)}\n...[truncated ${normalized.length - limit} chars]`;
}

function runCommand(command, cwd) {
  return new Promise((resolve) => {
    const child = spawn("powershell.exe", ["-NoProfile", "-Command", command], {
      cwd,
      windowsHide: true
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => {
      resolve({
        code,
        stdout: stdout.slice(-32000),
        stderr: stderr.slice(-32000)
      });
    });
  });
}

async function analyzeDisk(targetPath = "C:\\") {
  const resolved = resolvePath(process.cwd(), targetPath);
  const command = [
    "$ErrorActionPreference='SilentlyContinue'",
    `$root = Get-Item -LiteralPath '${resolved.replace(/'/g, "''")}'`,
    "if (-not $root.PSIsContainer) { $root = $root.Directory }",
    "$items = Get-ChildItem -LiteralPath $root.FullName -Force",
    "$result = foreach ($item in $items) {",
    "  if ($item.PSIsContainer) {",
    "    $size = (Get-ChildItem -LiteralPath $item.FullName -Force -Recurse -File | Measure-Object Length -Sum).Sum",
    "  } else {",
    "    $size = $item.Length",
    "  }",
    "  if ($null -eq $size) { $size = 0 }",
    "  [pscustomobject]@{ Name = $item.Name; Type = if ($item.PSIsContainer) { 'directory' } else { 'file' }; Size = [int64]$size }",
    "}",
    "$result | Sort-Object Size -Descending | Select-Object -First 25 | ConvertTo-Json -Compress"
  ].join("; ");

  const result = await runCommand(command, resolved);
  if (result.code !== 0 && !result.stdout) {
    return result;
  }

  let parsed = [];
  try {
    parsed = JSON.parse(result.stdout || "[]");
  } catch {
    parsed = [];
  }

  return {
    path: resolved,
    topItems: Array.isArray(parsed) ? parsed : [parsed]
  };
}

function normalizeGigaChatAuthorizationKey(value) {
  return String(value || "")
    .replace(/^Basic\s+/i, "")
    .replace(/^["']|["']$/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function normalizeBase64LikeKey(value) {
  const cleaned = normalizeGigaChatAuthorizationKey(value).replace(/-/g, "+").replace(/_/g, "/");
  if (!cleaned) {
    return "";
  }
  return cleaned.padEnd(Math.ceil(cleaned.length / 4) * 4, "=");
}

function formatErrorMessage(error) {
  if (!error) {
    return "Неизвестная ошибка.";
  }

  const parts = [];
  if (error.message) {
    parts.push(String(error.message));
  }
  if (error.cause?.message && error.cause.message !== error.message) {
    parts.push(`Техническая причина: ${error.cause.message}`);
  }
  return parts.filter(Boolean).join("\n");
}

function httpsRequest(urlString, options = {}) {
  const { method = "GET", headers = {}, body = "", allowInsecureTls = false } = options;

  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const request = https.request(
      {
        protocol: url.protocol,
        hostname: url.hostname,
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method,
        headers,
        rejectUnauthorized: !allowInsecureTls
      },
      (response) => {
        const chunks = [];
        response.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
        });
        response.on("end", () => {
          const buffer = Buffer.concat(chunks);
          resolve({
            ok: (response.statusCode || 0) >= 200 && (response.statusCode || 0) < 300,
            status: response.statusCode || 0,
            statusText: response.statusMessage || "",
            headers: response.headers,
            buffer,
            text: buffer.toString("utf8")
          });
        });
      }
    );

    request.on("error", reject);
    if (body) {
      request.write(body);
    }
    request.end();
  });
}

async function getGigaChatToken(credentials) {
  const authorizationKey = normalizeGigaChatAuthorizationKey(credentials?.gigachatAuthorizationKey || "");
  const clientId = String(credentials?.gigachatClientId || "").trim();
  const clientSecret = String(credentials?.gigachatClientSecret || "").trim();
  const scope = credentials?.gigachatScope || "GIGACHAT_API_PERS";
  const allowInsecureTls = Boolean(credentials?.gigachatAllowInsecureTls);

  if (!authorizationKey && (!clientId || !clientSecret)) {
    throw new Error("Заполните Authorization Key или пару Client ID / Client Secret GigaChat.");
  }

  let auth = "";
  let authMode = "";
  if (clientId && clientSecret) {
    auth = Buffer.from(`${clientId}:${clientSecret}`, "utf8").toString("base64");
    authMode = "client_credentials";
  } else {
    auth = normalizeBase64LikeKey(authorizationKey);
    if (!auth) {
      throw new Error("Поле GigaChat Authorization Key пустое или заполнено некорректно.");
    }
    authMode = "authorization_key";
  }

  try {
    const response = await httpsRequest("https://ngw.devices.sberbank.ru:9443/api/v2/oauth", {
      method: "POST",
      allowInsecureTls,
      headers: {
        Authorization: `Basic ${auth}`,
        Accept: "application/json",
        RqUID: crypto.randomUUID(),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: new URLSearchParams({ scope }).toString()
    });

    if (!response.ok) {
      const text = response.text || "";
      if (text.includes("Can't decode 'Authorization' header")) {
        throw new Error(
          authMode === "authorization_key"
            ? "GigaChat не смог декодировать Authorization Key. Скопируйте ключ заново из Studio целиком и вставьте только его значение."
            : "GigaChat не смог декодировать пару Client ID / Client Secret. Проверьте, что они скопированы полностью и без лишних пробелов."
        );
      }

      throw new Error(
        [
          "Не удалось получить токен GigaChat.",
          `HTTP статус: ${response.status} ${response.statusText}`.trim(),
          `Ответ API: ${text || "<пустой ответ>"}`
        ].join("\n")
      );
    }

    const payload = JSON.parse(response.text || "{}");
    if (!payload?.access_token) {
      throw new Error(
        [
          "GigaChat не вернул access_token.",
          `Тело ответа: ${JSON.stringify(payload)}`
        ].join("\n")
      );
    }

    return payload.access_token;
  } catch (error) {
    const errorText = String(error?.message || "");
    if (errorText.includes("self signed certificate in certificate chain")) {
      throw new Error(
        [
          "TLS-цепочка GigaChat не доверена на этом компьютере.",
          "Техническая причина: self signed certificate in certificate chain",
          allowInsecureTls
            ? "Диагностический режим TLS включён, но сертификатная цепочка всё равно блокируется на уровне системы или сети."
            : "Включите флажок 'Небезопасный TLS для GigaChat' или установите корневой сертификат Минцифры.",
          "Постоянное решение: установить корневой сертификат Минцифры в доверенные корневые центры Windows."
        ].join("\n")
      );
    }

    if (error.code) {
      throw new Error(
        [
          "Не удалось подключиться к GigaChat API.",
          `Техническая причина: ${error.code}${errorText ? `, ${errorText}` : ""}`
        ].join("\n")
      );
    }

    throw new Error(formatErrorMessage(error), { cause: error });
  }
}

async function testGigaChatConnection(credentials) {
  const token = await getGigaChatToken(credentials);
  const response = await httpsRequest("https://gigachat.devices.sberbank.ru/api/v1/models", {
    method: "GET",
    allowInsecureTls: Boolean(credentials?.gigachatAllowInsecureTls),
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(
      [
        "Токен получен, но проверка списка моделей завершилась ошибкой.",
        `HTTP статус: ${response.status} ${response.statusText}`.trim(),
        `Ответ API: ${response.text || "<пустой ответ>"}`
      ].join("\n")
    );
  }

  let parsed = null;
  try {
    parsed = JSON.parse(response.text);
  } catch {
    parsed = { raw: response.text };
  }

  return {
    ok: true,
    tokenPreview: `${String(token).slice(0, 10)}...`,
    modelsCount: Array.isArray(parsed?.data) ? parsed.data.length : 0,
    models: Array.isArray(parsed?.data)
      ? parsed.data.slice(0, 10).map((item) => item.id || item.name || JSON.stringify(item))
      : []
  };
}

function resolveGigaChatModel(configuredModel) {
  const raw = String(configuredModel || "").trim();
  if (!raw) {
    return "GigaChat-2-Max";
  }
  if (/preview/i.test(raw)) {
    return "GigaChat-2-Max";
  }
  return raw;
}

function getGigaChatFallbackModels(configuredModel) {
  const requested = resolveGigaChatModel(configuredModel);
  return [...new Set([requested, "GigaChat-2-Max", "GigaChat-2", "GigaChat", "GigaChat-Pro", "GigaChat-Plus"])];
}

function buildMultipartBody(filePath) {
  const filename = path.basename(filePath);
  const mimeType = getMimeType(filePath);
  const boundary = `----AgentShell${crypto.randomUUID().replace(/-/g, "")}`;
  const fileBuffer = fs.readFileSync(filePath);
  const preamble = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeType}\r\n\r\n`,
    "utf8"
  );
  const middle = Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="purpose"\r\n\r\ngeneral\r\n`, "utf8");
  const closing = Buffer.from(`--${boundary}--\r\n`, "utf8");
  return {
    boundary,
    body: Buffer.concat([preamble, fileBuffer, middle, closing])
  };
}

async function uploadFileToGigaChat(accessToken, credentials, filePath) {
  const resolved = ensureFile(filePath);
  const { boundary, body } = buildMultipartBody(resolved);
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    "Content-Type": `multipart/form-data; boundary=${boundary}`,
    "Content-Length": String(body.length)
  };

  if (credentials?.gigachatClientId) {
    headers["X-Client-ID"] = String(credentials.gigachatClientId).trim();
  }

  const response = await httpsRequest("https://gigachat.devices.sberbank.ru/api/v1/files", {
    method: "POST",
    allowInsecureTls: Boolean(credentials?.gigachatAllowInsecureTls),
    headers,
    body
  });

  if (!response.ok) {
    throw new Error(
      [
        `Не удалось загрузить файл в GigaChat: ${resolved}`,
        `HTTP статус: ${response.status} ${response.statusText}`.trim(),
        `Ответ API: ${response.text || "<пустой ответ>"}`
      ].join("\n")
    );
  }

  return JSON.parse(response.text || "{}");
}

function normalizeAttachmentInput(attachments = []) {
  return attachments
    .map((attachment, index) => {
      const resolved = ensureFile(attachment.path);
      const stat = fs.statSync(resolved);
      const mimeType = attachment.mimeType || getMimeType(resolved);
      return {
        id: attachment.id || `${index}-${path.basename(resolved)}`,
        name: attachment.name || path.basename(resolved),
        path: resolved,
        size: stat.size,
        mimeType,
        source: attachment.source || "file"
      };
    })
    .slice(0, 12);
}

function buildAttachmentContext(attachments) {
  const normalized = normalizeAttachmentInput(attachments);
  const files = normalized.map((attachment) => {
    const base = {
      name: attachment.name,
      path: attachment.path,
      mimeType: attachment.mimeType,
      size: attachment.size,
      source: attachment.source
    };

    if (isTextLikeFile(attachment.path, attachment.mimeType) && attachment.size <= 120000) {
      try {
        base.preview = truncateText(fs.readFileSync(attachment.path, "utf8"), 6000);
      } catch {
        base.preview = "";
      }
    }

    return base;
  });

  return {
    files,
    summary: files.map((attachment) => {
      const parts = [`${attachment.name}`, attachment.mimeType, `${attachment.size} bytes`];
      return `- ${parts.join(" • ")}${attachment.preview ? `\nPreview:\n${attachment.preview}` : ""}`;
    }).join("\n\n")
  };
}

async function uploadAttachments(accessToken, credentials, attachments) {
  const normalized = normalizeAttachmentInput(attachments);
  const uploaded = [];

  for (const attachment of normalized) {
    const remote = await uploadFileToGigaChat(accessToken, credentials, attachment.path);
    uploaded.push({
      ...attachment,
      remoteId: remote.id,
      modalities: remote.modalities || []
    });
  }

  return uploaded;
}

function buildInitialConversation(prompt, uploadedAttachments, attachmentContext, workspaceOverview) {
  const primaryPrompt = String(prompt || "").trim() || "Проанализируй вложения и проект, затем выполни нужные изменения в коде.";
  const images = uploadedAttachments.filter((attachment) => isImageMime(attachment.mimeType));
  const others = uploadedAttachments.filter((attachment) => !isImageMime(attachment.mimeType));
  const messages = [];

  const baseContent = [
    primaryPrompt,
    "",
    "Контекст проекта:",
    JSON.stringify(workspaceOverview, null, 2),
    attachmentContext.summary ? `\nЛокальный контекст вложений:\n${attachmentContext.summary}` : ""
  ].filter(Boolean).join("\n");

  const firstMessage = {
    role: "user",
    content: baseContent
  };

  if (others.length) {
    firstMessage.attachments = others.map((attachment) => attachment.remoteId);
  }

  if (images[0]) {
    firstMessage.attachments = [...(firstMessage.attachments || []), images[0].remoteId];
  }

  messages.push(firstMessage);

  for (let index = 1; index < images.length; index += 1) {
    messages.push({
      role: "user",
      content: `Дополнительный скриншот или изображение ${index + 1}. Тоже учитывай его при анализе задачи и правках проекта.`,
      attachments: [images[index].remoteId]
    });
  }

  return messages;
}

async function callGigaChat(messages, settings, options = {}) {
  const accessToken = options.accessToken || (await getGigaChatToken(settings.credentials || {}));
  const allowInsecureTls = Boolean(settings.credentials?.gigachatAllowInsecureTls);
  const fallbackModels = getGigaChatFallbackModels(settings.modelByProvider?.gigachat);

  const executeChat = async (model) => {
    const body = {
      model,
      temperature: options.temperature ?? 0.1,
      messages,
      stream: false,
      update_interval: 0
    };

    if (options.functions?.length) {
      body.functions = options.functions;
      body.function_call = options.functionCall || "auto";
    } else if (options.responseFormat) {
      body.response_format = options.responseFormat;
    }

    return httpsRequest("https://gigachat.devices.sberbank.ru/api/v1/chat/completions", {
      method: "POST",
      allowInsecureTls,
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify(body)
    });
  };

  let response = null;
  let lastPaymentError = "";

  for (const model of fallbackModels) {
    response = await executeChat(model);
    if (response.ok) {
      break;
    }
    if (response.status === 402) {
      lastPaymentError = response.text || lastPaymentError;
      continue;
    }
    break;
  }

  if (!response.ok) {
    if (response.status === 402) {
      throw new Error(
        [
          "GigaChat не дал выполнить запрос ни на одной из доступных fallback-моделей.",
          `Проверенные модели: ${fallbackModels.join(", ")}`,
          `Ответ API: ${lastPaymentError || response.text || "<пустой ответ>"}`
        ].join("\n")
      );
    }
    throw new Error(`GigaChat error: ${response.text}`);
  }

  const payload = JSON.parse(response.text || "{}");
  return {
    payload,
    message: payload?.choices?.[0]?.message || {},
    finishReason: payload?.choices?.[0]?.finish_reason || ""
  };
}

function buildWorkspaceOverview(workspacePath) {
  const root = ensureDirectory(workspacePath);
  const sampleFiles = listFilesRecursive(root, 140);
  const overview = {
    workspacePath: root,
    os: `${os.type()} ${os.release()}`,
    sampleFiles
  };

  const packageJsonPath = path.join(root, "package.json");
  if (fs.existsSync(packageJsonPath)) {
    try {
      overview.packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
    } catch {
      overview.packageJson = truncateText(fs.readFileSync(packageJsonPath, "utf8"), 3000);
    }
  }

  return overview;
}

function buildAgentFunctions() {
  return [
    {
      name: "list_files",
      description: "Показать список файлов проекта или подкаталога, чтобы понять структуру.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string", description: "Папка или файл для обзора." },
          limit: { type: "integer", description: "Максимум записей." }
        }
      }
    },
    {
      name: "inspect_path",
      description: "Посмотреть содержимое папки или свойства файла.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          limit: { type: "integer" }
        }
      }
    },
    {
      name: "read_file",
      description: "Прочитать текстовый файл полностью.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" }
        },
        required: ["path"]
      }
    },
    {
      name: "read_code",
      description: "Прочитать участок кода по строкам.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          startLine: { type: "integer" },
          lineCount: { type: "integer" }
        },
        required: ["path"]
      }
    },
    {
      name: "write_file",
      description: "Перезаписать файл целиком новым содержимым или создать новый файл.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          content: { type: "string" }
        },
        required: ["path", "content"]
      }
    },
    {
      name: "replace_in_file",
      description: "Точечно заменить фрагмент текста в существующем файле.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" },
          search: { type: "string" },
          replace: { type: "string" },
          replaceAll: { type: "boolean" }
        },
        required: ["path", "search", "replace"]
      }
    },
    {
      name: "search_text",
      description: "Найти текст, функцию, компонент, класс или API по всему проекту.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string" },
          rootPath: { type: "string" }
        },
        required: ["query"]
      }
    },
    {
      name: "run_command",
      description: "Запустить локальную PowerShell команду в рабочей папке, например build, test или git status.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string" },
          cwd: { type: "string" }
        },
        required: ["command"]
      }
    },
    {
      name: "git_status",
      description: "Показать текущие изменения git.",
      parameters: {
        type: "object",
        properties: {
          cwd: { type: "string" }
        }
      }
    },
    {
      name: "switch_git_remote",
      description: "Переключить origin на GitHub или GitVerse.",
      parameters: {
        type: "object",
        properties: {
          cwd: { type: "string" },
          provider: { type: "string", enum: ["github", "gitverse"] }
        },
        required: ["provider"]
      }
    },
    {
      name: "analyze_disk",
      description: "Посмотреть самые тяжёлые файлы и папки на диске или в каталоге.",
      parameters: {
        type: "object",
        properties: {
          path: { type: "string" }
        }
      }
    }
  ];
}

function buildSystemPrompt(context) {
  return [
    "Ты локальный coding-агент внутри desktop shell на базе GigaChat.",
    "Работай как самостоятельный инженер: сам изучай проект, ищи релевантные файлы, вноси изменения и проверяй результат.",
    "Пользователь может описывать задачу простыми словами без указания файлов и строк. Ты сам обязан найти нужное место в проекте.",
    "Если задача касается сайта, фронтенда, алгоритма, данных или структуры проекта — сначала быстро сориентируйся по дереву файлов, затем читай нужные файлы, меняй код и при необходимости запускай проверки.",
    "Если пользователь приложил скриншоты или файлы, учитывай их как входной контекст и используй для более точного анализа.",
    "Перед серьёзной перезаписью файла сначала прочитай его. Для точечной правки предпочитай replace_in_file. write_file используй, когда надо создать файл или осознанно заменить его полностью.",
    "После изменений по возможности запусти уместную проверку: сборку, тесты, линтер или хотя бы git_status.",
    "Не проси пользователя указывать путь к файлу, если его можно найти через list_files, inspect_path, search_text, read_file или read_code.",
    "Когда работа завершена, дай понятный итог без markdown-таблиц: что изменено, что проверено и есть ли ограничения.",
    `Рабочая папка: ${context.workspacePath}`,
    `Git provider: ${context.gitProvider}`,
    `ОС: ${os.type()} ${os.release()}`
  ].join("\n");
}

function parseFunctionArguments(rawArguments) {
  if (!rawArguments) {
    return {};
  }
  if (typeof rawArguments === "object") {
    return rawArguments;
  }
  try {
    return JSON.parse(rawArguments);
  } catch {
    return {};
  }
}

function parseLegacyAction(content) {
  const text = String(content || "").trim();
  if (!text) {
    return null;
  }

  const fenced = text.match(/```(?:json)?\s*([\s\S]+?)```/i);
  const source = fenced ? fenced[1] : text;

  try {
    return JSON.parse(source);
  } catch {
    return null;
  }
}

async function withGitRemoteSwitch(workspacePath, provider) {
  const cwd = ensureDirectory(workspacePath);
  const remoteUrl = store.store?.remotes?.[provider];
  if (!remoteUrl) {
    return {
      ok: false,
      message: `Для ${provider} не задан remote URL в настройках.`
    };
  }

  const readOrigin = await runCommand("git remote get-url origin", cwd);
  const escaped = String(remoteUrl).replace(/'/g, "''");
  let updateResult = null;

  if ((readOrigin.stdout || "").trim()) {
    updateResult = await runCommand(`git remote set-url origin '${escaped}'`, cwd);
  } else {
    updateResult = await runCommand(`git remote add origin '${escaped}'`, cwd);
  }

  if (updateResult.code !== 0) {
    return {
      ok: false,
      message: updateResult.stderr || updateResult.stdout || "Не удалось переключить origin."
    };
  }

  return {
    ok: true,
    message: `origin переключён на ${provider}: ${remoteUrl}`
  };
}

async function executeToolCall(workspacePath, action, gitProvider) {
  const args = action.args || {};

  switch (action.tool) {
    case "list_files": {
      const root = resolvePath(workspacePath, args.path || workspacePath);
      return { root, files: listFilesRecursive(root, Number(args.limit || 250)) };
    }
    case "inspect_path":
      return listPathEntries(args.path || workspacePath, Number(args.limit || 120));
    case "read_file":
      return readFileAny(workspacePath, args.path || "");
    case "read_code":
      return readCodeSample(workspacePath, args.path || "", args.startLine, args.lineCount);
    case "write_file":
      return writeFileAny(workspacePath, args.path || "", args.content || "");
    case "replace_in_file":
      return replaceInFileAny(workspacePath, args.path || "", args.search || "", args.replace || "", args.replaceAll !== false);
    case "search_text":
      return { matches: searchText(workspacePath, args.query || "", args.rootPath || workspacePath) };
    case "run_command": {
      const cwd = ensureDirectory(resolvePath(workspacePath, args.cwd || workspacePath));
      return runCommand(args.command || "", cwd);
    }
    case "git_status": {
      const cwd = ensureDirectory(resolvePath(workspacePath, args.cwd || workspacePath));
      return runCommand("git status --short", cwd);
    }
    case "switch_git_remote": {
      const cwd = ensureDirectory(resolvePath(workspacePath, args.cwd || workspacePath));
      return withGitRemoteSwitch(cwd, args.provider || gitProvider);
    }
    case "analyze_disk":
      return analyzeDisk(args.path || workspacePath || "C:\\");
    default:
      throw new Error(`Неизвестный инструмент: ${action.tool}`);
  }
}

async function tryHandleDirectCommand(prompt, workspacePath) {
  const text = String(prompt || "").toLowerCase();

  if (/структур.*проект|покажи.*проект|список.*файл|файлы.*проект/.test(text)) {
    const root = ensureDirectory(workspacePath);
    const files = listFilesRecursive(root, 250);
    return {
      ok: true,
      thought: "Команда выполнена локально через list_files без обращения к GigaChat.",
      final: `Структура проекта (${root}):\n${files.join("\n")}`
    };
  }

  if (/git status|статус git|состояни.*git/.test(text)) {
    const result = await runCommand("git status --short", ensureDirectory(workspacePath));
    return {
      ok: true,
      thought: "Команда выполнена локально через git_status без обращения к GigaChat.",
      final: result.stdout || result.stderr || "git status не вернул данных."
    };
  }

  return null;
}

async function runAgent({ prompt, workspacePath, gitProvider, attachments = [] }) {
  const resolvedWorkspace = ensureDirectory(workspacePath || process.cwd());
  const hasAttachments = Array.isArray(attachments) && attachments.length > 0;
  const directResult = hasAttachments ? null : await tryHandleDirectCommand(prompt, resolvedWorkspace);
  if (directResult) {
    return directResult;
  }

  const settings = store.store;
  const accessToken = await getGigaChatToken(settings.credentials || {});
  const workspaceOverview = buildWorkspaceOverview(resolvedWorkspace);
  const attachmentContext = buildAttachmentContext(attachments);
  const uploadedAttachments = hasAttachments ? await uploadAttachments(accessToken, settings.credentials || {}, attachments) : [];
  const systemPrompt = buildSystemPrompt({
    workspacePath: resolvedWorkspace,
    gitProvider
  });
  const functions = buildAgentFunctions();
  const conversation = buildInitialConversation(prompt, uploadedAttachments, attachmentContext, workspaceOverview);
  let lastThought = "";

  for (let step = 0; step < 14; step += 1) {
    const { message } = await callGigaChat(
      [{ role: "system", content: systemPrompt }, ...conversation],
      settings,
      {
        accessToken,
        functions,
        functionCall: "auto"
      }
    );

    if (message?.function_call?.name) {
      const toolName = message.function_call.name;
      const args = parseFunctionArguments(message.function_call.arguments);

      conversation.push({
        role: "assistant",
        content: message.content || "",
        function_call: {
          name: toolName,
          arguments: JSON.stringify(args)
        }
      });

      const toolResult = await executeToolCall(resolvedWorkspace, { tool: toolName, args }, gitProvider);
      conversation.push({
        role: "function",
        name: toolName,
        content: JSON.stringify(toolResult)
      });

      if (message.content) {
        lastThought = message.content;
      }
      continue;
    }

    if (message?.content) {
      const legacyReply = parseLegacyAction(message.content);
      if (legacyReply?.type === "tool" && legacyReply.tool) {
        const toolResult = await executeToolCall(resolvedWorkspace, legacyReply, gitProvider);
        conversation.push({ role: "assistant", content: message.content });
        conversation.push({
          role: "function",
          name: legacyReply.tool,
          content: JSON.stringify(toolResult)
        });
        lastThought = legacyReply.thought || lastThought;
        continue;
      }

      if (legacyReply?.type === "final") {
        return {
          ok: true,
          thought: legacyReply.thought || lastThought,
          final: legacyReply.final || "Готово."
        };
      }

      return {
        ok: true,
        thought: lastThought,
        final: message.content
      };
    }
  }

  return {
    ok: false,
    thought: lastThought,
    final: "Лимит шагов агента исчерпан. Нужна дополнительная декомпозиция задачи."
  };
}

function createAttachmentMeta(filePath, source = "file") {
  const resolved = ensureFile(filePath);
  const stat = fs.statSync(resolved);
  return {
    id: crypto.randomUUID(),
    name: path.basename(resolved),
    path: resolved,
    size: stat.size,
    mimeType: getMimeType(resolved),
    source
  };
}

async function pickAttachments() {
  const result = await dialog.showOpenDialog({
    properties: ["openFile", "multiSelections"]
  });

  if (result.canceled || !result.filePaths?.length) {
    return [];
  }

  return result.filePaths.map((filePath) => createAttachmentMeta(filePath, "file"));
}

function saveClipboardImage({ dataUrl, suggestedName }) {
  const match = String(dataUrl || "").match(/^data:(.+?);base64,(.+)$/);
  if (!match) {
    throw new Error("Некорректный data URL изображения.");
  }

  const mimeType = match[1];
  const extension = mimeType.includes("jpeg") ? ".jpg" : ".png";
  const baseDir = path.join(app.getPath("userData"), "clipboard-attachments");
  fs.mkdirSync(baseDir, { recursive: true });

  const rawName = String(suggestedName || `clipboard-${Date.now()}${extension}`);
  const safeBaseName = path.basename(rawName, path.extname(rawName)) || `clipboard-${Date.now()}`;
  const filename = `${safeBaseName}-${Date.now()}${extension}`;
  const filePath = path.join(baseDir, filename);
  fs.writeFileSync(filePath, Buffer.from(match[2], "base64"));

  return {
    id: crypto.randomUUID(),
    name: filename,
    path: filePath,
    size: fs.statSync(filePath).size,
    mimeType,
    source: "clipboard"
  };
}

ipcMain.handle("config:get", () => store.store);
ipcMain.handle("config:set", (_, partial) => {
  store.set(partial);
  return store.store;
});
ipcMain.handle("dialog:pickWorkspace", async () => {
  const result = await dialog.showOpenDialog({ properties: ["openDirectory"] });
  if (result.canceled || !result.filePaths[0]) {
    return "";
  }
  return result.filePaths[0];
});
ipcMain.handle("dialog:pickAttachments", async () => pickAttachments());
ipcMain.handle("clipboard:saveImage", async (_, payload) => saveClipboardImage(payload));
ipcMain.handle("agent:run", async (_, payload) => {
  try {
    return await runAgent(payload);
  } catch (error) {
    return { ok: false, errorMessage: formatErrorMessage(error) };
  }
});
ipcMain.handle("workspace:list", (_, workspacePath) => {
  const resolved = ensureDirectory(workspacePath || process.cwd());
  return listFilesRecursive(resolved, 200);
});
ipcMain.handle("git:switchProvider", async (_, { workspacePath, provider }) => {
  return withGitRemoteSwitch(ensureDirectory(workspacePath || process.cwd()), provider);
});
ipcMain.handle("gigachat:test", async (_, credentials) => {
  try {
    const result = await testGigaChatConnection(credentials);
    return { ok: true, ...result };
  } catch (error) {
    return { ok: false, errorMessage: formatErrorMessage(error) };
  }
});

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
