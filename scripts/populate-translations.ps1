# ONE-TIME script: translate all preset_recipes into 5 languages and save to DB
# Usage: .\scripts\populate-translations.ps1 -ApiKey "sk-or-v1-xxx"
# Requires: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local

param(
  [Parameter(Mandatory=$true)][string]$ApiKey
)

# ── Load .env.local ──────────────────────────────────────────────────────────
$envFile = "$PSScriptRoot\..\..\..\..\.env.local"
if (!(Test-Path $envFile)) { $envFile = "$PSScriptRoot\..\.env.local" }
if (!(Test-Path $envFile)) { Write-Error "Cannot find .env.local"; exit 1 }

$envVars = @{}
Get-Content $envFile | ForEach-Object {
  if ($_ -match '^([^=]+)=(.*)$') { $envVars[$matches[1].Trim()] = $matches[2].Trim() }
}
$SupabaseUrl = $envVars['NEXT_PUBLIC_SUPABASE_URL']
$SupabaseKey = $envVars['SUPABASE_SECRET_KEY']
Write-Host "Supabase: $($SupabaseUrl.Substring(0,40))..."
Write-Host "API Key:  $($ApiKey.Substring(0,20))..."

# ── Supabase GET helper ───────────────────────────────────────────────────────
function Invoke-SupabaseGet($path) {
  $headers = @{
    'apikey'        = $SupabaseKey
    'Authorization' = "Bearer $SupabaseKey"
    'User-Agent'    = 'PawChef-Script/1.0'
  }
  return Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/$path" -Method GET -Headers $headers
}

# ── Supabase PATCH helper — sends raw JSON bytes (avoids encoding issues) ─────
function Invoke-SupabasePatch($path, $rawJsonBody) {
  $headers = @{
    'apikey'        = $SupabaseKey
    'Authorization' = "Bearer $SupabaseKey"
    'Content-Type'  = 'application/json'
    'Prefer'        = 'return=minimal'
    'User-Agent'    = 'PawChef-Script/1.0'
  }
  $bodyBytes = [System.Text.Encoding]::UTF8.GetBytes($rawJsonBody)
  Invoke-RestMethod -Uri "$SupabaseUrl/rest/v1/$path" -Method PATCH -Headers $headers -Body $bodyBytes | Out-Null
}

# ── Translate via OpenRouter — returns raw JSON STRING (no PS parsing) ────────
function Translate-Recipe($recipeJson, $langName) {
  $prompt = "Translate this pet food recipe JSON to $langName. Rules:`n- Keep all emojis exactly as-is`n- Keep all numbers and units (g, kg, ml, kcal) exactly as-is`n- Keep ALL JSON keys exactly as-is - only translate string values`n- 'standard' field -> AAFCO compliance phrase in $langName`n- Return ONLY valid JSON, no markdown fences, no commentary`n`n$recipeJson"

  # Escape the prompt for embedding in JSON
  $escapedPrompt = $prompt `
    -replace '\\', '\\' `
    -replace '"',  '\"' `
    -replace "`r`n", '\n' `
    -replace "`n",   '\n' `
    -replace "`r",   '\n' `
    -replace "`t",   '\t'

  $reqBody = "{`"model`":`"anthropic/claude-3-haiku`",`"max_tokens`":2000,`"temperature`":0.1,`"messages`":[{`"role`":`"user`",`"content`":`"$escapedPrompt`"}]}"

  $headers = @{
    'Authorization' = "Bearer $ApiKey"
    'Content-Type'  = 'application/json'
    'X-Title'       = 'PawChef'
  }

  try {
    $reqBytes = [System.Text.Encoding]::UTF8.GetBytes($reqBody)
    $resp = Invoke-RestMethod -Uri 'https://openrouter.ai/api/v1/chat/completions' `
      -Method POST -Headers $headers -Body $reqBytes
    $text = $resp.choices[0].message.content

    # Extract the JSON block — return as RAW STRING, no ConvertFrom-Json (PS can't parse CJK JSON)
    if ($text -match '(?s)\{.+\}') {
      return $matches[0]
    }
    Write-Warning "    No JSON block in response"
    return $null
  } catch {
    $detail = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }
    Write-Warning "    API error: $detail"
    return $null
  }
}

# ── Fetch all recipes ─────────────────────────────────────────────────────────
Write-Host "`nFetching recipes from DB..."
$recipes = Invoke-SupabaseGet 'preset_recipes?select=id,title,content,nutrition,translations'
Write-Host "Total: $($recipes.Count)`n"

$locales = [ordered]@{
  zh = 'Chinese (Simplified)'
  fr = 'French'
  es = 'Spanish'
  ja = 'Japanese'
  ko = 'Korean'
}

$idx = 0
foreach ($recipe in $recipes) {
  # Collect which locales already have translations
  $done = @{}
  if ($recipe.translations) {
    $recipe.translations.PSObject.Properties | ForEach-Object { $done[$_.Name] = $true }
  }

  $pending = $locales.Keys | Where-Object { -not $done.ContainsKey($_) }
  if (-not $pending) {
    Write-Host "skip '$($recipe.title.Substring(0,[Math]::Min(50,$recipe.title.Length)))' (all done)"
    continue
  }

  # Translate only missing locales — store raw JSON strings
  $newTranslations = @{}   # code -> raw JSON string (new ones only)

  $payload = @{ title = $recipe.title; content = $recipe.content; nutrition = $recipe.nutrition }
  $payloadJson = $payload | ConvertTo-Json -Depth 20 -Compress

  foreach ($code in $pending) {
    $idx++
    $langName = $locales[$code]
    Write-Host "  [$idx] '$($recipe.title.Substring(0,[Math]::Min(45,$recipe.title.Length)))' -> $code"

    $rawJson = Translate-Recipe $payloadJson $langName
    if ($rawJson) {
      $newTranslations[$code] = $rawJson
      Write-Host "    OK"
    } else {
      Write-Host "    FAILED - will retry next run"
    }
    Start-Sleep -Milliseconds 400
  }

  if ($newTranslations.Count -eq 0) { continue }

  # ── Build save body: merge existing (from DB as PSCustomObject) + new (raw strings) ──
  # Serialize existing translations back to JSON
  $parts = [System.Collections.Generic.List[string]]::new()

  if ($recipe.translations) {
    $recipe.translations.PSObject.Properties | ForEach-Object {
      $code = $_.Name
      if (-not $newTranslations.ContainsKey($code)) {
        $valJson = $_.Value | ConvertTo-Json -Depth 20 -Compress
        $parts.Add("`"$code`":$valJson")
      }
    }
  }
  foreach ($code in $newTranslations.Keys) {
    $parts.Add("`"$code`":$($newTranslations[$code])")
  }

  $mergedJson = "{" + ($parts -join ",") + "}"
  $rawBody    = "{`"translations`":$mergedJson}"

  try {
    Invoke-SupabasePatch "preset_recipes?id=eq.$($recipe.id)" $rawBody
    Write-Host "  saved ($($parts.Count) locales)`n"
  } catch {
    $detail = if ($_.ErrorDetails.Message) { $_.ErrorDetails.Message } else { $_.Exception.Message }
    Write-Warning "  DB save failed: $detail"
  }
}

Write-Host "`nDone! All translations stored in DB."
