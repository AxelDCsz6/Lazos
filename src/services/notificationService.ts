import { Platform, PermissionsAndroid, DeviceEventEmitter } from 'react-native';
import { api } from './api';

// Lazy/safe acceso a @react-native-firebase/messaging. Si el módulo nativo no
// está disponible (p.ej. falta google-services.json en cold-start), devolvemos
// null y todos los puntos de entrada hacen no-op en lugar de propagar el crash.
type MessagingModule = ReturnType<typeof getMessagingModule>;
function getMessagingModule(): any {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  return require('@react-native-firebase/messaging');
}

function safeMessaging(): any | null {
  try {
    const mod = getMessagingModule();
    const messaging = mod?.default;
    if (typeof messaging !== 'function') {
      console.warn('[notifications] messaging() no disponible');
      return null;
    }
    // Probar instanciación; algunos errores nativos solo se ven aquí.
    const instance = messaging();
    if (!instance) { return null; }
    return messaging;
  } catch (err) {
    console.warn('[notifications] Firebase messaging no disponible:', err);
    return null;
  }
}

// Race una promesa contra un timeout. Si timeout vence, resuelve a null.
// Necesario porque messaging().getToken() y registerDeviceForRemoteMessages()
// pueden colgarse en cold-start cuando Play Services aún no responde.
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    let done = false;
    const t = setTimeout(() => { if (!done) { done = true; resolve(null); } }, ms);
    p.then((v) => { if (!done) { done = true; clearTimeout(t); resolve(v); } })
      .catch(() => { if (!done) { done = true; clearTimeout(t); resolve(null); } });
  });
}

// ─── Solicitar permiso y registrar token FCM ───────────────────
export async function registerForPushNotifications(): Promise<void> {
  const messaging = safeMessaging();
  if (!messaging) {
    console.warn('[notifications] registerForPushNotifications: no-op (messaging no disponible)');
    return;
  }
  try {
    // Android 13+ (API 33) requiere permiso en tiempo de ejecución
    if (Platform.OS === 'android' && Platform.Version >= 33) {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        console.log('[notifications] Permiso POST_NOTIFICATIONS denegado');
        return;
      }
    } else if (Platform.OS === 'ios') {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;
      if (!enabled) {
        console.log('[notifications] Permisos iOS denegados');
        return;
      }
    }

    const registered = await withTimeout(
      messaging().registerDeviceForRemoteMessages(),
      8000,
    );
    if (registered === null) {
      console.warn('[notifications] registerDeviceForRemoteMessages timeout');
      return;
    }

    const token = await withTimeout<string>(messaging().getToken(), 8000);
    if (!token) {
      console.warn('[notifications] getToken() devolvió vacío o timeout');
      return;
    }

    await api.put('/auth/fcm-token', { token });
    console.log('[notifications] FCM token registrado:', token.slice(0, 20) + '...');
  } catch (err) {
    console.error('[notifications] Error registrando FCM token:', err);
  }
}

// ─── Escuchar cambios de token (rotación automática) ──────────
export function listenForTokenRefresh(): () => void {
  const messaging = safeMessaging();
  if (!messaging) {
    console.warn('[notifications] listenForTokenRefresh: no-op (messaging no disponible)');
    return () => {};
  }
  try {
    return messaging().onTokenRefresh(async (newToken: string) => {
      try {
        await api.put('/auth/fcm-token', { token: newToken });
      } catch {
        // silenciar error de red
      }
    });
  } catch (err) {
    console.warn('[notifications] listenForTokenRefresh error:', err);
    return () => {};
  }
}

// Ref compartido del lazo cuyo chat está actualmente abierto. Se setea desde
// ChatModal para que el handler de notificaciones no incremente unread del
// lazo que el usuario ya está viendo.
let activeChatLazoId: string | null = null;
export function setActiveChatLazo(id: string | null): void { activeChatLazoId = id; }
export function getActiveChatLazo(): string | null { return activeChatLazoId; }

// ─── Handler para mensajes en foreground ──────────────────────
export function setupForegroundHandler(
  onMessage: (title: string, body: string) => void,
): () => void {
  const messaging = safeMessaging();
  if (!messaging) {
    console.warn('[notifications] setupForegroundHandler: no-op (messaging no disponible)');
    return () => {};
  }
  try {
    return messaging().onMessage(async (remoteMessage: any) => {
      const title = remoteMessage.notification?.title ?? '';
      const body  = remoteMessage.notification?.body  ?? '';
      const data = remoteMessage.data ?? {};
      const lazoId = typeof data.lazoId === 'string' ? data.lazoId : undefined;
      const kind = typeof data.type === 'string' ? data.type : undefined;

      // Incrementar contador de no leídos si la notificación es de mensaje
      // y el chat de ese lazo no está abierto en pantalla.
      if (lazoId && kind === 'message' && activeChatLazoId !== lazoId) {
        try {
          const { incrementUnread } = await import('./unreadService');
          await incrementUnread(lazoId);
        } catch {
          // best-effort
        }
      }

      // Emitir eventos para que la UI reaccione en tiempo real
      if (kind === 'watering' && lazoId) {
        DeviceEventEmitter.emit('lazos:refresh', { reason: 'watering', lazoId });
      } else if (kind === 'lazo_created' && lazoId) {
        DeviceEventEmitter.emit('lazos:refresh', { reason: 'created', lazoId });
      } else if (kind === 'lazo_deleted' && lazoId) {
        const deleterUsername = typeof data.deleterUsername === 'string' ? data.deleterUsername : '';
        DeviceEventEmitter.emit('lazos:deleted-by-partner', { lazoId, deleterUsername });
      }

      if (title || body) {
        onMessage(title, body);
      }
    });
  } catch (err) {
    console.warn('[notifications] setupForegroundHandler error:', err);
    return () => {};
  }
}

// ─── Handler para mensajes en background/killed ────────────────
// Debe registrarse en index.js antes de cualquier componente
export function setupBackgroundHandler(): void {
  const messaging = safeMessaging();
  if (!messaging) {
    console.warn('[notifications] setupBackgroundHandler: no-op (messaging no disponible)');
    return;
  }
  try {
    messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
      // FCM muestra la notificación automáticamente en background.
      // Persistir incremento de no leídos para que al abrir la app el badge ya esté.
      try {
        const data = remoteMessage.data ?? {};
        const lazoId = typeof data.lazoId === 'string' ? data.lazoId : undefined;
        const kind = typeof data.type === 'string' ? data.type : undefined;
        if (lazoId && kind === 'message') {
          const { incrementUnread } = await import('./unreadService');
          await incrementUnread(lazoId);
        }
      } catch {
        // best-effort
      }
    });
  } catch (err) {
    console.warn('[notifications] setupBackgroundHandler error:', err);
  }
}

// Tipo dummy export para evitar warning unused
export type _MessagingModule = MessagingModule;
