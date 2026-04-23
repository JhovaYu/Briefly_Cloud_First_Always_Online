const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Find the project and workspace directories
const projectRoot = __dirname;
// This can be replaced with `find-yarn-workspace-root`
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// 1. Watch all files within the monorepo
config.watchFolders = [workspaceRoot];
// 2. Let Metro know where to resolve packages and in what order
config.resolver.nodeModulesPaths = [
    path.resolve(projectRoot, 'node_modules'),
    path.resolve(workspaceRoot, 'node_modules'),
];
// 3. Force Metro to resolve (sub)dependencies from the `node_modules`
//    of the project, instead of where they are defined.
//    (required for packages using peerDependencies)
config.resolver.disableHierarchicalLookup = true;

// 4. PREVENT 'process' MODULE RESOLUTION (The Radical Fix)
config.resolver.blockList = [
    // This stops Metro from even looking at the 'process' package in node_modules
    /node_modules\/process\/.*/,
    /node_modules\/.*\/node_modules\/process\/.*/,
];

// 5. Shim isomorphic-webcrypto
config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (moduleName === 'isomorphic-webcrypto/src/react-native') {
        return {
            filePath: path.resolve(__dirname, './shims/isomorphic-webcrypto.js'),
            type: 'sourceFile',
        };
    }
    return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
