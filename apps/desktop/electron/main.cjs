const { app, BrowserWindow, ipcMain, Menu } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const os = require('os');

const isDev = !app.isPackaged;
let signalingProcess = null;

/**
 * Obtiene la IP local de la red (preferiblemente WiFi o Ethernet).
 */
function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            // Ignorar IPv6 y localhost
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return '127.0.0.1';
}

/**
 * Inicia el signaling server en puerto 4444 escuchando en 0.0.0.0 (todos los interfaces).
 */
async function startSignalingServer() {
    if (signalingProcess) {
        console.log('[Fluent] Signaling server ya estaba corriendo.');
        return getLocalIP();
    }

    try {
        // El archivo del servidor: node_modules/y-webrtc/bin/server.js
        // En prod, con asarUnpack, el archivo estará en resources/app.asar.unpacked/node_modules/...

        let serverPath;
        if (isDev) {
            serverPath = path.join(__dirname, '..', 'node_modules', 'y-webrtc', 'bin', 'server.js');
        } else {
            // En producción (packaged)
            serverPath = path.join(process.resourcesPath, 'app.asar.unpacked', 'node_modules', 'y-webrtc', 'bin', 'server.js');
        }

        console.log(`[Fluent] Iniciando signaling con: ${process.execPath} (ELECTRON_RUN_AS_NODE) -> ${serverPath}`);

        // Usamos el ejecutable de Electron propiamente dicho para correr el script como Node
        // Esto evita depender de que el usuario tenga Node instalado globalmente
        signalingProcess = spawn(process.execPath, [serverPath], {
            stdio: 'pipe',
            env: {
                ...process.env,
                ELECTRON_RUN_AS_NODE: '1', // Indispensable para ejecutar scripts JS con el binario de Electron
                PORT: '4444',
                HOST: '0.0.0.0'
            },
        });

        signalingProcess.stdout?.on('data', (data) => {
            console.log(`[Signaling] ${data.toString().trim()}`);
        });

        signalingProcess.stderr?.on('data', (data) => {
            console.error(`[Signaling Error] ${data.toString().trim()}`);
        });

        signalingProcess.on('error', (err) => {
            console.error('[Signaling] Failed to start:', err.message);
        });

        console.log('[Fluent] Signaling server iniciado en 0.0.0.0:4444');
        return getLocalIP();
    } catch (err) {
        console.error('[Fluent] Error al iniciar signaling server:', err);
        throw err;
    }
}

/**
 * Detiene el signaling server.
 */
function stopSignalingServer() {
    if (signalingProcess) {
        console.log('[Fluent] Deteniendo signaling server...');
        signalingProcess.kill();
        signalingProcess = null;
    }
}

function createWindow() {
    // Remove default Electron menu (File, Edit, View, etc.)
    Menu.setApplicationMenu(null);

    const win = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        title: 'Briefly',
        icon: path.join(__dirname, '../public/logo.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs'),
        },
        titleBarStyle: 'default',
        backgroundColor: '#1e1e1e',
        show: false,
        autoHideMenuBar: true,
    });

    win.once('ready-to-show', () => {
        win.maximize();
        win.show();
    });

    if (isDev) {
        win.loadURL('http://localhost:5173');
        // win.webContents.openDevTools({ mode: 'detach' });
    } else {
        win.loadFile(path.join(__dirname, '../dist/index.html'));
    }

    win.webContents.setWindowOpenHandler(({ url }) => {
        require('electron').shell.openExternal(url);
        return { action: 'deny' };
    });
}

app.whenReady().then(() => {
    // Manejadores IPC
    ipcMain.handle('start-signaling', async () => {
        return await startSignalingServer();
    });

    ipcMain.handle('stop-signaling', () => {
        stopSignalingServer();
        return true;
    });

    ipcMain.handle('get-local-ip', () => {
        return getLocalIP();
    });

    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) {
            createWindow();
        }
    });
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('before-quit', () => {
    stopSignalingServer();
});

