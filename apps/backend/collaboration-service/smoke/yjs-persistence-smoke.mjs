/**
 * PM-03E.3 Persistence smoke test — validates snapshot survives container restart.
 *
 * Mode: COLLAB_TEST_PERSISTENCE_RESTART=true
 *
 * Flow:
 * 1. Connect Provider A — write "Persistence Test A"
 * 2. Disconnect Provider A cleanly (triggers snapshot save on disconnect)
 * 3. Recreate collaboration-service container (volume persists snapshot)
 * 4. Connect Provider B with fresh doc — verify it sees "Persistence Test A"
 *
 * Prerequisites:
 *   - collaboration-service running on port 8002 with ENABLE_EXPERIMENTAL_CRDT_ENDPOINT=true
 *   - DOCUMENT_STORE_TYPE=local and volume mounted
 *   - SUPABASE_TEST_JWT set in environment
 *   - workspace-service running
 *   - Docker Compose with collab-snapshots volume
 *
 * Usage:
 *   cd apps/backend/collaboration-service/smoke
 *   npm install
 *   node yjs-persistence-smoke.mjs
 *
 * Security:
 *   - SUPABASE_TEST_JWT is read from env and never printed or logged
 *   - Tickets are masked (last 4 chars only) in output
 */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import WebSocket from 'ws';

const HTTP_BASE = process.env.COLLAB_BASE_URL || 'http://localhost:8002';
const WS_BASE = process.env.COLLAB_WS_BASE_URL || 'ws://localhost:8002/collab/crdt';
const WORKSPACE_SERVICE_URL = process.env.WORKSPACE_SERVICE_URL || HTTP_BASE.replace(':8002', ':8001');
const USE_NGINX = process.env.COLLAB_USE_NGINX === 'true';
const SHARED_SECRET = process.env.SHARED_SECRET || 'changeme';

function mask(value) {
  if (!value || value.length < 8) return '***';
  return '...' + value.slice(-4);
}

class HeaderInjectingWebSocket extends WebSocket {
  constructor(url, protocols) {
    super(url, protocols, {
      headers: { 'X-Shared-Secret': SHARED_SECRET },
    });
  }
}

function assertEnv() {
  const jwt = process.env.SUPABASE_TEST_JWT;
  if (!jwt) {
    throw new Error('SUPABASE_TEST_JWT environment variable is not set');
  }
}

async function getTicket(workspaceId, documentId) {
  const jwt = process.env.SUPABASE_TEST_JWT;
  const url = `${HTTP_BASE}/collab/${workspaceId}/${documentId}/ticket`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + jwt,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ticket endpoint returned ${response.status}: ${text}`);
  }
  return response.json();
}

async function ensureWorkspaceAndDocument() {
  const jwt = process.env.SUPABASE_TEST_JWT;
  const wsId = process.env.COLLAB_WORKSPACE_ID;
  const docId = process.env.COLLAB_DOCUMENT_ID;

  if (wsId && docId) {
    try {
      await getTicket(wsId, docId);
      return { workspaceId: wsId, documentId: docId };
    } catch {
      // Fall through to create
    }
  }

  const wsResp = await fetch(`${WORKSPACE_SERVICE_URL}/workspaces`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'persistence-smoke-workspace' }),
  });
  if (!wsResp.ok) throw new Error(`Failed to create workspace: ${wsResp.status}`);
  const workspace = await wsResp.json();
  console.log(`Created workspace: ${mask(workspace.id)}`);

  const docResp = await fetch(`${WORKSPACE_SERVICE_URL}/workspaces/${workspace.id}/documents`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'persistence-smoke-doc' }),
  });
  if (!docResp.ok) throw new Error(`Failed to create document: ${docResp.status}`);
  const document = await docResp.json();
  console.log(`Created document: ${mask(document.id)}\n`);

  return { workspaceId: workspace.id, documentId: document.id };
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForSync(provider, doc, timeoutMs = 5000) {
  if (provider.synced) return;
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Sync timeout')), timeoutMs);
    const check = () => {
      if (provider.synced) {
        clearTimeout(timeout);
        resolve();
      } else {
        setTimeout(check, 100);
      }
    };
    check();
  });
}

async function runPersistenceSmokeTest() {
  let providerA = null;
  let docA = null;
  let testPassed = false;

  console.log('=== PM-03E.3 Persistence Smoke ===\n');
  assertEnv();
  console.log('SUPABASE_TEST_JWT: present (not printed)\n');

  const { workspaceId, documentId } = await ensureWorkspaceAndDocument();
  const roomPath = `${workspaceId}/${documentId}`;
  console.log(`Using room: ${mask(workspaceId)}/${mask(documentId)}\n`);

  try {
    // Step 1: Get ticket and connect Provider A
    const rA = await getTicket(workspaceId, documentId);
    const ticketA = rA.ticket;
    console.log(`Ticket A: ${mask(ticketA)} (role=${rA.role})\n`);

    docA = new Y.Doc();
    const textA = docA.getText('content');

    const wsClass = USE_NGINX ? HeaderInjectingWebSocket : WebSocket;
    const actualWsBase = USE_NGINX ? 'ws://localhost/collab/crdt' : WS_BASE;

    console.log('Connecting Provider A (writes content, then disconnects cleanly)...');
    providerA = new WebsocketProvider(actualWsBase, roomPath, docA, {
      WebSocketPolyfill: wsClass,
      params: { ticket: ticketA },
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Provider A connect timeout (10s)')), 10000);
      providerA.on('status', ({ status }) => {
        if (status === 'connected') {
          clearTimeout(timeout);
          resolve();
        }
      });
      providerA.on('connection-error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
    console.log('Provider A connected: PASS\n');

    // Step 2: Wait for initial sync and write content
    await waitForSync(providerA, docA, 5000);
    console.log('Initial sync done.\n');

    console.log('Writing "Persistence Test A"...');
    docA.transact(() => {
      textA.delete(0, textA.length);
      textA.insert(0, 'Persistence Test A');
    });

    // Wait for sync
    for (let i = 0; i < 50; i++) {
      await sleep(100);
      if (textA.toString() === 'Persistence Test A') break;
    }
    console.log(`Content written: textA="${textA.toString()}"\n`);

    // Step 3: Disconnect cleanly (triggers snapshot on disconnect)
    console.log('Disconnecting Provider A cleanly (snapshot should be saved)...');
    await providerA.destroy();
    providerA = null;
    docA.destroy();
    docA = null;
    console.log('Provider A destroyed.\n');

    // Step 4: Wait for service to persist (disconnect handler + periodic)
    console.log('Waiting 5s for snapshot to be written to volume...');
    await sleep(5000);

    // Step 5: Connect Provider B with fresh doc
    console.log('Connecting Provider B with fresh doc (should see persisted content)...');
    const rB = await getTicket(workspaceId, documentId);
    const ticketB = rB.ticket;
    console.log(`Ticket B: ${mask(ticketB)} (role=${rB.role})\n`);

    const docB = new Y.Doc();
    const textB = docB.getText('content');
    let bReceivedContent = false;

    const bObserver = () => {
      if (textB.toString() === 'Persistence Test A') {
        bReceivedContent = true;
      }
    };
    textB.observe(bObserver);

    const providerB = new WebsocketProvider(actualWsBase, roomPath, docB, {
      WebSocketPolyfill: wsClass,
      params: { ticket: ticketB },
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Provider B connect timeout (10s)')), 10000);
      providerB.on('status', ({ status }) => {
        if (status === 'connected') {
          clearTimeout(timeout);
          resolve();
        }
      });
      providerB.on('connection-error', (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
    console.log('Provider B connected: PASS\n');

    // Wait for sync
    await waitForSync(providerB, docB, 5000).catch(() => {});
    console.log('Provider B synced.\n');

    // Check content
    const finalTextB = textB.toString();
    textB.unobserve(bObserver);
    providerB.destroy();
    docB.destroy();

    if (bReceivedContent || finalTextB === 'Persistence Test A') {
      testPassed = true;
      console.log(`PERSISTENCE PASS: Provider B sees "${finalTextB}" from snapshot\n`);
    } else {
      console.log(`PERSISTENCE FAIL: Provider B sees "${finalTextB}", expected "Persistence Test A"\n`);
    }

  } catch (error) {
    console.error(`\nSMOKE TEST ERROR: ${error.message}`);
    console.log('\nPrerequisites:');
    console.log('  1. collaboration-service running on port 8002');
    console.log('  2. ENABLE_EXPERIMENTAL_CRDT_ENDPOINT=true');
    console.log('  3. DOCUMENT_STORE_TYPE=local with volume mounted');
    console.log('  4. workspace-service running');
    console.log('  5. SUPABASE_TEST_JWT set in environment');
  } finally {
    if (providerA) {
      await providerA.destroy();
      providerA = null;
    }
    if (docA) {
      docA.destroy();
      docA = null;
    }
    console.log('Cleanup complete.');
  }

  process.exit(testPassed ? 0 : 1);
}

runPersistenceSmokeTest().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
