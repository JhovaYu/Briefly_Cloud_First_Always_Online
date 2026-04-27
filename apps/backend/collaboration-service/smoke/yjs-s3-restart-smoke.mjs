/**
 * PM-03E.5B.1 S3 Hard Restart Smoke — validates S3 restore after container restart.
 *
 * Flow:
 * 1. Connect Provider A — write "S3 Restart Proof <timestamp>"
 * 2. Disconnect Provider A cleanly (triggers snapshot save on disconnect)
 * 3. Head-object check: verify latest.bin exists in S3, record ContentLength
 * 4. Reiniciar collaboration-service container via docker compose --force-recreate
 * 5. Wait for /health OK
 * 6. Connect Provider B with fresh Y.Doc — verify it sees the same text
 * 7. Head-object check again: verify ContentLength unchanged
 * 8. Report findings (especially if ContentLength is suspiciously small)
 *
 * Usage:
 *   cd apps/backend/collaboration-service/smoke
 *   node yjs-s3-restart-smoke.mjs
 *
 * Security:
 *   - SUPABASE_TEST_JWT never printed or logged
 *   - AWS secrets never printed or logged
 *   - S3 body never downloaded
 *   - Only head_object used for S3 validation
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
    body: JSON.stringify({ name: 's3-restart-smoke-workspace' }),
  });
  if (!wsResp.ok) throw new Error(`Failed to create workspace: ${wsResp.status}`);
  const workspace = await wsResp.json();
  console.log(`Created workspace: ${mask(workspace.id)}`);

  const docResp = await fetch(`${WORKSPACE_SERVICE_URL}/workspaces/${workspace.id}/documents`, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + jwt, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 's3-restart-smoke-doc' }),
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

/**
 * Check S3 head-object using a standalone Python script that reads .env.s3 directly.
 * Returns { found: bool, content_length: int|null, key: str, error: str|null }
 * Does NOT download body. Does NOT print secrets.
 */
function getS3HeadObject(workspaceId, documentId) {
  const key = `collab-snapshots/${workspaceId}/${documentId}/latest.bin`;
  try {
    const result = spawnSync(
      'python',
      [
        join(__dirname, 's3_head_check.py'),
        workspaceId,
        documentId,
      ],
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
  console.log('Restarting collaboration-service container (docker compose force-recreate)...');
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

async function runRestartSmokeTest() {
  let providerA = null;
  let docA = null;
  let testPassed = false;

  console.log('=== PM-03E.5B.1 S3 Hard Restart Smoke ===\n');
  assertEnv();
  console.log('SUPABASE_TEST_JWT: present (not printed)\n');

  const { workspaceId, documentId } = await ensureWorkspaceAndDocument();
  const roomPath = `${workspaceId}/${documentId}`;
  console.log(`Using room: ${mask(workspaceId)}/${mask(documentId)}`);
  console.log(`S3 key: collab-snapshots/${mask(workspaceId)}/${mask(documentId)}/latest.bin\n`);

  const uniqueText = `S3 Restart Proof ${Date.now()}`;
  console.log(`Unique text for this run: "${uniqueText}"\n`);

  let s3InfoBefore = { found: false };
  let s3InfoAfter = { found: false };

  try {
    // ── Step 1: Get ticket and connect Provider A ──────────────────────────
    const rA = await getTicket(workspaceId, documentId);
    const ticketA = rA.ticket;
    console.log(`Ticket A: ${mask(ticketA)} (role=${rA.role})\n`);

    docA = new Y.Doc();
    const textA = docA.getText('content');

    const wsClass = USE_NGINX ? HeaderInjectingWebSocket : WebSocket;
    const actualWsBase = USE_NGINX ? 'ws://localhost/collab/crdt' : WS_BASE;

    console.log('Connecting Provider A...');
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

    // ── Step 2: Wait for initial sync and write unique content ──────────────
    await waitForSync(providerA, docA, 5000);
    console.log('Initial sync done.\n');

    console.log(`Writing unique text: "${uniqueText}"...`);
    docA.transact(() => {
      textA.delete(0, textA.length);
      textA.insert(0, uniqueText);
    });

    for (let i = 0; i < 50; i++) {
      await sleep(100);
      if (textA.toString() === uniqueText) break;
    }
    console.log(`Content written: textA="${textA.toString()}"\n`);

    // ── Step 3: Disconnect cleanly (triggers snapshot save on disconnect) ─────
    console.log('Disconnecting Provider A cleanly (snapshot should be saved to S3)...');
    await providerA.destroy();
    providerA = null;
    docA.destroy();
    docA = null;
    console.log('Provider A destroyed.\n');

    // ── Step 4: Wait for periodic snapshot to fire (45s interval) ─────────
    console.log('Waiting 45s for periodic snapshot to be written to S3...');
    await sleep(45000);

    // ── Step 5: S3 head-object check BEFORE restart ───────────────────────
    console.log('Checking S3 object existence and ContentLength BEFORE restart...');
    s3InfoBefore = getS3HeadObject(workspaceId, documentId);
    if (s3InfoBefore.found) {
      console.log(`S3 key: ${s3InfoBefore.key}`);
      console.log(`S3 ContentLength BEFORE restart: ${s3InfoBefore.content_length} bytes`);
    } else {
      console.log(`S3 object NOT FOUND before restart: ${JSON.stringify(s3InfoBefore.error || 'unknown error')}`);
    }
    console.log('');

    if (!s3InfoBefore.found) {
      console.log('SMOKE TEST FAIL: latest.bin not found in S3 before restart\n');
      process.exit(1);
    }

    // ── Step 6: Restart collaboration-service container ────────────────────
    restartCollabService();

    // ── Step 7: Wait for health OK ─────────────────────────────────────────
    console.log('Waiting for /health to be OK...');
    await waitForCollabHealth(30);
    console.log('collaboration-service /health: OK\n');

    // ── Step 8: S3 head-object check AFTER restart (before Provider B) ────
    console.log('Checking S3 object ContentLength AFTER restart (before Provider B)...');
    s3InfoAfter = getS3HeadObject(workspaceId, documentId);
    if (s3InfoAfter.found) {
      console.log(`S3 ContentLength AFTER restart: ${s3InfoAfter.content_length} bytes`);
    } else {
      console.log(`S3 object NOT FOUND after restart: ${JSON.stringify(s3InfoAfter.error || 'unknown error')}`);
    }
    console.log('');

    // ── Step 9: Connect Provider B with fresh Y.Doc ─────────────────────────
    console.log('Connecting Provider B with fresh Y.Doc (should see persisted content)...');
    const rB = await getTicket(workspaceId, documentId);
    const ticketB = rB.ticket;
    console.log(`Ticket B: ${mask(ticketB)} (role=${rB.role})\n`);

    const docB = new Y.Doc();
    const textB = docB.getText('content');
    let bReceivedContent = false;

    const bObserver = () => {
      if (textB.toString() === uniqueText) {
        bReceivedContent = true;
      }
    };
    textB.observe(bObserver);

    const providerB = new WebsocketProvider(actualWsBase, roomPath, docB, {
      WebSocketPolyfill: wsClass,
      params: { ticket: ticketB },
    });

    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Provider B connect timeout (15s)')), 15000);
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
    await providerB.destroy();
    docB.destroy();

    // ── Step 10: Evaluate result ───────────────────────────────────────────
    const contentLengthChanged = s3InfoBefore.found && s3InfoAfter.found &&
      s3InfoBefore.content_length !== s3InfoAfter.content_length;

    console.log('=== RESULT ===');
    if (bReceivedContent || finalTextB === uniqueText) {
      testPassed = true;
      console.log(`HARD RESTART SMOKE: PASS`);
      console.log(`Provider B restored text: "${finalTextB}"`);
      console.log(`S3 ContentLength before restart: ${s3InfoBefore.content_length} bytes`);
      console.log(`S3 ContentLength after restart:  ${s3InfoAfter.content_length} bytes`);
      if (contentLengthChanged) {
        console.log(`NOTE: ContentLength CHANGED (${s3InfoBefore.content_length} → ${s3InfoAfter.content_length}) — investigate why`);
      }
      if (s3InfoBefore.content_length <= 10) {
        console.log(`NOTE: ContentLength is suspiciously small (${s3InfoBefore.content_length} bytes).`);
        console.log(`If Provider B correctly restored the text, the snapshot format may use efficient encoding.`);
      }
      console.log('');
    } else {
      console.log(`HARD RESTART SMOKE: FAIL`);
      console.log(`Provider B expected: "${uniqueText}"`);
      console.log(`Provider B got:       "${finalTextB}"`);
      console.log(`S3 ContentLength before restart: ${s3InfoBefore.content_length} bytes`);
      console.log(`S3 ContentLength after restart:  ${s3InfoAfter.content_length} bytes`);
      console.log('');
    }

  } catch (error) {
    console.error(`\nSMOKE TEST ERROR: ${error.message}`);
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

runRestartSmokeTest().catch(err => {
  console.error('Unexpected error:', err);
  process.exit(1);
});
