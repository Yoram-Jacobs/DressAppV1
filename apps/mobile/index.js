/**
 * apps/mobile/index.js
 */
import { AppRegistry } from 'react-native';
import registerRootComponent from 'expo/src/launch/registerRootComponent';
import App from './App';

AppRegistry.registerComponent('main', () => App);
AppRegistry.registerComponent('dressapp', () => App);
AppRegistry.registerComponent('DressApp', () => App);
AppRegistry.registerComponent('apps/mobile/index', () => App);
AppRegistry.registerComponent('index', () => App);

registerRootComponent(App);
