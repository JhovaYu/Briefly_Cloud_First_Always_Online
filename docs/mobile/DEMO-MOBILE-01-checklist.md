# DEMO-MOBILE-01 Checklist

**Fecha:** 2026-05-01
**Branch:** `pm-06-mobile-rn`

---

## Checklist antes de demo

### Entorno local

- [ ] Android Studio + emulador准备好了
- [ ] Java y ADB disponibles
- [ ] Dependencias npm instaladas (`cd apps/mobile && npm install`)
- [ ] Repo en `C:\dev\Briefly`

### Infraestructura

- [ ] AWS Learner Lab encendido
- [ ] No-IP hostname `briefly.ddns.net` actualizado a IPv4 pública actual
- [ ] Backend corriendo en `http://briefly.ddns.net`
- [ ] `workspace-service` activo en puerto 8001
- [ ] Supabase Auth accesible con email/password

### App local

- [ ] `apps/mobile/.env` presente (copiado de `.env.example`)
- [ ] `.env` tiene valores válidos (no placeholder, no vacíos)
- [ ] `.env` no está trackeado por git (verificar `.gitignore`)

### Build

- [ ] Prebuild limpio: `npx expo prebuild --platform android --no-install --clean`
- [ ] APK generada: `android/app/build/outputs/apk/debug/app-debug.apk`
- [ ] APK tiene tamaño > 30 MB (JS bundle incluido)
- [ ] `android/` y `app.json` no modificados (verificar con `git status`)

### Validaciones preflight

- [ ] `git status --short --untracked-files=all` → clean
- [ ] Sin archivos sin trackear
- [ ] Sin secretos en archivos no trackeados

---

## Checklist durante demo

### Login y Auth

- [ ] Pantalla de login carga correctamente
- [ ] Login con email/password exitoso
- [ ] Redirect a Home post-login
- [ ] Sesión persiste al cerrar y reabrir app

### Health Checks

- [ ] `GET /health` responde 200
- [ ] `GET /healthz` responde 200
- [ ] UI muestra estado correcto (verde/aprobar)

### Navegación Workspaces

- [ ] Botón "Espacios cloud" visible en Home
- [ ] Lista de workspaces carga desde backend
- [ ] Selección de workspace navega a detalle

### Workspace Detail

- [ ] Detalle del workspace muestra información correcta
- [ ] Botón "Tareas" o acceso a tareas funcional

### Tasks CRUD

- [ ] Lista de tareas carga correctamente
- [ ] **CREATE:** Nueva tarea se crea y persiste
- [ ] **READ:** Tareas existentes visibles
- [ ] **UPDATE:** Toggle done/pending funciona y persiste
- [ ] **DELETE:** Eliminar tarea funciona y persiste
- [ ] Refresco de lista muestra cambios persistidos

### Troubleshooting durante demo

- [ ] Si "Network request failed": verificar `.env` y backend
- [ ] Si timeout: verificar AWS Lab y No-IP
- [ ] Si Metro desconecta: `adb reverse` y reiniciar Expo

---

## Checklist después de demo

### Estado git

- [ ] `git status --short --untracked-files=all` → **DEBE SER LIMPIO**
- [ ] Sin archivos nuevos sin trackear
- [ ] Sin modificaciones en archivos trackeados

### APK y artifacts

- [ ] APK `app-debug.apk` no versionada (NO git add)
- [ ] Directorio `android/` no modificado (o descartado con `git checkout`)

### Criterios PASS

| Criterio | PASS | FAIL |
|---|---|---|
| Git status limpio pre-demo | ✅ | ❌ |
| APK genera sin errores | ✅ | ❌ |
| Login funciona | ✅ | ❌ |
| Health checks responden | ✅ | ❌ |
| Workspaces se listan | ✅ | ❌ |
| Workspace detail accesible | ✅ | ❌ |
| Tasks CREATE funciona | ✅ | ❌ |
| Tasks READ funciona | ✅ | ❌ |
| Tasks UPDATE (toggle) funciona | ✅ | ❌ |
| Tasks DELETE funciona | ✅ | ❌ |
| Persistencia verificada (refresco) | ✅ | ❌ |
| Git status limpio post-demo | ✅ | ❌ |

### Resultado final

**Si todos los criterios PASS:** ✅ **DEMO APROBADA**

**Si algún criterio FAIL:**
1. Documentar cuál criterion falló
2. Investigar causa raíz
3. Corregir si es posible (sin modificar código base)
4. Reprobar sección afectada

---

## Notas de sesión

> Llenar post-demo con observaciones específicas de esta sesión.