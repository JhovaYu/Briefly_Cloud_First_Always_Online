# PM-06 — Mobile (React Native) Plan

**Fecha:** 2026-04-30
**Proyecto:** Briefly — mobile Android APK
**Stack:** Expo 54 + React Native 0.81.5 + Expo Prebuild (bare Android)

---

## Estado Actual

- `apps/mobile/` existe con Expo + React Native preconfigurado
- Dependencias clave ya instaladas: expo, expo-router, expo-secure-store, react-native, @tuxnotas/shared
- Health check screen implementado en `app/index.tsx`
- APK prebuild listo para generar

---

## Fases

| Fase | Descripción | Entregable |
|---|---|---|
| **PM-06B** | Expo Prebuild skeleton + health check | ✅ `app/index.tsx` health screen, `app.json` configurado |
| **PM-06C** | Auth email/password + Supabase session | ✅ Login screen (`login.tsx`), session persistence via expo-secure-store + `@supabase/supabase-js`, `AuthProvider`/`useAuth` in `AuthContext.tsx`, `index.tsx` redirects based on session, `home.tsx` shows user + health checks + logout |
| **PM-06C2** | Google OAuth (POST DEPLOY-01D HTTPS) | OAuth flow con deep links `briefly://` |
| **PM-06D** | Tasks cloud CRUD | ✅ PM-06D DONE — PlanningApiClient + tasks screen completo + workspaceClient.ts + home.tsx botón Tareas |
| **PM-06E** | Pools/Workspaces read | ✅ PM-06E DONE — workspaces.tsx list, workspace-detail.tsx with tasks button, home.tsx "Espacios cloud" button, workspaceId param in tasks.tsx. Pool (P2P/Yjs) != Workspace (cloud REST) — `[poolId].tsx` remains P2P, not cloud. No update/delete workspace endpoints in backend.
| **PM-06F** | Schedule/Calendar UI | ScheduleAdaptado de web |
| **PM-06G** | Android widgets prototype | TaskWidget + ScheduleWidget en kotlin nativo |

---

## Riesgos

### HTTP Cleartext (Temporal)

**Problema:** Android 9+ bloquea HTTP cleartext por defecto.

**Mitigación:** Configurar `network_security_config.xml` en el proyecto Android generado por prebuild, permitiendo cleartext solo para `briefly.ddns.net`.

**Archivo a crear/modificar:**
```
apps/mobile/android/app/src/main/res/xml/network_security_config.xml
```

**Contenido mínimo:**
```xml
<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
  <domain-config cleartextTrafficPermitted="true">
    <domain includeSubdomains="true">briefly.ddns.net</domain>
  </domain-config>
</network-security-config>
```

**Nota:** Esto es temporal. DEPLOY-01D (HTTPS hardening) eliminará la necesidad de cleartext.

### Google OAuth (Requiere HTTPS o Flujo Nativo)

**Problema:** Google OAuth API en Android requiere HTTPS para el redirect URI en producción.

**Opciones:**
1. Postergar Google OAuth a después de DEPLOY-01D (HTTPS)
2. Usar OAuth con custom scheme `briefly://` + expo-browser + HTTPS

**Recomendación:** PM-06C con email/password; Google OAuth como PM-06C2 post-HTTPS.

### Widgets Android Nativos

**Problema:** Widgets Android requieren archivos Java/Kotlin nativos y no son compatibles con Expo managed workflow.

**Mitigación:** Usar Expo prebuild para acceder a `android/` nativo. PM-06G como fase separada con archivos kotlin/java.

**Arquitectura para widgets:**
1. RN app escribe JSON de tasks a `SharedPreferences` o archivo en `filesDir`
2. Widget Android (kotlin) lee archivo + `AppWidgetProvider`
3. RemoteViews renderiza interfaz simple

---

## Dependencias Existentes

```json
"expo": "~54.0.33",
"react-native": "0.81.5",
"expo-router": "~6.0.23",
"expo-secure-store": "~15.0.8",
"@tuxnotas/shared": "*"
```

## Build Commands

```bash
cd apps/mobile

# Prebuild Android (genera android/ nativo)
npx expo prebuild --platform android

# Build debug APK
cd android && ./gradlew assembleDebug

# O directamente
npx expo run:android
```

---

## App Config (app.json)

```json
{
  "expo": {
    "name": "Briefly",
    "slug": "briefly-mobile",
    "scheme": "briefly",
    "android": {
      "package": "com.briefly.mobile"
    }
  }
}
```

---

## Notas

- Monorepo npm workspaces ya configurado en raíz (`apps/*`)
- `@tuxnotas/shared` accesible desde `apps/mobile` vía workspace
- API clients (`PlanningApiClient`, `WorkspaceService`) reutilizables desde `packages/shared/src/logic/`
- Supabase session via `expo-secure-store` + `@supabase/supabase-js`
