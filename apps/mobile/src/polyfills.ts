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

// 2. Polyfill WebRTC (Crucial for y-webrtc)
import { registerGlobals } from 'react-native-webrtc';
registerGlobals();

// 3. RESTORE: If getDevServer was lost, put it back
// @ts-ignore
if (global.process && originalGetDevServer && !global.process.getDevServer) {
    // @ts-ignore
    global.process.getDevServer = originalGetDevServer;
}
