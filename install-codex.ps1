param([switch]$Force)
$ErrorActionPreference = 'Stop'
$source = Split-Path -Parent $MyInvocation.MyCommand.Path
$skillSource = Join-Path $source 'skills\agentready'
$destination = Join-Path $HOME '.agents\skills\agentready'

if (-not (Test-Path (Join-Path $skillSource 'scripts\agentready.mjs'))) {
  throw "Packaged skill runtime missing in $skillSource. Run 'npm run skill:package' first."
}
if ((Test-Path $destination) -and -not $Force) {
  throw "AgentReady already exists at $destination. Rerun with -Force only after reviewing what it will replace."
}
if (Test-Path $destination) { Remove-Item $destination -Recurse -Force }
New-Item -ItemType Directory -Path (Split-Path -Parent $destination) -Force | Out-Null
Copy-Item $skillSource $destination -Recurse
Write-Host "Installed self-contained AgentReady skill at $destination. Restart Codex to discover it."
Write-Host "Recommended universal installer: npx skills add cuonghuhuu/agentready_B2A --skill agentready -g"
