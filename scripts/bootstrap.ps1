param(
  [switch]$Detached = $true
)

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

function Get-EnvMap {
  param(
    [string]$Path
  )

  $values = @{}
  foreach ($line in Get-Content -LiteralPath $Path) {
    $trimmed = $line.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) {
      continue
    }

    $parts = $trimmed -split '=', 2
    if ($parts.Count -ne 2) {
      continue
    }

    $values[$parts[0].Trim()] = $parts[1].Trim()
  }

  return $values
}

function Get-ConfigValue {
  param(
    [hashtable]$Primary,
    [hashtable]$Defaults,
    [string]$Key
  )

  if ($Primary.ContainsKey($Key) -and $Primary[$Key]) {
    return $Primary[$Key]
  }

  if ($Defaults.ContainsKey($Key) -and $Defaults[$Key]) {
    return $Defaults[$Key]
  }

  return $null
}

function Test-HttpHealth {
  param(
    [string]$Name,
    [string]$Uri,
    [int]$Attempts = 5
  )

  for ($attempt = 1; $attempt -le $Attempts; $attempt++) {
    try {
      $response = Invoke-WebRequest -Uri $Uri -UseBasicParsing -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 400) {
        return "${Name}: OK"
      }
    } catch {
    }

    Start-Sleep -Seconds 2
  }

  return "${Name}: CHECK"
}

if (-not (Test-Path '.env')) {
  Copy-Item '.env.example' '.env'
  Write-Host 'Created .env from .env.example'
}

if (-not (Test-Path 'reports')) {
  New-Item -ItemType Directory -Path 'reports' | Out-Null
}

docker compose config | Out-Null

if ($Detached) {
  docker compose up --build -d
} else {
  docker compose up --build
}

$defaults = Get-EnvMap -Path '.env.example'
$envValues = Get-EnvMap -Path '.env'

$appAPort = Get-ConfigValue -Primary $envValues -Defaults $defaults -Key 'APP_A_PORT'
$appBPort = Get-ConfigValue -Primary $envValues -Defaults $defaults -Key 'APP_B_PORT'
$appCPort = Get-ConfigValue -Primary $envValues -Defaults $defaults -Key 'APP_C_PORT'
$grafanaPort = Get-ConfigValue -Primary $envValues -Defaults $defaults -Key 'GRAFANA_PORT'
$prometheusPort = Get-ConfigValue -Primary $envValues -Defaults $defaults -Key 'PROMETHEUS_PORT'
$dozzlePort = Get-ConfigValue -Primary $envValues -Defaults $defaults -Key 'DOZZLE_PORT'
$jaegerPort = Get-ConfigValue -Primary $envValues -Defaults $defaults -Key 'JAEGER_UI_PORT'
$postgresPort = Get-ConfigValue -Primary $envValues -Defaults $defaults -Key 'POSTGRES_PORT'
$grafanaUser = Get-ConfigValue -Primary $envValues -Defaults $defaults -Key 'GRAFANA_ADMIN_USER'
$grafanaPassword = Get-ConfigValue -Primary $envValues -Defaults $defaults -Key 'GRAFANA_ADMIN_PASSWORD'
$postgresDb = Get-ConfigValue -Primary $envValues -Defaults $defaults -Key 'POSTGRES_DB'
$postgresUser = Get-ConfigValue -Primary $envValues -Defaults $defaults -Key 'POSTGRES_USER'
$postgresPassword = Get-ConfigValue -Primary $envValues -Defaults $defaults -Key 'POSTGRES_PASSWORD'

$healthChecks = @(
  (Test-HttpHealth -Name 'App UI' -Uri "http://localhost:$appAPort/health"),
  (Test-HttpHealth -Name 'App-B' -Uri "http://localhost:$appBPort/health"),
  (Test-HttpHealth -Name 'App-C' -Uri "http://localhost:$appCPort/health"),
  (Test-HttpHealth -Name 'Grafana' -Uri "http://localhost:$grafanaPort/login"),
  (Test-HttpHealth -Name 'Prometheus' -Uri "http://localhost:$prometheusPort/-/healthy"),
  (Test-HttpHealth -Name 'Jaeger' -Uri "http://localhost:$jaegerPort"),
  (Test-HttpHealth -Name 'Dozzle' -Uri "http://localhost:$dozzlePort")
)

Write-Host ''
Write-Host 'SRE Lab is ready'
Write-Host '----------------'
Write-Host "Grafana:    http://localhost:$grafanaPort  (user: $grafanaUser, password: $grafanaPassword)"
Write-Host "App UI:     http://localhost:$appAPort"
Write-Host "Reports:    http://localhost:$appAPort/reports"
Write-Host "App-B:      http://localhost:$appBPort/health"
Write-Host "App-C:      http://localhost:$appCPort/health"
Write-Host "Prometheus: http://localhost:$prometheusPort"
Write-Host "Jaeger:     http://localhost:$jaegerPort"
Write-Host "Dozzle:     http://localhost:$dozzlePort"
Write-Host "Postgres:   localhost:$postgresPort  (db: $postgresDb, user: $postgresUser, password: $postgresPassword)"
Write-Host ''
Write-Host 'Health checks:'
$healthChecks | ForEach-Object { Write-Host "  $_" }
Write-Host ''
Write-Host 'Values are loaded from .env when present, otherwise .env.example defaults are used.'
