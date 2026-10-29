import type {CapacitorConfig} from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.maxnjun.burgundyexpanded',
  appName: 'Burgundy Expanded',
  loggingBehavior: 'none',
  webDir: '.local-data/android/web',
  // Keep the existing server's authenticated WebSocket Origin check intact.
  // This is the bundled asset origin, NOT server.url (the app starts offline).
  server: {hostname: 'burgundy-expanded.onrender.com', androidScheme: 'https'},
  android: {allowMixedContent: false, webContentsDebuggingEnabled: false, minWebViewVersion: 111},
  plugins: {SystemBars: {insetsHandling: 'native'}},
};
export default config;
