# Fetches a private copy of Node into .runtime\node, for Windows machines that
# don't have one. start.bat calls this only after failing to find an installed
# Node 20+; nothing here touches the system, the registry, or PATH beyond the
# launcher's own process, and deleting .runtime undoes all of it.
#
# Deliberately built on .NET types rather than the obvious cmdlets (Get-FileHash,
# Expand-Archive, Invoke-WebRequest). Launching start.bat from a PowerShell 7
# terminal leaves Windows PowerShell 5.1 with an inherited PSModulePath pointing
# at PowerShell 7's modules, and it then can't resolve half its own cmdlets.
# .NET is always there. Keep this file ASCII-only too: 5.1 reads .ps1 as ANSI
# unless there is a BOM, so a stray em dash is a parse error.

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dest = Join-Path $root ".runtime\node"
$staging = Join-Path $root ".runtime\_unpack"
$channel = "https://nodejs.org/dist/latest-v22.x"

# A 32-bit PowerShell host on 64-bit Windows reports x86 in PROCESSOR_ARCHITECTURE
# and the real answer in PROCESSOR_ARCHITEW6432.
$raw = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
$arch = if ($raw -eq "ARM64") { "arm64" } else { "x64" }

try {
  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
} catch {
  # Already the default on anything current; only older hosts need the nudge.
}

function New-WebClient {
  $wc = New-Object Net.WebClient
  # Picks up a corporate proxy, which is otherwise a silent hang.
  $wc.Proxy = [Net.WebRequest]::GetSystemWebProxy()
  $wc.Proxy.Credentials = [Net.CredentialCache]::DefaultCredentials
  return $wc
}

function Get-Sha256 {
  param([string]$Path)
  $sha = [Security.Cryptography.SHA256]::Create()
  $stream = [IO.File]::OpenRead($Path)
  try {
    $bytes = $sha.ComputeHash($stream)
  } finally {
    $stream.Dispose()
    $sha.Dispose()
  }
  return [BitConverter]::ToString($bytes).Replace("-", "")
}

Write-Host "  Looking up the current Node LTS..."
$wc = New-WebClient
try {
  $manifest = $wc.DownloadString("$channel/SHASUMS256.txt")
} finally {
  $wc.Dispose()
}

# The channel URL always points at the newest v22, so the exact filename and its
# checksum are read out of the manifest rather than pinned in this file.
$file = $null
$hash = $null
foreach ($line in ($manifest -split "`r?`n")) {
  if ($line -match "^([0-9a-fA-F]{64})\s+(node-v[\d.]+-win-$arch\.zip)\s*$") {
    $hash = $Matches[1]
    $file = $Matches[2]
    break
  }
}
if (-not $file) {
  throw "No Windows $arch build is listed at $channel"
}

$tmp = Join-Path ([IO.Path]::GetTempPath()) $file
Write-Host "  Downloading $file..."
$wc = New-WebClient
try {
  $wc.DownloadFile("$channel/$file", $tmp)
} finally {
  $wc.Dispose()
}

if ((Get-Sha256 $tmp) -ne $hash.ToUpper()) {
  [IO.File]::Delete($tmp)
  throw "Checksum mismatch - the download was corrupted or tampered with."
}

Write-Host "  Unpacking..."
[Reflection.Assembly]::LoadWithPartialName("System.IO.Compression.FileSystem") | Out-Null
if ([IO.Directory]::Exists($staging)) { [IO.Directory]::Delete($staging, $true) }
[IO.Compression.ZipFile]::ExtractToDirectory($tmp, $staging)

# The zip holds a single node-vX.Y.Z-win-arch folder; move it into place under a
# stable name so start.bat doesn't have to guess the version.
$inner = @([IO.Directory]::GetDirectories($staging))
if ($inner.Count -eq 0) { throw "The archive did not contain a Node folder." }
if ([IO.Directory]::Exists($dest)) { [IO.Directory]::Delete($dest, $true) }
[IO.Directory]::CreateDirectory((Split-Path -Parent $dest)) | Out-Null
[IO.Directory]::Move($inner[0], $dest)

if ([IO.Directory]::Exists($staging)) { [IO.Directory]::Delete($staging, $true) }
[IO.File]::Delete($tmp)

Write-Host "  Node is ready in .runtime\node"
