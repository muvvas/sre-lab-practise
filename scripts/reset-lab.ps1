param(
  [switch]$RemoveVolumes
)

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$dockerArgs = @('compose', 'down')
if ($RemoveVolumes) {
  $dockerArgs += '-v'
}

& docker @dockerArgs 2>&1 | ForEach-Object {
  Write-Host $_
}

$reportsPath = Join-Path $root 'reports'
$reportsCount = 0
if (Test-Path -LiteralPath $reportsPath) {
  $reportsCount = (Get-ChildItem -LiteralPath $reportsPath -File -ErrorAction SilentlyContinue | Measure-Object).Count
}

Write-Host ''
Write-Host 'SRE Lab has been stopped'
Write-Host '------------------------'
if ($RemoveVolumes) {
  Write-Host 'Docker containers, network, and named volumes were removed.'
  Write-Host 'Postgres data and Docker-managed app logs were reset.'
} else {
  Write-Host 'Docker containers and network were stopped and removed.'
  Write-Host 'Named volumes were preserved, so Postgres data and app logs remain available.'
}
Write-Host "Reports folder: $reportsPath"
Write-Host "Saved report files detected: $reportsCount"
Write-Host ''
Write-Host 'Start the lab again with:'
Write-Host '  .\scripts\bootstrap.ps1'
