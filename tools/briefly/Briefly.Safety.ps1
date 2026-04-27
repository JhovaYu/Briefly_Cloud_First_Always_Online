#Requires -Version 5.1
# Briefly Safety Helpers — DX-01A
# Helpers para reducir friccion operativa y riesgo de filtracion de secretos
# NO es un Command Gateway. No bloquea automaticamente. Humano mantiene aprobacion final.

$ErrorActionPreference = 'Continue'

# -----------------------------------------------------------------------------
# Helper: bpreflight
# Muestra estado del repo sin leer secretos
# -----------------------------------------------------------------------------
function bpreflight {
    Write-Host "`n=== Briefly Preflight ===" -ForegroundColor Cyan

    # Current directory
    Write-Host "`n[CWD]" -ForegroundColor Yellow
    $cwd = Get-Location
    Write-Host "  $cwd"

    # Git root y branch
    Write-Host "`n[GIT]" -ForegroundColor Yellow
    $gitRoot = git rev-parse --show-toplevel 2>$null
    if ($gitRoot) {
        Write-Host "  git root: $gitRoot"
        $branch = git branch --show-current 2>$null
        Write-Host "  branch: $branch"

        Write-Host "`n  [STATUS --short]" -ForegroundColor Yellow
        $status = git status --short --untracked-files=all 2>$null
        if ($status) { Write-Host $status } else { Write-Host "  (clean)" }

        Write-Host "`n  [LOG -5]" -ForegroundColor Yellow
        git log --oneline -5 2>$null | ForEach-Object { Write-Host "  $_" }

        # Staged files
        Write-Host "`n  [STAGED]" -ForegroundColor Yellow
        $staged = git diff --cached --name-only 2>$null
        if ($staged) {
            $staged | ForEach-Object { Write-Host "  + $_" }
        } else {
            Write-Host "  (none)"
        }

        # Warn about dangerous staged files
        $dangerPatterns = @('.env', '.env.s3', '.bin', 'node_modules', '.data', 'secrets')
        $dangerStaged = $staged | Where-Object {
            $file = $_
            $dangerPatterns | Where-Object { $file -match $_ }
        }
        if ($dangerStaged) {
            Write-Host "`n  [!!] DANGEROUS STAGED FILES:" -ForegroundColor Red
            $dangerStaged | ForEach-Object { Write-Host "    $_" -ForegroundColor Red }
        }

        # .env.s3 gitignored check
        $envS3Path = Join-Path $gitRoot ".env.s3"
        if (Test-Path $envS3Path) {
            Write-Host "`n  [.env.s3]" -ForegroundColor Yellow
            $isIgnored = git check-ignore -v $envS3Path 2>$null
            if ($isIgnored) {
                Write-Host "  exists: True  gitignored: True" -ForegroundColor Green
            } else {
                Write-Host "  exists: True  gitignored: False" -ForegroundColor Red
                Write-Host "  [!!] WARNING: .env.s3 is NOT gitignored!" -ForegroundColor Red
            }
        }
    } else {
        Write-Host "  (not a git repo)"
    }

    Write-Host "`n=== Preflight done ===`n" -ForegroundColor Cyan
}

# -----------------------------------------------------------------------------
# Helper: bjwtsafe
# Muestra info del JWT sin imprimir el token
# -----------------------------------------------------------------------------
function bjwtsafe {
    Write-Host "`n=== JWT Safety Check ===" -ForegroundColor Cyan

    $envJwt = $env:SUPABASE_TEST_JWT

    Write-Host "`n[SUPABASE_TEST_JWT]" -ForegroundColor Yellow
    if ([string]::IsNullOrEmpty($envJwt)) {
        Write-Host "  present: False"
    } else {
        Write-Host "  present: True"
        Write-Host "  length: $($envJwt.Length)"

        # Check for ENABLE_EXPERIMENTAL_CRDT_ENDPOINT in env
        $expFlag = $env:ENABLE_EXPERIMENTAL_CRDT_ENDPOINT
        Write-Host "  ENABLE_EXPERIMENTAL_CRDT_ENDPOINT: $($expFlag -replace 'True','true' -replace 'False','false')"

        # Try to decode JWT payload (base64url, no verification)
        try {
            $parts = $envJwt.Split('.')
            if ($parts.Count -ge 2) {
                $payloadB64 = $parts[1].Replace('-', '+').Replace('_', '/')
                # Pad to multiple of 4
                while ($payloadB64.Length % 4 -ne 0) { $payloadB64 += '=' }
                $jsonBytes = [System.Convert]::FromBase64String($payloadB64)
                $json = [System.Text.Encoding]::UTF8.GetString($jsonBytes)
                $payload = $json | ConvertFrom-Json

                if ($payload.exp) {
                    $expUnix = [long]$payload.exp
                    $expTime = [DateTimeOffset]::FromUnixTimeSeconds($expUnix).LocalDateTime
                    $now = [DateTimeOffset]::Now
                    $minutesLeft = [Math]::Round(($expTime - $now).TotalMinutes, 1)
                    Write-Host "  exp: $expTime ($minutesLeft min remaining)"
                }
            }
        } catch {
            Write-Host "  decode: unavailable (base64 decode failed)"
        }
    }

    Write-Host "`n=== JWT check done ===`n" -ForegroundColor Cyan
}

# -----------------------------------------------------------------------------
# Helper: bsafeenvs3
# Valida .env.s3 sin imprimir valores
# -----------------------------------------------------------------------------
function bsafeenvs3 {
    Write-Host "`n=== .env.s3 Safety Check ===" -ForegroundColor Cyan

    $gitRoot = git rev-parse --show-toplevel 2>$null
    if (-not $gitRoot) {
        Write-Host "  (not a git repo, cannot verify .env.s3)"
        return
    }

    $envS3Path = Join-Path $gitRoot ".env.s3"

    Write-Host "`n[.env.s3]" -ForegroundColor Yellow
    $exists = Test-Path $envS3Path
    Write-Host "  exists: $exists"

    if (-not $exists) {
        Write-Host "  (file not present, nothing to check)"
        return
    }

    $isIgnored = git check-ignore -v $envS3Path 2>$null
    Write-Host "  gitignored: $($isIgnored -ne $null)"

    Write-Host "`n  [KEYS CHECK]" -ForegroundColor Yellow
    $expectedKeys = @(
        'DOCUMENT_STORE_TYPE',
        'AWS_S3_BUCKET_NAME',
        'AWS_REGION',
        'AWS_ACCESS_KEY_ID',
        'AWS_SECRET_ACCESS_KEY',
        'AWS_SESSION_TOKEN'
    )

    $content = Get-Content $envS3Path -Raw -ErrorAction SilentlyContinue
    if (-not $content) {
        Write-Host "  (could not read file)"
        return
    }

    $lines = $content -split "`n" | Where-Object { $_ -match '^[A-Za-z_]' }
    $foundKeys = @{}
    foreach ($line in $lines) {
        if ($line -match '^([A-Za-z_][A-Za-z0-9_]*)=(.+)$') {
            $foundKeys[$matches[1]] = $true
        }
    }

    $placeholderPatterns = @(
        '\$accessKey',
        '\$secretKey',
        '\$sessionToken',
        '<temp key>',
        '<AWS[^>]*>'
    )

    foreach ($key in $expectedKeys) {
        $present = $foundKeys.ContainsKey($key)
        Write-Host "  $key : $present"

        if ($present -and $key -ne 'DOCUMENT_STORE_TYPE' -and $key -ne 'AWS_REGION') {
            # Check for placeholder patterns in value
            $keyLine = $lines | Where-Object { $_ -match "^$key=" }
            if ($keyLine) {
                $value = ($keyLine -split '=', 2)[1].Trim()
                $isPlaceholder = $false
                foreach ($pattern in $placeholderPatterns) {
                    if ($value -match $pattern) {
                        $isPlaceholder = $true
                        break
                    }
                }

                # Check for angle brackets, spaces, empty
                if ($value -match '<[^>]+>') { $isPlaceholder = $true }
                if ($value -match '^\s*$') { $isPlaceholder = $true }
                if ($value -match '\s' -and $key -like '*KEY*') { Write-Host "    [i] contains spaces" }

                if ($isPlaceholder) {
                    Write-Host "    placeholder detected: True"
                }
                Write-Host "    value_length: $($value.Length)"
            }
        }
    }

    Write-Host "`n=== .env.s3 check done ===`n" -ForegroundColor Cyan
}

# -----------------------------------------------------------------------------
# Helper: bredactlog
# Redacts secrets from log output
# Pipe mode: Get-Clipboard | bredactlog | Set-Clipboard
# Direct mode: bredactlog "some text with secrets"
# -----------------------------------------------------------------------------
function bredactlog {
    param(
        [Parameter(ValueFromPipeline=$true)]
        [string]$InputText
    )

    Begin {
        $fullText = ""
        $hadPipelineInput = $false
        $fromClipboard = $false
    }

    Process {
        $fullText += $InputText + "`n"
        $hadPipelineInput = $true
    }

    End {
        if ([string]::IsNullOrWhiteSpace($fullText)) {
            # No input from pipeline, try clipboard
            try {
                $clipText = Get-Clipboard -ErrorAction SilentlyContinue
                if ($clipText) {
                    $fullText = $clipText
                    $fromClipboard = $true
                }
            } catch {
                Write-Host "bredactlog: no input and clipboard unavailable" -ForegroundColor Yellow
                return
            }
        }

        if ([string]::IsNullOrWhiteSpace($fullText)) {
            return
        }

        # Redaction rules
        $redacted = $fullText

        # AWS Access Key ID (AKIA...)
        $redacted = $redacted -replace 'AKIA[0-9A-Z]{16}', 'AKIA[REDACTED]'
        # AWS Access Key ID alternate pattern (ASIA...)
        $redacted = $redacted -replace 'ASIA[0-9A-Z]{16}', 'ASIA[REDACTED]'
        # AWS Secret Access Key
        $redacted = $redacted -replace '(?<=AWS_SECRET_ACCESS_KEY[=\s:"]+)[A-Za-z0-9/+=]{20,}', '[AWS_SECRET_ACCESS_KEY_REDACTED]'
        $redacted = $redacted -replace '(?<=AWS_ACCESS_KEY_ID[=\s:"]+)[A-Za-z0-9/+=]{16,}', '[AWS_ACCESS_KEY_ID_REDACTED]'
        # AWS Session Token
        $redacted = $redacted -replace '(?<=AWS_SESSION_TOKEN[=\s:"]+)[A-Za-z0-9/+=,.A-Za-z\-]{50,}', '[AWS_SESSION_TOKEN_REDACTED]'
        # IQoJb pattern (AWS session token prefix)
        $redacted = $redacted -replace 'IQoJb[a-zA-Z0-9+/]+', '[IQOJB_REDACTED]'
        # JWT-like strings
        $redacted = $redacted -replace 'eyJ[A-Za-z0-9+/=]{20,}', '[JWT_REDACTED]'
        # Supabase publishable key
        $redacted = $redacted -replace 'sb_publishable_[a-zA-Z0-9+/=]{20,}', 'sb_publishable_[REDACTED]'
        # Supabase secret key
        $redacted = $redacted -replace 'sb_secret_[a-zA-Z0-9+/=]{20,}', 'sb_secret_[REDACTED]'
        # Supabase service role
        $redacted = $redacted -replace '(?<=SUPABASE_SERVICE_ROLE_KEY[=\s:"]+)[A-Za-z0-9+/=]{50,}', '[SUPABASE_SERVICE_ROLE_KEY_REDACTED]'
        # Authorization Bearer
        $redacted = $redacted -replace '(?<=Authorization:\s*Bearer\s+)[A-Za-z0-9_/-]{20,}', '[BEARER_REDACTED]'
        # Generic Bearer token
        $redacted = $redacted -replace '(?<=Bearer\s+)[A-Za-z0-9_-]{30,}', '[BEARER_REDACTED]'

        # Pipeline input: stdout only, never touch clipboard
        # Clipboard fallback (no pipe): redact and update clipboard
        if ($hadPipelineInput) {
            Write-Output $redacted
        } elseif ($fromClipboard) {
            Set-Clipboard -Value $redacted
            Write-Host "bredactlog: clipboard redacted and updated" -ForegroundColor Green
        } else {
            Write-Output $redacted
        }
    }
}

# -----------------------------------------------------------------------------
# Helper: bsecretcheck
# Escanear archivos antes de commit
# Soporta: bsecretcheck (auto-scan) o bsecretcheck -Path "file"
# -----------------------------------------------------------------------------
function bsecretcheck {
    param(
        [string]$Path = ""
    )

    Write-Host "`n=== Secret Scan ===" -ForegroundColor Cyan

    $filesToScan = @()

    if ($Path -ne "") {
        $filesToScan = @($Path)
    } else {
        $staged = git diff --cached --name-only 2>$null
        if ($staged) {
            Write-Host "`n[Scanning STAGED files]" -ForegroundColor Yellow
            $filesToScan = $staged
        } else {
            $modified = git status --porcelain 2>$null | Where-Object { $_.Trim() -ne '' }
            if ($modified) {
                Write-Host "`n[Scanning MODIFIED/UNTRACKED files]" -ForegroundColor Yellow
                $filesToScan = $modified | ForEach-Object { $_.Trim().Split(' ', 2)[1] }
            }
        }
    }

    if ($filesToScan.Count -eq 0) {
        Write-Host "  PASS — nothing to scan" -ForegroundColor Green
        Write-Host "`n=== Secret scan done ===`n" -ForegroundColor Cyan
        return
    }

    $found = $false
    $skipExts = @('.exe', '.dll', '.so', '.bin', '.png', '.jpg', '.jpeg', '.gif', '.ico', '.pdf', '.zip', '.tar', '.gz')

    foreach ($f in $filesToScan) {
        $resolved = $f
        if (-not [System.IO.Path]::IsPathRooted($resolved)) {
            $resolved = Join-Path (Get-Location) $resolved
        }

        if (-not (Test-Path $resolved -PathType Leaf)) {
            continue
        }

        $ext = [System.IO.Path]::GetExtension($resolved).ToLower()
        if ($skipExts -contains $ext) { continue }

        $txt = Get-Content $resolved -Raw -ErrorAction SilentlyContinue
        if (-not $txt) { continue }

        # AKIA
        if ($txt -match 'AKIA[0-9A-Z]{16}') {
            $found = $true
            Write-Host "`n  [FAIL] $resolved" -ForegroundColor Red
            Write-Host "         -> AWS Access Key ID (AKIA...)" -ForegroundColor Yellow
        }
        # ASIA
        if ($txt -match 'ASIA[0-9A-Z]{16}') {
            $found = $true
            Write-Host "`n  [FAIL] $resolved" -ForegroundColor Red
            Write-Host "         -> AWS Access Key ID (ASIA...)" -ForegroundColor Yellow
        }
        # IQoJb
        if ($txt -match 'IQoJb[a-zA-Z0-9+/]+') {
            $found = $true
            Write-Host "`n  [FAIL] $resolved" -ForegroundColor Red
            Write-Host "         -> AWS Session Token prefix (IQoJb...)" -ForegroundColor Yellow
        }
        # JWT
        if ($txt -match 'eyJ[A-Za-z0-9+/]{20,}') {
            $found = $true
            Write-Host "`n  [FAIL] $resolved" -ForegroundColor Red
            Write-Host "         -> JWT token" -ForegroundColor Yellow
        }
        # sb_secret
        if ($txt -match 'sb_secret_[a-zA-Z0-9+/=]{20,}') {
            $found = $true
            Write-Host "`n  [FAIL] $resolved" -ForegroundColor Red
            Write-Host "         -> Supabase secret key" -ForegroundColor Yellow
        }
        # sb_publishable
        if ($txt -match 'sb_publishable_[a-zA-Z0-9+/=]{20,}') {
            $found = $true
            Write-Host "`n  [FAIL] $resolved" -ForegroundColor Red
            Write-Host "         -> Supabase publishable key" -ForegroundColor Yellow
        }
        # Private key
        if ($txt -match '-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----') {
            $found = $true
            Write-Host "`n  [FAIL] $resolved" -ForegroundColor Red
            Write-Host "         -> Private Key header" -ForegroundColor Yellow
        }
    }

    if (-not $found) {
        Write-Host "  PASS — no secrets detected" -ForegroundColor Green
    }

    Write-Host "`n=== Secret scan done ===`n" -ForegroundColor Cyan
}

# Functions are loaded via dot-source (. .\Briefly.Safety.ps1)
# Do NOT use Export-ModuleMember — not a module, it's a script to be dot-sourced