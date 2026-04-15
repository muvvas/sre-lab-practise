param(
  [string]$BaseUrl = "http://localhost:3001",
  [string]$OutputDir = ".\\reports",
  [switch]$Pdf
)

$resolvedOutput = Resolve-Path -LiteralPath "." | ForEach-Object { Join-Path $_ $OutputDir.TrimStart(".\") }
if (-not (Test-Path $resolvedOutput)) {
  New-Item -ItemType Directory -Path $resolvedOutput | Out-Null
}

$stamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$mdPath = Join-Path $resolvedOutput "sre-session-report-$stamp.md"
$htmlPath = Join-Path $resolvedOutput "sre-session-report-$stamp.html"
$pdfPath = Join-Path $resolvedOutput "sre-session-report-$stamp.pdf"

Invoke-WebRequest -Uri "$BaseUrl/api/session-report/latest/markdown" -OutFile $mdPath
Invoke-WebRequest -Uri "$BaseUrl/api/session-report/latest/html" -OutFile $htmlPath

if ($Pdf) {
  $edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
  if (-not (Test-Path $edge)) {
    throw "Microsoft Edge not found at $edge"
  }

  $fileUri = "file:///" + ($htmlPath -replace "\\","/")
  & $edge --headless --disable-gpu "--print-to-pdf=$pdfPath" $fileUri | Out-Null
}

Write-Host "Markdown: $mdPath"
Write-Host "HTML: $htmlPath"
if ($Pdf) {
  Write-Host "PDF: $pdfPath"
}
