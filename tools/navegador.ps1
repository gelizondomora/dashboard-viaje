param(
  [string]$Pagina = 'tests.html',
  [ValidateSet('pruebas', 'dom', 'captura')] [string]$Modo = 'pruebas',
  [string]$Salida = 'captura.png',
  [int]$Ancho = 390,
  [int]$Alto = 1400
)
$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [Text.Encoding]::UTF8
$raiz = Split-Path -Parent $PSScriptRoot
$edge = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$puerto = Get-Random -Minimum 20000 -Maximum 40000
$serve = Join-Path $PSScriptRoot 'serve.ps1'
$servidor = Start-Process -FilePath 'powershell.exe' -WindowStyle Hidden -PassThru -ArgumentList @(
  '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', "`"$serve`"", '-Root', "`"$raiz`"", '-Port', $puerto)
$codigo = 0
try {
  $listo = $false
  for ($i = 0; $i -lt 30 -and -not $listo; $i++) {
    Start-Sleep -Milliseconds 300
    try { Invoke-WebRequest -Uri "http://localhost:$puerto/tools/serve.ps1" -UseBasicParsing -TimeoutSec 2 | Out-Null; $listo = $true } catch { }
  }
  if (-not $listo) { throw 'El servidor local no arrancó.' }
  $tmp = Join-Path $env:TEMP ('dv-' + [guid]::NewGuid())
  $url = "http://localhost:$puerto/$Pagina"
  $argumentos = @('--headless', '--disable-gpu', '--no-first-run', "--user-data-dir=`"$tmp`"", '--virtual-time-budget=15000')
  if ($Modo -eq 'captura') {
    $destino = if ([IO.Path]::IsPathRooted($Salida)) { $Salida } else { Join-Path (Get-Location) $Salida }
    $argumentos += @("--window-size=$Ancho,$Alto", "--screenshot=`"$destino`"", "`"$url`"")
  } else {
    $argumentos += @('--dump-dom', "`"$url`"")
  }
  Start-Process -FilePath $edge -ArgumentList $argumentos -RedirectStandardOutput "$tmp.html" -RedirectStandardError "$tmp.err" -Wait -NoNewWindow
  if ($Modo -eq 'captura') {
    Write-Output "Captura guardada en $destino"
  } else {
    $dom = Get-Content "$tmp.html" -Raw -Encoding UTF8
    if ($Modo -eq 'dom') {
      Write-Output $dom
    } else {
      $m = [regex]::Match($dom, 'RESUMEN: (\d+) ok, (\d+) fallas')
      if (-not $m.Success) {
        Write-Output 'No se encontró el resumen de pruebas. DOM recibido:'; Write-Output $dom; $codigo = 2
      } else {
        Write-Output $m.Value
        $fallos = [regex]::Match($dom, '<pre id="fallos">([\s\S]*?)</pre>').Groups[1].Value
        if ($fallos) { Write-Output ([System.Net.WebUtility]::HtmlDecode($fallos)) }
        if ([int]$m.Groups[2].Value -gt 0) { $codigo = 1 }
      }
    }
  }
} finally {
  Stop-Process -Id $servidor.Id -Force -ErrorAction SilentlyContinue
}
exit $codigo
