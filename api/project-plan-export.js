import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { buildMsProjectXml, buildProjectPlan } from "../src/lib/projectPlanExport.js";

const execFileAsync = promisify(execFile);

function filePart(value, fallback) {
  return String(value || fallback).replace(/[<>:"/\\|?*]+/g, "_").slice(0, 80) || fallback;
}

async function convertXmlToMpp(xmlPath, mppPath) {
  if (process.platform !== "win32") {
    throw new Error("Экспорт в MPP поддерживается только в Windows-контуре с установленным Microsoft Project.");
  }

  const script = `
$ErrorActionPreference = 'Stop'
$xmlPath = '${xmlPath.replace(/'/g, "''")}'
$mppPath = '${mppPath.replace(/'/g, "''")}'
$app = $null
try {
  $app = New-Object -ComObject MSProject.Application
  $app.Visible = $false
  $app.DisplayAlerts = 0
  $app.FileOpen($xmlPath)
  $app.FileSaveAs($mppPath)
  $app.FileCloseAllEx(0)
} finally {
  if ($app -ne $null) {
    try { $app.Quit() | Out-Null } catch {}
    try { [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($app) } catch {}
    [GC]::Collect()
    [GC]::WaitForPendingFinalizers()
  }
}
if (-not (Test-Path -LiteralPath $mppPath)) { throw 'MPP file was not created.' }
`;

  await execFileAsync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-Command", script], {
    windowsHide: true,
    timeout: 120000,
    maxBuffer: 1024 * 1024,
  });
}

export async function buildProjectPlanArtifact({ format, payload }) {
  const normalizedFormat = format === "msproject" ? "mpp" : format;
  if (normalizedFormat !== "mpp") {
    throw new Error("Поддерживается только экспорт проекта в MPP.");
  }

  const plan = buildProjectPlan(payload || {});
  const xml = buildMsProjectXml(plan);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "project-core-plan-"));
  const xmlPath = path.join(tmpDir, "project-plan.xml");
  const mppPath = path.join(tmpDir, "project-plan.mpp");

  try {
    await fs.writeFile(xmlPath, `\uFEFF${xml}`, "utf8");
    await convertXmlToMpp(xmlPath, mppPath);
    const buffer = await fs.readFile(mppPath);
    return {
      buffer,
      fileName: `${filePart(plan.summary.projectName, "project")}_project_plan.mpp`,
      contentType: "application/vnd.ms-project",
    };
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }
}
