[CmdletBinding()]
param(
  [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'

if ($env:OS -ne 'Windows_NT') {
  throw 'This setup is intended for Windows POS terminals.'
}

$tabletTipPath = 'HKCU:\Software\Microsoft\TabletTip\1.7'
$propertyName = 'EnableDesktopModeAutoInvoke'

if (-not $CheckOnly) {
  New-Item -Path $tabletTipPath -Force | Out-Null
  New-ItemProperty `
    -Path $tabletTipPath `
    -Name $propertyName `
    -PropertyType DWord `
    -Value 1 `
    -Force | Out-Null
}

$configuredValue = (
  Get-ItemProperty -Path $tabletTipPath -Name $propertyName -ErrorAction SilentlyContinue
).$propertyName
$textInputService = Get-Service -Name 'TextInputManagementService' -ErrorAction SilentlyContinue
$serviceReady = $null -ne $textInputService -and $textInputService.Status -eq 'Running'

if ($configuredValue -eq 1 -and $serviceReady) {
  Write-Output 'PASS Windows touch keyboard auto-invoke is enabled for the current POS user.'
  exit 0
}

if ($configuredValue -ne 1) {
  Write-Output 'NOT_CONFIGURED EnableDesktopModeAutoInvoke is not enabled for the current POS user.'
}
if (-not $serviceReady) {
  Write-Output 'NOT_READY Windows Text Input Management Service is not running.'
}

exit 1
