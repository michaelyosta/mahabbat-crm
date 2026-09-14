[CmdletBinding()]
param(
  [ValidateSet('start', 'stop', 'status')]
  [string]$Action = 'status',
  [string]$EnvFile = ''
)

Set-StrictMode -Version Latest

$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$privateDir = Join-Path $root '.private'
$pidFile = Join-Path $privateDir 'remote-print-gateway.pid'
$stdoutPath = Join-Path $privateDir 'remote-print-gateway.out.log'
$stderrPath = Join-Path $privateDir 'remote-print-gateway.err.log'

function Read-PrivateEnv {
  param([Parameter(Mandatory = $true)][string]$Path)
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) {
    throw "Private gateway environment file is missing: $Path"
  }
  $values = [ordered]@{}
  foreach ($line in Get-Content -LiteralPath $Path -ErrorAction Stop) {
    if ($line -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
      $value = $matches[2].Trim()
      if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
        $value = $value.Substring(1, $value.Length - 2)
      }
      $values[$matches[1]] = $value
    }
  }
  return $values
}

function Get-GatewayProcess {
  if (-not (Test-Path -LiteralPath $pidFile -PathType Leaf)) { return $null }
  try { $processId = [int](Get-Content -Raw -LiteralPath $pidFile).Trim() } catch { return $null }
  $process = Get-Process -Id $processId -ErrorAction SilentlyContinue
  if ($null -eq $process -or $process.ProcessName -notmatch '(?i)node') { return $null }
  return $process
}

function Get-GatewayHealth {
  try {
    return Invoke-RestMethod -UseBasicParsing -Uri 'http://127.0.0.1:3110/health' -TimeoutSec 3 -ErrorAction Stop
  } catch {
    return $null
  }
}

if ([string]::IsNullOrWhiteSpace($EnvFile)) {
  $EnvFile = Join-Path $root 'deploy\print-gateway.remote.env'
}

switch ($Action) {
  'status' {
    $process = Get-GatewayProcess
    $health = Get-GatewayHealth
    if ($null -ne $health -and $health.status -eq 'ok') {
      Write-Host ('REMOTE PRINT GATEWAY HEALTHY (gateway {0})' -f $health.gatewayId)
    } elseif ($null -ne $process) {
      Write-Host ('REMOTE PRINT GATEWAY UNHEALTHY (PID {0})' -f $process.Id)
      exit 1
    } else {
      Write-Host 'REMOTE PRINT GATEWAY STOPPED'
      exit 1
    }
    break
  }
  'stop' {
    $process = Get-GatewayProcess
    if ($null -ne $process) {
      Stop-Process -Id $process.Id -ErrorAction Stop
      Write-Host 'Remote print gateway stopped.'
    } else {
      Write-Host 'Remote print gateway is already stopped.'
    }
    if (Test-Path -LiteralPath $pidFile -PathType Leaf) { Remove-Item -LiteralPath $pidFile -Force -ErrorAction SilentlyContinue }
    break
  }
  'start' {
    if ($null -ne (Get-GatewayProcess) -and $null -ne (Get-GatewayHealth)) {
      Write-Host 'Remote print gateway is already running.'
      break
    }

    $envMap = Read-PrivateEnv $EnvFile
    foreach ($required in @('TWENTY_API_URL', 'MAHABBAT_INTERNAL_ROUTE_SECRET')) {
      if (-not $envMap.Contains($required) -or [string]::IsNullOrWhiteSpace([string]$envMap[$required]) -or [string]$envMap[$required].StartsWith('<')) {
        throw "$required is missing from the private gateway environment."
      }
    }
    if (-not $envMap.Contains('PRINT_GATEWAY_MODE') -or [string]$envMap['PRINT_GATEWAY_MODE'].ToUpperInvariant() -ne 'REMOTE') {
      throw 'The private gateway environment must set PRINT_GATEWAY_MODE=REMOTE.'
    }

    New-Item -ItemType Directory -Force -Path $privateDir | Out-Null
    $node = Get-Command node -ErrorAction Stop
    $names = @('TWENTY_API_URL', 'MAHABBAT_INTERNAL_ROUTE_SECRET', 'PRINT_GATEWAY_MODE', 'PRINT_GATEWAY_HOST', 'PRINT_GATEWAY_PORT', 'PRINT_GATEWAY_ID', 'PRINT_GATEWAY_POLL_MS', 'PRINT_GATEWAY_CONNECT_TIMEOUT_MS', 'PRINT_GATEWAY_AUTO_RETRY_LIMIT', 'CLOUDFLARE_ACCESS_CLIENT_ID', 'CLOUDFLARE_ACCESS_CLIENT_SECRET')
    $previous = @{}
    try {
      foreach ($name in $names) {
        $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
        if ($envMap.Contains($name)) { Set-Item -LiteralPath "Env:$name" -Value ([string]$envMap[$name]) }
      }
      $process = Start-Process -FilePath $node.Source -ArgumentList @('pos-standalone/server/print-gateway.mjs') -WorkingDirectory $root -WindowStyle Hidden -RedirectStandardOutput $stdoutPath -RedirectStandardError $stderrPath -PassThru
      [IO.File]::WriteAllText($pidFile, [string]$process.Id, [Text.UTF8Encoding]::new($false))
      Write-Host ('Remote print gateway started (PID {0}).' -f $process.Id)
    } finally {
      foreach ($name in $names) {
        if ($null -eq $previous[$name]) { Remove-Item -LiteralPath "Env:$name" -ErrorAction SilentlyContinue }
        else { Set-Item -LiteralPath "Env:$name" -Value $previous[$name] }
      }
    }
    break
  }
}
