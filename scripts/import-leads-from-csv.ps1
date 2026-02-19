param(
  [Parameter(Mandatory = $true)]
  [string]$CsvPath,
  [Parameter(Mandatory = $true)]
  [string]$TargetClientName,
  [string]$ProjectRef = "kockawmdcotemxhmkozb"
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

function Normalize-Cell {
  param([AllowNull()][string]$Value)
  if ($null -eq $Value) { return $null }
  $trimmed = $Value.Trim()
  if ([string]::IsNullOrWhiteSpace($trimmed)) { return $null }
  return $trimmed
}

function Invoke-Json {
  param(
    [Parameter(Mandatory = $true)] [ValidateSet("GET", "POST")] [string]$Method,
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

if (-not (Test-Path $CsvPath)) {
  throw "CSV file not found: $CsvPath"
}

Import-DotEnvFile ".env.local"
Import-DotEnvFile ".env"

$supabaseUrl = Require-Env "VITE_SUPABASE_URL"
$accessToken = Require-Env "SUPABASE_ACCESS_TOKEN"

$mgmtHeaders = @{
  Authorization = "Bearer $accessToken"
  "Content-Type" = "application/json; charset=utf-8"
  "User-Agent" = "soctivcrm-leads-import/1.0"
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
  Prefer = "resolution=merge-duplicates,return=representation"
  "User-Agent" = "soctivcrm-leads-import/1.0"
}

$targetNameEscaped = [Uri]::EscapeDataString($TargetClientName)
$targetClients = Invoke-Json -Method GET -Uri "$supabaseUrl/rest/v1/clients?select=id,user_id,company_name&company_name=eq.$targetNameEscaped" -Headers $restHeaders
$targetCount = @($targetClients).Count

if ($targetCount -eq 0) {
  throw "Target client not found by exact company_name: $TargetClientName"
}
if ($targetCount -gt 1) {
  throw "Multiple clients found for company_name: $TargetClientName. Use a unique company name first."
}

$targetClientId = $targetClients[0].id

$rows = Import-Csv -Path $CsvPath -Delimiter ";" -Encoding UTF8
if (@($rows).Count -eq 0) {
  throw "CSV has no rows: $CsvPath"
}

$allowedStatuses = @(
  "new",
  "contacting",
  "appointment_booked",
  "interviewed",
  "no_show",
  "sold",
  "cancelled"
)

$payloadRows = New-Object System.Collections.Generic.List[object]
$skippedInvalid = 0
$skippedStatus = 0

foreach ($row in $rows) {
  $id = Normalize-Cell $row.id
  $firstName = Normalize-Cell $row.first_name
  $lastName = Normalize-Cell $row.last_name
  $status = Normalize-Cell $row.status

  if ([string]::IsNullOrWhiteSpace($id) -or [string]::IsNullOrWhiteSpace($firstName) -or [string]::IsNullOrWhiteSpace($lastName)) {
    $skippedInvalid += 1
    continue
  }

  if ([string]::IsNullOrWhiteSpace($status)) {
    $status = "new"
  }
  if ($status -notin $allowedStatuses) {
    $skippedStatus += 1
    continue
  }

  $payloadRows.Add([ordered]@{
    id = $id
    client_id = $targetClientId
    first_name = $firstName
    last_name = $lastName
    email = Normalize-Cell $row.email
    phone = Normalize-Cell $row.phone
    status = $status
    source = Normalize-Cell $row.source
    notes = Normalize-Cell $row.notes
    created_at = Normalize-Cell $row.created_at
    updated_at = Normalize-Cell $row.updated_at
    worktype = Normalize-Cell $row.worktype
    stage = Normalize-Cell $row.stage
    first_contact_at = Normalize-Cell $row.first_contact_at
  }) | Out-Null
}

if ($payloadRows.Count -eq 0) {
  throw "No valid leads to import after validation."
}

# Keep request size predictable.
$batchSize = 100
$insertedOrUpdated = 0
for ($i = 0; $i -lt $payloadRows.Count; $i += $batchSize) {
  $slice = $payloadRows[$i..([Math]::Min($i + $batchSize - 1, $payloadRows.Count - 1))]
  $res = Invoke-Json -Method POST -Uri "$supabaseUrl/rest/v1/leads?on_conflict=id" -Headers $restHeaders -Body $slice
  $insertedOrUpdated += @($res).Count
}

$verifyLeads = Invoke-Json -Method GET -Uri "$supabaseUrl/rest/v1/leads?select=id&client_id=eq.$targetClientId" -Headers $restHeaders
$verifyCount = @($verifyLeads).Count

Write-Host "Import finished."
Write-Host "ProjectRef: $ProjectRef"
Write-Host "Target client: $TargetClientName"
Write-Host "Target client_id: $targetClientId"
Write-Host "CSV rows: $(@($rows).Count)"
Write-Host "Imported (inserted/updated): $insertedOrUpdated"
Write-Host "Skipped (invalid required values): $skippedInvalid"
Write-Host "Skipped (invalid status): $skippedStatus"
Write-Host "Total leads now under target client: $verifyCount"

