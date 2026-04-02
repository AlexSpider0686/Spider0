const elements = {
  gigachatModel: document.getElementById("gigachatModel"),
  workspacePath: document.getElementById("workspacePath"),
  gitProvider: document.getElementById("gitProvider"),
  githubRemote: document.getElementById("githubRemote"),
  gitverseRemote: document.getElementById("gitverseRemote"),
  gigachatAuthorizationKey: document.getElementById("gigachatAuthorizationKey"),
  gigachatClientId: document.getElementById("gigachatClientId"),
  gigachatClientSecret: document.getElementById("gigachatClientSecret"),
  gigachatScope: document.getElementById("gigachatScope"),
  gigachatAllowInsecureTls: document.getElementById("gigachatAllowInsecureTls"),
  promptInput: document.getElementById("promptInput"),
  transcript: document.getElementById("transcript"),
  statusPill: document.getElementById("statusPill"),
  saveSettingsButton: document.getElementById("saveSettingsButton"),
  testGigaChatButton: document.getElementById("testGigaChatButton"),
  pickWorkspaceButton: document.getElementById("pickWorkspaceButton"),
  pickAttachmentsButton: document.getElementById("pickAttachmentsButton"),
  runAgentButton: document.getElementById("runAgentButton"),
  listWorkspaceButton: document.getElementById("listWorkspaceButton"),
  switchRemoteButton: document.getElementById("switchRemoteButton"),
  attachmentsPanel: document.getElementById("attachmentsPanel"),
  attachmentsList: document.getElementById("attachmentsList"),
  messageTemplate: document.getElementById("messageTemplate")
};

let currentConfig = null;
let pendingAttachments = [];

function setStatus(text) {
  elements.statusPill.textContent = text;
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (!value) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let current = value;
  let unitIndex = 0;
  while (current >= 1024 && unitIndex < units.length - 1) {
    current /= 1024;
    unitIndex += 1;
  }
  const digits = current >= 10 || unitIndex === 0 ? 0 : 1;
  return `${current.toFixed(digits)} ${units[unitIndex]}`;
}

function describeAttachment(attachment) {
  const mime = attachment.mimeType || "unknown";
  const origin = attachment.source === "clipboard" ? "скриншот" : "файл";
  return `${origin} • ${mime} • ${formatBytes(attachment.size)}`;
}

function renderAttachments() {
  elements.attachmentsList.innerHTML = "";
  const hasAttachments = pendingAttachments.length > 0;
  elements.attachmentsPanel.hidden = !hasAttachments;

  for (const attachment of pendingAttachments) {
    const chip = document.createElement("article");
    chip.className = "attachment-chip";

    const info = document.createElement("div");
    const name = document.createElement("div");
    name.className = "attachment-chip__name";
    name.textContent = attachment.name;

    const meta = document.createElement("div");
    meta.className = "attachment-chip__meta";
    meta.textContent = describeAttachment(attachment);

    info.append(name, meta);

    const removeButton = document.createElement("button");
    removeButton.className = "ghost-button attachment-chip__remove";
    removeButton.type = "button";
    removeButton.textContent = "×";
    removeButton.title = "Удалить вложение";
    removeButton.addEventListener("click", () => {
      pendingAttachments = pendingAttachments.filter((item) => item.id !== attachment.id);
      renderAttachments();
    });

    chip.append(info, removeButton);
    elements.attachmentsList.appendChild(chip);
  }
}

function mergeAttachments(nextAttachments) {
  const byPath = new Map(
    pendingAttachments.map((attachment) => [attachment.path || attachment.id, attachment])
  );

  for (const attachment of nextAttachments) {
    byPath.set(attachment.path || attachment.id, attachment);
  }

  pendingAttachments = [...byPath.values()];
  renderAttachments();
}

function addMessage(role, body) {
  const fragment = elements.messageTemplate.content.cloneNode(true);
  fragment.querySelector(".message__role").textContent = role;
  fragment.querySelector(".message__body").textContent = body;
  elements.transcript.appendChild(fragment);
  elements.transcript.scrollTop = elements.transcript.scrollHeight;
}

function collectConfigFromForm() {
  return {
    provider: "gigachat",
    workspacePath: elements.workspacePath.value.trim(),
    gitProvider: elements.gitProvider.value,
    modelByProvider: {
      gigachat: elements.gigachatModel.value.trim() || "GigaChat-2-Max"
    },
    remotes: {
      github: elements.githubRemote.value.trim(),
      gitverse: elements.gitverseRemote.value.trim()
    },
    credentials: {
      gigachatAuthorizationKey: elements.gigachatAuthorizationKey.value.trim(),
      gigachatClientId: elements.gigachatClientId.value.trim(),
      gigachatClientSecret: elements.gigachatClientSecret.value.trim(),
      gigachatScope: elements.gigachatScope.value.trim() || "GIGACHAT_API_PERS",
      gigachatAllowInsecureTls: elements.gigachatAllowInsecureTls.checked
    }
  };
}

function applyConfig(config) {
  currentConfig = config;
  elements.workspacePath.value = config.workspacePath || "";
  elements.gitProvider.value = config.gitProvider || "github";
  elements.gigachatModel.value = config.modelByProvider?.gigachat || "GigaChat-2-Max";
  elements.githubRemote.value = config.remotes?.github || "";
  elements.gitverseRemote.value = config.remotes?.gitverse || "";
  elements.gigachatAuthorizationKey.value = config.credentials?.gigachatAuthorizationKey || "";
  elements.gigachatClientId.value = config.credentials?.gigachatClientId || "";
  elements.gigachatClientSecret.value = config.credentials?.gigachatClientSecret || "";
  elements.gigachatScope.value = config.credentials?.gigachatScope || "GIGACHAT_API_PERS";
  elements.gigachatAllowInsecureTls.checked = Boolean(config.credentials?.gigachatAllowInsecureTls);
}

async function saveConfig() {
  setStatus("Сохраняю настройки...");
  const nextConfig = collectConfigFromForm();
  const saved = await window.agentShell.setConfig(nextConfig);
  applyConfig(saved);
  setStatus("Настройки сохранены");
}

async function testGigaChatConnection() {
  await saveConfig();
  setStatus("Проверяю подключение к GigaChat...");
  const result = await window.agentShell.testGigaChat(currentConfig.credentials);
  if (!result?.ok) {
    addMessage("Ошибка GigaChat", result?.errorMessage || "Не удалось проверить подключение GigaChat.");
    setStatus("GigaChat не подключён");
    return;
  }

  addMessage(
    "GigaChat",
    [
      "Подключение успешно.",
      `Токен: ${result.tokenPreview}`,
      `Доступных моделей: ${result.modelsCount}`,
      result.models?.length ? `Примеры моделей:\n${result.models.join("\n")}` : "Список моделей не получен."
    ].join("\n")
  );
  setStatus("GigaChat подключён");
}

function buildUserMessage(prompt) {
  if (!pendingAttachments.length) {
    return prompt;
  }

  return `${prompt}\n\nВложения:\n${pendingAttachments
    .map((attachment) => `- ${attachment.name} (${describeAttachment(attachment)})`)
    .join("\n")}`;
}

async function runAgent() {
  const prompt = elements.promptInput.value.trim();
  if (!prompt && !pendingAttachments.length) {
    setStatus("Введите задачу или добавьте вложение");
    return;
  }

  await saveConfig();
  addMessage("Пользователь", buildUserMessage(prompt || "Проанализируй вложение и выполни нужные изменения в проекте."));
  elements.promptInput.value = "";
  setStatus("Агент анализирует проект и выполняет задачу...");

  try {
    const result = await window.agentShell.runAgent({
      prompt,
      attachments: pendingAttachments,
      workspacePath: currentConfig.workspacePath,
      gitProvider: currentConfig.gitProvider
    });

    if (result?.errorMessage) {
      addMessage("Ошибка", result.errorMessage);
      setStatus("Ошибка выполнения");
      return;
    }

    addMessage(
      "Агент",
      `${result.final || "Готово."}${result.thought ? `\n\nВнутренняя логика: ${result.thought}` : ""}`
    );
    pendingAttachments = [];
    renderAttachments();
    setStatus(result.ok ? "Задача выполнена" : "Нужна дополнительная декомпозиция");
  } catch (error) {
    addMessage("Ошибка", error.message || String(error));
    setStatus("Ошибка выполнения");
  }
}

async function pickWorkspace() {
  const selected = await window.agentShell.pickWorkspace();
  if (selected) {
    elements.workspacePath.value = selected;
    setStatus("Рабочая папка выбрана");
  }
}

async function pickAttachments() {
  const selected = await window.agentShell.pickAttachments();
  if (!selected?.length) {
    return;
  }
  mergeAttachments(selected);
  setStatus(`Добавлено вложений: ${pendingAttachments.length}`);
}

async function handlePaste(event) {
  const items = [...(event.clipboardData?.items || [])];
  const imageItem = items.find((item) => item.type?.startsWith("image/"));
  if (!imageItem) {
    return;
  }

  const file = imageItem.getAsFile();
  if (!file) {
    return;
  }

  event.preventDefault();
  setStatus("Сохраняю скриншот из буфера...");

  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Не удалось прочитать изображение из буфера."));
    reader.readAsDataURL(file);
  });

  const saved = await window.agentShell.saveClipboardImage({
    dataUrl,
    suggestedName: file.name || `clipboard-${Date.now()}.png`
  });

  if (saved) {
    mergeAttachments([saved]);
    setStatus("Скриншот добавлен во вложения");
  }
}

async function listWorkspace() {
  await saveConfig();
  setStatus("Считываю структуру проекта...");
  try {
    const files = await window.agentShell.listWorkspace(elements.workspacePath.value.trim());
    addMessage("Workspace", files.join("\n"));
    setStatus("Файлы считаны");
  } catch (error) {
    addMessage("Ошибка", error.message || String(error));
    setStatus("Не удалось считать файлы");
  }
}

async function switchRemote() {
  await saveConfig();
  setStatus("Переключаю git remote...");
  const result = await window.agentShell.switchGitProvider({
    workspacePath: elements.workspacePath.value.trim(),
    provider: elements.gitProvider.value
  });
  addMessage("Git", result.message || "Операция выполнена");
  setStatus(result.ok ? "remote переключен" : "remote не переключен");
}

async function bootstrap() {
  const config = await window.agentShell.getConfig();
  applyConfig(config);
  renderAttachments();
  addMessage(
    "Система",
    [
      "Готово к работе.",
      "Это desktop-приложение в стиле Codex на базе GigaChat.",
      "Агент умеет анализировать проект целиком, принимать скриншоты и файлы, а затем сам выбирать нужные файлы для правок.",
      "Можно описывать задачу простыми словами без указания строк и конкретных файлов."
    ].join("\n")
  );
}

elements.saveSettingsButton.addEventListener("click", saveConfig);
elements.testGigaChatButton.addEventListener("click", testGigaChatConnection);
elements.pickWorkspaceButton.addEventListener("click", pickWorkspace);
elements.pickAttachmentsButton.addEventListener("click", pickAttachments);
elements.runAgentButton.addEventListener("click", runAgent);
elements.listWorkspaceButton.addEventListener("click", listWorkspace);
elements.switchRemoteButton.addEventListener("click", switchRemote);
elements.promptInput.addEventListener("paste", (event) => {
  handlePaste(event).catch((error) => {
    addMessage("Ошибка", error.message || String(error));
    setStatus("Не удалось обработать скриншот");
  });
});
elements.promptInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    runAgent();
  }
});

bootstrap();
