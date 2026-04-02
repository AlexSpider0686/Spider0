const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("agentShell", {
  getConfig: () => ipcRenderer.invoke("config:get"),
  setConfig: (partial) => ipcRenderer.invoke("config:set", partial),
  pickWorkspace: () => ipcRenderer.invoke("dialog:pickWorkspace"),
  pickAttachments: () => ipcRenderer.invoke("dialog:pickAttachments"),
  saveClipboardImage: (payload) => ipcRenderer.invoke("clipboard:saveImage", payload),
  runAgent: (payload) => ipcRenderer.invoke("agent:run", payload),
  listWorkspace: (workspacePath) => ipcRenderer.invoke("workspace:list", workspacePath),
  switchGitProvider: (payload) => ipcRenderer.invoke("git:switchProvider", payload),
  testGigaChat: (credentials) => ipcRenderer.invoke("gigachat:test", credentials)
});
