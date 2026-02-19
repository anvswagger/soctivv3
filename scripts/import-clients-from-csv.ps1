param(
  [Parameter(Mandatory = $true)]
  [string]$CsvPath,
  [string]$ProjectRef = ""
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
    [Parameter(Mandatory = $true)] [ValidateSet("GET", "POST", "PATCH")] [string]$Method,
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
    $json = $Body | ConvertTo-Json -Depth 15 -Compress
    $invokeParams["Body"] = [System.Text.Encoding]::UTF8.GetBytes($json)
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

function Normalize-Cell {
  param([AllowNull()][string]$Value)
  if ($null -eq $Value) { return $null }
  $trimmed = $Value.Trim()
  if ([string]::IsNullOrWhiteSpace($trimmed)) { return $null }
  return $trimmed
}

function Parse-BoolOrNull {
  param([AllowNull()][string]$Value)
  $normalized = Normalize-Cell $Value
  if ($null -eq $normalized) {
    return $null
  }

  switch ($normalized.ToLowerInvariant()) {
    "true" { return $true }
    "false" { return $false }
    default { return $null }
  }
}

if (-not (Test-Path $CsvPath)) {
  throw "CSV file not found: $CsvPath"
}

Import-DotEnvFile ".env.local"
Import-DotEnvFile ".env"

$supabaseUrl = Require-Env "VITE_SUPABASE_URL"
$accessToken = Require-Env "SUPABASE_ACCESS_TOKEN"

if ([string]::IsNullOrWhiteSpace($ProjectRef)) {
  $projectFromEnv = [Environment]::GetEnvironmentVariable("VITE_SUPABASE_PROJECT_ID")
  if (-not [string]::IsNullOrWhiteSpace($projectFromEnv)) {
    $ProjectRef = $projectFromEnv
  } else {
    $uri = [Uri]$supabaseUrl
    $ProjectRef = $uri.Host.Split(".")[0]
  }
}

$rows = Import-Csv -Path $CsvPath -Delimiter ";" -Encoding UTF8
if (@($rows).Count -eq 0) {
  throw "CSV has no rows: $CsvPath"
}

$mgmtHeaders = @{
  Authorization = "Bearer $accessToken"
  "Content-Type" = "application/json"
  "User-Agent" = "soctivcrm-client-import/1.0"
}

$apiKeys = Invoke-Json -Method GET -Uri "https://api.supabase.com/v1/projects/$ProjectRef/api-keys" -Headers $mgmtHeaders
$serviceRoleKey = ($apiKeys | Where-Object { $_.id -eq "service_role" } | Select-Object -First 1).api_key
if ([string]::IsNullOrWhiteSpace($serviceRoleKey)) {
  throw "Could not fetch service_role key for project $ProjectRef"
}

$restHeaders = @{
  apikey = $serviceRoleKey
  Authorization = "Bearer $serviceRoleKey"
  "Content-Type" = "application/json; charset=utf-8"
  Prefer = "return=representation"
  "User-Agent" = "soctivcrm-client-import/1.0"
}

$userIds = @(
  $rows |
    ForEach-Object { Normalize-Cell $_.user_id } |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
    Sort-Object -Unique
)

if ($userIds.Count -eq 0) {
  throw "No valid user_id values found in CSV"
}

$userList = ($userIds -join ",")

$profilesResp = Invoke-Json -Method GET -Uri "$supabaseUrl/rest/v1/profiles?select=id&id=in.($userList)" -Headers $restHeaders
$profileSet = New-Object "System.Collections.Generic.HashSet[string]"
foreach ($p in @($profilesResp)) {
  if ($p.id) { [void]$profileSet.Add($p.id) }
}

$existingResp = Invoke-Json -Method GET -Uri "$supabaseUrl/rest/v1/clients?select=id,user_id&user_id=in.($userList)" -Headers $restHeaders
$existingByUser = @{}
foreach ($client in @($existingResp)) {
  if ($client.user_id) {
    $existingByUser[$client.user_id] = $client.id
  }
}

$inserted = 0
$updated = 0
$skippedMissingProfile = 0
$skippedInvalid = 0
$failed = 0
$idMismatchCount = 0

foreach ($row in $rows) {
  $userId = Normalize-Cell $row.user_id
  $companyName = Normalize-Cell $row.company_name

  if ([string]::IsNullOrWhiteSpace($userId) -or [string]::IsNullOrWhiteSpace($companyName)) {
    $skippedInvalid += 1
    continue
  }

  if (-not $profileSet.Contains($userId)) {
    $skippedMissingProfile += 1
    continue
  }

  $payload = [ordered]@{
    id = Normalize-Cell $row.id
    user_id = $userId
    company_name = $companyName
    industry = Normalize-Cell $row.industry
    website = Normalize-Cell $row.website
    address = Normalize-Cell $row.address
    notes = Normalize-Cell $row.notes
    created_at = Normalize-Cell $row.created_at
    updated_at = Normalize-Cell $row.updated_at
    webhook_code = Normalize-Cell $row.webhook_code
    phone = Normalize-Cell $row.phone
    onboarding_completed = Parse-BoolOrNull $row.onboarding_completed
    specialty = Normalize-Cell $row.specialty
    work_area = Normalize-Cell $row.work_area
    strength = Normalize-Cell $row.strength
    min_contract_value = Normalize-Cell $row.min_contract_value
    headquarters = Normalize-Cell $row.headquarters
    achievements = Normalize-Cell $row.achievements
    promotional_offer = Normalize-Cell $row.promotional_offer
    facebook_url = Normalize-Cell $row.facebook_url
  }

  try {
    if ($existingByUser.ContainsKey($userId)) {
      $existingId = $existingByUser[$userId]

      if (($payload.id) -and ($payload.id -ne $existingId)) {
        $idMismatchCount += 1
      }

      $patchBody = [ordered]@{
        user_id = $payload.user_id
        company_name = $payload.company_name
        industry = $payload.industry
        website = $payload.website
        address = $payload.address
        notes = $payload.notes
        created_at = $payload.created_at
        updated_at = $payload.updated_at
        webhook_code = $payload.webhook_code
        phone = $payload.phone
        onboarding_completed = $payload.onboarding_completed
        specialty = $payload.specialty
        work_area = $payload.work_area
        strength = $payload.strength
        min_contract_value = $payload.min_contract_value
        headquarters = $payload.headquarters
        achievements = $payload.achievements
        promotional_offer = $payload.promotional_offer
        facebook_url = $payload.facebook_url
      }

      Invoke-Json -Method PATCH -Uri "$supabaseUrl/rest/v1/clients?id=eq.$existingId" -Headers $restHeaders -Body $patchBody | Out-Null
      $updated += 1
    } else {
      if ([string]::IsNullOrWhiteSpace($payload.id)) {
        $payload.Remove("id")
      }

      Invoke-Json -Method POST -Uri "$supabaseUrl/rest/v1/clients" -Headers $restHeaders -Body $payload | Out-Null
      $inserted += 1
    }
  } catch {
    $failed += 1
    Write-Warning "Failed row user_id=$userId company_name=$companyName. $($_.Exception.Message)"
  }
}

$verifyResp = Invoke-Json -Method GET -Uri "$supabaseUrl/rest/v1/clients?select=id,user_id&user_id=in.($userList)" -Headers $restHeaders
$verifiedCount = @($verifyResp).Count

Write-Host "Import finished."
Write-Host "ProjectRef: $ProjectRef"
Write-Host "CSV rows: $(@($rows).Count)"
Write-Host "Inserted: $inserted"
Write-Host "Updated: $updated"
Write-Host "Skipped (missing profile): $skippedMissingProfile"
Write-Host "Skipped (invalid required values): $skippedInvalid"
Write-Host "ID mismatches preserved existing IDs: $idMismatchCount"
Write-Host "Failed: $failed"
Write-Host "Verified clients for imported user_ids: $verifiedCount"

if ($failed -gt 0) {
  throw "Import finished with failures."
}
