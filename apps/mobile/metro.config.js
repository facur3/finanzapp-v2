const path = require('node:path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
const repositoryRoot = path.resolve(__dirname, '../..');
// Independent install/lockfile: adding mobile must not alter the web deploy.
config.watchFolders = [repositoryRoot];
config.resolver.nodeModulesPaths = [path.join(__dirname, 'node_modules')];
module.exports = config;
