import { NativeModules, Platform } from 'react-native';

interface SharedData {
  type: 'text';
  data: string;
}

const { ShareIntent } = NativeModules;

export async function getSharedData(): Promise<SharedData | null> {
  if (Platform.OS !== 'android' || !ShareIntent) { return null; }
  return ShareIntent.getSharedData();
}

export function clearSharedData(): void {
  if (Platform.OS !== 'android' || !ShareIntent) { return; }
  ShareIntent.clearSharedData();
}
