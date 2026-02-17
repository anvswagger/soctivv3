param(
  [string]$ProjectRef = "",
  [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

function Write-Step {
  param([string]$Message)
  Write-Host ""
  Write-Host "==> $Message" -ForegroundColor Cyan
}

function Run-Cli {
  param(
    [Parameter(Mandatory = $true)]
    [string[]]$Args
  )

  & npx @Args
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed: npx $($Args -join ' ')"
  }
}

function Import-DotEnvFile {
  param([string]$Path)

  if (-not (Test-Path $Path)) {
    return
  }

  Get-Content $Path | ForEach-Object {
    $line = $_.Trim()
    if (-not $line -or $line.StartsWith("#")) {
      return
    }

    $parts = $line -split "=", 2
    if ($parts.Count -ne 2) {
      return
    }

    $name = $parts[0].Trim()
    $value = $parts[1].Trim()

    if ($value.StartsWith('"') -and $value.EndsWith('"')) {
      $value = $value.Substring(1, $value.Length - 2)
    }

    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($name))) {
      [Environment]::SetEnvironmentVariable($name, $value)
      Set-Item -Path "env:$name" -Value $value
    }
  }
}

function Require-Env {
  param([string]$Name)

  $value = [Environment]::GetEnvironmentVariable($Name)
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing required env var: $Name"
  }
  return $value
}

function Upsert-EnvLine {
  param(
    [string]$Path,
    [string]$Name,
    [string]$Value
  )

  $newLine = "$Name=""$Value"""

  if (-not (Test-Path $Path)) {
    Set-Content -Path $Path -Value $newLine -Encoding UTF8
    return
  }

  $lines = Get-Content $Path
  $updated = $false
  for ($i = 0; $i -lt $lines.Count; $i++) {
    if ($lines[$i] -match "^\s*$([Regex]::Escape($Name))\s*=") {
      $lines[$i] = $newLine
      $updated = $true
      break
    }
  }

  if (-not $updated) {
    $lines += $newLine
  }

  Set-Content -Path $Path -Value $lines -Encoding UTF8
}

Write-Step "Loading environment from .env.local then .env (if present)"
Import-DotEnvFile ".env.local"
Import-DotEnvFile ".env"

if ([string]::IsNullOrWhiteSpace($ProjectRef)) {
  if (-not (Test-Path "supabase/config.toml")) {
    throw "supabase/config.toml not found. Run this script from project root."
  }

  $projectLine = Get-Content "supabase/config.toml" | Where-Object { $_ -match '^\s*project_id\s*=' } | Select-Object -First 1
  if (-not $projectLine) {
    throw "project_id not found in supabase/config.toml"
  }

  $ProjectRef = ($projectLine -split "=", 2)[1].Trim().Trim('"')
}

$accessToken = Require-Env "SUPABASE_ACCESS_TOKEN"
$serviceRoleKey = Require-Env "SUPABASE_SERVICE_ROLE_KEY"
$webPushPublic = Require-Env "WEB_PUSH_PUBLIC_KEY"
$webPushPrivate = Require-Env "WEB_PUSH_PRIVATE_KEY"
$webPushSubject = [Environment]::GetEnvironmentVariable("WEB_PUSH_SUBJECT")
if ([string]::IsNullOrWhiteSpace($webPushSubject)) {
  $webPushSubject = "mailto:admin@example.com"
}

Set-Item -Path "env:SUPABASE_ACCESS_TOKEN" -Value $accessToken

if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable("VITE_WEB_PUSH_PUBLIC_KEY"))) {
  Write-Step "VITE_WEB_PUSH_PUBLIC_KEY missing, writing it to .env.local"
  Upsert-EnvLine -Path ".env.local" -Name "VITE_WEB_PUSH_PUBLIC_KEY" -Value $webPushPublic
}

Write-Step "Linking Supabase project ($ProjectRef)"
Run-Cli -Args @("supabase", "link", "--project-ref", $ProjectRef, "--yes")

Write-Step "Pushing Supabase config.toml"
Run-Cli -Args @("supabase", "config", "push", "--project-ref", $ProjectRef, "--yes")

Write-Step "Applying database migrations"
Run-Cli -Args @("supabase", "db", "push", "--linked", "--yes")

Write-Step "Upserting app_runtime_settings for DB-trigger -> Edge Function calls"
# We store runtime values in a locked-down table instead of custom GUCs (app.settings.*),
# which are not supported consistently across Supabase environments.
$projectUrl = "https://$ProjectRef.supabase.co"
$serviceRoleKeyEncoded = [Uri]::EscapeDataString($serviceRoleKey)
$headers = @{
  "Content-Type" = "application/json"
  Prefer = "resolution=merge-duplicates,return=representation"
  "User-Agent" = "soctivcrm-setup/1.0"
}
$payload = @{
  id = 1
  supabase_url = $projectUrl
  service_role_key = $serviceRoleKey
} | ConvertTo-Json

try {
  Invoke-RestMethod -Method Post -Uri "$projectUrl/rest/v1/app_runtime_settings?on_conflict=id&apikey=$serviceRoleKeyEncoded" -Headers $headers -Body $payload | Out-Null
} catch {
  # If the row already exists, PATCH is reliable.
  Invoke-RestMethod -Method Patch -Uri "$projectUrl/rest/v1/app_runtime_settings?id=eq.1&apikey=$serviceRoleKeyEncoded" -Headers $headers -Body $payload | Out-Null
}

Write-Step "Setting Edge Function secrets"
Run-Cli -Args @(
  "supabase", "secrets", "set",
  "--project-ref", $ProjectRef,
  "WEB_PUSH_PUBLIC_KEY=$webPushPublic",
  "WEB_PUSH_PRIVATE_KEY=$webPushPrivate",
  "WEB_PUSH_SUBJECT=$webPushSubject"
)

Write-Step "Deploying send-push-notification function"
Run-Cli -Args @(
  "supabase", "functions", "deploy",
  "send-push-notification",
  "--project-ref", $ProjectRef,
  "--use-api",
  "--no-verify-jwt"
)

Write-Step "Deploying push-config function"
Run-Cli -Args @(
  "supabase", "functions", "deploy",
  "push-config",
  "--project-ref", $ProjectRef,
  "--use-api",
  "--no-verify-jwt"
)

if (-not $SkipBuild) {
  Write-Step "Running frontend production build check"
  & npm run build
  if ($LASTEXITCODE -ne 0) {
    throw "npm run build failed"
  }
}

Write-Step "Notifications setup completed successfully"
Write-Host "Project: $ProjectRef"
Write-Host "Function: send-push-notification"
Write-Host "Next: open Settings > Notifications and create/test IF-THEN rules."
