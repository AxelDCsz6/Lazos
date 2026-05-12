/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import { setupBackgroundHandler } from './src/services/notificationService';

// Registrar handler de notificaciones en background/killed
// Debe llamarse antes de registerComponent. Envuelto en try/catch porque si el
// módulo nativo de Firebase no inicializa a tiempo en cold-start, lanza y mata
// el JS thread antes de que la app pueda arrancar.
try {
  setupBackgroundHandler();
} catch (err) {
  console.warn('[notifications] setupBackgroundHandler falló en cold-start:', err);
}

AppRegistry.registerComponent(appName, () => App);
