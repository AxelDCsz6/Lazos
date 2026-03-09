import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Text, Button } from 'react-native-paper';
import { useAuth } from '../../hooks/useAuth';

export function SettingsScreen() {
  const { user, logout } = useAuth();

  return (
    <View style={styles.container}>
      <Text variant="headlineSmall" style={styles.title}>
        Ajustes
      </Text>
      {user && (
        <Text variant="bodyMedium" style={styles.username}>
          👤 {user.username}
        </Text>
      )}
      <Button
        mode="outlined"
        onPress={logout}
        style={styles.button}
        textColor="#C62828">
        Cerrar sesión
      </Button>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FAFAFA' },
  title: { color: '#2E7D32', marginBottom: 16 },
  username: { color: '#757575', marginBottom: 32 },
  button: { borderColor: '#C62828' },
});
