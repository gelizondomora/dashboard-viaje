Add-Type -AssemblyName System.Drawing
$raiz = Split-Path -Parent $PSScriptRoot
foreach ($t in 192, 512) {
  $bmp = New-Object System.Drawing.Bitmap $t, $t
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = 'AntiAlias'
  $g.TextRenderingHint = 'AntiAlias'
  $g.Clear([System.Drawing.Color]::FromArgb(15, 118, 110))
  $fuente = New-Object System.Drawing.Font 'Segoe UI', ([float]($t * 0.4)), ([System.Drawing.FontStyle]::Bold), ([System.Drawing.GraphicsUnit]::Pixel)
  $formato = New-Object System.Drawing.StringFormat
  $formato.Alignment = 'Center'
  $formato.LineAlignment = 'Center'
  $g.DrawString('DV', $fuente, [System.Drawing.Brushes]::White, (New-Object System.Drawing.RectangleF 0, 0, $t, $t), $formato)
  $bmp.Save((Join-Path $raiz "icono-$t.png"), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}
