using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;
using System.Web.Script.Serialization;
using System.Windows.Forms;

namespace ProjectCoreLocalBridgeAgent
{
    internal static class Program
    {
        private const string AgentVersion = "1.2.0";
        private const int DefaultPort = 32123;
        private const string InstalledExeName = "ProjectCoreLocalBridgeAgent.exe";
        private const string ShortcutName = "ProjectCore Local Bridge.lnk";
        private static readonly string[] DefaultOrigins =
        {
            "https://spider0-spider0.amvera.io",
            "http://localhost:3000",
            "http://127.0.0.1:3000"
        };

        private static readonly JavaScriptSerializer Json = new JavaScriptSerializer
        {
            MaxJsonLength = int.MaxValue,
            RecursionLimit = 32
        };

        private static readonly string InstallRoot =
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "ProjectCoreLocalBridge");

        private static readonly string InstalledExePath = Path.Combine(InstallRoot, InstalledExeName);
        private static readonly string ConfigPath = Path.Combine(InstallRoot, "config.json");
        private static readonly string StatusPath = Path.Combine(InstallRoot, "status.json");
        private static readonly string StartupShortcutPath =
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup), ShortcutName);

        [STAThread]
        private static int Main(string[] args)
        {
            try
            {
                var options = AgentOptions.Parse(args);
                return options.Background ? RunBackground(options) : InstallAndStart(options);
            }
            catch (Exception ex)
            {
                var silent = args.Any(arg => string.Equals(arg, "--silent", StringComparison.OrdinalIgnoreCase));
                if (!silent)
                {
                    MessageBox.Show(
                        ex.Message,
                        "Project.Core Local Bridge",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error);
                }

                return 1;
            }
        }

        private static int InstallAndStart(AgentOptions options)
        {
            Directory.CreateDirectory(InstallRoot);

            var config = new AgentConfig
            {
                Port = options.Port,
                AllowedOrigins = options.AllowedOrigins.ToArray()
            };
            File.WriteAllText(ConfigPath, Json.Serialize(config), new UTF8Encoding(true));

            var currentExePath = Process.GetCurrentProcess().MainModule.FileName;
            var launchPath = currentExePath;

            if (!string.Equals(currentExePath, InstalledExePath, StringComparison.OrdinalIgnoreCase))
            {
                try
                {
                    File.Copy(currentExePath, InstalledExePath, true);
                    launchPath = InstalledExePath;
                }
                catch (IOException)
                {
                    if (File.Exists(InstalledExePath))
                    {
                        launchPath = InstalledExePath;
                    }
                    else
                    {
                        throw;
                    }
                }
            }

            if (options.NoAutostart)
            {
                RemoveShortcutIfExists();
            }
            else
            {
                CreateStartupShortcut(launchPath);
            }

            if (!options.NoStartNow)
            {
                StartBackgroundProcess(launchPath, options.Port);
            }

            if (!options.Silent)
            {
                MessageBox.Show(
                    "Локальный агент Project.Core установлен.\n\n" +
                    "Он слушает только localhost и работает для текущего пользователя Windows.\n" +
                    "Теперь можно вернуться в web-версию и повторить экспорт MS Project (.mpp).",
                    "Project.Core Local Bridge",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);
            }

            return 0;
        }

        private static int RunBackground(AgentOptions options)
        {
            Directory.CreateDirectory(InstallRoot);

            bool createdNew;
            using (var mutex = new Mutex(true, "ProjectCoreLocalBridgeAgent", out createdNew))
            {
                if (!createdNew)
                {
                    return 0;
                }

                var config = LoadConfig(options);
                var port = config.Port > 0 ? config.Port : DefaultPort;
                var configuredOrigins = config.AllowedOrigins ?? DefaultOrigins;
                var allowedOrigins = configuredOrigins.Where(value => !string.IsNullOrWhiteSpace(value)).Distinct().ToArray();
                if (allowedOrigins.Length == 0)
                {
                    allowedOrigins = DefaultOrigins;
                }

                var projectStatus = DetectMsProject();
                WriteStatus(new StatusPayload
                {
                    Ok = true,
                    Agent = "ProjectCoreLocalBridge",
                    Version = AgentVersion,
                    Port = port,
                    InstallRoot = InstallRoot,
                    StartupEnabled = File.Exists(StartupShortcutPath),
                    MsProjectDetected = projectStatus.MsProjectDetected,
                    MsProjectVersion = projectStatus.MsProjectVersion,
                    LastError = projectStatus.LastError ?? string.Empty,
                    UpdatedAt = DateTime.UtcNow.ToString("o")
                });

                using (var listener = new HttpListener())
                {
                    listener.Prefixes.Add(string.Format("http://127.0.0.1:{0}/", port));
                    listener.Prefixes.Add(string.Format("http://localhost:{0}/", port));
                    listener.Start();

                    while (listener.IsListening)
                    {
                        var context = listener.GetContext();
                        HandleRequest(context, allowedOrigins);
                    }
                }
            }

            return 0;
        }

        private static void HandleRequest(HttpListenerContext context, string[] allowedOrigins)
        {
            var request = context.Request;
            var origin = request.Headers["Origin"] ?? string.Empty;
            var path = request.Url.AbsolutePath ?? "/";

            if (string.Equals(request.HttpMethod, "OPTIONS", StringComparison.OrdinalIgnoreCase))
            {
                SendJson(context, 204, new Dictionary<string, object> { { "ok", true } }, origin, allowedOrigins);
                return;
            }

            if (string.Equals(path, "/health", StringComparison.OrdinalIgnoreCase) &&
                string.Equals(request.HttpMethod, "GET", StringComparison.OrdinalIgnoreCase))
            {
                var status = ReadStatus();
                status.StartupEnabled = File.Exists(StartupShortcutPath);
                SendJson(context, 200, status, origin, allowedOrigins);
                return;
            }

            if (!string.Equals(path, "/export-mpp", StringComparison.OrdinalIgnoreCase) ||
                !string.Equals(request.HttpMethod, "POST", StringComparison.OrdinalIgnoreCase))
            {
                SendJson(context, 404, new Dictionary<string, object>
                {
                    { "ok", false },
                    { "error", "Маршрут не найден." }
                }, origin, allowedOrigins);
                return;
            }

            if (!string.IsNullOrWhiteSpace(origin) && !allowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase))
            {
                SendJson(context, 403, new Dictionary<string, object>
                {
                    { "ok", false },
                    { "error", string.Format("Источник {0} не разрешен для локального моста.", origin) }
                }, origin, allowedOrigins);
                return;
            }

            try
            {
                var body = ReadRequestBody(request);
                var payload = Json.DeserializeObject(body ?? string.Empty) as Dictionary<string, object>;
                if (payload == null)
                {
                    throw new InvalidOperationException("Не получено тело запроса.");
                }

                var xml = GetXmlPayload(payload);
                if (string.IsNullOrWhiteSpace(xml))
                {
                    throw new InvalidOperationException("Не получен XML плана проекта.");
                }

                var projectName = GetStringValue(payload, "projectName");
                var fileName = GetStringValue(payload, "fileName");
                var targetFolder = ResolveTargetFolder(
                    GetStringValue(payload, "targetFolder"),
                    GetBoolValue(payload, "promptForFolder")
                );
                var openInMsProject = GetBoolValue(payload, "openInMsProject");
                if (string.IsNullOrWhiteSpace(fileName))
                {
                    fileName = "project_project_plan.mpp";
                }

                Directory.CreateDirectory(targetFolder);
                var targetPath = Path.Combine(targetFolder, fileName);

                ConvertXmlToMpp(xml, targetPath, openInMsProject);

                WriteStatus(new StatusPayload
                {
                    Ok = true,
                    Agent = "ProjectCoreLocalBridge",
                    Version = AgentVersion,
                    Port = ReadStatus().Port,
                    InstallRoot = InstallRoot,
                    StartupEnabled = File.Exists(StartupShortcutPath),
                    MsProjectDetected = true,
                    MsProjectVersion = DetectMsProject().MsProjectVersion,
                    LastError = string.Empty,
                    LastSavedPath = targetPath,
                    UpdatedAt = DateTime.UtcNow.ToString("o")
                });

                SendJson(context, 200, new Dictionary<string, object>
                {
                    { "ok", true },
                    { "savedPath", targetPath },
                    { "projectName", projectName ?? string.Empty }
                }, origin, allowedOrigins);
            }
            catch (Exception ex)
            {
                var current = ReadStatus();
                current.Ok = false;
                current.LastError = ex.Message;
                current.UpdatedAt = DateTime.UtcNow.ToString("o");
                WriteStatus(current);

                SendJson(context, 500, new Dictionary<string, object>
                {
                    { "ok", false },
                    { "error", ex.Message }
                }, origin, allowedOrigins);
            }
        }

        private static string ResolveTargetFolder(string preferredPath, bool promptForFolder)
        {
            if (!promptForFolder && !string.IsNullOrWhiteSpace(preferredPath))
            {
                return preferredPath;
            }

            using (var dialog = new FolderBrowserDialog())
            {
                dialog.Description = "Выберите папку для сохранения плана Project.Core в формате MS Project (.mpp)";
                dialog.ShowNewFolderButton = true;

                if (!string.IsNullOrWhiteSpace(preferredPath) && Directory.Exists(preferredPath))
                {
                    dialog.SelectedPath = preferredPath;
                }

                if (dialog.ShowDialog() != DialogResult.OK || string.IsNullOrWhiteSpace(dialog.SelectedPath))
                {
                    throw new InvalidOperationException("Сохранение .mpp отменено пользователем.");
                }

                return dialog.SelectedPath;
            }
        }

        private static void ConvertXmlToMpp(string xmlText, string targetPath, bool openInMsProject)
        {
            var tempDir = Path.Combine(Path.GetTempPath(), "project-core-local-bridge-" + Guid.NewGuid().ToString("N"));
            Directory.CreateDirectory(tempDir);
            var xmlPath = Path.Combine(tempDir, "project-plan.xml");
            File.WriteAllText(xmlPath, xmlText, new UTF8Encoding(true));

            try
            {
                RunMsProjectPowerShell(xmlPath, targetPath);

                if (!File.Exists(targetPath))
                {
                    throw new InvalidOperationException("Microsoft Project не создал .mpp файл.");
                }

                if (openInMsProject)
                {
                    Process.Start(new ProcessStartInfo
                    {
                        FileName = targetPath,
                        UseShellExecute = true,
                    });
                }
            }
            finally
            {
                try
                {
                    Directory.Delete(tempDir, true);
                }
                catch
                {
                }
            }
        }

        private static void RunMsProjectPowerShell(string xmlPath, string targetPath)
        {
            var script = "$ErrorActionPreference = 'Stop'\n" +
                         "$xmlPath = '" + EscapePowerShellLiteral(xmlPath) + "'\n" +
                         "$mppPath = '" + EscapePowerShellLiteral(targetPath) + "'\n" +
                         "$app = $null\n" +
                         "$opened = $false\n" +
                         "function Save-MppFile {\n" +
                         "  param(\n" +
                         "    [Parameter(Mandatory = $true)] $Application,\n" +
                         "    [Parameter(Mandatory = $true)] [string] $TargetPath\n" +
                         "  )\n" +
                         "  try {\n" +
                         "    $null = $Application.FileSaveAs($TargetPath, $null, $false, $false, $null, $false, $null, $null, $null, 'MSProject.mpp')\n" +
                         "    return\n" +
                         "  } catch {\n" +
                         "    try {\n" +
                         "      $null = $Application.FileSaveAs($TargetPath)\n" +
                         "      return\n" +
                         "    } catch {\n" +
                         "      throw $_\n" +
                         "    }\n" +
                         "  }\n" +
                         "}\n" +
                         "try {\n" +
                         "  $app = New-Object -ComObject MSProject.Application\n" +
                         "  $app.Visible = $false\n" +
                         "  $app.DisplayAlerts = 0\n" +
                         "  try {\n" +
                         "    $opened = [bool]$app.FileOpenEx($xmlPath, $false, 0, $true, $null, $null, $false, $null, $null, 'MSProject.xml', $null, $null, $null, $null, $true, $null, $true)\n" +
                         "  } catch {\n" +
                         "    $opened = [bool]$app.FileOpen($xmlPath)\n" +
                         "  }\n" +
                         "  Start-Sleep -Milliseconds 500\n" +
                         "  $project = $app.ActiveProject\n" +
                         "  if ($project -eq $null -and $app.Projects.Count -gt 0) { $project = $app.Projects.Item(1) }\n" +
                         "  if (-not $opened -and $project -eq $null) { throw 'Microsoft Project не открыл XML-план как активный проект.' }\n" +
                         "  Save-MppFile -Application $app -TargetPath $mppPath\n" +
                         "  try { $app.FileCloseAllEx(0) | Out-Null } catch {}\n" +
                         "} finally {\n" +
                         "  if ($app -ne $null) {\n" +
                         "    try { $app.Quit() | Out-Null } catch {}\n" +
                         "    try { [void][System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($app) } catch {}\n" +
                         "    [GC]::Collect()\n" +
                         "    [GC]::WaitForPendingFinalizers()\n" +
                         "  }\n" +
                         "}\n" +
                         "if (-not (Test-Path -LiteralPath $mppPath)) { throw 'MPP file was not created.' }\n";

            var startInfo = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = "-NoProfile -NonInteractive -ExecutionPolicy Bypass -Command \"" + script.Replace("\"", "\\\"") + "\"",
                UseShellExecute = false,
                CreateNoWindow = true,
                RedirectStandardError = true,
                RedirectStandardOutput = true
            };

            using (var process = Process.Start(startInfo))
            {
                var stdOut = process.StandardOutput.ReadToEnd();
                var stdErr = process.StandardError.ReadToEnd();
                process.WaitForExit();

                if (process.ExitCode != 0)
                {
                    var message = string.IsNullOrWhiteSpace(stdErr) ? stdOut : stdErr;
                    if (string.IsNullOrWhiteSpace(message))
                    {
                        message = "PowerShell-конвертация MS Project завершилась с ошибкой.";
                    }

                    throw new InvalidOperationException(message.Trim());
                }
            }
        }

        private static string EscapePowerShellLiteral(string value)
        {
            return (value ?? string.Empty).Replace("'", "''");
        }

        private static AgentConfig LoadConfig(AgentOptions options)
        {
            if (File.Exists(ConfigPath))
            {
                try
                {
                    var config = Json.Deserialize<AgentConfig>(File.ReadAllText(ConfigPath, Encoding.UTF8));
                    if (config != null)
                    {
                        if (options.Port > 0)
                        {
                            config.Port = options.Port;
                        }

                        if (options.AllowedOrigins.Count > 0)
                        {
                            config.AllowedOrigins = options.AllowedOrigins.ToArray();
                        }

                        return config;
                    }
                }
                catch
                {
                }
            }

            return new AgentConfig
            {
                Port = options.Port > 0 ? options.Port : DefaultPort,
                AllowedOrigins = options.AllowedOrigins.Count > 0 ? options.AllowedOrigins.ToArray() : DefaultOrigins
            };
        }

        private static ProjectDetectionResult DetectMsProject()
        {
            object app = null;

            try
            {
                var type = Type.GetTypeFromProgID("MSProject.Application");
                if (type == null)
                {
                    return new ProjectDetectionResult
                    {
                        MsProjectDetected = false,
                        MsProjectVersion = string.Empty,
                        LastError = "Microsoft Project не найден через COM."
                    };
                }

                app = Activator.CreateInstance(type);
                var version = string.Empty;
                try
                {
                    version = Convert.ToString(((dynamic)app).Version) ?? string.Empty;
                }
                catch
                {
                }

                return new ProjectDetectionResult
                {
                    MsProjectDetected = true,
                    MsProjectVersion = version,
                    LastError = string.Empty
                };
            }
            catch (Exception ex)
            {
                return new ProjectDetectionResult
                {
                    MsProjectDetected = false,
                    MsProjectVersion = string.Empty,
                    LastError = ex.Message
                };
            }
            finally
            {
                if (app != null)
                {
                    try
                    {
                        ((dynamic)app).Quit();
                    }
                    catch
                    {
                    }

                    try
                    {
                        Marshal.FinalReleaseComObject(app);
                    }
                    catch
                    {
                    }
                }
            }
        }

        private static void WriteStatus(StatusPayload status)
        {
            File.WriteAllText(StatusPath, Json.Serialize(status), new UTF8Encoding(true));
        }

        private static StatusPayload ReadStatus()
        {
            if (!File.Exists(StatusPath))
            {
                return new StatusPayload
                {
                    Ok = false,
                    Agent = "ProjectCoreLocalBridge",
                    Version = AgentVersion,
                    Port = DefaultPort,
                    InstallRoot = InstallRoot,
                    StartupEnabled = File.Exists(StartupShortcutPath),
                    MsProjectDetected = false,
                    MsProjectVersion = string.Empty,
                    LastError = string.Empty,
                    UpdatedAt = DateTime.UtcNow.ToString("o")
                };
            }

            try
            {
                var status = Json.Deserialize<StatusPayload>(File.ReadAllText(StatusPath, Encoding.UTF8));
                if (status != null)
                {
                    return status;
                }
            }
            catch
            {
            }

            return new StatusPayload
            {
                Ok = false,
                Agent = "ProjectCoreLocalBridge",
                Version = AgentVersion,
                Port = DefaultPort,
                InstallRoot = InstallRoot,
                StartupEnabled = File.Exists(StartupShortcutPath),
                MsProjectDetected = false,
                MsProjectVersion = string.Empty,
                LastError = "Не удалось прочитать status.json.",
                UpdatedAt = DateTime.UtcNow.ToString("o")
            };
        }

        private static string ReadRequestBody(HttpListenerRequest request)
        {
            using (var reader = new StreamReader(request.InputStream, request.ContentEncoding ?? Encoding.UTF8))
            {
                return reader.ReadToEnd();
            }
        }

        private static string GetStringValue(IDictionary<string, object> payload, string key)
        {
            object value;
            if (!payload.TryGetValue(key, out value) || value == null)
            {
                return string.Empty;
            }

            return Convert.ToString(value) ?? string.Empty;
        }

        private static bool GetBoolValue(IDictionary<string, object> payload, string key)
        {
            object value;
            if (!payload.TryGetValue(key, out value) || value == null)
            {
                return false;
            }

            if (value is bool)
            {
                return (bool)value;
            }

            var text = Convert.ToString(value);
            bool parsed;
            return bool.TryParse(text, out parsed) && parsed;
        }

        private static string GetXmlPayload(IDictionary<string, object> payload)
        {
            var xmlBase64 = GetStringValue(payload, "xmlBase64");
            if (!string.IsNullOrWhiteSpace(xmlBase64))
            {
                try
                {
                    var bytes = Convert.FromBase64String(xmlBase64);
                    return Encoding.UTF8.GetString(bytes);
                }
                catch
                {
                }
            }

            return GetStringValue(payload, "xml");
        }

        private static void SendJson(
            HttpListenerContext context,
            int statusCode,
            object payload,
            string origin,
            IEnumerable<string> allowedOrigins)
        {
            var response = context.Response;
            if (!string.IsNullOrWhiteSpace(origin) && allowedOrigins.Contains(origin, StringComparer.OrdinalIgnoreCase))
            {
                response.Headers["Access-Control-Allow-Origin"] = origin;
            }

            response.Headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS";
            response.Headers["Access-Control-Allow-Headers"] = "Content-Type";
            response.Headers["Access-Control-Allow-Private-Network"] = "true";
            response.StatusCode = statusCode;

            if (statusCode == 204)
            {
                response.ContentLength64 = 0;
                response.Close();
                return;
            }

            response.ContentType = "application/json; charset=utf-8";

            var bytes = Encoding.UTF8.GetBytes(Json.Serialize(payload));
            response.ContentLength64 = bytes.Length;
            response.OutputStream.Write(bytes, 0, bytes.Length);
            response.Close();
        }

        private static void CreateStartupShortcut(string exePath)
        {
            dynamic shell = Activator.CreateInstance(Type.GetTypeFromProgID("WScript.Shell"));
            dynamic shortcut = shell.CreateShortcut(StartupShortcutPath);
            shortcut.TargetPath = exePath;
            shortcut.Arguments = "--background";
            shortcut.WorkingDirectory = InstallRoot;
            shortcut.WindowStyle = 7;
            shortcut.Description = "Project.Core Local Bridge";
            shortcut.Save();
        }

        private static void RemoveShortcutIfExists()
        {
            if (File.Exists(StartupShortcutPath))
            {
                File.Delete(StartupShortcutPath);
            }
        }

        private static void StartBackgroundProcess(string exePath, int port)
        {
            var startInfo = new ProcessStartInfo
            {
                FileName = exePath,
                Arguments = string.Format("--background --port={0}", port),
                WorkingDirectory = Path.GetDirectoryName(exePath) ?? InstallRoot,
                UseShellExecute = true,
                WindowStyle = ProcessWindowStyle.Hidden
            };
            Process.Start(startInfo);
        }
    }

    internal sealed class AgentOptions
    {
        public bool Background { get; private set; }
        public bool Silent { get; private set; }
        public bool NoAutostart { get; private set; }
        public bool NoStartNow { get; private set; }
        public int Port { get; private set; }
        public List<string> AllowedOrigins { get; private set; }

        public AgentOptions()
        {
            Port = 32123;
            AllowedOrigins = new List<string>();
        }

        public static AgentOptions Parse(IEnumerable<string> args)
        {
            var options = new AgentOptions();
            var inputArgs = args ?? new string[0];

            foreach (var raw in inputArgs)
            {
                var arg = raw == null ? string.Empty : raw.Trim();
                int port;
                if (string.Equals(arg, "--background", StringComparison.OrdinalIgnoreCase))
                {
                    options.Background = true;
                    continue;
                }

                if (string.Equals(arg, "--silent", StringComparison.OrdinalIgnoreCase))
                {
                    options.Silent = true;
                    continue;
                }

                if (string.Equals(arg, "--no-autostart", StringComparison.OrdinalIgnoreCase))
                {
                    options.NoAutostart = true;
                    continue;
                }

                if (string.Equals(arg, "--no-start-now", StringComparison.OrdinalIgnoreCase))
                {
                    options.NoStartNow = true;
                    continue;
                }

                if (arg.StartsWith("--port=", StringComparison.OrdinalIgnoreCase) &&
                    int.TryParse(arg.Substring("--port=".Length), out port) &&
                    port > 0)
                {
                    options.Port = port;
                    continue;
                }

                if (arg.StartsWith("--allowed-origin=", StringComparison.OrdinalIgnoreCase))
                {
                    var origin = arg.Substring("--allowed-origin=".Length).Trim();
                    if (!string.IsNullOrWhiteSpace(origin))
                    {
                        options.AllowedOrigins.Add(origin);
                    }
                }
            }

            if (options.AllowedOrigins.Count == 0)
            {
                options.AllowedOrigins.AddRange(new[]
                {
                    "https://spider0-spider0.amvera.io",
                    "http://localhost:3000",
                    "http://127.0.0.1:3000"
                });
            }

            return options;
        }
    }

    internal sealed class AgentConfig
    {
        public int Port { get; set; }
        public string[] AllowedOrigins { get; set; }
    }

    internal sealed class ExportRequest
    {
        public string Xml { get; set; }
        public string ProjectName { get; set; }
        public string FileName { get; set; }
        public string TargetFolder { get; set; }
        public bool PromptForFolder { get; set; }
        public bool OpenInMsProject { get; set; }
    }

    internal sealed class StatusPayload
    {
        public bool Ok { get; set; }
        public string Agent { get; set; }
        public string Version { get; set; }
        public int Port { get; set; }
        public string InstallRoot { get; set; }
        public bool StartupEnabled { get; set; }
        public bool MsProjectDetected { get; set; }
        public string MsProjectVersion { get; set; }
        public string LastError { get; set; }
        public string LastSavedPath { get; set; }
        public string UpdatedAt { get; set; }
    }

    internal sealed class ProjectDetectionResult
    {
        public bool MsProjectDetected { get; set; }
        public string MsProjectVersion { get; set; }
        public string LastError { get; set; }
    }
}
