# Briefly Safety Helpers — DX-01A

DX-lite tooling to reduce operational friction and secret-leak risk when working in the Briefly repository.

> **Scope:** Helpers are PowerShell scripts for human operators. They do NOT automatically block Claude Code, Jarvis, or any other agent. Human maintains final approval at all times. **Not a Command Gateway.**

---

## Quick Start

### Manual load (per session)

```powershell
. .\tools\briefly\Briefly.Safety.ps1
```

### Install in PowerShell profile (persistent)

```powershell
# Add Briefly Safety Helpers block to $PROFILE
$block = @'
# BEGIN: Briefly Safety Helpers
`$brieflyHelpers = "C:\Users\alfom\OneDrive\Documentos\Proyectos_Programacion\Briefly_Cloud_First_Always_Online\tools\briefly\Briefly.Safety.ps1"
if (Test-Path `$brieflyHelpers) {
    . `$brieflyHelpers
    Write-Host "[Briefly Safety Helpers loaded]" -ForegroundColor Green
}
# END: Briefly Safety Helpers
'@

if ((Test-Path $PROFILE) -and (-not (Get-Content $PROFILE -Raw -ErrorAction SilentlyContinue) -match 'Briefly Safety Helpers')) {
    Add-Content -Path $PROFILE -Value $block
}
```

Run the snippet once, then new PowerShell sessions auto-load helpers.

### Profile note — Windows PowerShell 5.1 vs PowerShell 7 / VS Code

Windows PowerShell 5.1 and PowerShell 7 (or VS Code's integrated terminal) use **different profile files**. Installing in one does not install in the other.

To install in both:

```powershell
# Windows PowerShell 5.1 — CurrentUserAllHosts (affects all sessions)
$block = @'
# BEGIN: Briefly Safety Helpers
`$brieflyHelpers = "C:\Users\alfom\OneDrive\Documentos\Proyectos_Programacion\Briefly_Cloud_First_Always_Online\tools\briefly\Briefly.Safety.ps1"
if (Test-Path `$brieflyHelpers) {
    . `$brieflyHelpers
    Write-Host "[Briefly Safety Helpers loaded]" -ForegroundColor Green
}
# END: Briefly Safety Helpers
'@
if ((Test-Path $PROFILE) -and (-not (Get-Content $PROFILE -Raw -ErrorAction SilentlyContinue) -match 'Briefly Safety Helpers')) {
    Add-Content -Path $PROFILE -Value $block
}

# PowerShell 7 / VS Code — CurrentUserCurrentHost
$pwshBlock = @'
# BEGIN: Briefly Safety Helpers
`$brieflyHelpers = "C:\Users\alfom\OneDrive\Documentos\Proyectos_Programacion\Briefly_Cloud_First_Always_Online\tools\briefly\Briefly.Safety.ps1"
if (Test-Path `$brieflyHelpers) {
    . `$brieflyHelpers
    Write-Host "[Briefly Safety Helpers loaded]" -ForegroundColor Green
}
# END: Briefly Safety Helpers
'@
$pwshProfile = "$env:USERPROFILE\Documents\PowerShell\Microsoft.PowerShell_profile.ps1"
if ((Test-Path $pwshProfile) -and (-not (Get-Content $pwshProfile -Raw -ErrorAction SilentlyContinue) -match 'Briefly Safety Helpers')) {
    Add-Content -Path $pwshProfile -Value $pwshBlock
}
```

**No auto-install** — run the snippet above once, manually, in each PowerShell host you use.

---

## Helpers Reference

### bpreflight

Pre-operation check showing repo health without reading secrets.

```
bpreflight
```

Shows: current directory, git root, branch, `git status --short`, recent commits, staged files, .env.s3 gitignored status. Warns if dangerous files (.env, .env.s3, node_modules, *.bin) are staged.

**Never prints:** .env.s3 values, secrets, tokens.

---

### bjwtsafe

Check JWT environment variables without printing tokens.

```
bjwtsafe
```

Shows: `SUPABASE_TEST_JWT` present True/False, length (no actual token), `ENABLE_EXPERIMENTAL_CRDT_ENDPOINT` value, `exp` timestamp + minutes remaining (base64 decode, no crypto verification).

**Never prints:** token string, full header/payload, any prefix/substring.

---

### bsafeenvs3

Validates `.env.s3` presence and structure locally. **Reads the file** to check presence of keys, lengths, and placeholder patterns, but **never prints actual values** and does not call AWS.

```
bsafeenvs3
```

Shows: `exists: True/False`, `gitignored: True/False`, presence of expected keys (`DOCUMENT_STORE_TYPE`, `AWS_S3_BUCKET_NAME`, `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`), value lengths, placeholder detection.

**Never prints:** actual key values, token contents, AWS credentials.

---

### bredactlog

Redacts secrets from log output. Accepts pipeline or clipboard.

```
# Pipeline mode (stdout only — does NOT auto-write clipboard):
"text with AKIAFAKEFAKEFAKE1234" | bredactlog

# Clipboard mode (when no pipeline input):
Set-Clipboard "AKIAFAKEFAKEFAKEFAKE1234 secret here"
bredactlog
Get-Clipboard
```

Redacts: AKIA/ASIA patterns, AWS Secret Access Key, AWS Session Token, IQoJb prefix, JWT (eyJ...), sb_publishable, sb_secret, Authorization Bearer tokens.

Pipeline mode writes redacted text to stdout only. Clipboard is only modified when the function itself triggered the clipboard read (not when input came from a pipe).

**Never prints:** original secret values.

---

### bsecretcheck

Scan files for secret patterns before commit.

```
# Scan staged files (if any), otherwise scan modified/untracked files:
bsecretcheck
```

Scans staged files from git, or all modified/untracked files if no staged files exist.

Reports: filename + pattern type found. Never prints match content.

**Never prints:** actual secret values, token prefixes.

**Patterns detected:** AWS Access Key ID (AKIA/ASIA), AWS Session Token prefix (IQoJb), JWT tokens, Supabase secret/publishable keys, Private Key headers.

---

## Policy

See `briefly.policy.json` for the operational policy defining allow/ask/deny categories.

Key rules:
- **allow:** git status, health checks, safe reads, clipboard ops
- **ask:** docker compose, git commit/push, migrations, file deletions
- **deny:** reading .env.s3, printing AWS keys, printing JWT tokens, printing Supabase secrets

---

## Limitations

- **Not a Command Gateway** — helpers are reminders, not enforced blocks. Claude Code and Jarvis can still run any command. Human operator is responsible for final approval.
- **No auto-block** — does not prevent git add ., docker exec, or any dangerous operation automatically.
- **No git add/commit/push automation** — human reviews everything before committing.
- **No AWS interaction** — helpers do not call AWS APIs beyond reading .env.s3 locally for validation.
- **Local decode only** — JWT decode is base64 parsing only, no cryptographic verification.
- **In-memory only** — helpers do not persist state between PowerShell sessions (beyond profile installation).

---

## Validation

To validate helpers work correctly without real secrets:

```powershell
# Load helpers
. .\tools\briefly\Briefly.Safety.ps1

# Run preflight
bpreflight

# Run JWT check
bjwtsafe

# Run .env.s3 check
bsafeenvs3

# Test redaction with fake secrets
$fake = @"
AWS_ACCESS_KEY_ID=ASIAFAKEFAKEFAKE1234
AWS_SECRET_ACCESS_KEY=fakefakefakefakefakefakefakefakefakefake
AWS_SESSION_TOKEN=IQoJb3JpZ2luX2VjFAKEexample
Authorization: Bearer eyJfake.fake.fake
sb_secret_fakekey123456789
"@
$fake | bredactlog

# Create a fake secret file and scan it
$tmp = "__briefly_fake_secret_test.txt"
"AKIAFAKEFAKEFAKE1234 secret here" | Out-File $tmp -Encoding UTF8
bsecretcheck
Remove-Item $tmp -Force
```

All outputs should show no real secrets printed.

---

## File Structure

```
tools/briefly/
├── Briefly.Safety.ps1   # PowerShell module with all helpers
├── briefly.policy.json  # Operational policy (allow/ask/deny)
└── README.md           # This file
```