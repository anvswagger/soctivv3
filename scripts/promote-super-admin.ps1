param(
  [Parameter(Mandatory = $true)]
  [string]$Email
)

$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

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

Import-DotEnvFile ".env.local"
Import-DotEnvFile ".env"

$supabaseUrl = Require-Env "VITE_SUPABASE_URL"
$serviceRoleKey = Require-Env "SUPABASE_SERVICE_ROLE_KEY"

# Use a non-browser user agent to avoid Supabase "secret API key in browser" guardrails.
$ua = "soctivcrm-setup/1.0"

$authHeaders = @{
  apikey = $serviceRoleKey
  Authorization = $serviceRoleKey
  "Content-Type" = "application/json"
  "User-Agent" = $ua
}

Write-Host "Looking up user by email in Supabase Auth..." -ForegroundColor Cyan

$user = $null
for ($page = 1; $page -le 50 -and -not $user; $page++) {
  $resp = Invoke-RestMethod -Method Get -Uri "$supabaseUrl/auth/v1/admin/users?page=$page&per_page=200" -Headers $authHeaders
  $users = @($resp.users)
  if ($users.Count -eq 0) { break }
  $user = $users | Where-Object { $_.email -eq $Email } | Select-Object -First 1
}

if (-not $user) {
  throw "User not found for email: $Email. Sign up in the app first, then rerun this script."
}

$userId = $user.id
Write-Host "Found user id: $userId" -ForegroundColor Green

$restHeaders = @{
  apikey = $serviceRoleKey
  Authorization = $serviceRoleKey
  "Content-Type" = "application/json"
  Prefer = "resolution=merge-duplicates,return=representation"
  "User-Agent" = $ua
}

Write-Host "Granting roles (super_admin, admin)..." -ForegroundColor Cyan

$rolesBody = @(
  @{ user_id = $userId; role = "super_admin" },
  @{ user_id = $userId; role = "admin" }
) | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "$supabaseUrl/rest/v1/user_roles?on_conflict=user_id,role" -Headers $restHeaders -Body $rolesBody | Out-Null

Write-Host "Marking profile as approved..." -ForegroundColor Cyan
$profileBody = @{ approval_status = "approved" } | ConvertTo-Json
Invoke-RestMethod -Method Patch -Uri "$supabaseUrl/rest/v1/profiles?id=eq.$userId" -Headers $restHeaders -Body $profileBody | Out-Null

Write-Host "Done. $Email now has super admin access." -ForegroundColor Green

