// 0. SAFEGUARD: Protect global.process.getDevServer
// Some libraries (like 'process') overwrite global.process completely.
// We save the original function if it exists.
// @ts-ignore
const originalGetDevServer = global.process?.getDevServer;

import { Buffer } from 'buffer';
import 'react-native-get-random-values'; // Must be before uuid/crypto

// 1. Polyfill Buffer (needed for yjs)
if (typeof global.Buffer === 'undefined') {
    global.Buffer = Buffer;
}

// 2. WebRTC — lazy, only when explicitly requested
// react-native-webrtc is a native module that fails in Expo Go.
// keep the polyfill available but do NOT auto-initialize on startup.
let _webrtcInitialized = false;
export function ensureWebRTC(): boolean {
  if (_webrtcInitialized) return true;
  try {
    const { registerGlobals } = require('react-native-webrtc');
    registerGlobals();
    _webrtcInitialized = true;
    return true;
  } catch {
    // Not available in Expo Go — skip silently, auth doesn't need WebRTC
    _webrtcInitialized = true; // mark done so we don't retry
    return false;
  }
}

// 3. RESTORE: If getDevServer was lost, put it back
// @ts-ignore
if (global.process && originalGetDevServer && !global.process.getDevServer) {
    // @ts-ignore
    global.process.getDevServer = originalGetDevServer;
}
