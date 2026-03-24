import { Platform } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import api from './api';

// ─── Solicitar permiso y registrar token FCM ───────────────────
export async function registerForPushNotifications(): Promise<void> {
  try {
    // En iOS hay que pedir permiso explícito; en Android 13+ también
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.log('[notifications] Permisos de notificación denegados');
      return;
    }

    // En Android debemos asegurarnos que el token esté disponible
    if (Platform.OS === 'android') {
      await messaging().registerDeviceForRemoteMessages();
    }

    const token = await messaging().getToken();
    if (!token) { return; }

    // Enviar token al backend
    await api.put('/auth/fcm-token', { token });
    console.log('[notifications] FCM token registrado');
  } catch (err) {
    console.error('[notifications] Error registrando FCM token:', err);
  }
}

// ─── Escuchar cambios de token (rotación automática) ──────────
export function listenForTokenRefresh(): () => void {
  return messaging().onTokenRefresh(async (newToken) => {
    try {
      await api.put('/auth/fcm-token', { token: newToken });
    } catch {
      // silenciar error de red
    }
  });
}

// ─── Handler para mensajes en foreground ──────────────────────
export function setupForegroundHandler(
  onMessage: (title: string, body: string) => void,
): () => void {
  return messaging().onMessage(async (remoteMessage) => {
    const title = remoteMessage.notification?.title ?? '';
    const body  = remoteMessage.notification?.body  ?? '';
    if (title || body) {
      onMessage(title, body);
    }
  });
}

// ─── Handler para mensajes en background/killed ────────────────
// Debe registrarse en index.js antes de cualquier componente
export function setupBackgroundHandler(): void {
  messaging().setBackgroundMessageHandler(async (_remoteMessage) => {
    // FCM muestra la notificación automáticamente en background.
    // Aquí podemos hacer procesamiento adicional si fuera necesario.
  });
}
