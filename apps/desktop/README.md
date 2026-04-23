# 🐧 TuxNotas

**Aplicación de notas colaborativas P2P** — Sin servidores centrales, tus notas viven en tu máquina y se sincronizan directamente entre peers.

> Inspirada en Notion y Obsidian, pero 100% peer-to-peer.

---

## ✨ Características

- 📝 Editor de texto enriquecido (TipTap) con soporte para headings, listas, tablas, task lists
- 🔗 Colaboración en tiempo real peer-to-peer (Yjs + WebRTC)
- 💾 Persistencia local automática (IndexedDB)
- 🌙 Modo oscuro / claro (estilo Obsidian / Notion)
- 🖥️ App de escritorio (Electron) — instalable como `.exe`
- 🔒 Funciona en redes restringidas con servidor TURN como fallback

---

## 🏗️ Arquitectura

TuxNotas usa **Arquitectura Hexagonal** (Ports & Adapters) para separar la lógica de negocio de la infraestructura:

```
src/
├── core/                        # 🎯 Núcleo de dominio (sin dependencias externas)
│   ├── domain/
│   │   └── Entities.ts          # Entidades: Note, Task, Pool, Peer
│   └── ports/
│       └── Ports.ts             # Puertos: NoteRepository, NetworkAdapter, CryptoProvider
│
├── infrastructure/              # 🔌 Adaptadores (implementaciones concretas)
│   ├── AppServices.ts           # Orquestador principal (CollaborationService)
│   ├── network/
│   │   └── YjsWebRTCAdapter.ts  # Adaptador de red P2P (Yjs + WebRTC)
│   ├── persistence/
│   │   └── IndexedDBAdapter.ts  # Adaptador de persistencia (IndexedDB)
│   └── ui/
│       ├── components/
│       │   └── Editor.tsx       # Componente del editor TipTap
│       └── styles/
│           └── index.css        # Estilos globales
│
├── App.tsx                      # Componente raíz de React
├── main.tsx                     # Entry point
│
├── electron/                    # 🖥️ Electron main process
│   └── main.js                  # Ventana principal de la app de escritorio
│
├── vite.config.ts               # Configuración de Vite
├── package.json                 # Dependencias y scripts
└── index.html                   # HTML base
```

### Diagrama de flujo

```
┌─────────────────────────────────────────────────┐
│                    UI (React)                    │
│         App.tsx → Editor.tsx (TipTap)            │
└──────────────────────┬──────────────────────────┘
                       │ usa
          ┌────────────▼────────────┐
          │     AppServices.ts      │
          │  (CollaborationService) │
          └─────┬──────────┬────────┘
                │          │
     ┌──────────▼──┐   ┌──▼──────────────┐
     │  IndexedDB   │   │  YjsWebRTC      │
     │  Adapter     │   │  Adapter        │
     │  (local)     │   │  (P2P network)  │
     └──────────────┘   └─────────────────┘
```

---

## 🛠️ Stack Tecnológico

| Tecnología | Uso |
|---|---|
| **React 19** | UI framework |
| **TypeScript** | Tipado estático |
| **Vite** | Bundler y dev server |
| **TipTap** | Editor de texto enriquecido |
| **Yjs** | CRDT para sincronización en tiempo real |
| **y-webrtc** | Transporte P2P via WebRTC |
| **y-indexeddb** | Persistencia local del documento |
| **Electron** | App de escritorio (.exe) |
| **Lucide React** | Iconos |
| **Framer Motion** | Animaciones |

---

## 🚀 Comandos

### Desarrollo

```bash
# Instalar dependencias
npm install

# Iniciar servidor de desarrollo (navegador)
npm run dev
# → Abre http://localhost:5173

# Iniciar en modo Electron (escritorio)
npm run electron:dev
```

### Producción

```bash
# Build del frontend
npm run build

# Generar .exe instalable (Windows)
npm run electron:build

# Previsualizar build en navegador
npm run preview
```

### Calidad de Código

```bash
# Verificar errores de ESLint
npm run lint
```

---

## 🔗 P2P en Redes Restringidas

En redes como universidades donde se bloquean puertos, TuxNotas usa un **servidor TURN** como fallback:

1. **Intento directo (STUN)**: Conexión P2P pura, sin intermediarios
2. **Fallback (TURN)**: Si falla, el tráfico pasa por un servidor relay en **puerto 443** (HTTPS, nunca bloqueado)

Para configurar tu propio servidor TURN gratuito con **coturn** en un VPS, consulta la sección de configuración en `YjsWebRTCAdapter.ts`.

---

## 📋 Cómo Probar

1. `npm install` → `npm run dev`
2. Abre dos pestañas en `http://localhost:5173`
3. En la primera pestaña, crea un nuevo pool → copia el Pool ID
4. En la segunda pestaña, pega el Pool ID y dale "Join"
5. ¡Escribe en una pestaña y ve los cambios aparecer en la otra en tiempo real!

---

## 📄 Licencia

MIT
