<#
.SYNOPSIS
  Manual deploy of ai-client-onboarding to hablu-vps (no git on the server).
.DESCRIPTION
  git archive <sha> -> scp to /tmp on the host -> run scripts/remote-deploy.sh from that
  same archive. Only committed code is deployed. .env never leaves the server.
.EXAMPLE
  pwsh -File ops/deploy.ps1                 # deploy HEAD
  pwsh -File ops/deploy.ps1 -Sha 1a2b3c4d   # deploy / roll back to a commit
  pwsh -File ops/deploy.ps1 -Bootstrap      # first install: also starts db/auth/rest/storage/gateway
#>
[CmdletBinding()]
param(
  [string]$Sha = "HEAD",
  [switch]$Bootstrap,
  [string]$SshHost = "hablu-vps"
)
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Invoke-Checked([string]$what, [scriptblock]$cmd) {
  & $cmd
  if ($LASTEXITCODE -ne 0) { throw "$what failed (exit $LASTEXITCODE)" }
}

$repo = (git rev-parse --show-toplevel).Trim()
if ($LASTEXITCODE -ne 0) { throw "Run this inside the repository" }
Set-Location $repo

$full = (git rev-parse --verify "$Sha^{commit}" 2>$null)
if ($LASTEXITCODE -ne 0 -or -not $full) { throw "Unknown commit: $Sha" }
$full = $full.Trim()
$short = $full.Substring(0, 12)
if ($Sha -eq "HEAD" -and (git status --porcelain)) {
  Write-Warning "You have uncommitted changes. Only commit $short is deployed."
}

$name = "hablu-onboarding-$short.tar.gz"
$local = Join-Path ([IO.Path]::GetTempPath()) $name
$remoteScript = "/tmp/hablu-onboarding-remote-deploy-$short.sh"
$flag = if ($Bootstrap) { "--bootstrap" } else { "" }

Write-Host "==> Packing commit $short ($(git log -1 --format=%s $full))"
Invoke-Checked "git archive" { git archive --format=tar.gz -o $local $full }
Write-Host ("    {0:N1} MB" -f ((Get-Item $local).Length / 1MB))

try {
  Write-Host "==> Uploading to ${SshHost}:/tmp/$name"
  Invoke-Checked "scp" { scp -q $local "${SshHost}:/tmp/$name" }

  Write-Host "==> Running remote deploy"
  # The deploy script is taken from the same archive, so it always matches the code.
  $remote = "tar -xzOf /tmp/$name scripts/remote-deploy.sh > $remoteScript && bash $remoteScript $short $flag; rc=`$?; rm -f $remoteScript; exit `$rc"
  Invoke-Checked "remote deploy" { ssh $SshHost $remote }
} finally {
  Remove-Item -Force -ErrorAction SilentlyContinue $local
}
