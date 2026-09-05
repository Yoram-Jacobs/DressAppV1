/**
 * apps/mobile/index.js
 *
 * React Native / Expo entry point.
 * registerRootComponent handles both AppRegistry.registerComponent()
 * and the Expo-specific setup (splash screen, etc.).
 */
import { registerRootComponent } from 'expo';
import App from './App';

registerRootComponent(App);
