/**
 * PM-03E.5B.2 S3 Live Relay + Periodic Persistence Smoke.
 *
 * Tests that:
 * 1. Provider B sees A's text in LIVE relay (real-time sync)
 * 2. S3 snapshot is saved by periodic task (>2 bytes = real content)
 * 3. Provider C restores the text after restart (true persistence)
 *
 * Flow:
 * 1. Provider A + B connect simultaneously
 * 2. A writes unique text
 * 3. B observes the text live (relay check)
 * 4. A+B stay connected 45s+ (periodic snapshot)
 * 5. S3 head-object check
 * 6. Destroy both providers
 * 7. Restart collaboration-service
 * 8. Provider C connects fresh → must see the same text
 *
 * Usage:
 *   node yjs-s3-live-periodic-smoke.mjs
 *
 * Security:
 *   - SUPABASE_TEST_JWT never printed or logged
 *   - AWS secrets never printed or logged
 *   - S3 body never downloaded
 */

import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import WebSocket from 'ws';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

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
  const wsResp = await fetch(`${WORKSPACE_SERVICE_URL}/workspaces`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'live-periodic-smoke-workspace' }),
  });
  if (!wsResp.ok) throw new Error(`Failed to create workspace: ${wsResp.status}`);
  const workspace = await wsResp.json();
  console.log(`Created workspace: ${mask(workspace.id)}`);

  const docResp = await fetch(`${WORKSPACE_SERVICE_URL}/workspaces/${workspace.id}/documents`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'live-periodic-smoke-doc' }),
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

async function waitForCollabHealth(maxAttempts = 30) {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const resp = await fetch(`${HTTP_BASE}/health`);
      if (resp.ok) return true;
    } catch { /* ignore */ }
    await sleep(1000);
  }
  throw new Error('collaboration-service /health never OK after restart');
}

function getS3HeadObject(workspaceId, documentId) {
  const key = `collab-snapshots/${workspaceId}/${documentId}/latest.bin`;
  try {
    const result = spawnSync(
      'python',
      [join(__dirname, 's3_head_check.py'), workspaceId, documentId],
      { encoding: 'utf8', timeout: 15000 }
    );
    const output = (result.stdout || '').trim();
    if (!output) return { found: false, key, error: 'no output' };
    return JSON.parse(output);
  } catch (e) {
    return { found: false, key, error: e.message };
  }
}

function restartCollabService() {
  console.log('Restarting collaboration-service container...');
  try {
    spawnSync(
      'docker',
      ['compose', '--env-file', '.env.s3', 'up', '-d', '--force-recreate', 'collaboration-service'],
      { encoding: 'utf8', timeout: 60000, stdio: 'pipe' }
    );
    console.log('Container restart command issued.\n');
  } catch (e) {
    throw new Error(`docker compose restart failed: ${e.message}`);
  }
}

async function runLivePeriodicSmoke() {
  let providerA = null, docA = null;
  let providerB = null, docB = null;
  let testPassed = false;

  console.log('=== PM-03E.5B.2 S3 Live Relay + Periodic Persistence Smoke ===\n');
  assertEnv();
  console.log('SUPABASE_TEST_JWT: present (not printed)\n');

  const { workspaceId, documentId } = await ensureWorkspaceAndDocument();
  const roomPath = `${workspaceId}/${documentId}`;
  console.log(`Using room: ${mask(workspaceId)}/${mask(documentId)}`);
  console.log(`S3 key: collab-snapshots/${mask(workspaceId)}/${mask(documentId)}/latest.bin\n`);

  const uniqueText = `S3 Live Periodic Proof ${Date.now()}`;
  console.log(`Unique text for this run: "${uniqueText}"\n`);

  const wsClass = USE_NGINX ? HeaderInjectingWebSocket : WebSocket;
  const actualWsBase = USE_NGINX ? 'ws://localhost/collab/crdt' : WS_BASE;

  let bReceivedContent = false;
  let bObserver = null;

  try {
    // ── Step 1: Get tickets for A and B ───────────────────────────────────
    const [rA, rB] = await Promise.all([
      getTicket(workspaceId, documentId),
      getTicket(workspaceId, documentId),
    ]);
    console.log(`Ticket A: ${mask(rA.ticket)} (role=${rA.role})`);
    console.log(`Ticket B: ${mask(rB.ticket)} (role=${rB.role})\n`);

    // ── Step 2: Connect Provider A ──────────────────────────────────────────
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

    // ── Step 3: Connect Provider B ──────────────────────────────────────────
    docB = new Y.Doc();
    const textB = docB.getText('content');

    bObserver = () => {
      if (textB.toString() === uniqueText) {
        bReceivedContent = true;
      }
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

    // ── Step 4: Provider A writes unique text ────────────────────────────────
    console.log(`Provider A writing unique text: "${uniqueText}"...`);
    docA.transact(() => {
      textA.delete(0, textA.length);
      textA.insert(0, uniqueText);
    });
    console.log(`Provider A written: "${textA.toString()}"\n`);

    // ── Step 5: Wait for live relay to Provider B ───────────────────────────
    console.log('Waiting up to 10s for Provider B to receive text via live relay...');
    const relayStart = Date.now();
    bReceivedContent = false;
    for (let i = 0; i < 100; i++) {
      await sleep(100);
      if (textB.toString() === uniqueText) {
        bReceivedContent = true;
        break;
      }
    }

    const relayTime = Date.now() - relayStart;
    const relayText = textB.toString();
    console.log(`Live relay to B: ${bReceivedContent ? 'PASS' : 'FAIL'} (${relayTime}ms)`);
    console.log(`Provider B text after relay: "${relayText}"\n`);

    if (!bReceivedContent) {
      console.log('FAIL: Provider B did not receive text via live relay\n');
      process.exit(1);
    }

    // ── Step 6: Keep A+B connected for 45s (periodic snapshot) ─────────────
    console.log('Keeping Provider A+B connected for 45s to allow periodic snapshot...');
    console.log('Provider A text: "' + textA.toString() + '"');
    console.log('Provider B text: "' + textB.toString() + '"');
    await sleep(45000);
    console.log('45s elapsed.\n');

    // ── Step 7: S3 head-object check BEFORE destroy ─────────────────────────
    console.log('Checking S3 object existence and ContentLength (before destroy)...');
    const s3InfoBefore = getS3HeadObject(workspaceId, documentId);
    if (s3InfoBefore.found) {
      console.log(`S3 key: ${s3InfoBefore.key}`);
      console.log(`S3 ContentLength: ${s3InfoBefore.content_length} bytes`);
    } else {
      console.log(`S3 object NOT FOUND: ${JSON.stringify(s3InfoBefore.error || 'unknown')}`);
    }
    console.log('');

    if (!s3InfoBefore.found) {
      console.log('FAIL: latest.bin not found in S3 after 45s\n');
      process.exit(1);
    }

    if (s3InfoBefore.content_length <= 2) {
      console.log(`FAIL: ContentLength is ${s3InfoBefore.content_length} bytes — snapshot is empty\n`);
      process.exit(1);
    }

    // ── Step 8: Destroy both providers ─────────────────────────────────────
    console.log('Destroying Provider A and B...');
    textB.unobserve(bObserver);
    await providerA.destroy();
    await providerB.destroy();
    providerA = null; providerB = null;
    docA.destroy(); docB.destroy();
    docA = null; docB = null;
    console.log('Providers destroyed.\n');

    // ── Step 9: Restart collaboration-service ───────────────────────────────
    restartCollabService();
    await waitForCollabHealth(30);
    console.log('collaboration-service /health: OK\n');

    // ── Step 10: S3 check after restart (before Provider C) ─────────────────
    console.log('S3 ContentLength after restart (before Provider C)...');
    const s3InfoAfter = getS3HeadObject(workspaceId, documentId);
    if (s3InfoAfter.found) {
      console.log(`S3 ContentLength: ${s3InfoAfter.content_length} bytes`);
    } else {
      console.log(`S3 object NOT FOUND after restart`);
    }
    console.log('');

    // ── Step 11: Connect Provider C with fresh Y.Doc ────────────────────────
    console.log('Connecting Provider C with fresh Y.Doc...');
    const rC = await getTicket(workspaceId, documentId);
    console.log(`Ticket C: ${mask(rC.ticket)} (role=${rC.role})\n`);

    const docC = new Y.Doc();
    const textC = docC.getText('content');
    let cReceivedContent = false;

    const cObserver = () => {
      if (textC.toString() === uniqueText) {
        cReceivedContent = true;
      }
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

    // ── Step 12: Evaluate results ───────────────────────────────────────────
    console.log('=== RESULT ===');
    if (cReceivedContent || finalTextC === uniqueText) {
      testPassed = true;
      console.log('HARD RESTART SMOKE: PASS');
      console.log(`Provider C restored text: "${finalTextC}"`);
      console.log(`S3 ContentLength (before destroy): ${s3InfoBefore.content_length} bytes`);
      console.log(`S3 ContentLength (after restart):  ${s3InfoAfter.content_length || 'N/A'} bytes`);
      console.log(`Live relay A→B: PASS (${relayTime}ms)`);
    } else {
      console.log('HARD RESTART SMOKE: FAIL');
      console.log(`Provider C expected: "${uniqueText}"`);
      console.log(`Provider C got:       "${finalTextC}"`);
      console.log(`S3 ContentLength (before destroy): ${s3InfoBefore.content_length} bytes`);
    }
    console.log('');

  } catch (error) {
    console.error(`\nSMOKE TEST ERROR: ${error.message}`);
  } finally {
    if (providerA) { await providerA.destroy(); providerA = null; }
    if (docA) { docA.destroy(); docA = null; }
    if (providerB) { await providerB.destroy(); providerB = null; }
    if (docB) { docB.destroy(); docB = null; }
    console.log('Cleanup complete.');
  }

  process.exit(testPassed ? 0 : 1);
}

runLivePeriodicSmoke().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
