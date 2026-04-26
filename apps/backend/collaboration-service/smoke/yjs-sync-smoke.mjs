/**
 * PM-03D.4 Yjs sync smoke test using WebsocketProvider.
 *
 * Validates bidirectional Y.Text sync between two yjs clients connected
 * to the pycrdt-websocket server via y-websocket WebsocketProvider.
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
 *   node yjs-sync-smoke.mjs
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

  // Try existing env vars first
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

  // Create workspace
  const wsResp = await fetch(`${WORKSPACE_SERVICE_URL}/workspaces`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'smoke-test-workspace' }),
  });
  if (!wsResp.ok) throw new Error(`Failed to create workspace: ${wsResp.status}`);
  const workspace = await wsResp.json();
  console.log(`Created workspace: ${mask(workspace.id)}`);

  // Create document
  const docResp = await fetch(`${WORKSPACE_SERVICE_URL}/workspaces/${workspace.id}/documents`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'smoke-test-doc' }),
  });
  if (!docResp.ok) throw new Error(`Failed to create document: ${docResp.status}`);
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
    console.log('=== PM-03D.4 Yjs Sync Smoke (WebsocketProvider) ===\n');

    // Step 0: Env check
    assertEnv();
    console.log('SUPABASE_TEST_JWT: present (not printed)\n');

    // Step 1: Ensure workspace and document exist
    const { workspaceId, documentId } = await ensureWorkspaceAndDocument();
    console.log(`Using room: ${mask(workspaceId)}/${mask(documentId)}\n`);

    // Step 2: Get two separate tickets
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

    // Step 3: Create Y.Docs
    docA = new Y.Doc();
    docB = new Y.Doc();
    const textA = docA.getText('content');
    const textB = docB.getText('content');

    // Step 4: Connect Provider A
    console.log('Connecting Provider A...');
    providerA = new WebsocketProvider(
      WS_BASE,
      `${workspaceId}/${documentId}`,
      docA,
      {
        WebSocketPolyfill: WebSocket,
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

    // Step 5: Connect Provider B
    console.log('Connecting Provider B...');
    providerB = new WebsocketProvider(
      WS_BASE,
      `${workspaceId}/${documentId}`,
      docB,
      {
        WebSocketPolyfill: WebSocket,
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

    // Step 6: Wait for initial sync
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

    // Step 7: A writes -> B should receive
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

    // Wait up to 5s for B to receive
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

    // Step 8: B writes -> A should receive
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

    // Wait up to 5s for A to receive
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

    testPassed = ticketEndpointOK && connectAOK && connectBOK && syncABOK && syncBAOK;

    console.log('--- Results ---');
    console.log(`Ticket endpoint:   ${ticketEndpointOK ? 'PASS' : 'FAIL'}`);
    console.log(`Provider A conn:  ${connectAOK ? 'PASS' : 'FAIL'}`);
    console.log(`Provider B conn:  ${connectBOK ? 'PASS' : 'FAIL'}`);
    console.log(`A -> B sync:      ${syncABOK ? 'PASS' : 'FAIL'}`);
    console.log(`B -> A sync:      ${syncBAOK ? 'PASS' : 'FAIL'}`);
    console.log('');

    if (testPassed) {
      console.log('SYNC PASS: bidirectional text sync verified');
    } else {
      console.log('SYNC FAIL: see above for details');
      if (!syncABOK) console.log(`  textA="${textA.toString()}" textB="${textBValue}"`);
    }

  } catch (error) {
    console.error(`\nSMOKE TEST ERROR: ${error.message}`);
    console.log('\nPrerequisites:');
    console.log('  1. collaboration-service running on port 8002');
    console.log('  2. ENABLE_EXPERIMENTAL_CRDT_ENDPOINT=true');
    console.log('  3. workspace-service running (for ticket validation)');
    console.log('  4. SUPABASE_TEST_JWT set in environment');
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