param(
  [Parameter(Mandatory = $true)]
  [string]$CsvPath,
  [Parameter(Mandatory = $true)]
  [string]$TargetClientName,
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

function Normalize-Cell {
  param([AllowNull()][string]$Value)
  if ($null -eq $Value) { return $null }
  $trimmed = $Value.Trim()
  if ([string]::IsNullOrWhiteSpace($trimmed)) { return $null }
  return $trimmed
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
    $json = $Body | ConvertTo-Json -Depth 20 -Compress
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

function Chunk-Array {
  param(
    [Parameter(Mandatory = $true)]
    [object[]]$Items,
    [Parameter(Mandatory = $true)]
    [int]$Size
  )

  $chunks = New-Object System.Collections.Generic.List[object[]]
  for ($i = 0; $i -lt $Items.Count; $i += $Size) {
    $end = [Math]::Min($i + $Size - 1, $Items.Count - 1)
    $chunks.Add($Items[$i..$end]) | Out-Null
  }
  return $chunks
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

$mgmtHeaders = @{
  Authorization = "Bearer $accessToken"
  "Content-Type" = "application/json; charset=utf-8"
  "User-Agent" = "soctivcrm-appointments-import/1.0"
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
  "User-Agent" = "soctivcrm-appointments-import/1.0"
}

$targetNameEscaped = [Uri]::EscapeDataString($TargetClientName)
$targetClients = Invoke-Json -Method GET -Uri "$supabaseUrl/rest/v1/clients?select=id,user_id,company_name&company_name=eq.$targetNameEscaped" -Headers $restHeaders
$targetCount = @($targetClients).Count

if ($targetCount -eq 0) {
  throw "Target client not found by exact company_name: $TargetClientName"
}
if ($targetCount -gt 1) {
  throw "Multiple clients found for company_name: $TargetClientName"
}

$targetClientId = $targetClients[0].id
$rows = Import-Csv -Path $CsvPath -Delimiter ";" -Encoding UTF8

if (@($rows).Count -eq 0) {
  throw "CSV has no rows: $CsvPath"
}

$allowedStatuses = @("scheduled", "completed", "cancelled", "no_show")

$leadIds = @(
  $rows |
    ForEach-Object { Normalize-Cell $_.lead_id } |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
    Sort-Object -Unique
)

if ($leadIds.Count -eq 0) {
  throw "No valid lead_id values found in CSV."
}

$leadsById = @{}
$leadChunks = Chunk-Array -Items $leadIds -Size 150
foreach ($chunk in $leadChunks) {
  $leadList = ($chunk -join ",")
  $leadRows = Invoke-Json -Method GET -Uri "$supabaseUrl/rest/v1/leads?select=id,client_id&id=in.($leadList)" -Headers $restHeaders
  foreach ($lead in @($leadRows)) {
    $leadsById[$lead.id] = $lead
  }
}

$payloadRows = New-Object System.Collections.Generic.List[object]
$skippedInvalid = 0
$skippedStatus = 0
$skippedMissingLead = 0
$skippedLeadClientMismatch = 0

foreach ($row in $rows) {
  $id = Normalize-Cell $row.id
  $leadId = Normalize-Cell $row.lead_id
  $scheduledAt = Normalize-Cell $row.scheduled_at
  $status = Normalize-Cell $row.status
  $durationRaw = Normalize-Cell $row.duration_minutes

  if ([string]::IsNullOrWhiteSpace($id) -or [string]::IsNullOrWhiteSpace($leadId) -or [string]::IsNullOrWhiteSpace($scheduledAt)) {
    $skippedInvalid += 1
    continue
  }

  if ([string]::IsNullOrWhiteSpace($status)) {
    $status = "scheduled"
  }

  if ($status -notin $allowedStatuses) {
    $skippedStatus += 1
    continue
  }

  if (-not $leadsById.ContainsKey($leadId)) {
    $skippedMissingLead += 1
    continue
  }

  if ($leadsById[$leadId].client_id -ne $targetClientId) {
    $skippedLeadClientMismatch += 1
    continue
  }

  $duration = 60
  if (-not [string]::IsNullOrWhiteSpace($durationRaw)) {
    $parsed = 0
    if ([int]::TryParse($durationRaw, [ref]$parsed) -and $parsed -gt 0) {
      $duration = $parsed
    }
  }

  $payloadRows.Add([ordered]@{
    id = $id
    lead_id = $leadId
    client_id = $targetClientId
    scheduled_at = $scheduledAt
    duration_minutes = $duration
    status = $status
    notes = Normalize-Cell $row.notes
    location = Normalize-Cell $row.location
    created_at = Normalize-Cell $row.created_at
    updated_at = Normalize-Cell $row.updated_at
  }) | Out-Null
}

if ($payloadRows.Count -eq 0) {
  throw "No valid appointments to import after validation."
}

$appointmentIds = @($payloadRows | ForEach-Object { $_.id })
$existingIds = New-Object "System.Collections.Generic.HashSet[string]"
$idChunks = Chunk-Array -Items $appointmentIds -Size 150
foreach ($chunk in $idChunks) {
  $idList = ($chunk -join ",")
  $existingRows = Invoke-Json -Method GET -Uri "$supabaseUrl/rest/v1/appointments?select=id&id=in.($idList)" -Headers $restHeaders
  foreach ($row in @($existingRows)) {
    if ($row.id) { [void]$existingIds.Add($row.id) }
  }
}

$toDisableRuleIds = New-Object System.Collections.Generic.List[string]
$disabledCount = 0

try {
  # Disable only appointment_created automation rules during import to avoid duplicate "new appointment" confirmations.
  $rules = Invoke-Json -Method GET -Uri "$supabaseUrl/rest/v1/notification_automation_rules?select=id,enabled,event_type,client_id_filter&event_type=eq.appointment_created&enabled=eq.true" -Headers $restHeaders
  foreach ($rule in @($rules)) {
    $appliesToTarget = ($null -eq $rule.client_id_filter) -or ($rule.client_id_filter -eq $targetClientId)
    if ($appliesToTarget) {
      Invoke-Json -Method PATCH -Uri "$supabaseUrl/rest/v1/notification_automation_rules?id=eq.$($rule.id)" -Headers $restHeaders -Body @{ enabled = $false } | Out-Null
      $toDisableRuleIds.Add($rule.id) | Out-Null
      $disabledCount += 1
    }
  }

  $batchSize = 100
  $imported = 0
  for ($i = 0; $i -lt $payloadRows.Count; $i += $batchSize) {
    $slice = $payloadRows[$i..([Math]::Min($i + $batchSize - 1, $payloadRows.Count - 1))]
    $res = Invoke-Json -Method POST -Uri "$supabaseUrl/rest/v1/appointments?on_conflict=id" -Headers $restHeaders -Body $slice
    $imported += @($res).Count
  }

  $verifiedCount = 0
  foreach ($chunk in $idChunks) {
    $idList = ($chunk -join ",")
    $verified = Invoke-Json -Method GET -Uri "$supabaseUrl/rest/v1/appointments?select=id&client_id=eq.$targetClientId&id=in.($idList)" -Headers $restHeaders
    $verifiedCount += @($verified).Count
  }

  $insertedCount = 0
  $updatedCount = 0
  foreach ($id in $appointmentIds) {
    if ($existingIds.Contains($id)) { $updatedCount += 1 } else { $insertedCount += 1 }
  }

  Write-Host "Import finished."
  Write-Host "ProjectRef: $ProjectRef"
  Write-Host "Target client: $TargetClientName"
  Write-Host "Target client_id: $targetClientId"
  Write-Host "CSV rows: $(@($rows).Count)"
  Write-Host "Imported (inserted/updated): $imported"
  Write-Host "Inserted: $insertedCount"
  Write-Host "Updated: $updatedCount"
  Write-Host "Skipped (invalid required values): $skippedInvalid"
  Write-Host "Skipped (invalid status): $skippedStatus"
  Write-Host "Skipped (missing lead): $skippedMissingLead"
  Write-Host "Skipped (lead belongs to another client): $skippedLeadClientMismatch"
  Write-Host "Temporarily disabled appointment_created rules: $disabledCount"
  Write-Host "Verified imported appointments under target client: $verifiedCount"
}
finally {
  foreach ($ruleId in $toDisableRuleIds) {
    try {
      Invoke-Json -Method PATCH -Uri "$supabaseUrl/rest/v1/notification_automation_rules?id=eq.$ruleId" -Headers $restHeaders -Body @{ enabled = $true } | Out-Null
    } catch {
      Write-Warning "Failed to re-enable notification_automation_rule id=$ruleId. $($_.Exception.Message)"
    }
  }
}

