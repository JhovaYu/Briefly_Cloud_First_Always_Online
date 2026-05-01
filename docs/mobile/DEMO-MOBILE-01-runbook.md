# APEX PRIME — DEMO-MOBILE-01: Mobile APK Demo Runbook

**Fecha:** 2026-05-01
**Branch:** `pm-06-mobile-rn`
**Último commit:** `80fa667 PM-06E implement Workspaces read MVP`
**Backend:** http://briefly.ddns.net (HTTP, no HTTPS)
**Stack:** Expo 54 + React Native 0.81.5 + Expo Prebuild (bare Android)

---

## 1. Prerrequisitos

### 1.1 Entorno local

- [ ] Android Studio instalado con emulador/configurado ADB
- [ ] Java disponible en PATH (`java -version`)
- [ ] ADB disponible (`adb version`)
- [ ] Repo clonado en ruta corta: `C:\dev\Briefly`
- [ ] Dependencias npm instaladas en `apps/mobile/`

### 1.2 Infraestructura externa

- [ ] AWS Learner Lab encendido y con IP válida
- [ ] No-IP hostname `briefly.ddns.net` apuntando a la IPv4 pública actual
- [ ] `workspace-service` corriendo en puerto 8001 del backend
- [ ] Supabase Auth configurado con email/password (proyecto existente)

### 1.3 App local

- [ ] `apps/mobile/.env` presente (copiado de `.env.example`, **NO commiteado**)
- [ ] Variables requeridas en `.env`:
  - `EXPO_PUBLIC_SUPABASE_URL`
  - `EXPO_PUBLIC_SUPABASE_ANON_KEY`
  - `EXPO_PUBLIC_BACKEND_URL=http://briefly.ddns.net`
  - `EXPO_PUBLIC_WORKSPACE_SERVICE_URL=http://briefly.ddns.net:8001`
  - `EXPO_PUBLIC_PLANNING_SERVICE_URL=http://briefly.ddns.net:8003`
- [ ] Android build previo borrado si existe (`apps/mobile/android/app/build/`)

---

## 2. Validaciones seguras (preflight)

> **IMPORTANTE:** Nunca imprimas, copies ni reveles valores de .env, keys, tokens o passwords.

### 2.1 Verificar que no haya secretos fugados

```bash
# Si bsecretcheck está disponible:
bsecretcheck

# Alternativa manual: buscar patrones de secretos en archivos no trackeados
git status --short --untracked-files=all
```

**Esperado:** Sin archivos nuevos. Solo archivos ya trackeados o `.env` ya en .gitignore.

### 2.2 Verificar .env por presencia (sin leer valores)

```bash
# Verificar que .env existe
ls -la apps/mobile/.env

# Verificar tamaño > 0 (tiene contenido)
wc -c apps/mobile/.env

# NO usar: cat, type, Get-Content con contenido visible
# NO verificar valores específicos
```

### 2.3 Verificar git status limpio

```bash
git status --short --untracked-files=all
```

**Esperado:** Sin cambios, sin archivos sin trackear.

---

## 3. Build

### 3.1 Prebuild Android (genera android/ nativo)

```bash
cd apps/mobile
npx expo prebuild --platform android --no-install --clean
```

> **Nota:** `android/` y `app.json` **NO deben commitearse**. Si aparecen como modificados, descartarlos con `git checkout --`.

### 3.2 Assemble Debug APK

```bash
cd apps/mobile/android
.\gradlew assembleDebug
```

**Salida esperada:**
```
android/app/build/outputs/apk/debug/app-debug.apk
```

### 3.3 Verificar APK generada

```bash
ls -lh apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

**Tamaño esperado:** > 30 MB (indica que Bundled JS está incluido).

---

## 4. Ejecutar en emulador

### 4.1 Iniciar Metro bundler

```bash
cd apps/mobile
npx expo start --dev-client --host localhost --clear
```

### 4.2 Configurar ADB reverse

```bash
adb reverse tcp:8081 tcp:8081
```

### 4.3 Instalar APK

```bash
adb install -r apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk
```

### 4.4 Lanzar app

```bash
adb shell monkey -p com.briefly.mobile 1
```

> **Alternativa manual:** Abrir emulador, buscar app "Briefly", tocar icono.

---

## 5. Flujo demo

### 5.1 Login

1. Pantalla de login cargada (logo Briefy + email/password)
2. Ingresar credenciales Supabase válidas
3. Tocar "Iniciar sesión"
4. **Esperado:** Redirect a Home tras login exitoso

### 5.2 Health checks

1. En Home, sección "Health Checks" (o similar)
2. Verificar que responds:
   - `GET /health` del backend
   - `GET /healthz` del backend
3. **Esperado:** Ambos responden 200 OK

### 5.3 Workspaces (Espacios cloud)

1. Desde Home, tocar botón "Espacios cloud" o "Workspaces"
2. **Esperado:** Lista de workspaces del backend
3. Seleccionar un workspace

### 5.4 Workspace detail

1. Ver detalle del workspace seleccionado
2. Botón o acceso a "Tareas" del workspace
3. **Esperado:** Navegación funcional

### 5.5 Ver tareas

1. Lista de tareas del workspace
2. **Esperado:** Tareas existentes visibles (si hay datos previos)

### 5.6 Crear tarea

1. Tocar botón "+" o "Nueva tarea"
2. Ingresar título y opcionalmente descripción
3. Guardar
4. **Esperado:** Tarea aparece en lista, persiste en backend

### 5.7 Toggle done/pending

1. Tocar checkbox o botón de completar en una tarea
2. **Esperado:** Tarea marcada como completada, estado persiste al recargar

### 5.8 Borrar tarea

1. Tocar botón eliminar en una tarea existente
2. Confirmar eliminación
3. **Esperado:** Tarea eliminada de lista y backend

### 5.9 Verificar persistencia

1. Refrescar pantalla de tareas
2. Verificar que cambios persisten:
   - Nueva tarea creada visible
   - Tarea completada sigue completada
   - Tarea borrada no reaparece

---

## 6. Troubleshooting

### 6.1 "Network request failed" al hacer login o API calls

**Causa probable:** `.env` con valores placeholder o vacíos.

**Solución:**
1. Verificar que `.env` existe y tiene valores no-vacíos
2. Verificar que las URLs usan `http://` no `https://` (HTTP temporal)
3. Reiniciar Metro: `npx expo start --clear`

### 6.2 AWS Learner Lab apagado / No-IP desactualizada

**Síntoma:** Timeout o "Network request failed" en todas las llamadas.

**Solución:**
1. Verificar que AWS Lab está encendido
2. Verificar IPv4 pública actual: `curl ifconfig.me`
3. Actualizar No-IP hostname manualmente
4. Reintentar tras 2-5 minutos (propagación DNS)

### 6.3 Expo dev client URL / Metro no conecta

**Síntoma:** App se cierra o muestra pantalla roja.

**Solución:**
1. Verificar que `adb reverse tcp:8081 tcp:8081` está activo
2. Verificar que Metro bundler está corriendo en puerto 8081
3. Si Metro está en otra terminal, verificar `--host localhost` en comando

### 6.4 adb reverse falla

**Síntoma:** `adb: error: device not found` o similar.

**Solución:**
1. Verificar que emulador está corriendo: `adb devices`
2. Verificar que emulador tiene API level suficiente
3. Reiniciar ADB: `adb kill-server && adb start-server`

### 6.5 Android root prebuild accidental

**Problema:** Archivos `android/` y `app.json` modificados tras prebuild.

**Causa:** `expo prebuild` modifica archivos que están siendo trackeados.

**Solución:**
```bash
git checkout -- android/ app.json
```

**Prevención:** `git status --short` después de cada prebuild.

### 6.6 Linking warning expo-router

**Síntoma:** Warning en consola sobre `expo-router` linking.

**Impacto:** **No bloqueante.** Estos warnings son comunes y no afectan la funcionalidad demo.

---

## 7. Riesgos conocidos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| HTTP cleartext | Android 9+ bloquea HTTP por defecto | `network_security_config.xml` ya configurado permitiendo `briefly.ddns.net` |
| AWS Learner Lab cambia IP al reiniciar | Backend inaccesible | Actualizar No-IP hostname manualmente post-reinicio |
| workspace-service puede ser in-memory | Datos no persisten tras reinicio | Verificar que workspace-service tiene persistencia o no importa para demo |
| Google OAuth pendiente | Solo email/password disponible | OK para demo actual |
| Widgets Android pendientes | No disponibles en esta fase | Roadmap PM-06G |
| Horarios/Screen pendientes | Solo Tasks + Workspaces funcional | OK para demo actual |

---

## 8. Post-demo cleanup

1. **NO hacer `git add`** de ningún archivo nuevo o modificado
2. **NO hacer commit**
3. **NO hacer push**
4. **NO versionar APK** (`app-debug.apk` no debe commitearse)

Para verificar estado final:

```bash
git status --short --untracked-files=all
```

**Esperado:** Sin cambios.