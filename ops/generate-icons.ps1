Add-Type -AssemblyName System.Drawing

$project = Split-Path -Parent $PSScriptRoot
$public = Join-Path $project "public"
$sourceSvg = Join-Path $public "brand\app-icon.svg"
$edgeCandidates = @(
  (Join-Path $env:ProgramFiles "Microsoft\Edge\Application\msedge.exe"),
  (Join-Path ${env:ProgramFiles(x86)} "Microsoft\Edge\Application\msedge.exe"),
  (Join-Path $env:LOCALAPPDATA "Microsoft\Edge\Application\msedge.exe")
)
$edge = $edgeCandidates | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if (-not $edge) {
  throw "Microsoft Edge is required to render the SVG icon master."
}

$tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("cebimde-kur-icons-" + [guid]::NewGuid())
$renderSvg = Join-Path $tempDir "app-icon-render.svg"
$masterPng = Join-Path $tempDir "app-icon-1024.png"
New-Item -ItemType Directory -Path $tempDir | Out-Null

try {
  $svg = Get-Content -Raw -Encoding utf8 -LiteralPath $sourceSvg
  $fullBleedSvg = $svg.Replace(
    '<rect width="1024" height="1024" rx="240" fill="#102B25"/>',
    '<rect width="1024" height="1024" fill="#102B25"/><rect width="1024" height="1024" rx="240" fill="#102B25"/>'
  )
  Set-Content -LiteralPath $renderSvg -Value $fullBleedSvg -Encoding utf8

  $renderUri = [System.Uri]::new($renderSvg).AbsoluteUri
  & $edge --headless=new --disable-gpu --hide-scrollbars --no-first-run --window-size=1024,1024 "--screenshot=$masterPng" $renderUri | Out-Null
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $masterPng)) {
    throw "Edge could not render the SVG icon master."
  }

  $master = [System.Drawing.Image]::FromFile($masterPng)
  try {
    foreach ($size in @(180, 192, 512)) {
      $bitmap = New-Object System.Drawing.Bitmap($size, $size)
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.DrawImage($master, 0, 0, $size, $size)
        $output = Join-Path $public "icon-$size.png"
        $bitmap.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)
      } finally {
        $graphics.Dispose()
        $bitmap.Dispose()
      }
    }
  } finally {
    $master.Dispose()
  }
} finally {
  if (Test-Path -LiteralPath $renderSvg) { Remove-Item -LiteralPath $renderSvg -Force }
  if (Test-Path -LiteralPath $masterPng) { Remove-Item -LiteralPath $masterPng -Force }
  if (Test-Path -LiteralPath $tempDir) { Remove-Item -LiteralPath $tempDir -Force }
}
