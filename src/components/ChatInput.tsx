import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  Text,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

const C = {
  beige: '#F5ECD7',
  green: '#6B9E78',
  textLight: '#B0A090',
  textSoft: '#7A6A55',
  text: '#3A2E1E',
  white: '#FFFDF8',
};

interface Props {
  onSend: (text: string) => Promise<void>;
  onFocusExpand: () => void;
  onPickFromCamera?: () => void;
  onPickFromGallery?: () => void;
}

export const ChatInput = React.memo(function ChatInput({
  onSend,
  onFocusExpand,
  onPickFromCamera,
  onPickFromGallery,
}: Props) {
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuAnim = useRef(new Animated.Value(0)).current;

  // Animar apertura/cierre del menú de adjuntos.
  useEffect(() => {
    Animated.timing(menuAnim, {
      toValue: menuOpen ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [menuOpen, menuAnim]);

  const handleSend = useCallback(async () => {
    const text = inputText.trim();
    if (!text || sending) { return; }
    setInputText('');
    setSending(true);
    try {
      await onSend(text);
    } finally {
      setSending(false);
    }
  }, [inputText, sending, onSend]);

  const handlePickCamera = useCallback(() => {
    setMenuOpen(false);
    onPickFromCamera?.();
  }, [onPickFromCamera]);

  const handlePickGallery = useCallback(() => {
    setMenuOpen(false);
    onPickFromGallery?.();
  }, [onPickFromGallery]);

  return (
    <>
      {/* Menú de adjuntos (cámara / galería). Se renderiza condicionalmente
          para no interceptar toques cuando está cerrado. */}
      {menuOpen && (
        <Animated.View
          style={[
            styles.attachMenu,
            {
              opacity: menuAnim,
              transform: [{
                translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }),
              }],
            },
          ]}>
          <TouchableOpacity style={styles.attachOption} onPress={handlePickCamera}>
            <View style={[styles.attachIcon, { backgroundColor: '#E8F3EC' }]}>
              <Icon name="camera" size={22} color={C.green} />
            </View>
            <Text style={styles.attachLabel}>Cámara</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.attachOption} onPress={handlePickGallery}>
            <View style={[styles.attachIcon, { backgroundColor: '#F0E8DC' }]}>
              <Icon name="image-multiple" size={22} color={C.textSoft} />
            </View>
            <Text style={styles.attachLabel}>Galería</Text>
          </TouchableOpacity>
        </Animated.View>
      )}

      <View style={styles.chatInputRow}>
        <TouchableOpacity
          style={styles.chatPlus}
          onPress={() => setMenuOpen(o => !o)}>
          <Icon name={menuOpen ? 'close' : 'plus'} size={22} color={C.textSoft} />
        </TouchableOpacity>
        <TextInput
          style={styles.chatInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Escribe un mensaje..."
          placeholderTextColor={C.textLight}
          multiline
          maxLength={1000}
          onFocus={() => { setMenuOpen(false); onFocusExpand(); }}
        />
        <TouchableOpacity
          style={styles.chatSend}
          onPress={handleSend}
          disabled={!inputText.trim() || sending}>
          <Icon
            name="send"
            size={18}
            color={inputText.trim() && !sending ? C.green : C.textLight}
          />
        </TouchableOpacity>
      </View>
    </>
  );
});

const styles = StyleSheet.create({
  chatInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: C.white,
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: C.beige,
  },
  chatPlus: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  chatInput: {
    flex: 1,
    backgroundColor: C.beige,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 14,
    color: C.text,
  },
  chatSend: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.beige,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachMenu: {
    flexDirection: 'row',
    backgroundColor: C.white,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 4,
    gap: 24,
  },
  attachOption: {
    alignItems: 'center',
    gap: 6,
  },
  attachIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachLabel: {
    fontSize: 12,
    color: C.textSoft,
    fontWeight: '600',
  },
});
