import { api } from './api';
import { Message } from '../types';

function mapMessage(m: any): Message {
  return {
    id: m.id,
    lazoId: m.lazo_id,
    senderId: m.sender_id,
    content: m.content,
    type: m.type,
    status: m.status,
    createdAt: m.created_at,
  };
}

export async function getMessages(lazoId: string, page: number): Promise<Message[]> {
  const res = await api.get(`/lazos/${lazoId}/messages`, { params: { page } });
  return (res.data.messages as any[]).map(mapMessage);
}

export async function sendMessage(lazoId: string, content: string): Promise<Message> {
  const res = await api.post(`/lazos/${lazoId}/messages`, { content });
  return mapMessage(res.data.message);
}
