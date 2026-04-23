# CONTEXTO DE PROYECTO — BRIEFLY
> Fuente de verdad del proyecto. Si algo aquí contradice el código, el código manda.
> Actualiza este archivo ante cambios arquitectónicos relevantes.

---

## Identidad del Proyecto

- **Nombre**: Briefly (anteriormente TuxNotas)
- **Versión actual**: 1.2.0
- **Equipo**: MasterCoders AI
- **Repositorio**: https://github.com/JhovaYu/Briefly
- **Rama activa de desarrollo**: `feature/tasks-screen`
- **Ramas existentes**:
  - `main` — producción/estable
  - `feature/jhovanny-login-redesign` — redesign UI (login + dashboard) — en pausa
  - `feature/jhovanny-desktop-updates` — updates generales desktop
  - `feature/jhovanny-sync-infrastructure` — infraestructura de sincronización
  - `feature/tasks-screen` — ✅ RAMA ACTIVA — refactor + mejoras UX de TasksScreen
  - `feature/schedule-event-details` — detalles de eventos en ScheduleScreen (remota)
  - `feature/jhovanny-mobile-updates` — updates de app mobile (remota)
  - `claude/determined-elion` — rama auxiliar generada por agente (remota)

---

## Propósito

Briefly es una **aplicación multiplataforma de notas colaborativas en tiempo real**, estilo Notion/Obsidian, con arquitectura **P2P (Peer-to-Peer)** via WebRTC + Yjs CRDT.

**Filosofía central**: cero servidores para datos del usuario. Cada peer es un nodo autónomo con su copia local del documento. La única infraestructura cloud es:
1. **Supabase** — Auth cloud + perfil + sincronización básica de la lista de Pools del usuario hacia su cliente local.
2. **Signaling Server** (AWS, pendiente deploy) — solo peer discovery WebRTC, no relaya datos.

**Sistema de identidad dual**: el usuario puede autenticarse via Supabase Auth (email/Google) O via frase semilla BIP39 (12 palabras, sin servidor, estilo wallet crypto). Ambos flujos coexisten. La identidad BIP39 es completamente local y soberana.

**Contexto académico**: proyecto universitario con requisito de mínimo 5 microservicios.

---

## Plataformas

| Plataforma | Estado | Tech |
|---|---|---|
| Desktop | ✅ Operativo, mejoras activas en TasksScreen | Electron 35 + React 19 + TypeScript |
| Mobile | 🟡 MVP funcional | React Native + Expo + Expo Router |
| Web | 🔮 Futuro latente | — |


> **Detalle Mobile**: Aunque es de menor prioridad, provee un MVP real funcional. Soporta onboarding, gestión de identidad/espacios (basado en IDs y formato ID@IP), conexión WebRTC e integración plena con las librerías compartidas dentro del monorepo (`@tuxnotas/shared`).

---

## Monorepo — Estructura Completa

```text
tux_notas/
├── apps/
│   ├── desktop/ ← APP PRINCIPAL (foco actual)
│   │   ├── electron/main.cjs ← Proceso main de Electron
│   │   ├── src/
│   │   │   ├── App.tsx ← Router state-based (sin React Router)
│   │   │   ├── constants.ts
│   │   │   ├── electron.d.ts ← Tipos para la API expuesta por Electron
│   │   │   ├── core/
│   │   │   │   ├── domain/
│   │   │   │   │   └── UserProfile.ts ← Re-exporta UserProfile/PoolInfo de @tuxnotas/shared
│   │   │   │   │                        + CRUD helpers (getUserProfile, saveUserProfile,
│   │   │   │   │                          getSavedPools, savePools, addPool, removePool,
│   │   │   │   │                          updatePoolLastOpened) sobre localStorage
│   │   │   │   └── ports/
│   │   │   │       └── Ports.ts ← Contratos/interfaces (NoteRepository, etc.)
│   │   │   ├── infrastructure/
│   │   │   │   ├── AppServices.ts ← CollaborationService (orquestador P2P)
│   │   │   │   ├── network/
│   │   │   │   │   └── YjsWebRTCAdapter.ts ← WebRTC ↔ Yjs adapter
│   │   │   │   ├── persistence/
│   │   │   │   │   └── IndexedDBAdapter.ts ← y-indexeddb wrapper
│   │   │   │   └── ui/
│   │   │   │       ├── components/
│   │   │   │       │   ├── Editor.tsx ← Editor TipTap (componente base)
│   │   │   │       │   └── TaskBoard.tsx ← Board de tareas Kanban (componente base)
│   │   │   │       └── styles/
│   │   │   │           └── index.css ← Design system completo (CSS Variables)
│   │   │   └── ui/
│   │   │       ├── components/
│   │   │       │   ├── ContextMenu.tsx
│   │   │       │   ├── EventPopup.tsx
│   │   │       │   ├── InlineRename.tsx
│   │   │       │   ├── NotificationsModal.tsx ← Notificaciones locales (futuro: push)
│   │   │       │   ├── QrModal.tsx ← QR de invitación a Pool
│   │   │       │   └── SettingsModal.tsx ← Config de accesibilidad (fuente, color)
│   │   │       ├── screens/
│   │   │       │   ├── ProfileSetup.tsx (~14KB) ← Login + identidad dual
│   │   │       │   ├── HomeDashboard.tsx (~17KB) ← Dashboard lista de Pools
│   │   │       │   ├── PoolWorkspace.tsx (~29KB) ← Editor colaborativo P2P. OPERATIVO
│   │   │       │   ├── CalendarScreen.tsx (~17KB) ← Vista calendario. ✅ ENTREGADO
│   │   │       │   ├── ScheduleScreen.tsx (~37KB) ← Tabla horario semanal. OPERATIVO
│   │   │       │   └── TasksScreen.tsx (~47KB) ← Lista/Kanban de tareas. ✅ OPERATIVO
│   │   │       └── utils/
│   │   │           └── exportHelpers.ts ← jszip: exportNoteAs (txt/md), exportAllPoolAsZip
│   │   └── package.json ← v1.2.0, nombre: "Briefly"
│   │
│   ├── mobile/ ← MVP FUNCIONAL
│   │   ├── app/ ← Expo Router (file-based routing)
│   │   ├── src/
│   │   │   ├── AppContext.tsx
│   │   │   ├── constants.ts
│   │   │   ├── polyfills.ts
│   │   │   └── storage.ts
│   │   └── shims/
│   │
│   └── signaling/ ← WRAPPER (sin código custom)
│       └── package.json ← start: "node node_modules/y-webrtc/bin/server.js"
│
├── packages/
│   └── shared/ ← @tuxnotas/shared (librería interna)
│       └── src/
│           ├── index.ts ← Barrel export de todo
│           ├── domain/
│           │   ├── Entities.ts ← Tipos: Note, Notebook, Task, TaskState, TaskPriority,
│           │   │                         TaskList, TaskListPreference, Pool, Peer,
│           │   │                         UserProfile, PoolInfo
│           │   └── Identity.ts ← Interface Identity {type, userId, seedPhrase?,
│           │                      encryptionKey?, syncPoolId?, email?, token?}
│           ├── crypto/
│           │   └── SeedPhrase.ts ← Motor BIP39: generate(), isValid(),
│           │                       deriveCredentials() → {userId, syncPoolId, encryptionKey}
│           └── logic/
│               ├── TaskService.ts ← CRUD de tareas sobre Y.Map de Yjs:
│               │                    createTaskList, getTaskLists, addTask, updateTask,
│               │                    deleteTask, deleteTaskList, getTasks
│               └── IdentityManager.ts ← Singleton: initializeCloud(url, key),
│                                        cloudClient (getter → SupabaseClient | null)
│
├── contexto.md ← ESTE ARCHIVO
└── README.md
```

---

## Stack Tecnológico Completo

### Lenguajes
- **TypeScript ~5.9** — estricto en toda la app desktop y shared
- **JavaScript** — configs, scripts, signaling wrapper

### Core (Desktop)
- **React 19** — componentes funcionales + hooks, sin estado global.
- **Electron 35** — wrapper desktop, build NSIS para Windows.
- **Vite 7** — bundler + dev server.

### Editor de Notas
- **TipTap 3** + `@tiptap/y-tiptap` — editor rich text con colaboración.
  - Extensions activas: StarterKit, Table, TaskList, TaskItem, Collaboration, CollaborationCursor.

### Sincronización P2P
- **Yjs 13** — CRDT engine, cada Pool es un `Y.Doc`.
- **y-webrtc 10** — transport WebRTC entre peers.
- **y-indexeddb 9** — persistencia offline-first del `Y.Doc` (IndexedDB, NO SQLite).
- **y-prosemirror** — binding Yjs ↔ base de TipTap.

### Identidad y Auth (Dual)
- **BIP39 / SHA256** (local, `packages/shared/src/crypto/SeedPhrase.ts`)
  - Genera frase de 12 palabras → deriva `userId` + `syncPoolId` + `encryptionKey`.
  - Sin servidor. Soberanía total del usuario.
- **Supabase** (cloud, via `IdentityManager.cloudClient`)
  - Email/password + Google OAuth.
  - Tablas: `profiles` (`id`, `username`, `full_name`, `color`), `user_pools` (`user_id`, `pool_id`, `pool_name`).
  - Inicialización: `IdentityManager.initializeCloud(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)` en App.tsx.

### Design System (Hand-crafted, SIN Tailwind)
- **CSS Variables puras** en `infrastructure/ui/styles/index.css`
- **Dos temas**: Light (estética Notion) y Dark (estética Obsidian, `[data-theme="dark"]`).
- **Token categories**:
  - `--bg-*` — fondos por capa (primary, secondary, sidebar, hover, modal, card).
  - `--text-*` — niveles (primary, secondary, tertiary, placeholder) + `--custom-text-color`.
  - `--font-ui` — Inter/Roboto (interfaz).
  - `--font-editor` — Georgia/Times New Roman (editor, estilo Notion).
  - `--font-size-multiplier` — zoom global gestionado desde root (html) vía JS.
- **Persistencia de settings**: `localStorage` (`app-font-size`, `app-sidebar-style`, `app-custom-colors`, `app-font-color`).

### UI Auxiliar
- **Framer Motion 12** — animaciones y transiciones.
- **Lucide React 0.563** — íconos SVG (usados en Web/Desktop)
- **clsx** — manejo de clases condicionales (sin Tailwind, solo CSS custom)
- **tailwind-merge 3** — utilidad para merge de clases (instalada, uso auxiliar).
- **qrcode** — generación QR para invitar a Pools.
- **jszip** — exportación de notas a ZIP/MD/TXT (✅ conectado en `ui/utils/exportHelpers.ts`).
- **react-force-graph-2d** — visualización de red/grafo de notas (instalado, pendiente de conectar).
- **vite-plugin-node-polyfills** — polyfills para APIs Node.js en el contexto del navegador/Vite.

### Mobile
- **Expo + Expo Router** — navegación file-based robusta.
- **Ionicons** — para mobile icons native.
- Componentes funcionales, hooks, y acceso sin fricciones a base de código compartida (`@tuxnotas/shared`).

### Dev & Calidad
- **Vitest 4 + Testing Library** — tests (UI & Unit).
- **ESLint 9** — linting (Reglas estrictas y React hooks config).
- **electron-builder 26** — empaquetado y deployment NSIS Windows.
- **concurrently + wait-on** — workflow de dev: Vite + Electron simultáneos.

---

## Arquitectura: Hexagonal (Ports & Adapters)

- **CORE** (reglas de negocio, sin dependencias externas):
  - `domain/Entities.ts` → qué es una Note, una Task, un Pool.
  - `domain/Identity.ts` → qué es una Identity.
  - `core/domain/UserProfile.ts` → helpers CRUD de `UserProfile` y `PoolInfo` sobre localStorage.
  - `ports/` → contratos para implementación local y remota.

- **INFRASTRUCTURE** (implementaciones concretas):
  - `AppServices.ts` → CollaborationService: orquesta Yjs + WebRTC + IndexedDB.
  - `network/` → YjsWebRTCAdapter: manejo nativo a `y-webrtc`.
  - `persistence/` → IndexedDBAdapter: envoltorio de `y-indexeddb`.
  - `ui/components/` → Editor.tsx (TipTap base), TaskBoard.tsx (Kanban base).
  - `ui/styles/` → Design system en CSS Vars.

- **UI** (presentación, consume infrastructure):
  - `screens/` → Componentes de página completa.
  - `components/` → Piezas de UI modulares y reutilizables.
  - `utils/exportHelpers.ts` → Lógica de exportación (jszip).

---

## Router de Pantallas (`App.tsx` — state-based)

```typescript
type Screen =
  | { type: 'profile' }     // ProfileSetup — Login/registro
  | { type: 'dashboard' }   // HomeDashboard — lista de Pools
  | { type: 'workspace'; poolId: string; poolName: string; signalingUrl?: string }
  | { type: 'calendar' }    // CalendarScreen ✅
  | { type: 'notes' }       // ⚠️ PLACEHOLDER — cae al fallback de PoolWorkspace
  | { type: 'tasks' }       // TasksScreen ✅
  | { type: 'schedule' }    // ScheduleScreen ✅
  | { type: 'boards' }      // ⚠️ PLACEHOLDER — cae al fallback de PoolWorkspace
  | { type: 'trash' };      // ⚠️ PLACEHOLDER — cae al fallback de PoolWorkspace
```

> **Nota**: Las pantallas `notes`, `boards` y `trash` aún no tienen screen propia.
> El fallback en App.tsx las redirige a `PoolWorkspace` con poolId/poolName vacíos.

### Inicialización de App.tsx
1. `IdentityManager.initializeCloud(url, key)` — si existen las vars de entorno.
2. `personalDocRef` — `Y.Doc` en memoria para tareas personales.
3. `YjsIndexedDBAdapter.initialize('briefly-personal-doc')` — persiste el doc personal en IndexedDB.
4. `sb.auth.getSession()` — detecta sesión Supabase activa → autoLogin.
5. `sb.auth.onAuthStateChange()` — listener reactivo de cambios de auth.

---

## Flujo de Colaboración P2P
```text
Usuario abre Pool
│
▼
CollaborationService.joinPool(poolId)
 ├── crea Y.Doc
 ├── IndexedDBAdapter.load(poolId) ← restaura estado local previo
 └── YjsWebRTCAdapter.connect(room) ← conecta al room WebRTC
│
▼
Signaling Server (y-webrtc built-in, deploy AWS pendiente)
(solo provee peer matching e IP resolution; NADA DE DATOS en base de datos central)
│
▼
Conexiones ICE/STUN directas entre pares
(Yjs reconcilia cambios off-line / on-line en automático mediante CRDT)
```

---

## Componentes y Modales — Detalle

### `QrModal.tsx`
- Genera un QR con el identificador del Pool empleando string con formato: `pool-{id}@{IP}`.
- Es la vía preferente actual para conectar otro par móvil a un nodo Desktop.
- Pendiente: Habilitar una caja de texto copiables estándar para share code manual.

### `SettingsModal.tsx`
- **Accesibilidad**: Define settings de CSS via `localStorage` (como `--font-size-multiplier`).
- **Personalización de Interfaz**: Elección layout del sidebar (Header vs Floating Botón). Soporte incipiente para agregar arrays de colores custom `app-custom-colors`.
- **Pendientes**: Switch Dark/Light explícito, config de URL para Signal Server, Localization (Idioma), Config de perfil de usuario.

### `NotificationsModal.tsx`
- Notificaciones 100% locales construidas en base a eventos de calendario/Recordatorios internos.
- Extensión planificada Desktop/Mobile via Push nativos.

### `ScheduleScreen.tsx`
- Vista matricial completa de Horarios / Schedule tracker.
- Tareas futuras incluyen output PDF / JPG de la tabla via bibliotecas exportables.

### `exportHelpers.ts` (ui/utils/)
- `getNoteContentAsText(doc, noteId)` — extrae texto plano de un `Y.XmlFragment`.
- `exportNoteAs(doc, note, 'txt'|'md')` — descarga nota individual en formato TXT o MD.
- `exportAllPoolAsZip(doc, notes, notebooks, poolName)` — empaqueta todo el Pool en un ZIP,
  organizando notas por cuadernos dentro de carpetas.

---

## Microservicios (Requisito Académico — mínimo 5)

El proyecto implementa **9 microservicios** diferenciados. Los primeros 3 operan vía Supabase (BaaS).
Los 6 restantes son microservicios HTTP independientes con Express/TypeScript, containerizados con Docker,
y protegidos por header `x-api-key`.

| # | Servicio | Puerto | Tecnología | Estado |
|---|---|---|---|---|
| 1 | Auth Service | — | Supabase Auth (email + Google OAuth) | ✅ Operativo |
| 2 | Profile Service | — | Supabase tabla `profiles` | ✅ Operativo |
| 3 | Pool Registry Service | — | Supabase tabla `user_pools` | ✅ Operativo |
| 4 | Signaling Service | — | y-webrtc server — Railway | ✅ Operativo |
| 5 | Export Service | 3000 | Express + PDFKit — Docker — AWS EC2 | ✅ Operativo |
| 6 | Link Preview Service | 3001 | Express + Cheerio — Docker | ✅ Build OK (pendiente deploy) |
| 7 | QR Service | 8081 | Express + qrcode — Docker | ✅ Build OK (pendiente deploy) |
| 8 | Text Stats Service | 8082 | Express (zero-deps) — Docker | ✅ Operativo local (smoke test OK) |
| 9 | AI Summary Service | 8083 | Express + Google Gemini 1.5-flash — Docker | ✅ Build OK (pendiente deploy) |

> **Seguridad**: Todos los endpoints protegidos requieren `x-api-key`. El `GET /health` es siempre público.
> Variables de entorno requeridas: `API_KEY` (todos), `GEMINI_API_KEY` (servicio 9).
>
> **Restricción de memoria EC2 t3.micro**: Los Dockerfiles usan `CMD ["node", "--max-old-space-size=128", "dist/index.js"]`
> para limitar el heap de Node a 128MB por servicio y evitar OOM en instancias con 1GB de RAM.


---

## Estado por Pantalla

| Pantalla | Archivo | Tamaño aprox | Estado |
|---|---|---|---|
| Login / Perfil | `ProfileSetup.tsx` | ~14KB | ✅ Operativo (redesign pendiente de retomar) |
| Dashboard | `HomeDashboard.tsx` | ~17KB | ✅ Operativo (redesign pendiente de retomar) |
| Editor P2P | `PoolWorkspace.tsx` | ~29KB | ✅ Operativo |
| Calendario | `CalendarScreen.tsx` | ~17KB | ✅ Entregado al profesor |
| Horario Semanal | `ScheduleScreen.tsx` | ~37KB | ✅ Operativo |
| Tareas | `TasksScreen.tsx` | ~47KB | ✅ Operativo (Lista/Kanban, P2P, IndexedDB, UX refinado) |

---

## ⚠️ Recordatorio de Feedback del Profesor

> El Dashboard debe ser **más gráfico, menos texto, más visual**. El diseño actual se percibe denso.
> **Aplicar al final**, una vez terminadas las features principales (Desktop Updates y Auth Flow).

---

## Convenciones de Código

- **Componentes/Screens**: PascalCase (`HomeDashboard`, `PoolWorkspace`).
- **Funciones/variables**: camelCase (`handleOpenPool`, `userProfile`).
- **Tipos/interfaces**: PascalCase (`UserProfile`, `Screen`, `PoolInfo`).
- **Archivos de screen**: `NombreScreen.tsx`.
- **Navegación**: Modificación de estado via `useState<Screen>` en `App.tsx` (Sin React Router Desktop).
- **Estado Global**: Nulo (Sin Redux/Zustand), props-drilling limitado e Identity Manager local.
- **Variables de entorno**: Prefijo `VITE_` en `.env`.
- **Importaciones shared**: `import { [Pieza] } from '@tuxnotas/shared'`.
- **Design System**: Hand-crafted CSS classes & variables. Cero TailwindCSS para customización P2P ilimitada.

---

## Pendientes Técnicos

- [ ] [ALTA] Implementar Export Service como microservicio HTTP (Node/Express + jszip) con Docker, exponer endpoints REST para exportar notas a PDF y MD.
- [ ] [ALTA] Deploy Signaling Service en AWS EC2 con Docker.
- [ ] Retomar redesign `ProfileSetup` + `HomeDashboard` (rama `feature/jhovanny-login-redesign`).
- [ ] Implementar screens propias: `notes`, `boards`, `trash` (actualmente caen al fallback de PoolWorkspace).
- [ ] Conectar `react-force-graph-2d` para una visualización al estilo de Obsidian Graph.
- [ ] SettingsModal: Extender con selector DarkMode verdadero, custom IP signal e info de perfil.
- [ ] QrModal: Incluir el ID de texto simple para copiar.
- [ ] ScheduleScreen: Permitir compartir o exportar horarios individualmente como Imagen.
- [ ] Notificaciones nativas Electron/Mobile en Desktop Push.
- [ ] **Feedback Profesor:** Revisitar el Dashboard final agregando un carácter visual extra (iconografía, gráficos circulares estilo Notion/stats).
- [ ] App Mobile: Pulir el Workspace (`[poolId].tsx`).
- [ ] Deuda Técnica: Refactorizar TasksScreen.tsx (monolito de ~47KB) dividiéndolo en componentes más pequeños dentro de ui/components/tasks/.

---

## Contexto Académico — Revisión Alfaro (Taller de Desarrollo)

### Planteamiento original vs. implementación real

El planteamiento formal entregado al profesor propuso:
- Backend: FastAPI + Python + PostgreSQL + RabbitMQ
- Frontend: Next.js 14
- Infraestructura: Docker + Kubernetes + AWS S3

La implementación evolucionó hacia una arquitectura P2P-first:
- Backend: Supabase (BaaS) + y-webrtc Signaling (AWS)
- Frontend: Electron 35 + React 19 (Desktop) + React Native (Mobile)
- Persistencia: IndexedDB (local) + Supabase (cloud sync de metadatos)

Esta divergencia es una decisión arquitectónica documentada, no un desvío.
La arquitectura hexagonal (Ports & Adapters) se implementó en el cliente
desktop, no en servicios FastAPI separados. Los 5 microservicios del
requisito académico se cubren con Supabase (3 servicios) + Signaling AWS
(1 servicio) + Export Service pendiente (1 servicio).

### Microservicios demostrables para revisión

Para la revisión del profesor, los puntos de demostración son:
1. **Auth + Google OAuth**: flujo de login en la app (Supabase Auth)
2. **Profile Service**: tabla `profiles` visible en Supabase dashboard
3. **Pool Registry**: tabla `user_pools` visible en Supabase dashboard
4. **Signaling Service**: demostrar conexión P2P entre dos instancias
   de la app usando el servidor en AWS
5. **CRDT Sync**: edición colaborativa en tiempo real entre dos peers
