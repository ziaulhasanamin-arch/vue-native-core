import type { CapacitorConfig } from '@capacitor/cli';
const config: CapacitorConfig = {
  appId: 'com.takagelokoi.finance',
  appName: 'TakaGeloKoi',
  webDir: 'dist',
  android: { backgroundColor: '#051F20', allowMixedContent: false },
  plugins: { LocalNotifications: { iconColor: '#10B981' } },
};
export default config;
