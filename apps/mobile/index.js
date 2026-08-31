/**
 * apps/mobile/index.js
 *
 * React Native / Expo entry point.
 * registerRootComponent handles both AppRegistry.registerComponent()
 * and the Expo-specific setup (splash screen, etc.).
 */
import { LogBox } from 'react-native';

LogBox.ignoreLogs([
  '[expo-av]: Expo AV has been deprecated',
  'Expo AV has been deprecated',
]);

import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
