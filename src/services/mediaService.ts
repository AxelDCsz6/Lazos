import {
  launchCamera,
  launchImageLibrary,
  Asset,
  CameraOptions,
  ImageLibraryOptions,
} from 'react-native-image-picker';
import { Platform, PermissionsAndroid } from 'react-native';
import { api } from './api';
import { API_BASE_URL } from '../constants';
import { Message } from '../types';

// Reusa el mapper del servicio de messages.
function mapMessage(m: any): Message {
  return {
    id: m.id,
    lazoId: m.lazo_id,
    senderId: m.sender_id,
    content: m.content,
    type: m.type,
    status: m.status,
    createdAt: m.created_at,
    replyToId: m.reply_to_id ?? undefined,
    replyContent: m.reply_content ?? undefined,
    replySenderId: m.reply_sender_id ?? undefined,
    reactions: Array.isArray(m.reactions)
      ? (m.reactions as any[]).map(r => ({ userId: r.userId ?? r.user_id, type: r.type }))
      : [],
    mediaUrl: m.media_url ?? undefined,
    mediaMime: m.media_mime ?? undefined,
    mediaWidth: m.media_width ?? undefined,
    mediaHeight: m.media_height ?? undefined,
    mediaDurationMs: m.media_duration_ms ?? undefined,
  };
}

async function ensureCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') { return true; }
  const granted = await PermissionsAndroid.request(
    PermissionsAndroid.PERMISSIONS.CAMERA,
  );
  return granted === PermissionsAndroid.RESULTS.GRANTED;
}

export async function pickFromCamera(): Promise<Asset | null> {
  const ok = await ensureCameraPermission();
  if (!ok) { return null; }
  const options: CameraOptions = {
    mediaType: 'mixed',
    quality: 0.8,
    videoQuality: 'high',
    saveToPhotos: false,
  };
  const res = await launchCamera(options);
  if (res.didCancel || res.errorCode || !res.assets || res.assets.length === 0) { return null; }
  return res.assets[0];
}

export async function pickFromGallery(): Promise<Asset | null> {
  const options: ImageLibraryOptions = {
    mediaType: 'mixed',
    quality: 0.8,
    selectionLimit: 1,
  };
  const res = await launchImageLibrary(options);
  if (res.didCancel || res.errorCode || !res.assets || res.assets.length === 0) { return null; }
  return res.assets[0];
}

// Compone una URL absoluta a partir de la URL relativa que devuelve el backend.
// Si la URL ya es absoluta (file:// o http(s)://), la devuelve sin tocar.
export function resolveMediaUrl(url: string | undefined): string | undefined {
  if (!url) { return undefined; }
  if (/^(https?:|file:|content:|data:)/i.test(url)) { return url; }
  // API_BASE_URL termina en /api; el endpoint de media vive en la raíz del backend.
  const base = API_BASE_URL.replace(/\/api\/?$/, '');
  return base + url;
}

export async function uploadMedia(
  lazoId: string,
  asset: Asset,
  replyToId?: string,
): Promise<Message> {
  const form = new FormData();
  // En React Native, FormData espera un objeto con uri/name/type para archivos.
  form.append('file', {
    uri: asset.uri,
    name: asset.fileName ?? `upload.${asset.type?.split('/')[1] ?? 'bin'}`,
    type: asset.type ?? 'application/octet-stream',
  } as any);
  if (replyToId) { form.append('reply_to_id', replyToId); }

  const res = await api.post(`/lazos/${lazoId}/messages/media`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
    // Subidas pueden tardar más; subimos el timeout.
    timeout: 60000,
  });
  return mapMessage(res.data.message);
}
