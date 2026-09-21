import React from 'react';
import { Text, Linking, TextStyle, StyleProp, StyleSheet } from 'react-native';
import { splitTextByUrls, normalizeUrlForOpen } from '../utils/links';

// Texto de mensaje con URLs clickeables (hyperlinks estilo WhatsApp).
// Trocea el string con splitTextByUrls y renderiza <Text> anidados.
export function MessageText({
  text,
  style,
  linkStyle,
}: {
  text: string;
  style?: StyleProp<TextStyle>;
  linkStyle?: StyleProp<TextStyle>;
}) {
  const segments = splitTextByUrls(text);
  if (segments.length === 0) {
    return <Text style={style}>{text}</Text>;
  }
  return (
    <Text style={style}>
      {segments.map((seg, i) =>
        seg.type === 'url' ? (
          <Text
            key={i}
            style={[styles.link, linkStyle]}
            suppressHighlighting={true}
            onPress={async () => {
              try {
                await Linking.openURL(normalizeUrlForOpen(seg.value));
              } catch {
                // Sin app que maneje el esquema: fallo silencioso
              }
            }}>
            {seg.value}
          </Text>
        ) : (
          <Text key={i}>{seg.value}</Text>
        ),
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: { color: '#1B74E4', textDecorationLine: 'underline' },
});
