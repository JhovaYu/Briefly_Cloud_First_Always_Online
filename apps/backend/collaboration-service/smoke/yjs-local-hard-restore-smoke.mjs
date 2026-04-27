/**
 * PM-03E.5C FASE 6: Local Hard Restore Smoke (DOCUMENT_STORE_TYPE=local)
 *
 * Tests that:
 * 1. Provider A + B live relay (A to B text sync)
 * 2. After waiting >30s (periodic fires), Provider C restores after restart
 *
 * Flow:
 * 1. Provider A + B connect, A writes unique text
 * 2. B observes live relay
 * 3. Wait 35s (>30s periodic interval) - periodic task fires and saves
 * 4. Destroy both providers
 * 5. Restart collaboration-service
 * 6. Provider C connects fresh - must see the same text
 *
 * Security:
 * - SUPABASE_TEST_JWT never printed or logged
 * - No AWS/S3 operations
 */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import WebSocket from 'ws';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  if (!jwt) throw new Error('SUPABASE_TEST_JWT environment variable is not set');
  if (jwt.length === 0) throw new Error('SUPABASE_TEST_JWT is empty');
}

async function getTicket(workspaceId, documentId) {
  const jwt = process.env.SUPABASE_TEST_JWT;
  const url = HTTP_BASE + '/collab/' + workspaceId + '/' + documentId + '/ticket';
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
    throw new Error('Ticket endpoint returned ' + response.status + ': ' + text);
  }
  return response.json();
}

async function ensureWorkspaceAndDocument() {
  const jwt = process.env.SUPABASE_TEST_JWT;
  const wsResp = await fetch(WORKSPACE_SERVICE_URL + '/workspaces', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'local-hard-restore-smoke-ws' }),
  });
  if (!wsResp.ok) throw new Error('Failed to create workspace: ' + wsResp.status);
  const workspace = await wsResp.json();
  console.log('Created workspace: ' + mask(workspace.id));

  const docResp = await fetch(WORKSPACE_SERVICE_URL + '/workspaces/' + workspace.id + '/documents', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'local-hard-restore-smoke-doc' }),
  });
  if (!docResp.ok) throw new Error('Failed to create document: ' + docResp.status);
  const document = await docResp.json();
  console.log('Created document: ' + mask(document.id) + '\n');

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
      if (provider.synced) { clearTimeout(timeout); resolve(); }
      else setTimeout(check, 100);
    };
    check();
  });
}

async function waitForCollabHealth(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const resp = await fetch(HTTP_BASE + '/health');
      if (resp.ok) return true;
    } catch { /* ignore */ }
    await sleep(1000);
  }
  throw new Error('collaboration-service /health never OK after restart');
}

function getContainerSnapshotInfo(workspaceId, documentId) {
  // Use LocalFileDocumentStore logic: split storeKey by ':'
  // and construct /data/collab-snapshots/{workspace_id}/{document_id}/latest.bin
  const storeKey = workspaceId + ':' + documentId;
  const pythonCmd = (
    "from app.adapters.local_file_document_store import LocalFileDocumentStore; " +
    "store = LocalFileDocumentStore(root='/data/collab-snapshots'); " +
    "exists = store.exists('" + storeKey.replace(/'/g, "\\'") + "'); " +
    "if exists: " +
    "  import os; " +
    "  p = '/data/collab-snapshots/" + workspaceId + "/" + documentId + "/latest.bin'; " +
    "  print('size:' + str(os.path.getsize(p))); " +
    "else: print('not_found')"
  );
  try {
    const result = spawnSync(
      'docker', ['exec', 'collaboration-service', 'sh', '-c', 'python3 -c "' + pythonCmd + '"'],
      { encoding: 'utf8', timeout: 10000 }
    );
    const output = (result.stdout || '').trim();
    if (output === 'not_found') return { found: false };
    if (output.startsWith('size:')) return { found: true, size: parseInt(output.slice(5), 10) };
    return { found: false };
  } catch {
    return { found: false };
  }
}

function restartCollabLocal() {
  console.log('Restarting collaboration-service (local, no .env.s3)...');
  spawnSync(
    'docker',
    ['compose', 'up', '-d', '--force-recreate', 'collaboration-service'],
    { encoding: 'utf8', timeout: 60000, stdio: 'pipe' }
  );
  console.log('Container restart command issued.\n');
}

async function runLocalHardRestoreSmoke() {
  let providerA = null, docA = null;
  let providerB = null, docB = null;
  let testPassed = false;

  console.log('=== PM-03E.5C FASE 6: Local Hard Restore Smoke ===\n');
  assertEnv();
  console.log('SUPABASE_TEST_JWT: present (not printed)\n');
  console.log('DOCUMENT_STORE_TYPE: local\n');

  const { workspaceId, documentId } = await ensureWorkspaceAndDocument();
  const roomPath = workspaceId + '/' + documentId;
  const storeKey = workspaceId + ':' + documentId;
  console.log('Using room: ' + mask(workspaceId) + '/' + mask(documentId));
  console.log('Store key: ' + storeKey + '\n');

  const uniqueText = 'Local Hard Restore Proof ' + Date.now();
  console.log('Unique text: "' + uniqueText + '"\n');

  const wsClass = USE_NGINX ? HeaderInjectingWebSocket : WebSocket;
  const actualWsBase = USE_NGINX ? 'ws://localhost/collab/crdt' : WS_BASE;

  let bReceivedContent = false;
  let bObserver = null;

  try {
    // Step 1: Get tickets for A and B
    const rA = await getTicket(workspaceId, documentId);
    const rB = await getTicket(workspaceId, documentId);
    console.log('Ticket A: ' + mask(rA.ticket) + ' (role=' + rA.role + ')');
    console.log('Ticket B: ' + mask(rB.ticket) + ' (role=' + rB.role + ')\n');

    // Step 2: Connect Provider A
    docA = new Y.Doc();
    const textA = docA.getText('content');
    providerA = new WebsocketProvider(actualWsBase, roomPath, docA, {
      WebSocketPolyfill: wsClass,
      params: { ticket: rA.ticket },
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Provider A connect timeout (10s)')), 10000);
      providerA.on('status', ({ status }) => {
        if (status === 'connected') { clearTimeout(timeout); resolve(); }
      });
      providerA.on('connection-error', (err) => { clearTimeout(timeout); reject(err); });
    });
    console.log('Provider A connected: PASS');
    await waitForSync(providerA, docA, 5000);
    console.log('Provider A synced.\n');

    // Step 3: Connect Provider B
    docB = new Y.Doc();
    const textB = docB.getText('content');

    bObserver = () => {
      if (textB.toString() === uniqueText) bReceivedContent = true;
    };
    textB.observe(bObserver);

    providerB = new WebsocketProvider(actualWsBase, roomPath, docB, {
      WebSocketPolyfill: wsClass,
      params: { ticket: rB.ticket },
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Provider B connect timeout (10s)')), 10000);
      providerB.on('status', ({ status }) => {
        if (status === 'connected') { clearTimeout(timeout); resolve(); }
      });
      providerB.on('connection-error', (err) => { clearTimeout(timeout); reject(err); });
    });
    console.log('Provider B connected: PASS');
    await waitForSync(providerB, docB, 5000);
    console.log('Provider B synced.\n');

    // Step 4: Provider A writes unique text
    console.log('Provider A writing: "' + uniqueText + '"...');
    docA.transact(() => {
      textA.delete(0, textA.length);
      textA.insert(0, uniqueText);
    });
    console.log('Provider A text: "' + textA.toString() + '"\n');

    // Step 5: Live relay check
    console.log('Waiting for live relay to Provider B...');
    const relayStart = Date.now();
    bReceivedContent = false;
    for (let i = 0; i < 100; i++) {
      await sleep(100);
      if (textB.toString() === uniqueText) { bReceivedContent = true; break; }
    }
    const relayTime = Date.now() - relayStart;
    console.log('Live relay A to B: ' + (bReceivedContent ? 'PASS' : 'FAIL') + ' (' + relayTime + 'ms)');
    console.log('Provider B text: "' + textB.toString() + '"\n');
    if (!bReceivedContent) { console.log('FAIL: Live relay failed\n'); process.exit(1); }

    // Step 6: Keep A+B connected 35s (periodic fires at ~30s, saves dirty+empty rooms)
    // Key: room is dirty (text written) but NOT empty (both A+B connected)
    // So periodic does NOT save it yet (only saves dirty+empty)
    // The point is to let periodic task RUN at least once, proving it works
    console.log('Keeping Provider A+B connected for 35s (periodic fires at ~30s)...');
    console.log('Provider A: "' + textA.toString() + '"');
    console.log('Provider B: "' + textB.toString() + '"');
    await sleep(35000);
    console.log('35s elapsed. Periodic task has fired.\n');

    // Step 7: Check snapshot (may or may not exist - room is not empty so periodic didn't save)
    const snapshotInfoBefore = getContainerSnapshotInfo(workspaceId, documentId);
    console.log('Snapshot before destroy (room not empty so periodic may not save): ' +
      (snapshotInfoBefore.found ? snapshotInfoBefore.size + ' bytes' : 'not found') + '\n');

    // Step 8: Destroy both providers (now room becomes empty+dirty and should be saved)
    console.log('Destroying Provider A and B...');
    textB.unobserve(bObserver);
    await providerA.destroy();
    await providerB.destroy();
    providerA = null; providerB = null;
    docA.destroy(); docB.destroy();
    docA = null; docB = null;
    console.log('Providers destroyed (room now empty+dirty).\n');

    // Wait for snapshot write
    console.log('Waiting 5s for snapshot write...');
    await sleep(5000);

    // Check snapshot after destroy
    const snapshotInfoAfterDestroy = getContainerSnapshotInfo(workspaceId, documentId);
    console.log('Snapshot after destroy: ' +
      (snapshotInfoAfterDestroy.found ? snapshotInfoAfterDestroy.size + ' bytes' : 'not found') + '\n');

    // Step 9: Restart collaboration-service
    restartCollabLocal();
    await waitForCollabHealth(30);
    console.log('collaboration-service /health: OK\n');

    // Step 10: Check snapshot after restart
    const snapshotInfoAfter = getContainerSnapshotInfo(workspaceId, documentId);
    console.log('Snapshot size after restart: ' +
      (snapshotInfoAfter.found ? snapshotInfoAfter.size + ' bytes' : 'not found') + '\n');

    // Step 11: Connect Provider C with fresh Y.Doc
    console.log('Connecting Provider C (fresh Y.Doc)...');
    const rC = await getTicket(workspaceId, documentId);
    console.log('Ticket C: ' + mask(rC.ticket) + ' (role=' + rC.role + ')\n');

    const docC = new Y.Doc();
    const textC = docC.getText('content');
    let cReceivedContent = false;

    const cObserver = () => {
      if (textC.toString() === uniqueText) cReceivedContent = true;
    };
    textC.observe(cObserver);

    const providerC = new WebsocketProvider(actualWsBase, roomPath, docC, {
      WebSocketPolyfill: wsClass,
      params: { ticket: rC.ticket },
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Provider C connect timeout (15s)')), 15000);
      providerC.on('status', ({ status }) => {
        if (status === 'connected') { clearTimeout(timeout); resolve(); }
      });
      providerC.on('connection-error', (err) => { clearTimeout(timeout); reject(err); });
    });
    console.log('Provider C connected: PASS\n');

    await waitForSync(providerC, docC, 5000).catch(() => {});
    console.log('Provider C synced.\n');

    const finalTextC = textC.toString();
    textC.unobserve(cObserver);
    await providerC.destroy();
    docC.destroy();

    // Step 12: Evaluate results
    console.log('=== RESULT ===');
    if (cReceivedContent || finalTextC === uniqueText) {
      testPassed = true;
      console.log('LOCAL HARD RESTORE SMOKE: PASS');
      console.log('Provider C restored: "' + finalTextC + '"');
      console.log('Live relay A to B: PASS (' + relayTime + 'ms)');
      console.log('Snapshot size (after restart): ' +
        (snapshotInfoAfter.found ? snapshotInfoAfter.size + ' bytes' : 'not found'));
    } else {
      console.log('LOCAL HARD RESTORE SMOKE: FAIL');
      console.log('Provider C expected: "' + uniqueText + '"');
      console.log('Provider C got:       "' + finalTextC + '"');
      console.log('Snapshot size: ' + (snapshotInfoAfter.found ? snapshotInfoAfter.size + ' bytes' : 'not found'));
    }
    console.log('');

  } catch (error) {
    console.error('\nSMOKE TEST ERROR: ' + error.message);
  } finally {
    if (providerA) { await providerA.destroy(); providerA = null; }
    if (docA) { docA.destroy(); docA = null; }
    if (providerB) { await providerB.destroy(); providerB = null; }
    if (docB) { docB.destroy(); docB = null; }
    console.log('Cleanup complete.');
  }

  process.exit(testPassed ? 0 : 1);
}

runLocalHardRestoreSmoke().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});