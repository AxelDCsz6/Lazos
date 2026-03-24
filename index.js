/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { setupBackgroundHandler } from './src/services/notificationService';

// Registrar handler de notificaciones en background/killed
// Debe llamarse antes de registerComponent
setupBackgroundHandler();

AppRegistry.registerComponent(appName, () => App);
