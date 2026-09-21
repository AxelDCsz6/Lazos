import React from 'react';
import { Modal, View, TouchableOpacity, Dimensions, StatusBar, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { WebView } from 'react-native-webview';

const { width: SW, height: SH } = Dimensions.get('window');

// URL de embed oficial. TikTok: embed/v2 (el que usa WhatsApp).
// YouTube: iframe embed estándar.
function embedUrl(provider: string, videoId: string): string {
  if (provider === 'tiktok') { return `https://www.tiktok.com/embed/v2/${videoId}`; }
  return `https://www.youtube.com/embed/${videoId}`;
}

// Reproductor interno de video vía WebView (embed oficial).
// 9:16 para TikTok (vertical); 16:9 para YouTube.
export function InlineVideoPlayer({
  visible,
  provider,
  videoId,
  onClose,
}: {
  visible: boolean;
  provider: string;
  videoId: string;
  onClose: () => void;
}) {
  if (!visible) { return null; }
  const isTikTok = provider === 'tiktok';
  const playerW = SW - 16;
  const playerH = isTikTok ? Math.min(playerW * (16 / 9), SH * 0.8) : playerW * (9 / 16);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      <View style={styles.backdrop}>
        <StatusBar backgroundColor="rgba(0,0,0,0.85)" barStyle="light-content" />
        <View style={styles.playerContainer}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Icon name="close" size={26} color="#FFF" />
          </TouchableOpacity>
          <View style={[styles.player, { width: playerW, height: playerH }]}>
            <WebView
              source={{ uri: embedUrl(provider, videoId) }}
              style={styles.webview}
              javaScriptEnabled
              domStorageEnabled
              mediaPlaybackRequiresUserAction={false}
              allowsFullscreenVideo
              userAgent="Mozilla/5.0 (Linux; Android 10) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Mobile Safari/537.36"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerContainer: {
    alignItems: 'center',
  },
  closeBtn: {
    alignSelf: 'flex-end',
    marginBottom: 8,
    padding: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  player: {
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
});
