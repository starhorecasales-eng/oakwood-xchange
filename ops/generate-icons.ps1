Add-Type -AssemblyName System.Drawing

$project = Split-Path -Parent $PSScriptRoot
$public = Join-Path $project "public"

foreach ($size in @(180, 192, 512)) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $graphics.Clear([System.Drawing.ColorTranslator]::FromHtml("#102b25"))

  $inset = [int]($size * 0.11)
  $creamBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#f4eedf"))
  $graphics.FillEllipse($creamBrush, $inset, $inset, $size - (2 * $inset), $size - (2 * $inset))

  $fontSize = [single]($size * 0.255)
  $font = New-Object System.Drawing.Font("Segoe UI", $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $inkBrush = New-Object System.Drawing.SolidBrush([System.Drawing.ColorTranslator]::FromHtml("#102b25"))
  $format = New-Object System.Drawing.StringFormat
  $format.Alignment = [System.Drawing.StringAlignment]::Center
  $format.LineAlignment = [System.Drawing.StringAlignment]::Center
  $rect = New-Object System.Drawing.RectangleF(0, 0, $size, $size)
  $graphics.DrawString("₺£", $font, $inkBrush, $rect, $format)

  $output = Join-Path $public "icon-$size.png"
  $bitmap.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)

  $format.Dispose()
  $inkBrush.Dispose()
  $font.Dispose()
  $creamBrush.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}
