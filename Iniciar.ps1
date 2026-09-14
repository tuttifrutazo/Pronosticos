Set-Location -LiteralPath $PSScriptRoot
New-Item -ItemType Directory -Force "$PSScriptRoot/data" | Out-Null
$up = $false
try { $up = (Invoke-RestMethod 'http://127.0.0.1:3210/api/health').ok } catch {}
if (-not $up) {
  Start-Process -FilePath 'node' -ArgumentList 'src/server.js' -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -RedirectStandardOutput "$PSScriptRoot/data/server.log" -RedirectStandardError "$PSScriptRoot/data/server-error.log"
}
Start-Process 'http://127.0.0.1:3210'
