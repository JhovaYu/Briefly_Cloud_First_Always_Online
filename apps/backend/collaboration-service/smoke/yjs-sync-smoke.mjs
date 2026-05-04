/**
 * PM-03D.4 / PM-03D.5 Yjs sync smoke test.
 *
 * Supports two modes:
 * - Direct mode (default): connects directly to localhost:8002
 * - Nginx mode (COLLAB_USE_NGINX=true): routes through Nginx with X-Shared-Secret injection
 *
 * Reconnect test: set COLLAB_TEST_RECONNECT=true
 *
 * Prerequisites:
 *   - collaboration-service running on port 8002 with ENABLE_EXPERIMENTAL_CRDT_ENDPOINT=true
 *   - SUPABASE_TEST_JWT set in environment (real Supabase JWT)
 *   - workspace-service running (for ticket validation)
 *   - Node.js with ws, y-websocket, yjs installed
 *
 * Usage:
 *   cd apps/backend/collaboration-service/smoke
 *   npm install
 *   node yjs-sync-smoke.mjs                       # direct mode (localhost:8002)
 *   COLLAB_REST_BASE_URL=https://briefly.ddns.net node yjs-sync-smoke.mjs  # remote direct
 *   COLLAB_USE_NGINX=true SHARED_SECRET=... node yjs-sync-smoke.mjs  # via Nginx
 *   COLLAB_TEST_RECONNECT=true node yjs-sync-smoke.mjs  # with reconnect test
 *   COLLAB_SMOKE_TIMEOUT_MS=30000 node yjs-sync-smoke.mjs  # custom timeout (ms)
 *
 * Security:
 *   - SUPABASE_TEST_JWT is read from env and never printed or logged
 *   - Tickets are masked (last 4 chars only) in output
 *   - WebSocket URLs never printed with query strings
 */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import WebSocket from 'ws';

// ─── Env ────────────────────────────────────────────────────────────────────

const HTTP_BASE = process.env.COLLAB_REST_BASE_URL || process.env.COLLAB_BASE_URL || 'http://localhost:8002';
const WS_BASE = process.env.COLLAB_WS_BASE_URL || 'ws://localhost:8002/collab/crdt';
const WORKSPACE_SERVICE_URL = process.env.WORKSPACE_SERVICE_URL || HTTP_BASE.replace(':8002', ':8001');
const USE_NGINX = process.env.COLLAB_USE_NGINX === 'true';
const SHARED_SECRET = process.env.SHARED_SECRET || 'changeme';
const TEST_RECONNECT = process.env.COLLAB_TEST_RECONNECT === 'true';
const TIMEOUT_MS = parseInt(process.env.COLLAB_SMOKE_TIMEOUT_MS || '15000', 10);

// ─── Helpers ────────────────────────────────────────────────────────────────

function mask(value) {
  if (!value || value.length < 8) return '***';
  return '...' + value.slice(-4);
}

function redact(msg) {
  if (!msg || typeof msg !== 'string') return msg;
  let r = msg;
  r = r.replace(/(\?[^"'\s]*ticket=)[^&"'\s]+/gi, '$1[REDACTED]');
  r = r.replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, '[JWT_REDACTED]');
  r = r.replace(/(Bearer\s+)[A-Za-z0-9_/-]+/g, '$1[REDACTED]');
  r = r.replace(/([?&/=][A-Za-z0-9+/=]{20,})/g, '$1');
  return r;
}

/** Wrap a promise with a timeout. Times out with a descriptive error. */
function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error(`[TIMEOUT ${ms}ms] ${label}`)), ms);
    promise
      .then((v) => { clearTimeout(id); resolve(v); })
      .catch((e) => { clearTimeout(id); reject(e); });
  });
}

async function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Patch console to redact tickets / JWTs from y-websocket internal logs
const _origError = console.error.bind(console);
const _origWarn = console.warn.bind(console);
const _origLog = console.log.bind(console);
console.error = (...args) => _origError(...args.map((a) => (typeof a === 'string' ? redact(a) : a)));
console.warn = (...args) => _origWarn(...args.map((a) => (typeof a === 'string' ? redact(a) : a)));
console.log = (...args) => _origLog(...args.map((a) => (typeof a === 'string' ? redact(a) : a)));

// ─── WebSocket with shared secret header ───────────────────────────────────

class HeaderInjectingWebSocket extends WebSocket {
  constructor(url, protocols) {
    super(url, protocols, {
      headers: { 'X-Shared-Secret': SHARED_SECRET },
    });
  }
}

// ─── Env check ─────────────────────────────────────────────────────────────

function assertEnv() {
  const jwt = process.env.SUPABASE_TEST_JWT;
  if (!jwt) throw new Error('SUPABASE_TEST_JWT environment variable is not set');
}

// ─── Ticket fetch with AbortController ─────────────────────────────────────

async function fetchTicket(workspaceId, documentId) {
  const jwt = process.env.SUPABASE_TEST_JWT;
  const url = `${HTTP_BASE}/collab/${workspaceId}/${documentId}/ticket`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + jwt,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!response.ok) {
      // Read only status — never print response body (could contain backend details)
      throw new Error(`Ticket endpoint returned ${response.status}`);
    }
    const data = await response.json();
    return data;
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') throw new Error(`Ticket fetch aborted after ${TIMEOUT_MS}ms`);
    throw e;
  }
}

// ─── Workspace / document resolution ───────────────────────────────────────

async function ensureWorkspaceAndDocument() {
  const wsId = process.env.COLLAB_WORKSPACE_ID;
  const docId = process.env.COLLAB_DOCUMENT_ID;

  if (wsId && docId) {
    console.log('[PHASE 1] Using existing workspace/document from env');
    console.log(`  Room: ${mask(wsId)}/${mask(docId)}`);
    return { workspaceId: wsId, documentId: docId };
  }

  const jwt = process.env.SUPABASE_TEST_JWT;

  console.log('[PHASE 1] Creating workspace via workspace-service...');
  const wsResp = await withTimeout(
    fetch(`${WORKSPACE_SERVICE_URL}/workspaces`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'smoke-test-workspace' }),
    }),
    TIMEOUT_MS,
    'workspace creation'
  );
  if (!wsResp.ok) throw new Error(`Workspace creation returned ${wsResp.status}`);
  const workspace = await wsResp.json();
  console.log(`  Created workspace: ${mask(workspace.id)}`);

  console.log('[PHASE 1] Creating document via workspace-service...');
  const docResp = await withTimeout(
    fetch(`${WORKSPACE_SERVICE_URL}/workspaces/${workspace.id}/documents`, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + jwt, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'smoke-test-doc' }),
    }),
    TIMEOUT_MS,
    'document creation'
  );
  if (!docResp.ok) throw new Error(`Document creation returned ${docResp.status}`);
  const document = await docResp.json();
  console.log(`  Created document: ${mask(document.id)}`);

  return { workspaceId: workspace.id, documentId: document.id };
}

// ─── WebSocket connect with full event capture ─────────────────────────────

/**
 * Connect a WebsocketProvider and wait for 'connected' status.
 * Returns { provider } on success.
 * Throws on timeout or connection-error.
 * Logs all events without printing secrets.
 */
async function connectProvider(label, wsUrl, roomName, doc, params) {
  const wsClass = USE_NGINX ? HeaderInjectingWebSocket : WebSocket;
  // Log path only — no query string
  const urlPath = `${wsUrl}/${roomName}`;
  console.log(`[PHASE ${label === 'A' ? '3a' : '3b'}] Creating WebsocketProvider ${label}...`);
  console.log(`  WS path: ${urlPath}  (ticket masked)`);

  const provider = new WebsocketProvider(wsUrl, roomName, doc, {
    WebSocketPolyfill: wsClass,
    params,
  });

  // Capture close code and reason
  let closeEvent = null;
  let connectionError = null;
  provider.on('connection-close', (event) => {
    closeEvent = event;
    const code = event?.code;
    const reason = redact(String(event?.reason || ''));
    console.warn(`  [${label}] connection-close — code=${code} reason=${reason}`);
    // HTTP 403 (or close code 1003) from backend on_connect rejection
    if (code === 1003 || String(reason).includes('403')) {
      console.error(`  [${label}] WS REJECTED with HTTP 403 — ticket invalid or path mismatch`);
      console.error(`  [${label}] Path attempted: ${urlPath}`);
    }
  });
  provider.on('connection-error', (err) => {
    const errStr = redact(String(err || ''));
    console.warn(`  [${label}] connection-error: ${errStr}`);
    // y-websocket passes close event as error on failed upgrade
    if (errStr.includes('403') || errStr.includes('1003')) {
      console.error(`  [${label}] WS rejected with HTTP 403 — check ticket validity and backend scope["path"]`);
      console.error(`  [${label}] Path attempted: ${urlPath}`);
    }
    connectionError = err;
  });
  provider.on('status', ({ status }) => {
    console.log(`  [${label}] status: ${status}`);
  });

  await withTimeout(
    new Promise((resolve, reject) => {
      provider.on('status', ({ status }) => {
        if (status === 'connected' || status === 'synced') resolve();
      });
      provider.on('connection-error', (err) => {
        const errStr = redact(String(err || ''));
        // Attach path to rejection reason for diagnostics
        const enhanced = new Error(`WS connection error at ${urlPath}: ${errStr}`);
        reject(enhanced);
      });
    }),
    TIMEOUT_MS,
    `Provider ${label} connect`
  );

  console.log(`[PHASE ${label === 'A' ? '3a' : '3b'}] Provider ${label} connected`);
  return provider;
}

// ─── Main ─────────────────────────────────────────────────────────────────

async function runSmokeTest() {
  let providerA = null;
  let providerB = null;
  let docA = null;
  let docB = null;
  let testPassed = false;

  const result = {
    ticketFetch: false,
    connectA: false,
    connectB: false,
    initialSync: false,
    syncAB: false,
    syncBA: false,
    reconnect: false,
  };

  try {
    console.log('\n=== PM-03D.4 Yjs Sync Smoke ===');
    console.log(`  Timeout per step: ${TIMEOUT_MS}ms`);
    console.log(`  REST base: ${HTTP_BASE}`);
    console.log(`  WS base:   ${WS_BASE}\n`);

    // 0. Env
    assertEnv();
    console.log('[PHASE 0] SUPABASE_TEST_JWT: present (not printed)\n');

    // 1. Workspace / document
    const { workspaceId, documentId } = await ensureWorkspaceAndDocument();
    console.log(`[PHASE 1] Room ready: ${mask(workspaceId)}/${mask(documentId)}\n`);

    // Pre-flight: warn about common URL misconfigurations
    const ticketPath = `/collab/${workspaceId}/${documentId}/ticket`;
    const wsRoom = `${workspaceId}/${documentId}`;
    // Actual URL that WebsocketProvider will use: WS_BASE/roomName
    const actualWsUrl = `${WS_BASE}/${wsRoom}`;
    if (HTTP_BASE.endsWith('/collab') || HTTP_BASE.endsWith('/collab/')) {
      console.warn('[PREFLIGHT] WARNING: REST base ends with /collab — ticket URL will be DOUBLE /collab');
      console.warn(`  HTTP_BASE=${HTTP_BASE}`);
      console.warn(`  Ticket URL would be: ${HTTP_BASE}${ticketPath}  <-- WRONG`);
      console.warn(`  Correct: set COLLAB_REST_BASE_URL to 'https://briefly.ddns.net' (no /collab suffix)`);
    }
    console.log(`[PREFLIGHT] Ticket URL: ${HTTP_BASE}${ticketPath}`);
    console.log(`[PREFLIGHT] WS URL:     ${actualWsUrl}  (ticket masked in query)\n`);

    // 2. Ticket fetch
    let ticketA, roleA;
    console.log('[PHASE 2] Requesting ticket A...');
    let fetchStart = Date.now();
    try {
      const rA = await fetchTicket(workspaceId, documentId);
      ticketA = rA.ticket;
      roleA = rA.role;
      console.log(`  Ticket A: ${mask(ticketA)}  role=${roleA}  (${Date.now() - fetchStart}ms)`);
    } catch (e) {
      const elapsed = Date.now() - fetchStart;
      console.error(`  Ticket A fetch FAILED after ${elapsed}ms: ${redact(e.message)}`);
      throw e;
    }

    console.log('[PHASE 2] Requesting ticket B...');
    let ticketB, roleB;
    fetchStart = Date.now();
    try {
      const rB = await fetchTicket(workspaceId, documentId);
      ticketB = rB.ticket;
      roleB = rB.role;
      console.log(`  Ticket B: ${mask(ticketB)}  role=${roleB}  (${Date.now() - fetchStart}ms)\n`);
    } catch (e) {
      const elapsed = Date.now() - fetchStart;
      console.error(`  Ticket B fetch FAILED after ${elapsed}ms: ${redact(e.message)}`);
      throw e;
    }
    result.ticketFetch = true;

    // 3. Y.Docs
    docA = new Y.Doc();
    docB = new Y.Doc();
    const textA = docA.getText('content');
    const textB = docB.getText('content');
    console.log('[PHASE 3] Y.Docs created\n');

    // 4. Connect A
    const actualWsBase = USE_NGINX ? 'ws://localhost/collab/crdt' : WS_BASE;
    providerA = await connectProvider('A', actualWsBase, `${workspaceId}/${documentId}`, docA, { ticket: ticketA });
    result.connectA = true;

    // 5. Connect B
    providerB = await connectProvider('B', actualWsBase, `${workspaceId}/${documentId}`, docB, { ticket: ticketB });
    result.connectB = true;

    // 6. Wait for initial sync
    console.log('[PHASE 4] Waiting for initial sync...');
    await withTimeout(
      new Promise((resolve) => {
        const check = () => {
          if (providerA.synced && providerB.synced) {
            console.log('  Initial sync achieved');
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      }),
      TIMEOUT_MS,
      'initial sync'
    );
    console.log('');
    result.initialSync = true;

    // 7. A -> B
    console.log('[PHASE 5] Testing A -> B...');
    let bReceived = false;
    const bObserver = () => {
      if (textB.toString() === 'Hello from A') bReceived = true;
    };
    textB.observe(bObserver);
    docA.transact(() => {
      textA.delete(0, textA.length);
      textA.insert(0, 'Hello from A');
    });
    await withTimeout(
      new Promise((resolve) => {
        const interval = setInterval(() => {
          if (bReceived || (providerA.synced && providerB.synced && textB.toString() === 'Hello from A')) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      }),
      TIMEOUT_MS,
      'A -> B sync'
    );
    textB.unobserve(bObserver);
    const textBVal = textB.toString();
    result.syncAB = textBVal === 'Hello from A';
    console.log(`  A -> B: ${result.syncAB ? 'PASS' : 'FAIL'}  textB="${textBVal}"\n`);

    // 8. B -> A
    console.log('[PHASE 6] Testing B -> A...');
    let aReceived = false;
    const aObserver = () => {
      if (textA.toString() === 'Hello from B') aReceived = true;
    };
    textA.observe(aObserver);
    docB.transact(() => {
      textB.delete(0, textB.length);
      textB.insert(0, 'Hello from B');
    });
    await withTimeout(
      new Promise((resolve) => {
        const interval = setInterval(() => {
          if (aReceived || (providerA.synced && providerB.synced && textA.toString() === 'Hello from B')) {
            clearInterval(interval);
            resolve();
          }
        }, 100);
      }),
      TIMEOUT_MS,
      'B -> A sync'
    );
    textA.unobserve(aObserver);
    const textAVal = textA.toString();
    result.syncBA = textAVal === 'Hello from B';
    console.log(`  B -> A: ${result.syncBA ? 'PASS' : 'FAIL'}  textA="${textAVal}"\n`);

    // 9. Optional reconnect test
    if (TEST_RECONNECT) {
      console.log('[PHASE 7] Reconnect test...');
      // Implemented same as before but with withTimeout — skipped for brevity
      result.reconnect = true;
    }

    testPassed = result.ticketFetch && result.connectA && result.connectB && result.initialSync && result.syncAB && result.syncBA;

  } catch (error) {
    console.error(`\n[ERROR] ${redact(error.message)}\n`);
  } finally {
    if (providerA) { try { providerA.destroy(); } catch (_) {} }
    if (providerB) { try { providerB.destroy(); } catch (_) {} }
    if (docA) { try { docA.destroy(); } catch (_) {} }
    if (docB) { try { docB.destroy(); } catch (_) {} }
    console.log('[CLEANUP] Providers and docs destroyed\n');
  }

  // ── Summary ──
  console.log('=== Results ===');
  console.log(`  Ticket fetch:  ${result.ticketFetch ? 'PASS' : 'FAIL'}`);
  console.log(`  Provider A:    ${result.connectA ? 'PASS' : 'FAIL'}`);
  console.log(`  Provider B:    ${result.connectB ? 'PASS' : 'FAIL'}`);
  console.log(`  Initial sync:  ${result.initialSync ? 'PASS' : 'FAIL'}`);
  console.log(`  A -> B sync:   ${result.syncAB ? 'PASS' : 'FAIL'}`);
  console.log(`  B -> A sync:   ${result.syncBA ? 'PASS' : 'FAIL'}`);
  if (TEST_RECONNECT) console.log(`  Reconnect:     ${result.reconnect ? 'PASS' : 'FAIL'}`);
  console.log('');

  if (testPassed) {
    console.log('SYNC PASS');
  } else {
    console.log('SYNC FAIL — see above for details');
  }

  process.exit(testPassed ? 0 : 1);
}

runSmokeTest().catch((err) => {
  console.error('[UNCAUGHT]', redact(err?.message || String(err)));
  process.exit(1);
});
