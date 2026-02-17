param(
  [switch]$KeepUser
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

function Invoke-Json {
  param(
    [Parameter(Mandatory = $true)] [ValidateSet("GET","POST","PATCH","DELETE")] [string]$Method,
    [Parameter(Mandatory = $true)] [string]$Uri,
    [Parameter(Mandatory = $true)] [hashtable]$Headers,
    [object]$Body = $null
  )

  $invokeParams = @{
    Method = $Method
    Uri = $Uri
    Headers = $Headers
  }

  if ($null -ne $Body) {
    $invokeParams["Body"] = ($Body | ConvertTo-Json -Depth 10)
  }

  try {
    return Invoke-RestMethod @invokeParams
  } catch {
    $status = $null
    try { $status = $_.Exception.Response.StatusCode.value__ } catch {}
    $details = $null
    try { $details = $_.ErrorDetails.Message } catch {}
    throw "HTTP $status calling $Method $Uri. $details"
  }
}

Write-Host "Loading environment from .env.local then .env..." -ForegroundColor Cyan
Import-DotEnvFile ".env.local"
Import-DotEnvFile ".env"

$supabaseUrl = Require-Env "VITE_SUPABASE_URL"
$anonKey = Require-Env "VITE_SUPABASE_PUBLISHABLE_KEY"
$serviceRoleKey = Require-Env "SUPABASE_SERVICE_ROLE_KEY"

$ua = "soctivcrm-smoke-test/1.0"

$timestamp = (Get-Date).ToUniversalTime().ToString("yyyyMMddHHmmss")
$email = "smoke+$timestamp@example.com"
$password = "Sm0ke!$timestamp#"

Write-Host "1) Auth signup + login..." -ForegroundColor Cyan
$authHeaders = @{
  apikey = $anonKey
  "Content-Type" = "application/json"
  "User-Agent" = $ua
}

Invoke-Json -Method POST -Uri "$supabaseUrl/auth/v1/signup" -Headers $authHeaders -Body @{
  email = $email
  password = $password
  data = @{
    full_name = "Smoke Test"
    phone = "0000000000"
    company_name = "Smoke Co"
  }
} | Out-Null

$tokenResp = Invoke-Json -Method POST -Uri "$supabaseUrl/auth/v1/token?grant_type=password" -Headers $authHeaders -Body @{
  email = $email
  password = $password
}

$accessToken = $tokenResp.access_token
if (-not $accessToken) { throw "Auth token missing from login response" }

$userHeaders = @{
  apikey = $anonKey
  Authorization = "Bearer $accessToken"
  "Content-Type" = "application/json"
  "User-Agent" = $ua
  Prefer = "return=representation"
}

$userResp = Invoke-Json -Method GET -Uri "$supabaseUrl/auth/v1/user" -Headers $userHeaders
$userId = $userResp.id
if (-not $userId) { throw "User id missing from /auth/v1/user response" }

Write-Host "2) Verify profile/roles/client row..." -ForegroundColor Cyan
$roles = Invoke-Json -Method GET -Uri "$supabaseUrl/rest/v1/user_roles?select=role&user_id=eq.$userId" -Headers $userHeaders
if (-not ($roles | Where-Object { $_.role -eq "client" })) {
  throw "Expected default role 'client' missing for user $userId"
}

$clients = Invoke-Json -Method GET -Uri "$supabaseUrl/rest/v1/clients?select=id,company_name,onboarding_completed&user_id=eq.$userId" -Headers $userHeaders
$clientId = $clients[0].id
if (-not $clientId) { throw "Client row not created for user $userId" }

Write-Host "3) Insert lead + appointment (RLS)..." -ForegroundColor Cyan
$lead = Invoke-Json -Method POST -Uri "$supabaseUrl/rest/v1/leads" -Headers $userHeaders -Body @{
  client_id = $clientId
  first_name = "Test"
  last_name = "Lead"
  phone = "0910000000"
  status = "new"
  source = "smoke_test"
}

$leadId = $lead[0].id
if (-not $leadId) { throw "Lead insert failed (no id returned)" }

$scheduledAt = (Get-Date).ToUniversalTime().AddHours(1).ToString("o")
$appt = Invoke-Json -Method POST -Uri "$supabaseUrl/rest/v1/appointments" -Headers $userHeaders -Body @{
  lead_id = $leadId
  client_id = $clientId
  scheduled_at = $scheduledAt
  duration_minutes = 30
  status = "scheduled"
  location = "Smoke Test"
}

$apptId = $appt[0].id
if (-not $apptId) { throw "Appointment insert failed (no id returned)" }

Invoke-Json -Method PATCH -Uri "$supabaseUrl/rest/v1/appointments?id=eq.$apptId" -Headers $userHeaders -Body @{
  status = "completed"
} | Out-Null

Write-Host "4) Edge function auth guard checks..." -ForegroundColor Cyan
# send-push-notification should reject non-super-admin manual calls.
try {
  Invoke-Json -Method POST -Uri "$supabaseUrl/functions/v1/send-push-notification" -Headers $userHeaders -Body @{
    title = "Smoke Test"
    message = "Hello"
    type = "info"
    url = "/"
  } | Out-Null
  throw "Expected send-push-notification to reject non-super-admin user"
} catch {
  if (-not ($_.Exception.Message -match "HTTP 403")) {
    throw
  }
}

Write-Host "5) Cron runner RPC..." -ForegroundColor Cyan
$serviceRoleKeyEncoded = [Uri]::EscapeDataString($serviceRoleKey)
$cronHeaders = @{
  "Content-Type" = "application/json"
  "User-Agent" = $ua
}
$cronResp = Invoke-Json -Method POST -Uri "$supabaseUrl/rest/v1/rpc/run_appointment_reminders_cron?apikey=$serviceRoleKeyEncoded" -Headers $cronHeaders -Body @{}
if (-not $cronResp.ok) { throw "run_appointment_reminders_cron did not return ok=true" }

Write-Host "Smoke test passed." -ForegroundColor Green
Write-Host "User: $email"
Write-Host "Client: $clientId"
Write-Host "Lead: $leadId"
Write-Host "Appointment: $apptId"

if (-not $KeepUser) {
  Write-Host "Cleaning up (delete auth user)..." -ForegroundColor Cyan
  $adminHeaders = @{
    apikey = $serviceRoleKey
    Authorization = $serviceRoleKey
    "Content-Type" = "application/json"
    "User-Agent" = $ua
  }
  Invoke-Json -Method DELETE -Uri "$supabaseUrl/auth/v1/admin/users/$userId" -Headers $adminHeaders | Out-Null
  Write-Host "Cleanup completed." -ForegroundColor Green
} else {
  Write-Host "KeepUser enabled; leaving test user in place." -ForegroundColor Yellow
}
