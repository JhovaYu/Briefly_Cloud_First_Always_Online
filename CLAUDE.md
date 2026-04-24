# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview — Dual State

> **Estado actual del sistema (legacy):** P2P collaborative notes app con Electron 35 + React 19 + TypeScript. El frontend es local-first con Yjs + WebRTC. Supabase solo para auth/metadata.
>
> **Target activo de desarrollo:** Migración cloud-first/always-online sobre AWS Academy Learner Lab. Stack target: Python 3.12 + FastAPI para todos los microservicios REST, pycrdt-websocket para colaboración (pendiente PM-03), Supabase Auth para v1. El frontend PWA se reconecta a cloud-first APIs.
>
> **Nota:** Cuando este documento menciona "frontend", "screens" o "Yjs", se refiere al sistema legacy P2P actual. Cuando menciona `apps/backend/`, se refiere al stack cloud-first en construcción.

## Common Commands

### Desktop App (main focus)
```bash
cd apps/desktop
npm run dev          # Web dev server (localhost:5173)
npm run electron:dev # Full Electron app with hot reload
npm run electron:build # Build .exe installer → apps/desktop/release/
npm run build        # TypeScript compile + Vite build
npm run lint         # ESLint
npm run test         # Vitest (run)
```

### Monorepo
```bash
npm run dev --workspace=apps/desktop  # From root
npm run build --workspaces             # Build all packages
```

### Microservices (apps/*-service)
Each service is Express/TypeScript, built with `tsc`, run with Node:
```bash
cd apps/<service>
npm run build && npm start   # Production
npm run dev                  # Development with ts-node
```

### Shared Package
```bash
cd packages/shared
npm run build  # Compiles TypeScript to dist/
```

## Architecture

### Hexagonal (Ports & Adapters) — desktop

```
apps/desktop/src/
├── core/
│   ├── domain/       → Entities + localStorage CRUD helpers
│   └── ports/        → Interface contracts (NoteRepository, etc.)
├── infrastructure/
│   ├── AppServices.ts         → CollaborationService (P2P orchestrator)
│   ├── network/YjsWebRTCAdapter.ts
│   └── persistence/IndexedDBAdapter.ts
└── ui/
    ├── components/   → Sidebar, SettingsModal, QrModal, etc.
    ├── screens/     → ProfileSetup, HomeDashboard, PoolWorkspace, CalendarScreen, ScheduleScreen, TasksScreen
    └── utils/       → exportHelpers.ts (jszip)
```

### Shared Package (`@tuxnotas/shared`)
```
packages/shared/src/
├── domain/Entities.ts    → Note, Task, Pool, UserProfile types
├── crypto/SeedPhrase.ts → BIP39 identity (local, sovereign)
└── logic/
    ├── IdentityManager.ts → Supabase client singleton
    └── TaskService.ts     → Yjs-backed task CRUD
```

### Screen Router (App.tsx — state-based, no React Router)
```typescript
type Screen =
  | { type: 'profile' }    // ProfileSetup — Login
  | { type: 'dashboard' }   // HomeDashboard — Pool list
  | { type: 'workspace'; poolId: string; poolName: string; signalingUrl?: string }
  | { type: 'calendar' }   // CalendarScreen ✅
  | { type: 'schedule' }   // ScheduleScreen ✅
  | { type: 'tasks' }      // TasksScreen ✅
  | { type: 'notes' }      // ⚠️ placeholder → falls back to PoolWorkspace
  | { type: 'boards' }     // ⚠️ placeholder → falls back to PoolWorkspace
  | { type: 'trash' };     // ⚠️ placeholder → falls back to PoolWorkspace
```

## Design System
- Hand-crafted CSS with variables (NO Tailwind for UI)
- `apps/desktop/src/infrastructure/ui/styles/index.css` — full design tokens
- Two themes: Light (Notion-style) and Dark (Obsidian-style) via `[data-theme="dark"]`
- Settings persisted in `localStorage` (font size, sidebar style, colors)

## Environment Variables
```env
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
VITE_SIGNALING_URL=...  # WebSocket URL for y-webrtc peer discovery
```
Copy `apps/desktop/.env.example` → `apps/desktop/.env`.

## Microservices

### Express/TypeScript (existing)
| Service | Port | Description |
|---|---|---|
| export-service | 3000 | PDF export via PDFKit |
| link-preview-service | 3001 | URL preview scraping |
| qr-service | 8081 | QR code generation |
| text-stats-service | 8082 | Text statistics (zero-deps) |
| ai-summary-service | 8083 | Gemini AI summarization |

All protected by `x-api-key` header (except `GET /health`).

### Python/FastAPI (apps/backend/) — cloud-first migration
| Service | Port | Memory | Description |
|---|---|---|---|
| workspace-service | 8001 | 128m | Workspace and pool management |
| collaboration-service | 8002 | 384m | WebSocket collaborative sync (skeleton) |
| planning-service | 8003 | 128m | Task and schedule management |
| intelligence-service | 8004 | 128m | AI summaries (Gemini deferred) |
| utility-service | 8005 | 256m | QR, preview, text statistics |

Run locally with Docker Compose from root:
```bash
docker compose up -d
```

Nginx reverse proxy on port 80 routes:
- `/api/workspaces/*` → workspace-service
- `/collab/*` → collaboration-service
- `/api/planning/*` → planning-service
- `/api/intelligence/*` → intelligence-service
- `/api/utility/*` → utility-service

All proxied routes require `X-Shared-Secret` header (validated by Nginx).
`/health` and `/healthz` are exempted.

## Key Libraries
- **Yjs 13** — CRDT sync engine
- **y-webrtc 10** — WebRTC transport
- **y-indexeddb 9** — IndexedDB persistence
- **TipTap 3** — rich text editor with `@tiptap/y-tiptap` for Yjs integration
- **Framer Motion 12** — animations
- **Supabase** — auth + cloud metadata

## Code Conventions
- Components/Screens: PascalCase (`PoolWorkspace.tsx`)
- Functions/variables: camelCase
- Types/interfaces: PascalCase
- Screens in `ui/screens/NombreScreen.tsx`
- Navigation via `useState<Screen>` in App.tsx (no React Router)
- Imports from shared: `import { X } from '@tuxnotas/shared'`