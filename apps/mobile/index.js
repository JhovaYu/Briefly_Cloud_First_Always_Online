// Shim window para compatibilidad con y-webrtc (lib de browser)
if (typeof global.window === 'undefined') {
    global.window = global;
}
if (typeof global.window.addEventListener !== 'function') {
    global.window.addEventListener = () => { };
    global.window.removeEventListener = () => { };
    global.window.dispatchEvent = () => false;
}

// 1. LOS POLYFILLS DEBEN SER LA PRIMERA LÍNEA ABSOLUTA
import './src/polyfills';

// 2. LUEGO todo lo demás (Expo Router, App, etc)
import 'expo-router/entry';
