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
| **PM-06F** | Schedule/Calendar UI | ✅ PM-06F.DB PASS — Desktop/Mobile Schedule cloud parity + PostgreSQL persistence en EC2. Schedule sobrevive reinicio de contenedor. |
| **PM-06G** | Android Quick Actions + Today Dashboard | ✅ PM-06G.1 PASS (Today Dashboard), PM-06G.2 PASS (Quick Actions), PM-06G.3 pendiente |
| **PM-06G.1** | Today Dashboard — screen con summary diario | ✅ PASS — `app/today.tsx` + `hooks/useTodaySummary.ts`, muestra próximo schedule block + tareas pendientes + quick actions |
| **PM-06G.2** | Android Quick Actions (App Shortcuts) | ✅ PASS — expo-quick-actions@6.0.1, 3 acciones: Hoy→/today, Tareas→/tasks, Horario→/schedule. Sin android/ manual. |
| **PM-06G.3** | Android Widget real | �.Future — Requiere react-native-android-widget o config plugin, riesgo alto con Expo prebuild, postergado |

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

### PM-06G — Android Quick Actions + Widget Prototype

**Decisión arquitectónica (2026-05-03):** Se prioriza Quick Actions + Today Dashboard sobre widget Android real.

**Razones:**
1. Widget Android real requiere config plugin o modificaciones manuales a `android/` — riesgo alto de romper Expo prebuild.
2. Quick Actions dan acceso directo a pantallas existentes sin cambios nativos.
3. Today Dashboard ofrece la misma utilidad de "resumen diario" sin complejidad de widget.
4. Widget real queda documentado como PM-06G.3 para futuro.

**PM-06G.1 — Today Dashboard:** `app/today.tsx` + `hooks/useTodaySummary.ts`. Muestra próximo schedule block del día, contador de tareas pendientes, top 3 tareas, botones de navegación rápida.

**PM-06G.2 — Android Quick Actions:** expo-quick-actions@6.0.1. Tres acciones registradas en `_layout.tsx`:
- "Hoy" → `/today` (Today Dashboard)
- "Tareas" → `/tasks`
- "Horario" → `/schedule`

Cold start: quick action guardada en `QuickActions.initial`, navegación diferida 500ms para esperar restauración de sesión AuthContext. Warm start: listener `QuickActions.addListener` navega en cada invocación.

**PM-06G.3 — Widget real:** Postergado. Opciones técnicas identificadas:
- `react-native-android-widget` + expo-config-plugin
- Modificaciones manuales a `android/` (expuesto a sobreescritura por expo prebuild)
- Requiere investigación de compatibilidad con Expo 54 + RN 0.81.

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
