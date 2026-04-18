import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { buildMsProjectXml, buildProjectPlan } from "../src/lib/projectPlanModel.js";

const execFileAsync = promisify(execFile);

function filePart(value, fallback) {
  return String(value || fallback).replace(/[<>:"/\\|?*]+/g, "_").slice(0, 80) || fallback;
}

async function convertXmlToMpp(xmlPath, mppPath) {
  if (process.platform !== "win32") {
    const error = new Error(
      "Экспорт в .mpp доступен только в Windows-контуре с установленным Microsoft Project. В web-деплое без Windows/Project этот формат недоступен."
    );
    error.statusCode = 501;
    throw error;
  }

  const script = `
param(
  [Parameter(Mandatory = $true)] [string] $xmlPath,
  [Parameter(Mandatory = $true)] [string] $mppPath
)

$ErrorActionPreference = 'Stop'
$app = $null
$opened = $false

function Save-MppFile {
  param(
    [Parameter(Mandatory = $true)] $Application,
    [Parameter(Mandatory = $true)] [string] $TargetPath
  )

  try {
    $null = $Application.FileSaveAs($TargetPath, $null, $false, $false, $null, $false, $null, $null, $null, 'MSProject.mpp')
    return
  } catch {
    try {
      $null = $Application.FileSaveAs($TargetPath)
      return
    } catch {
      throw $_
    }
  }
}

try {
  $app = New-Object -ComObject MSProject.Application
  $app.Visible = $false
  $app.DisplayAlerts = 0
  try {
    $opened = [bool]$app.FileOpenEx($xmlPath, $false, 0, $true, $null, $null, $false, $null, $null, 'MSProject.xml', $null, $null, $null, $null, $true, $null, $true)
  } catch {
    $opened = [bool]$app.FileOpen($xmlPath)
  }
  Start-Sleep -Milliseconds 500
  $project = $app.ActiveProject
  if ($project -eq $null -and $app.Projects.Count -gt 0) { $project = $app.Projects.Item(1) }
  if (-not $opened -and $project -eq $null) { throw 'Microsoft Project did not open the XML plan as an active project.' }
  Save-MppFile -Application $app -TargetPath $mppPath
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

  const scriptPath = path.join(os.tmpdir(), `project-core-mpp-${Date.now()}.ps1`);
  try {
    await fs.writeFile(scriptPath, script, "utf8");
    await execFileAsync(
      "powershell.exe",
      ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath, xmlPath, mppPath],
      {
        windowsHide: true,
        timeout: 120000,
        maxBuffer: 1024 * 1024,
      }
    );
  } finally {
    await fs.rm(scriptPath, { force: true });
  }
}

export async function buildProjectPlanArtifact({ format, payload }) {
  const normalizedFormat = format === "msproject" ? "mpp" : format;
  if (normalizedFormat !== "mpp") {
    const error = new Error("Поддерживается только экспорт проекта в MPP.");
    error.statusCode = 400;
    throw error;
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

function setCorsHeaders(res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function normalizeBody(req) {
  if (!req || req.body === undefined || req.body === null) return {};
  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body);
    } catch {
      const error = new Error("Некорректное тело запроса JSON.");
      error.statusCode = 400;
      throw error;
    }
  }
  return typeof req.body === "object" ? req.body : {};
}

export default async function handler(req, res) {
  setCorsHeaders(res);

  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }

  if (req.method !== "POST") {
    res.status(405).json({ ok: false, error: "Method not allowed" });
    return;
  }

  try {
    const body = normalizeBody(req);
    const artifact = await buildProjectPlanArtifact({
      format: body?.format,
      payload: body?.payload,
    });

    res.setHeader("Content-Type", artifact.contentType || "application/octet-stream");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename*=UTF-8''${encodeURIComponent(artifact.fileName || "project_plan.mpp")}`
    );
    res.status(200).send(artifact.buffer);
  } catch (error) {
    res.status(error?.statusCode || 500).json({
      ok: false,
      error: error?.message || "Не удалось сформировать MPP-файл.",
    });
  }
}
