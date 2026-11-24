param([switch]$Force)
$ErrorActionPreference = 'Stop'
$source = Split-Path -Parent $MyInvocation.MyCommand.Path
$destination = Join-Path $HOME '.agents\skills\agentready'
if ((Test-Path $destination) -and -not $Force) {
  throw "AgentReady already exists at $destination. Rerun with -Force only after reviewing what it will replace."
}
if (Test-Path $destination) { Remove-Item $destination -Recurse -Force }
New-Item -ItemType Directory -Path $destination -Force | Out-Null
Copy-Item (Join-Path $source 'skills\agentready\SKILL.md') $destination
Copy-Item (Join-Path $source 'skills\agentready\references') $destination -Recurse
Copy-Item (Join-Path $source 'bin') $destination -Recurse
Copy-Item (Join-Path $source 'src') $destination -Recurse
Write-Host "Installed AgentReady skill at $destination. Restart Codex to discover it."
