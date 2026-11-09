// Default Expo config, plus: the AI search Worker in /server is a separate
// project with its own node_modules, deployed to Cloudflare. The app never
// imports it, so Metro shouldn't crawl or watch it.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.blockList = [/[\\/]server[\\/].*/];

module.exports = config;
