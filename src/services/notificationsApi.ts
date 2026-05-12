import { api } from './api';

// Llama al endpoint debug para que el backend envíe una notificación de prueba
// al FCM token registrado del usuario autenticado. Útil para verificar que
// la cadena Firebase Admin → device funciona.
export async function sendTestNotification(): Promise<{ tokenPreview: string }> {
  const res = await api.post('/auth/test-notification');
  return res.data;
}
