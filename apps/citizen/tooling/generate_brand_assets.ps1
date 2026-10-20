Add-Type -AssemblyName System.Drawing

$ink = [System.Drawing.ColorTranslator]::FromHtml('#171717')
$blue = [System.Drawing.ColorTranslator]::FromHtml('#59B5CF')
$background = [System.Drawing.ColorTranslator]::FromHtml('#F7F6F2')
$fontName = 'Arial'

function New-BrandBitmap([int]$width, [int]$height, [float]$fontSize, [bool]$opaque, [bool]$center) {
  $bitmap = [System.Drawing.Bitmap]::new($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear($(if ($opaque) { $background } else { [System.Drawing.Color]::Transparent }))
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
  $font = [System.Drawing.Font]::new($fontName, $fontSize, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
  $text = 'reunite'
  $measure = $graphics.MeasureString($text, $font, [System.Drawing.PointF]::new(0, 0), [System.Drawing.StringFormat]::GenericTypographic)
  $textWidth = [single]$measure.Width
  $x = if ($center) { ($width - ($textWidth + $fontSize * 0.23)) / 2 } else { 6 }
  $y = ($height - $fontSize * 1.03) / 2
  $graphics.DrawString($text, $font, [System.Drawing.SolidBrush]::new($ink), [single]$x, [single]$y, [System.Drawing.StringFormat]::GenericTypographic)
  $dotSize = [single]($fontSize * 0.105)
  $dotY = [single]($y + $fontSize * 0.7)
  $graphics.FillEllipse([System.Drawing.SolidBrush]::new($blue), [single]($x + $textWidth + $fontSize * 0.025), $dotY, $dotSize, $dotSize)
  $font.Dispose()
  $graphics.Dispose()
  return $bitmap
}

function Save-BrandBitmap([string]$path, [int]$width, [int]$height, [float]$fontSize, [bool]$opaque, [bool]$center) {
  $bitmap = New-BrandBitmap $width $height $fontSize $opaque $center
  $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bitmap.Dispose()
}

$root = Resolve-Path (Join-Path $PSScriptRoot '..')
$brandDir = Join-Path $root 'assets\brand'
$androidRes = Join-Path $root 'android\app\src\main\res'
New-Item -ItemType Directory -Force -Path $brandDir, (Join-Path $androidRes 'drawable-nodpi') | Out-Null

Save-BrandBitmap (Join-Path $brandDir 'reunite-wordmark.png') 500 180 132 $false $false
Save-BrandBitmap (Join-Path $androidRes 'drawable-nodpi\reunite_wordmark.png') 500 180 132 $false $false
Save-BrandBitmap (Join-Path $androidRes 'drawable-nodpi\reunite_splash_logo.png') 512 512 100 $false $true
Save-BrandBitmap (Join-Path $androidRes 'drawable-nodpi\ic_launcher_foreground.png') 432 432 68 $false $true

foreach ($entry in @(@{ density = 'mdpi'; size = 48 }, @{ density = 'hdpi'; size = 72 }, @{ density = 'xhdpi'; size = 96 }, @{ density = 'xxhdpi'; size = 144 }, @{ density = 'xxxhdpi'; size = 192 })) {
  $directory = Join-Path $androidRes "mipmap-$($entry.density)"
  New-Item -ItemType Directory -Force -Path $directory | Out-Null
  Save-BrandBitmap (Join-Path $directory 'ic_launcher.png') $entry.size $entry.size ($entry.size * 0.24) $true $true
}
