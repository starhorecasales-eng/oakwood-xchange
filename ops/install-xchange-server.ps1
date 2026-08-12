$ErrorActionPreference = "Stop"

$workspace = Split-Path -Parent $PSScriptRoot
Start-Transcript -Path (Join-Path $PSScriptRoot "install.log") -Append -Force | Out-Null
$serviceName = "OakwoodXchange"
$serviceDisplayName = "Oakwood Xchange"
$tunnelServiceName = "STAR Tunnel"
$tunnelName = "pc003-production-20260622"
$tunnelId = "e609af94-4651-4c1a-a7ce-0ea4d169d4bd"
$port = 3027

$nssm = (Get-Command nssm.exe -ErrorAction Stop).Source
$node = "C:\Program Files\nodejs\node.exe"
$serverEntry = Join-Path $workspace "ops\server.mjs"
$cloudflared = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
$cloudflaredConfig = Join-Path $PSScriptRoot "cloudflared.yml"
$logs = Join-Path $workspace "logs"

foreach ($requiredFile in @($node, $serverEntry, $cloudflared, $cloudflaredConfig)) {
  if (-not (Test-Path -LiteralPath $requiredFile)) {
    throw "Required file not found: $requiredFile"
  }
}

New-Item -ItemType Directory -Path $logs -Force | Out-Null

function Wait-ForService {
  param([string]$Name, [int]$Seconds = 20)
  $deadline = (Get-Date).AddSeconds($Seconds)
  do {
    $service = Get-Service -Name $Name -ErrorAction Stop
    if ($service.Status -eq "Running") { return }
    Start-Sleep -Milliseconds 500
  } while ((Get-Date) -lt $deadline)
  throw "Service did not reach Running state: $Name"
}

# Remove only a previous Xchange development process that owns the chosen port.
$listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue
foreach ($listener in $listeners) {
  $process = Get-CimInstance Win32_Process -Filter "ProcessId=$($listener.OwningProcess)"
  if ($process.CommandLine -notlike "*$workspace*") {
    throw "Port $port is owned by an unrelated process (PID $($listener.OwningProcess))."
  }
  Stop-Process -Id $listener.OwningProcess -Force
}

$existingSiteService = Get-Service -Name $serviceName -ErrorAction SilentlyContinue
if ($existingSiteService) {
  if ($existingSiteService.Status -ne "Stopped") {
    Stop-Service -Name $serviceName -Force
  }
  & $nssm set $serviceName Application $node | Out-Null
  & $nssm set $serviceName AppParameters $serverEntry | Out-Null
} else {
  & $nssm install $serviceName $node $serverEntry | Out-Null
}

& $nssm set $serviceName DisplayName $serviceDisplayName | Out-Null
& $nssm set $serviceName Description "Oakwood Apps GBP/TRY converter on localhost:$port" | Out-Null
& $nssm set $serviceName AppDirectory $workspace | Out-Null
& $nssm set $serviceName AppStdout (Join-Path $logs "server-out.log") | Out-Null
& $nssm set $serviceName AppStderr (Join-Path $logs "server-error.log") | Out-Null
& $nssm set $serviceName AppRotateFiles 1 | Out-Null
& $nssm set $serviceName AppRotateOnline 1 | Out-Null
& $nssm set $serviceName AppRotateBytes 1048576 | Out-Null
& $nssm set $serviceName AppExit Default Restart | Out-Null
& $nssm set $serviceName AppRestartDelay 5000 | Out-Null
& $nssm set $serviceName Start SERVICE_AUTO_START | Out-Null

Start-Service -Name $serviceName
Wait-ForService -Name $serviceName

$deadline = (Get-Date).AddSeconds(20)
$siteReady = $false
do {
  try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:$port" -UseBasicParsing -TimeoutSec 3
    $siteReady = $response.StatusCode -eq 200 -and $response.Content -match "Cebimde Kur"
  } catch {
    $siteReady = $false
  }
  if (-not $siteReady) { Start-Sleep -Milliseconds 750 }
} while (-not $siteReady -and (Get-Date) -lt $deadline)

if (-not $siteReady) {
  throw "Xchange service started but the local health check failed."
}

& $cloudflared --config $cloudflaredConfig tunnel ingress validate | Out-Null
if ($LASTEXITCODE -ne 0) {
  throw "Cloudflare ingress validation failed."
}

$previousTunnelParameters = & $nssm get $tunnelServiceName AppParameters
if ($LASTEXITCODE -ne 0) {
  throw "Could not read the existing tunnel service configuration."
}

try {
  Stop-Service -Name $tunnelServiceName -Force
  & $nssm set $tunnelServiceName AppParameters --config $cloudflaredConfig tunnel --protocol http2 run $tunnelName | Out-Null
  Start-Service -Name $tunnelServiceName
  Wait-ForService -Name $tunnelServiceName
} catch {
  try {
    Stop-Service -Name $tunnelServiceName -Force -ErrorAction SilentlyContinue
    & $nssm set $tunnelServiceName AppParameters $previousTunnelParameters | Out-Null
    Start-Service -Name $tunnelServiceName
  } catch {
    # Preserve the original failure; manual intervention may be required.
  }
  throw
}

[PSCustomObject]@{
  SiteService = (Get-Service -Name $serviceName).Status
  TunnelService = (Get-Service -Name $tunnelServiceName).Status
  LocalUrl = "http://127.0.0.1:$port"
  TunnelId = $tunnelId
} | Format-List

Stop-Transcript | Out-Null
