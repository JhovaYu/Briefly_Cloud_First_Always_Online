export { };

declare global {
    interface Window {
        electronAPI: {
            startSignaling: () => Promise<string>;
            stopSignaling: () => Promise<boolean>;
            getLocalIP: () => Promise<string>;
        };
    }
}
