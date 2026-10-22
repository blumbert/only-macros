# Prints an EAS build's status every 30 seconds until it finishes.
#   .\scripts\watch-build.ps1 <build-id>
param([Parameter(Mandatory = $true)][string]$BuildId)

while ($true) {
  # --yes: otherwise npx can sit at a hidden "install eas-cli?" prompt forever.
  $json = npx --yes eas-cli@latest build:view $BuildId --json 2>$null | Out-String
  try {
    $b = $json | ConvertFrom-Json
  } catch {
    Write-Host "$(Get-Date -Format 'h:mm:ss tt')  couldn't read status, retrying..."
    Start-Sleep 30
    continue
  }
  Write-Host ("{0}  {1}  (version {2}, build {3})" -f (Get-Date -Format 'h:mm:ss tt'), $b.status, $b.appVersion, $b.appBuildVersion)
  if ($b.status -in @('FINISHED', 'ERRORED', 'CANCELED')) {
    if ($b.error) { Write-Host "Error: $($b.error.message)" }
    break
  }
  Start-Sleep 30
}
