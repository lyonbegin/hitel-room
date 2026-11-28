param([string]$Repo = "lyonbegin/hitel-room")
$ErrorActionPreference = "Stop"
$dir = Join-Path $env:LOCALAPPDATA "HITEL\Signing"
$key = Join-Path $dir "gallery-debug.keystore"
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw "GitHub CLI (gh) is required. Install using winget install --id GitHub.cli -e." }
if (-not (Get-Command keytool -ErrorAction SilentlyContinue)) { throw "JDK keytool is required. Install JDK 21 and add its bin directory to PATH." }
gh auth status
if ($LASTEXITCODE -ne 0) { throw "Run gh auth login first." }
$variables = gh variable list --repo $Repo --json name,value | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "Could not read GitHub variables." }
$registered = @($variables | Where-Object { $_.name -eq "HITEL_GALLERY_SIGNER_SHA256" })
$secrets = gh secret list --repo $Repo --json name | ConvertFrom-Json
if ($LASTEXITCODE -ne 0) { throw "Could not read GitHub secret names." }
$exists = @($secrets | Where-Object { $_.name -eq "HITEL_GALLERY_KEYSTORE_B64" }).Count -gt 0
if ($exists -and $registered.Count -eq 0) { throw "Signing secret already exists without fingerprint; refusing overwrite." }
if ($registered.Count -gt 0 -and -not (Test-Path $key)) { throw "A fixed signing identity already exists. Restore the original backup instead of creating a new key." }
New-Item -ItemType Directory -Path $dir -Force | Out-Null
if (-not (Test-Path $key)) {
    keytool -genkeypair -keystore $key -storetype PKCS12 -storepass android -keypass android -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 -dname "CN=HITEL Gallery Debug,O=HITEL"
    if ($LASTEXITCODE -ne 0) { throw "Key generation failed." }
}
$cert = Join-Path $dir "gallery-signing-cert.der"
keytool -exportcert -keystore $key -storepass android -alias androiddebugkey -file $cert
if ($LASTEXITCODE -ne 0) { throw "Certificate export failed." }
$sha = (Get-FileHash -Algorithm SHA256 $cert).Hash.ToLowerInvariant()
if ($registered.Count -gt 0 -and $registered[0].value.ToLowerInvariant() -ne $sha) { throw "Local key differs from registered key. No change made." }
if ($registered.Count -eq 0) {
    gh variable set HITEL_GALLERY_SIGNER_SHA256 --repo $Repo --body $sha
    if ($LASTEXITCODE -ne 0) { throw "Fingerprint registration failed. Keep the original key; retry." }
}
if (-not $exists) {
    [Convert]::ToBase64String([IO.File]::ReadAllBytes($key)) | gh secret set HITEL_GALLERY_KEYSTORE_B64 --repo $Repo
    if ($LASTEXITCODE -ne 0) { throw "Secret registration failed. Keep the local key and retry." }
}
Write-Host "FIXED_GALLERY_SIGNER_SHA256=$sha"
Write-Host "Private backup: $key"
Write-Host "Keep an encrypted offline backup. Never upload this keystore to a public repository or release."
