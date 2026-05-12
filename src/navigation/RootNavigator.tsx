import React, { useEffect, useState } from 'react';
import {
  View,
  ActivityIndicator,
  StyleSheet,
  Alert,
  Modal,
  Text,
  TouchableOpacity,
  FlatList,
} from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../hooks/useAuth';
import { AuthStack } from './AuthStack';
import { AppTabs } from './AppTabs';
import { RootStackParamList } from '../types';
import { setupForegroundHandler, registerForPushNotifications } from '../services/notificationService';
import { getSharedData, clearSharedData } from '../services/shareIntent';
import { fetchLazos } from '../services/lazosService';
import { sendMessage } from '../services/messages';

const Root = createNativeStackNavigator<RootStackParamList>();

const C = {
  bg: '#FDF6EE',
  beige: '#F5ECD7',
  green: '#6B9E78',
  greenLight: '#D4EAD8',
  text: '#3A2E1E',
  textSoft: '#7A6A55',
  textLight: '#B0A090',
  white: '#FFFDF8',
  overlay: 'rgba(40,28,16,0.38)',
};

export function RootNavigator() {
  const { isAuthenticated, isLoading } = useAuth();
  const [shareText, setShareText] = useState<string | null>(null);
  const [lazos, setLazos] = useState<Array<{ id: string; partnerUsername: string }>>([]);
  const [sharing, setSharing] = useState(false);

  useEffect(() => {
    const unsubscribe = setupForegroundHandler((title, body) => {
      Alert.alert(title, body);
    });
    return unsubscribe;
  }, []);

  // Registrar token FCM una vez que el navegador está montado y la sesión está activa.
  // Si Play Services tarda en cold-start, el timeout interno evita bloquear la UI.
  useEffect(() => {
    if (!isAuthenticated) { return; }
    const t = setTimeout(() => {
      registerForPushNotifications().catch(() => {});
    }, 500);
    return () => clearTimeout(t);
  }, [isAuthenticated]);

  // Check for shared data on mount and when auth state changes
  useEffect(() => {
    if (!isAuthenticated) { return; }
    getSharedData().then(data => {
      if (data?.type === 'text' && data.data) {
        setShareText(data.data);
        clearSharedData();
        fetchLazos()
          .then((raw: any[]) =>
            setLazos(raw.map(l => ({ id: l.id, partnerUsername: l.partner_username })))
          )
          .catch(() => {});
      }
    });
  }, [isAuthenticated]);

  const handleShareToLazo = async (lazoId: string) => {
    if (!shareText) { return; }
    setSharing(true);
    try {
      await sendMessage(lazoId, shareText);
      setShareText(null);
    } catch {
      Alert.alert('Error', 'No se pudo enviar el mensaje');
    } finally {
      setSharing(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator size="large" color="#6B9E78" />
      </View>
    );
  }

  return (
    <>
      <NavigationContainer>
        <Root.Navigator screenOptions={{ headerShown: false }}>
          {isAuthenticated ? (
            <Root.Screen name="App" component={AppTabs} />
          ) : (
            <Root.Screen name="Auth" component={AuthStack} />
          )}
        </Root.Navigator>
      </NavigationContainer>

      {/* Share intent lazo picker */}
      <Modal
        visible={!!shareText}
        transparent
        animationType="slide"
        onRequestClose={() => setShareText(null)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Enviar a un lazo</Text>
            <Text style={styles.sheetPreview} numberOfLines={3}>{shareText}</Text>
            <FlatList
              data={lazos}
              keyExtractor={l => l.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.lazoRow}
                  onPress={() => handleShareToLazo(item.id)}
                  disabled={sharing}>
                  <Text style={styles.lazoRowText}>{item.partnerUsername}</Text>
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No tienes lazos activos</Text>
              }
            />
            <TouchableOpacity style={styles.cancelBtn} onPress={() => setShareText(null)}>
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  splash: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FDF6EE' },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: C.overlay,
  },
  sheet: {
    backgroundColor: C.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingTop: 20,
    paddingBottom: 32,
    maxHeight: '70%',
  },
  sheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: C.text,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  sheetPreview: {
    fontSize: 13,
    color: C.textSoft,
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: C.beige,
    marginHorizontal: 20,
    borderRadius: 10,
    marginBottom: 12,
  },
  lazoRow: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: C.beige,
  },
  lazoRowText: { fontSize: 15, fontWeight: '600', color: C.text },
  emptyText: {
    fontSize: 14,
    color: C.textLight,
    textAlign: 'center',
    paddingVertical: 24,
  },
  cancelBtn: {
    marginHorizontal: 20,
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: C.beige,
  },
  cancelText: { fontSize: 15, color: C.textSoft, fontWeight: '600' },
});
