# DEMO-01 — Pre-Demo Checklist

**Para ejecutar ANTES de cada sesión de demo con profesor.**

---

## 1. Git Status

```powershell
git status --short --untracked-files=all
```
**Esperado:** sin output (directorio limpio)

---

## 2. Safety Helpers

```powershell
. .\tools\briefly\Briefly.Safety.ps1
```

---

## 3. bpreflight

```powershell
bpreflight
```
**Esperado:** clean working tree, no staged dangerous files

---

## 4. bsecretcheck

```powershell
bsecretcheck
```
**Esperado:** `PASS: nothing to scan`

---

## 5. JWT Status

```powershell
bjwtsafe
```
**Esperado:**
- `SUPABASE_TEST_JWT present: True`
- `minutes_remaining > 5`

**Si expired:**
```powershell
bjwt
# Humana aprueba el comando manualmente
# Copiar JWT output a $env:SUPABASE_TEST_JWT
```

---

## 6. Docker Desktop

Verificar que Docker Desktop está corriendo:
```powershell
docker compose ps
```
**Esperado:** todos los containers en estado desired (healthy o exit 0)

---

## 7. Build & Start Backend

```powershell
docker compose build --no-cache planning-service
docker compose up -d
```
**Esperado:** containers subiendo sin errores

---

## 8. Health Checks

```powershell
# Esperar ~15s para que los servicios suban
sleep 15

curl http://localhost:8001/health   # workspace-service
curl http://localhost:8002/health   # collaboration-service
curl http://localhost:8003/health   # planning-service
docker compose ps planning-postgres
```
**Esperado:** `{"status":"ok"}` de cada servicio, postgres "Healthy"

---

## 9. Smoke Test — inmemory

```powershell
cd apps/backend/planning-service
python smoke/planning_api_smoke.py
```
**Esperado:** `SMOKE TEST: ALL CHECKS PASSED` (11 checks)

---

## 10. Smoke Test — postgres (opcional, si se demonstra Postgres persistence)

```powershell
# Recrear planning-service en postgres mode
docker compose stop planning-service
docker compose build --no-cache planning-service
docker compose up -d --force-recreate planning-service
sleep 10

# Ejecutar smoke
cd apps/backend/planning-service
python smoke/planning_api_smoke.py
```
**Esperado:** `SMOKE TEST: ALL CHECKS PASSED`

---

## 11. Persistence After Restart (opcional post-smoke postgres)

```powershell
# Datos ya creados por el smoke anterior
# Reiniciar SOLO planning-service
docker compose stop planning-service
docker compose start planning-service
sleep 10

# Verificar task persiste
curl http://localhost:8003/health  # confirmar service up
# Nota: GET tasks requiere JWT — usar smoke para verificar persistencia
```

---

## 12. S3 (solo si explicitly requested + .env.s3 configurado)

```powershell
# Verificar que .env.s3 existe y está gitignored
bsafeenvs3
```
**Esperado:** `exists: True`, `gitignored: True`

**NO ejecutar comandos S3 sin aprobación explícita del profesor.**

---

## 13. bsecretcheck Final

```powershell
bsecretcheck
```
**Esperado:** `PASS`

---

## 14. Git Status Final

```powershell
git status --short --untracked-files=all
```
**Esperado:** sin output (directorio limpio, sin archivos de demo creados/modificados)

---

## Checklist Summary

| # | Verificación | Pass/Fail |
|---|---|---|
| 1 | git status clean | ☐ |
| 2 | bpreflight PASS | ☐ |
| 3 | bsecretcheck PASS | ☐ |
| 4 | bjwtsafe OK (min remaining > 5) | ☐ |
| 5 | Docker Desktop corriendo | ☐ |
| 6 | docker compose build/up OK | ☐ |
| 7 | Health checks 200 | ☐ |
| 8 | Smoke inmemory ALL PASS | ☐ |
| 9 | Smoke postgres ALL PASS (si aplica) | ☐ |
| 10 | Persistence restart OK (si aplica) | ☐ |
| 11 | S3 solo si requested | N/A |
| 12 | bsecretcheck final PASS | ☐ |
| 13 | git status final clean | ☐ |

**Todas las casillas en PASS = listo para demo.**

---

*Checklist creado: 2026-04-28*
