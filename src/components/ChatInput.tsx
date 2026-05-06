import React, { useState, useCallback } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  StyleSheet,
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
}

export const ChatInput = React.memo(function ChatInput({ onSend, onFocusExpand }: Props) {
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);

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

  return (
    <View style={styles.chatInputRow}>
      <TouchableOpacity style={styles.chatPlus}>
        <Icon name="plus" size={22} color={C.textSoft} />
      </TouchableOpacity>
      <TextInput
        style={styles.chatInput}
        value={inputText}
        onChangeText={setInputText}
        placeholder="Escribe un mensaje..."
        placeholderTextColor={C.textLight}
        multiline
        maxLength={1000}
        onFocus={onFocusExpand}
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
});
