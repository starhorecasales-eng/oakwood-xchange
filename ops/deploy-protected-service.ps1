$ErrorActionPreference = "Stop"

$workspace = Split-Path -Parent $PSScriptRoot
$serviceName = "OakwoodXchange"
$tunnelServiceName = "STAR Tunnel"
$releaseRoot = "C:\Program Files\OakwoodApps\Xchange\releases"
$commitId = (git -C $workspace rev-parse --short HEAD).Trim()
if (-not $commitId) { $commitId = "uncommitted" }
$releaseId = "$commitId-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
$release = Join-Path $releaseRoot $releaseId
$logs = "C:\ProgramData\OakwoodApps\Xchange\logs"
$node = "C:\Program Files\nodejs\node.exe"
$nssm = (Get-Command nssm.exe -ErrorAction Stop).Source
$protectedNssm = "C:\Program Files\OakwoodApps\Service\nssm.exe"
$cloudflared = "C:\Program Files (x86)\cloudflared\cloudflared.exe"
$protectedTunnelDirectory = "C:\ProgramData\OakwoodApps\Cloudflare"
$protectedTunnelConfig = Join-Path $protectedTunnelDirectory "cloudflared.yml"

foreach ($required in @(
  $node,
  (Join-Path $workspace "dist\client\index.html"),
  (Join-Path $workspace "dist\client\manifest.webmanifest"),
  (Join-Path $workspace "ops\server.mjs"),
  (Join-Path $workspace "ops\http-security.mjs"),
  (Join-Path $workspace "ops\cloudflared.yml"),
  $cloudflared
)) {
  if (-not (Test-Path -LiteralPath $required)) { throw "Required file not found: $required" }
}

$previous = [ordered]@{}
foreach ($field in @("Application", "AppParameters", "AppDirectory", "AppStdout", "AppStderr", "ObjectName")) {
  $previous[$field] = (& $nssm get $serviceName $field).Trim()
}
$previousImagePath = (Get-CimInstance Win32_Service -Filter "Name='$serviceName'").PathName
$previousTunnelParameters = (& $nssm get $tunnelServiceName AppParameters).Trim()

New-Item -ItemType Directory -Path (Join-Path $release "dist") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $release "ops") -Force | Out-Null
New-Item -ItemType Directory -Path $logs -Force | Out-Null
New-Item -ItemType Directory -Path (Split-Path -Parent $protectedNssm) -Force | Out-Null
New-Item -ItemType Directory -Path $protectedTunnelDirectory -Force | Out-Null
Copy-Item -LiteralPath (Join-Path $workspace "dist\client") -Destination (Join-Path $release "dist\client") -Recurse -Force
Copy-Item -LiteralPath (Join-Path $workspace "ops\server.mjs") -Destination (Join-Path $release "ops\server.mjs") -Force
Copy-Item -LiteralPath (Join-Path $workspace "ops\http-security.mjs") -Destination (Join-Path $release "ops\http-security.mjs") -Force
Copy-Item -LiteralPath $nssm -Destination $protectedNssm -Force
Copy-Item -LiteralPath (Join-Path $workspace "ops\cloudflared.yml") -Destination $protectedTunnelConfig -Force

& icacls.exe $release /inheritance:r /grant:r "SYSTEM:(OI)(CI)(F)" "Administrators:(OI)(CI)(F)" "LOCAL SERVICE:(OI)(CI)(RX)" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Could not protect the release directory." }
& icacls.exe $logs /inheritance:r /grant:r "SYSTEM:(OI)(CI)(F)" "Administrators:(OI)(CI)(F)" "LOCAL SERVICE:(OI)(CI)(M)" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Could not protect the log directory." }
& icacls.exe (Split-Path -Parent $protectedNssm) /inheritance:r /grant:r "SYSTEM:(OI)(CI)(F)" "Administrators:(OI)(CI)(F)" "LOCAL SERVICE:(OI)(CI)(RX)" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Could not protect the service wrapper." }
& icacls.exe $protectedTunnelDirectory /inheritance:r /grant:r "SYSTEM:(OI)(CI)(F)" "Administrators:(OI)(CI)(F)" | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Could not protect the tunnel configuration." }

& $cloudflared --config $protectedTunnelConfig tunnel ingress validate | Out-Null
if ($LASTEXITCODE -ne 0) { throw "Protected tunnel configuration is invalid." }

try {
  Stop-Service -Name $serviceName -Force
  $quotedProtectedNssm = '"' + $protectedNssm + '"'
  & sc.exe config $serviceName binPath= $quotedProtectedNssm | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Could not move the service wrapper." }
  & $nssm set $serviceName Application $node | Out-Null
  & $nssm set $serviceName AppParameters (Join-Path $release "ops\server.mjs") | Out-Null
  & $nssm set $serviceName AppDirectory $release | Out-Null
  & $nssm set $serviceName AppStdout (Join-Path $logs "server-out.log") | Out-Null
  & $nssm set $serviceName AppStderr (Join-Path $logs "server-error.log") | Out-Null
  & $nssm set $serviceName ObjectName "NT AUTHORITY\LocalService" | Out-Null
  Start-Service -Name $serviceName

  $deadline = (Get-Date).AddSeconds(20)
  $healthy = $false
  do {
    try {
      $response = Invoke-WebRequest -Uri "http://127.0.0.1:3027/" -Headers @{
        Host = "xchange.oakwoodapps.co.uk"
        "X-Forwarded-Proto" = "https"
      } -UseBasicParsing -TimeoutSec 2
      $healthy = $response.StatusCode -eq 200 -and
        $response.Content -match "Cebimde Kur" -and
        $response.Headers["Strict-Transport-Security"] -eq "max-age=86400"
    } catch {
      $healthy = $false
    }
    if (-not $healthy) { Start-Sleep -Milliseconds 500 }
  } while (-not $healthy -and (Get-Date) -lt $deadline)

  if (-not $healthy) { throw "Protected Xchange service failed its health check." }

  Stop-Service -Name $tunnelServiceName -Force
  & $nssm set $tunnelServiceName AppParameters --config $protectedTunnelConfig tunnel --protocol http2 run pc003-production-20260622 | Out-Null
  Start-Service -Name $tunnelServiceName

  $tunnelDeadline = (Get-Date).AddSeconds(30)
  $publicHealthy = $false
  do {
    try {
      $publicResponse = Invoke-WebRequest -Uri "https://xchange.oakwoodapps.co.uk/" -UseBasicParsing -TimeoutSec 4
      $publicHealthy = $publicResponse.StatusCode -eq 200 -and
        $publicResponse.Content -match "Cebimde Kur" -and
        $publicResponse.Headers["Strict-Transport-Security"] -eq "max-age=86400"
    } catch {
      $publicHealthy = $false
    }
    if (-not $publicHealthy) { Start-Sleep -Milliseconds 750 }
  } while (-not $publicHealthy -and (Get-Date) -lt $tunnelDeadline)

  if (-not $publicHealthy) { throw "Cloudflare public health check failed." }
} catch {
  Stop-Service -Name $serviceName -Force -ErrorAction SilentlyContinue
  Stop-Service -Name $tunnelServiceName -Force -ErrorAction SilentlyContinue
  & sc.exe config $serviceName binPath= $previousImagePath | Out-Null
  foreach ($field in $previous.Keys) {
    & $nssm set $serviceName $field $previous[$field] | Out-Null
  }
  Start-Service -Name $serviceName -ErrorAction SilentlyContinue
  & $nssm set $tunnelServiceName AppParameters $previousTunnelParameters | Out-Null
  Start-Service -Name $tunnelServiceName -ErrorAction SilentlyContinue
  throw
}

[PSCustomObject]@{
  Service = $serviceName
  Status = (Get-Service -Name $serviceName).Status
  Account = (Get-CimInstance Win32_Service -Filter "Name='$serviceName'").StartName
  Release = $release
  LocalUrl = "http://127.0.0.1:3027"
  TunnelConfig = $protectedTunnelConfig
} | Format-List
