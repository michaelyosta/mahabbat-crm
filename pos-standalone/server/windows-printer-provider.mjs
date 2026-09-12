import { spawn } from 'node:child_process';

const POWERSHELL = process.env.MAHABBAT_POWERSHELL_PATH ?? 'powershell.exe';

const DISCOVERY_SCRIPT = `
$ErrorActionPreference = 'Stop'
if (-not (Get-Command Get-Printer -ErrorAction SilentlyContinue)) { throw 'Get-Printer is unavailable' }
Get-Printer | Select-Object Name,DriverName,PortName,PrinterStatus,Default,Shared,WorkOffline | ConvertTo-Json -Compress
`;

const WRITE_RAW_SCRIPT = `
$ErrorActionPreference = 'Stop'
$QueueName = $env:MAHABBAT_PRINT_QUEUE_NAME
if ([string]::IsNullOrWhiteSpace($QueueName)) { throw 'Printer queue name is empty' }
$base64 = [Console]::In.ReadToEnd().Trim()
if ([string]::IsNullOrWhiteSpace($base64)) { throw 'Print payload is empty' }
$bytes = [Convert]::FromBase64String($base64)
Add-Type @'
using System;
using System.Runtime.InteropServices;
public static class MahabbatRawPrinter {
  [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
  public class DOCINFO {
    [MarshalAs(UnmanagedType.LPWStr)] public string pDocName;
    [MarshalAs(UnmanagedType.LPWStr)] public string pOutputFile;
    [MarshalAs(UnmanagedType.LPWStr)] public string pDataType;
  }
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern bool OpenPrinter(string name, out IntPtr handle, IntPtr defaults);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool ClosePrinter(IntPtr handle);
  [DllImport("winspool.drv", CharSet = CharSet.Unicode, SetLastError = true)]
  public static extern int StartDocPrinter(IntPtr handle, int level, [In] DOCINFO docInfo);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndDocPrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool StartPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool EndPagePrinter(IntPtr handle);
  [DllImport("winspool.drv", SetLastError = true)]
  public static extern bool WritePrinter(IntPtr handle, IntPtr bytes, int count, out int written);
}
'@
$handle = [IntPtr]::Zero
$pointer = [IntPtr]::Zero
$documentStarted = $false
$pageStarted = $false
try {
  if (-not [MahabbatRawPrinter]::OpenPrinter($QueueName, [ref]$handle, [IntPtr]::Zero)) { throw "OpenPrinter failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }
  $docInfo = New-Object MahabbatRawPrinter+DOCINFO
  $docInfo.pDocName = 'Mahabbat test print'
  $docInfo.pDataType = 'RAW'
  if ([MahabbatRawPrinter]::StartDocPrinter($handle, 1, $docInfo) -eq 0) { throw "StartDocPrinter failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }
  $documentStarted = $true
  if (-not [MahabbatRawPrinter]::StartPagePrinter($handle)) { throw "StartPagePrinter failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }
  $pageStarted = $true
  $pointer = [Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length)
  [Runtime.InteropServices.Marshal]::Copy($bytes, 0, $pointer, $bytes.Length)
  $written = 0
  if (-not [MahabbatRawPrinter]::WritePrinter($handle, $pointer, $bytes.Length, [ref]$written)) { throw "WritePrinter failed: $([Runtime.InteropServices.Marshal]::GetLastWin32Error())" }
  if ($written -ne $bytes.Length) { throw "WritePrinter wrote $written of $($bytes.Length) bytes" }
} finally {
  if ($pointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::FreeHGlobal($pointer) }
  if ($pageStarted) { [void][MahabbatRawPrinter]::EndPagePrinter($handle) }
  if ($documentStarted) { [void][MahabbatRawPrinter]::EndDocPrinter($handle) }
  if ($handle -ne [IntPtr]::Zero) { [void][MahabbatRawPrinter]::ClosePrinter($handle) }
}
Write-Output '{"status":"SENT"}'
`;

const runPowerShell = ({ script, input = '', env = {}, timeoutMs = 15_000 } = {}) => new Promise((resolve, reject) => {
  const child = spawn(POWERSHELL, ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', script], {
    windowsHide: true,
    env: { ...process.env, ...env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  let settled = false;
  const timer = setTimeout(() => {
    if (settled) return;
    settled = true;
    child.kill();
    const error = new Error('Windows printer provider timed out');
    error.code = 'WINDOWS_SPOOLER_TIMEOUT';
    reject(error);
  }, timeoutMs);
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data', (chunk) => { stdout += chunk; });
  child.stderr.on('data', (chunk) => { stderr += chunk; });
  child.once('error', (error) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    error.code = error.code === 'ENOENT' ? 'WINDOWS_SPOOLER_UNAVAILABLE' : error.code;
    reject(error);
  });
  child.once('close', (code) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    if (code !== 0) {
      const error = new Error(stderr.trim() || `PowerShell exited with code ${code}`);
      error.code = 'WINDOWS_SPOOLER_ERROR';
      reject(error);
      return;
    }
    resolve(stdout.trim());
  });
  child.stdin.end(input);
});

const asBoolean = (value) => value === true || String(value ?? '').toLowerCase() === 'true';
const unavailableStatuses = new Set(['offline', 'error', 'notavailable', 'unknown']);

export const parseSystemPrinterRows = (value, lastSeen = new Date().toISOString()) => {
  let parsed = value;
  if (typeof value === 'string') {
    try { parsed = value.trim() ? JSON.parse(value) : []; } catch { parsed = []; }
  }
  const rows = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' ? [parsed] : [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== 'object') return [];
    const name = String(row.Name ?? row.name ?? '').trim();
    if (!name) return [];
    const rawStatus = String(row.PrinterStatus ?? row.status ?? '').trim();
    const normalizedStatus = rawStatus.toLowerCase().replace(/[ _-]/g, '');
    const workOffline = asBoolean(row.WorkOffline ?? row.workOffline);
    const isAvailable = !workOffline && !unavailableStatuses.has(normalizedStatus);
    return [{
      id: `windows:${name}`,
      name,
      systemQueueName: name,
      driverName: String(row.DriverName ?? row.driverName ?? '').trim() || null,
      portName: String(row.PortName ?? row.portName ?? '').trim() || null,
      isDefault: asBoolean(row.Default ?? row.isDefault),
      status: isAvailable ? 'CONNECTED' : rawStatus ? 'UNAVAILABLE' : 'UNKNOWN',
      isAvailable,
      capabilityStatus: 'UNKNOWN',
      lastSeen,
    }];
  });
};

export const listWindowsPrinters = async ({ run = runPowerShell, now = new Date().toISOString() } = {}) => {
  const output = await run({ script: DISCOVERY_SCRIPT });
  return parseSystemPrinterRows(output, now);
};

export class WindowsSpoolerPrinterTransport {
  async send(bytes, device) {
    const queue = String(device?.systemQueueName ?? '').trim();
    if (!queue) {
      const error = new Error('Windows system printer binding is missing');
      error.code = 'SYSTEM_PRINTER_NOT_BOUND';
      error.outcome = 'FAILED';
      error.retryable = false;
      throw error;
    }
    const printers = await listWindowsPrinters();
    const discovered = printers.find((printer) => printer.systemQueueName === queue);
    if (!discovered) {
      const error = new Error('Windows does not contain the selected printer queue');
      error.code = 'WINDOWS_PRINTER_NOT_FOUND';
      error.outcome = 'FAILED';
      error.retryable = false;
      throw error;
    }
    await runPowerShell({ script: WRITE_RAW_SCRIPT, env: { MAHABBAT_PRINT_QUEUE_NAME: queue }, input: Buffer.from(bytes).toString('base64'), timeoutMs: 30_000 });
    return { outcome: 'SENT', bytesSent: bytes.length };
  }
}

export const _internal = { runPowerShell, DISCOVERY_SCRIPT, WRITE_RAW_SCRIPT };
