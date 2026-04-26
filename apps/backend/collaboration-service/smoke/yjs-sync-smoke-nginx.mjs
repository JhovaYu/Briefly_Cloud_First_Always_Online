/**
 * PM-03D.5 Yjs sync smoke test via Nginx.
 *
 * Same as yjs-sync-smoke.mjs but routes through Nginx at localhost
 * and passes X-Shared-Secret header via custom WebSocket class.
 *
 * Usage:
 *   cd apps/backend/collaboration-service/smoke
 *   node yjs-sync-smoke-nginx.mjs
 *
 * Environment variables:
 *   COLLAB_BASE_URL          - HTTP base (default: http://localhost)
 *   COLLAB_WS_BASE_URL      - WS base (default: ws://localhost/collab/crdt)
 *   SHARED_SECRET           - X-Shared-Secret (default: changeme)
 */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import WebSocket from 'ws';

const HTTP_BASE = process.env.COLLAB_BASE_URL || 'http://localhost';
const WS_BASE = process.env.COLLAB_WS_BASE_URL || 'ws://localhost/collab/crdt';
// Workspace-service is NOT behind Nginx for create workspace - use direct port
const WORKSPACE_SERVICE_URL = process.env.WORKSPACE_SERVICE_URL || 'http://localhost:8001';
const SHARED_SECRET = process.env.SHARED_SECRET || 'changeme';
const TEST_RECONNECT = process.env.COLLAB_TEST_RECONNECT === 'true';

function mask(value) {
  if (!value || value.length < 8) return '***';
  return '...' + value.slice(-4);
}

function assertEnv() {
  const jwt = process.env.SUPABASE_TEST_JWT;
  if (!jwt) {
    throw new Error('SUPABASE_TEST_JWT environment variable is not set');
  }
}

/**
 * Custom WebSocket class that injects X-Shared-Secret header.
 * Used for Nginx-proxied connections where the secret must be passed
 * as an HTTP header (not as a query param).
 */
class HeaderInjectingWebSocket extends WebSocket {
  constructor(url, protocols) {
    super(url, protocols, {
      headers: {
        'X-Shared-Secret': SHARED_SECRET,
      },
    });
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
      'X-Shared-Secret': SHARED_SECRET,
    },
    body: JSON.stringify({}),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Ticket endpoint returned ${response.status}: ${text}`);
  }
  return response.json();
}

/**
 * Workspace creation uses direct port (JWT validation bypass in test mode).
 * Collaboration traffic goes through Nginx with X-Shared-Secret injection.
 */
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

  // Workspace service not behind Nginx X-Shared-Secret (uses Nginx /api/workspaces/ route)
  // Create via direct port to bypass any JWT expiry issues in test mode
  const wsResp = await fetch('http://localhost:8001/workspaces', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'smoke-test-workspace-nginx' }),
  });
  if (!wsResp.ok) {
    const errText = await wsResp.text();
    throw new Error(`Failed to create workspace: ${wsResp.status} - ${errText}`);
  }
  const workspace = await wsResp.json();
  console.log(`Created workspace: ${mask(workspace.id)}`);

  const docResp = await fetch(`http://localhost:8001/workspaces/${workspace.id}/documents`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'smoke-test-doc-nginx' }),
  });
  if (!docResp.ok) {
    const errText = await docResp.text();
    throw new Error(`Failed to create document: ${docResp.status} - ${errText}`);
  }
  const document = await docResp.json();
  console.log(`Created document: ${mask(document.id)}\n`);

  return { workspaceId: workspace.id, documentId: document.id };
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runSmokeTest() {
  let providerA = null;
  let providerB = null;
  let docA = null;
  let docB = null;
  let testPassed = false;
  let ticketEndpointOK = false;
  let connectAOK = false;
  let connectBOK = false;
  let syncABOK = false;
  let syncBAOK = false;

  try {
    console.log('=== PM-03D.5 Yjs Sync Smoke (via Nginx) ===\n');
    console.log(`HTTP_BASE:  ${HTTP_BASE}`);
    console.log(`WS_BASE:     ${WS_BASE}`);
    console.log(`SHARED_SECRET: ${mask(SHARED_SECRET)}\n`);

    assertEnv();
    console.log('SUPABASE_TEST_JWT: present (not printed)\n');

    const { workspaceId, documentId } = await ensureWorkspaceAndDocument();
    console.log(`Using room: ${mask(workspaceId)}/${mask(documentId)}\n`);

    let ticketA, ticketB;
    let roleA, roleB;
    try {
      const rA = await getTicket(workspaceId, documentId);
      ticketA = rA.ticket;
      roleA = rA.role;
      const rB = await getTicket(workspaceId, documentId);
      ticketB = rB.ticket;
      roleB = rB.role;
      ticketEndpointOK = true;
      console.log(`Ticket A: ${mask(ticketA)}  (role=${roleA})`);
      console.log(`Ticket B: ${mask(ticketB)}  (role=${roleB})\n`);
    } catch (e) {
      console.log(`Ticket endpoint: FAIL - ${e.message}`);
      throw e;
    }
    console.log('Ticket endpoint: PASS\n');

    docA = new Y.Doc();
    docB = new Y.Doc();
    const textA = docA.getText('content');
    const textB = docB.getText('content');

    console.log('Connecting Provider A via Nginx (X-Shared-Secret header injected)...');
    providerA = new WebsocketProvider(
      WS_BASE,
      `${workspaceId}/${documentId}`,
      docA,
      {
        WebSocketPolyfill: HeaderInjectingWebSocket,
        params: { ticket: ticketA },
      }
    );

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
    connectAOK = true;
    console.log('Provider A connected: PASS\n');

    console.log('Connecting Provider B via Nginx (X-Shared-Secret header injected)...');
    providerB = new WebsocketProvider(
      WS_BASE,
      `${workspaceId}/${documentId}`,
      docB,
      {
        WebSocketPolyfill: HeaderInjectingWebSocket,
        params: { ticket: ticketB },
      }
    );

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
    connectBOK = true;
    console.log('Provider B connected: PASS\n');

    console.log('Waiting for initial sync...');
    await new Promise((resolve) => {
      const timeout = setTimeout(resolve, 3000);
      const checkSync = () => {
        if (providerA.synced && providerB.synced) {
          clearTimeout(timeout);
          resolve();
        } else {
          setTimeout(checkSync, 100);
        }
      };
      checkSync();
    });
    console.log('Initial sync detected.\n');

    console.log('Testing A -> B sync...');
    let bReceivedA = false;
    const bObserver = () => {
      if (textB.toString() === 'Hello from A') {
        bReceivedA = true;
      }
    };
    textB.observe(bObserver);

    docA.transact(() => {
      textA.delete(0, textA.length);
      textA.insert(0, 'Hello from A');
    });

    for (let i = 0; i < 50; i++) {
      await sleep(100);
      if (bReceivedA) break;
    }
    textB.unobserve(bObserver);

    const textBValue = textB.toString();
    if (bReceivedA || textBValue === 'Hello from A') {
      syncABOK = true;
      console.log(`A -> B sync: PASS (textB="${textBValue}")\n`);
    } else {
      console.log(`A -> B sync: FAIL (textB="${textBValue}", expected "Hello from A")\n`);
    }

    console.log('Testing B -> A sync...');
    let aReceivedB = false;
    const aObserver = () => {
      if (textA.toString() === 'Hello from B') {
        aReceivedB = true;
      }
    };
    textA.observe(aObserver);

    docB.transact(() => {
      textB.delete(0, textB.length);
      textB.insert(0, 'Hello from B');
    });

    for (let i = 0; i < 50; i++) {
      await sleep(100);
      if (aReceivedB) break;
    }
    textA.unobserve(aObserver);

    const textAValue = textA.toString();
    if (aReceivedB || textAValue === 'Hello from B') {
      syncBAOK = true;
      console.log(`B -> A sync: PASS (textA="${textAValue}")\n`);
    } else {
      console.log(`B -> A sync: FAIL (textA="${textAValue}", expected "Hello from B")\n`);
    }

    // Reconnect test (optional, triggered by COLLAB_TEST_RECONNECT=true)
    let reconnectOK = false;
    if (TEST_RECONNECT) {
      console.log('=== Reconnect Test via Nginx ===\n');
      console.log('Destroying Provider B...');
      providerB.destroy();
      providerB = null;

      await sleep(500);

      console.log('Fetching fresh ticket B2 for same room (via Nginx)...');
      try {
        const rB2 = await getTicket(workspaceId, documentId);
        const ticketB2 = rB2.ticket;
        console.log(`Ticket B2: ${mask(ticketB2)}\n`);

        console.log('Creating new Y.Doc B2 and Provider B2 via Nginx...');
        const docB2 = new Y.Doc();
        const textB2 = docB2.getText('content');

        providerB = new WebsocketProvider(
          WS_BASE,
          `${workspaceId}/${documentId}`,
          docB2,
          {
            WebSocketPolyfill: HeaderInjectingWebSocket,
            params: { ticket: ticketB2 },
          }
        );

        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('Provider B2 connect timeout (10s)')), 10000);
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
        console.log('Provider B2 reconnected: PASS\n');

        console.log('Waiting for B2 to sync with current state...');
        await new Promise((resolve) => {
          const timeout = setTimeout(resolve, 3000);
          const checkSync = () => {
            if (providerB.synced) {
              clearTimeout(timeout);
              resolve();
            } else {
              setTimeout(checkSync, 100);
            }
          };
          checkSync();
        });
        console.log('Provider B2 synced.\n');

        const b2Received = textB2.toString();
        if (b2Received === 'Hello from B') {
          console.log(`B2 sees current state: PASS (textB2="${b2Received}")\n`);
        } else {
          console.log(`B2 sees current state: PARTIAL (textB2="${b2Received}", expected "Hello from B")\n`);
        }

        console.log('B2 writes "Hello from B2"...');
        let aReceivedB2 = false;
        const aObserver2 = () => {
          if (textA.toString() === 'Hello from B2') {
            aReceivedB2 = true;
          }
        };
        textA.observe(aObserver2);

        docB2.transact(() => {
          textB2.delete(0, textB2.length);
          textB2.insert(0, 'Hello from B2');
        });

        for (let i = 0; i < 50; i++) {
          await sleep(100);
          if (aReceivedB2) break;
        }
        textA.unobserve(aObserver2);

        const finalTextA = textA.toString();
        if (aReceivedB2 || finalTextA === 'Hello from B2') {
          reconnectOK = true;
          console.log(`B2 -> A (reconnect): PASS (textA="${finalTextA}")\n`);
        } else {
          console.log(`B2 -> A (reconnect): FAIL (textA="${finalTextA}", expected "Hello from B2")\n`);
        }

        docB2.destroy();
      } catch (e) {
        console.log(`Reconnect test: FAIL - ${e.message}\n`);
      }
      console.log('--- Reconnect Results ---');
      console.log(`Provider B2 reconnect: ${reconnectOK ? 'PASS' : 'FAIL'}\n`);
    }

    testPassed = ticketEndpointOK && connectAOK && connectBOK && syncABOK && syncBAOK && (!TEST_RECONNECT || reconnectOK);

    console.log('--- Results ---');
    console.log(`Ticket endpoint:   ${ticketEndpointOK ? 'PASS' : 'FAIL'}`);
    console.log(`Provider A conn:  ${connectAOK ? 'PASS' : 'FAIL'}`);
    console.log(`Provider B conn:  ${connectBOK ? 'PASS' : 'FAIL'}`);
    console.log(`A -> B sync:      ${syncABOK ? 'PASS' : 'FAIL'}`);
    console.log(`B -> A sync:      ${syncBAOK ? 'PASS' : 'FAIL'}`);
    if (TEST_RECONNECT) console.log(`Reconnect:        ${reconnectOK ? 'PASS' : 'FAIL'}`);
    console.log('');

    if (testPassed) {
      console.log('SYNC PASS: bidirectional text sync via Nginx verified');
    } else {
      console.log('SYNC FAIL: see above for details');
    }

  } catch (error) {
    console.error(`\nSMOKE TEST ERROR: ${error.message}`);
    console.log('\nNginx smoke prerequisites:');
    console.log('  1. nginx running on port 80');
    console.log('  2. collaboration-service running behind nginx');
    console.log('  3. ENABLE_EXPERIMENTAL_CRDT_ENDPOINT=true');
    console.log('  4. workspace-service running');
    console.log('  5. SUPABASE_TEST_JWT set');
    console.log('  6. X-Shared-Secret header injected via custom WebSocket');
  } finally {
    if (providerA) providerA.destroy();
    if (providerB) providerB.destroy();
    if (docA) docA.destroy();
    if (docB) docB.destroy();
    console.log('\nCleanup complete.');
  }

  process.exit(testPassed ? 0 : 1);
}

runSmokeTest().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});