import { api } from './api';
import { Message, MessageReaction } from '../types';

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

export async function getMessages(lazoId: string, page: number): Promise<Message[]> {
  const res = await api.get(`/lazos/${lazoId}/messages`, { params: { page } });
  return (res.data.messages as any[]).map(mapMessage);
}

export async function sendMessage(
  lazoId: string,
  content: string,
  replyToId?: string,
): Promise<Message> {
  const res = await api.post(`/lazos/${lazoId}/messages`, {
    content,
    ...(replyToId ? { reply_to_id: replyToId } : {}),
  });
  return mapMessage(res.data.message);
}

export async function toggleReaction(
  lazoId: string,
  messageId: string,
  type = 'heart',
): Promise<MessageReaction[]> {
  const res = await api.post(`/lazos/${lazoId}/messages/${messageId}/react`, { type });
  return (res.data.reactions as any[]).map(r => ({
    userId: r.userId ?? r.user_id,
    type: r.type,
  }));
}
