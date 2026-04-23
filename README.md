<div align="center">

<img src="apps/desktop/public/logo.png" alt="Briefly Logo" width="80" />

# Briefly

**Notas colaborativas P2P en tiempo real — sin servidores centrales**

> Inspirado en Notion y Obsidian. Tu información viaja directo entre dispositivos, nunca por un servidor ajeno.

[![Version](https://img.shields.io/badge/version-1.2.0-4f98a3?style=flat-square)](https://github.com/JhovaYu/Briefly)
[![Electron](https://img.shields.io/badge/Electron-35-47848F?style=flat-square&logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178C6?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Auth-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)](LICENSE)

[Características](#-características) · [Arquitectura](#-arquitectura) · [Instalación](#-instalación) · [Microservicios](#-microservicios) · [Roadmap](#-roadmap)

</div>

---

## ¿Qué es Briefly?

Briefly es una **aplicación multiplataforma de notas colaborativas** disponible en Desktop (Windows) y con versión Mobile en desarrollo. Permite que múltiples usuarios editen el mismo documento simultáneamente, en tiempo real, conectándose **directamente entre sí** mediante tecnología P2P (Peer-to-Peer).

A diferencia de herramientas como Notion o Google Docs, **Briefly no enruta tu información por servidores centrales**. Los cambios viajan de dispositivo a dispositivo usando WebRTC, garantizando privacidad, baja latencia y costos de infraestructura mínimos.

```
Usuario A ──────────────────────────── Usuario B
    │          WebRTC (P2P directo)          │
    │◄──────────────────────────────────────►│
    │                                         │
    └──── Signaling Server (AWS) ────────────┘
         Solo para el primer "encuentro"
```

---

## ✨ Características

| Característica | Estado |
|---|---|
| Editor de texto enriquecido (headings, tablas, listas, tasks) | ✅ Operativo |
| Colaboración P2P en tiempo real entre redes distintas | ✅ Operativo |
| Persistencia local automática (sin internet) | ✅ Operativo |
| Login con email y Google OAuth | ✅ Operativo |
| Sistema de Pools (espacios de trabajo colaborativos) | ✅ Operativo |
| Vista Calendario con persistencia | ✅ Operativo |
| Vista Horario semanal | ✅ Operativo |
| Modo oscuro / claro | ✅ Operativo |
| Instalador de escritorio (.exe) | ✅ Operativo |
| App Mobile (React Native) | 🚧 En desarrollo |
| Exportación de notas (PDF / Markdown) | 📋 Pendiente |
| Vista de grafo de conocimiento | 📋 Pendiente |

---

## 🏗 Arquitectura

Briefly usa una **arquitectura hexagonal (Ports & Adapters)** que separa completamente la lógica de negocio de los detalles de implementación (base de datos, red, UI).

```
tux_notas/
├── apps/
│   ├── desktop/          → App principal: Electron 35 + React 19 + TypeScript
│   ├── mobile/           → App móvil: React Native (en desarrollo)
│   └── signaling/        → Servidor de encuentro WebRTC (AWS)
└── packages/
    └── shared/           → @tuxnotas/shared — IdentityManager, Supabase client
```

### Capa de dominio (desktop)

```
src/
├── core/
│   ├── domain/           → Entidades: Note, Pool, Peer, Task
│   └── ports/            → Interfaces: NoteRepository, NetworkAdapter
├── infrastructure/
│   ├── AppServices.ts    → CollaborationService (orquestador principal)
│   ├── network/          → YjsWebRTCAdapter — transporte P2P real
│   └── persistence/      → IndexedDBAdapter — persistencia local real
└── ui/
    ├── components/       → Piezas reutilizables de interfaz
    └── screens/          → Pantallas: Dashboard, Notas, Calendario, Horario...
```

### Flujo de sincronización

```
1. Login vía Supabase Auth
        ↓
2. Carga perfil y Pools desde Supabase
        ↓
3. Abre Pool → CollaborationService crea Yjs Doc
        ↓
4. y-webrtc conecta peers vía Signaling Server (solo handshake)
        ↓
5. Yjs sincroniza cambios entre peers (algoritmo CRDT)
        ↓
6. y-indexeddb persiste en IndexedDB local (offline-first)
```

---

## 🔧 Stack tecnológico

### Lenguajes
- **TypeScript ~5.9** — tipado estricto en toda la app de escritorio
- **JavaScript** — scripts de configuración y herramientas

### Frontend / UI
- **React 19** — framework de interfaz con componentes funcionales
- **Framer Motion 12** — animaciones y transiciones
- **Lucide React** — sistema de íconos SVG
- **clsx + tailwind-merge** — utilidades de clases CSS

### Editor colaborativo
- **TipTap 3** — editor de texto enriquecido (headings, tablas, task lists)
- **@tiptap/y-tiptap** — integración TipTap ↔ Yjs

### Colaboración P2P
- **Yjs 13** — CRDT para sincronización sin conflictos
- **y-webrtc 10** — transporte WebRTC entre peers
- **y-indexeddb 9** — persistencia local del documento Yjs

### Plataforma desktop
- **Electron 35** — empaqueta la app web como instalable de escritorio
- **Vite 7** — bundler y servidor de desarrollo
- **electron-builder** — genera instalador `.exe` (NSIS)

### Autenticación y nube
- **Supabase** — Auth (email + Google OAuth), tabla `profiles`, tabla `user_pools`

### Calidad
- **ESLint 9** — linting con reglas para React Hooks
- **Vitest + Testing Library** — pruebas unitarias e integración

---

## 🧩 Microservicios

El proyecto implementa una arquitectura de **5 microservicios** con responsabilidades bien definidas:

| # | Servicio | Responsabilidad | Tecnología |
|---|---|---|---|
| 1 | **Auth Service** | Registro, login, sesiones, Google OAuth | Supabase Auth |
| 2 | **Profile Service** | Gestión de perfiles de usuario | Supabase (tabla `profiles`) |
| 3 | **Pool Registry Service** | Registro de libretas/espacios de trabajo | Supabase (tabla `user_pools`) |
| 4 | **Signaling Service** | Coordinación P2P — encuentro de peers | y-webrtc-signaling en AWS |
| 5 | **CRDT Sync Service** | Sincronización distribuida de documentos | Yjs (motor distribuido, cada peer es un nodo) |

---

## 🚀 Instalación

### Requisitos previos
- Node.js >= 20
- npm >= 10

### 1. Clonar el repositorio

```bash
git clone https://github.com/JhovaYu/Briefly.git
cd Briefly
```

### 2. Instalar dependencias

```bash
# Dependencias del monorepo raíz
npm install

# Dependencias de la app de escritorio
cd apps/desktop
npm install
```

### 3. Configurar variables de entorno

Crea `apps/desktop/.env` basado en el ejemplo:

```bash
cp apps/desktop/.env.example apps/desktop/.env
```

Completa las variables de Supabase:
```env
VITE_SUPABASE_URL=tu_url_de_supabase
VITE_SUPABASE_ANON_KEY=tu_anon_key
VITE_SIGNALING_URL=wss://tu-signaling-server.com
```

### 4. Levantar en modo desarrollo

```bash
# Solo la app web (navegador)
cd apps/desktop
npm run dev

# App completa con Electron
npm run electron:dev

# Levantar signaling server local
npm run signaling
```

### 5. Build para producción

```bash
# Genera instalador .exe en apps/desktop/release/
npm run electron:build
```

---

## 📁 Estructura de ramas

| Rama | Propósito |
|---|---|
| `main` | Producción estable |
| `feature/jhovanny-login-redesign` | Rediseño UI — Login, Dashboard, vistas del sidebar |

---

## 📋 Roadmap

- [ ] Fix de navegación global entre todas las vistas del sidebar
- [ ] UI completa: Notas, Tareas, Tableros, Papelera
- [ ] App Mobile — React Native funcional
- [ ] Despliegue del Signaling Server en AWS
- [ ] Exportación de notas (PDF, Markdown) — jszip listo
- [ ] Vista de grafo de conocimiento — react-force-graph-2d listo
- [ ] Migración de eventos del Calendario a IndexedDB/Yjs
- [ ] Instalador firmado para distribución pública

---

## 👥 Equipo

**MasterCoders AI** — Proyecto académico de desarrollo de software

---

## 📄 Licencia

MIT — ver [LICENSE](LICENSE) para detalles.

---

<div align="center">
  <sub>Construido con ❤️ usando React, Electron, Yjs y WebRTC</sub>
</div>
