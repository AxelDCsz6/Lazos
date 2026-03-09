import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  PanResponder,
  Animated,
  StatusBar,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../../hooks/useAuth';

const { width: SW, height: SH } = Dimensions.get('window');

// ─── Paleta cálida ────────────────────────────────────────────
const C = {
  bg: '#FDF6EE',
  beige: '#F5ECD7',
  beigeCard: '#EDE0C8',
  green: '#6B9E78',
  greenDark: '#4A7A58',
  greenLight: '#D4EAD8',
  water: '#5B9BD5',
  text: '#3A2E1E',
  textSoft: '#7A6A55',
  textLight: '#B0A090',
  white: '#FFFDF8',
  shadow: '#C4A97D',
};

// ─── Datos mock ───────────────────────────────────────────────
const MOCK_LAZOS = [
  { id: '1', name: 'Mi primer lazo', level: 1, streak: 7 },
  { id: '2', name: 'Familia', level: 3, streak: 21 },
  { id: '3', name: 'Amigos cercanos', level: 5, streak: 45 },
];

const MOCK_MESSAGES = [
  { id: '1', text: '¡Hola! ¿Cómo estás?', time: '10:30', mine: false },
  { id: '2', text: '¡Muy bien! ¿Y tú?', time: '10:32', mine: true },
  { id: '3', text: 'También bien, recordé regar nuestra planta hoy 🌱', time: '14:15', mine: false },
];

// ─── Botón regar drag & drop ──────────────────────────────────
function WaterButton({ onWater }: { onWater: () => void }) {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [watered, setWatered] = useState(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
          tension: 40,
          friction: 7,
        }).start();
        setWatered(true);
        onWater();
        setTimeout(() => setWatered(false), 2000);
      },
    }),
  ).current;

  return (
    <Animated.View style={{ transform: pan.getTranslateTransform() }} {...panResponder.panHandlers}>
      <View style={[styles.waterBtnInner, watered && styles.waterBtnWatered]}>
        <Text style={{ fontSize: 22 }}>💧</Text>
      </View>
    </Animated.View>
  );
}

// ─── Modal Chat ───────────────────────────────────────────────
function ChatModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.chatContainer}>
          <View style={styles.chatHeader}>
            <TouchableOpacity onPress={onClose} style={styles.chatClose}>
              <Text style={styles.chatCloseText}>✕</Text>
            </TouchableOpacity>
            <View>
              <Text style={styles.chatTitle}>Mi primer lazo</Text>
              <Text style={styles.chatSubtitle}>En línea</Text>
            </View>
          </View>
          <FlatList
            data={MOCK_MESSAGES}
            keyExtractor={i => i.id}
            style={{ backgroundColor: C.bg }}
            contentContainerStyle={{ padding: 16, gap: 12 }}
            renderItem={({ item }) => (
              <View style={[styles.bubble, item.mine ? styles.bubbleMine : styles.bubbleOther]}>
                <Text style={[styles.bubbleText, item.mine && styles.bubbleTextMine]}>
                  {item.text}
                </Text>
                <Text style={[styles.bubbleTime, item.mine && styles.bubbleTimeMine]}>
                  {item.time}
                </Text>
              </View>
            )}
          />
          <View style={styles.chatInputRow}>
            <TouchableOpacity style={styles.chatPlus}>
              <Text style={{ fontSize: 20, color: C.textSoft }}>+</Text>
            </TouchableOpacity>
            <View style={styles.chatInputWrap}>
              <Text style={styles.chatInputPlaceholder}>Escribe un mensaje...</Text>
            </View>
            <TouchableOpacity style={styles.chatSend}>
              <Text style={{ fontSize: 16, color: C.green }}>➤</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─── Modal Menú hamburguesa ───────────────────────────────────
function MenuModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.menuContainer}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>Mis Lazos</Text>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.menuClose}>✕</Text>
            </TouchableOpacity>
          </View>
          <FlatList
            data={MOCK_LAZOS}
            keyExtractor={i => i.id}
            contentContainerStyle={{ paddingHorizontal: 20, gap: 4 }}
            renderItem={({ item }) => (
              <TouchableOpacity style={styles.lazoItem} onPress={onClose}>
                <View>
                  <Text style={styles.lazoName}>{item.name}</Text>
                  <Text style={styles.lazoLevel}>Nivel {item.level}</Text>
                </View>
                <View style={styles.lazoStreak}>
                  <Text style={styles.lazoStreakNum}>{item.streak}</Text>
                </View>
              </TouchableOpacity>
            )}
          />
          <TouchableOpacity style={styles.newLazoBtn} onPress={onClose}>
            <Text style={styles.newLazoBtnText}>+ Crear nuevo lazo</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Modal Ajustes ────────────────────────────────────────────
function SettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Seguro que quieres salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => {
            onClose();
            await logout();
          },
        },
      ],
    );
  };

  const menuItems = [
    { icon: '🔔', title: 'Notificaciones', sub: 'Gestiona tus notificaciones', onPress: () => {} },
    { icon: '🔒', title: 'Privacidad', sub: 'Configuración de privacidad', onPress: () => {} },
    { icon: 'ℹ️', title: 'Acerca de', sub: 'Información de la aplicación', onPress: () => {} },
  ];

  return (
    <>
      <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
        <View style={styles.modalOverlay}>
          <View style={styles.menuContainer}>
            <View style={styles.menuHeader}>
              <Text style={styles.menuTitle}>Configuración</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.menuClose}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={{ paddingHorizontal: 20 }}>

              {/* Perfil — abre subpanel */}
              <TouchableOpacity style={styles.settingsItem} onPress={() => setProfileOpen(true)}>
                <View style={styles.settingsIcon}>
                  <Text style={{ fontSize: 18 }}>👤</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsTitle}>Perfil</Text>
                  <Text style={styles.settingsSub}>{user?.username ?? 'Mi perfil'}</Text>
                </View>
                <Text style={{ color: C.textLight, fontSize: 18 }}>›</Text>
              </TouchableOpacity>

              {menuItems.map(item => (
                <TouchableOpacity key={item.title} style={styles.settingsItem} onPress={item.onPress}>
                  <View style={styles.settingsIcon}>
                    <Text style={{ fontSize: 18 }}>{item.icon}</Text>
                  </View>
                  <View>
                    <Text style={styles.settingsTitle}>{item.title}</Text>
                    <Text style={styles.settingsSub}>{item.sub}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>
      </Modal>

      {/* Sub-modal Perfil */}
      <Modal visible={profileOpen} animationType="slide" transparent onRequestClose={() => setProfileOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.menuContainer}>
            <View style={styles.menuHeader}>
              <TouchableOpacity onPress={() => setProfileOpen(false)}>
                <Text style={{ fontSize: 18, color: C.textSoft }}>‹</Text>
              </TouchableOpacity>
              <Text style={[styles.menuTitle, { flex: 1, textAlign: 'center' }]}>Perfil</Text>
              <TouchableOpacity onPress={() => { setProfileOpen(false); onClose(); }}>
                <Text style={styles.menuClose}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Info del usuario */}
            <View style={styles.profileInfo}>
              <View style={styles.profileAvatar}>
                <Text style={{ fontSize: 32 }}>🌱</Text>
              </View>
              <Text style={styles.profileName}>{user?.username ?? '—'}</Text>
              <Text style={styles.profileSub}>Miembro de Lazos</Text>
            </View>

            {/* Botón cerrar sesión */}
            <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
              <Text style={styles.logoutText}>Cerrar sesión</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

// ─── Pantalla principal ───────────────────────────────────────
export function LazosListScreen() {
  const [streak] = useState(7);
  const [chatOpen, setChatOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <View style={styles.gradientTL} />
        <View style={styles.gradientBR} />
      </View>

      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setMenuOpen(true)}>
            <Text style={styles.headerIcon}>☰</Text>
          </TouchableOpacity>
          <Text style={styles.headerName}>María González</Text>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setSettingsOpen(true)}>
            <Text style={styles.headerIcon}>⚙️</Text>
          </TouchableOpacity>
        </View>

        {/* Tarjeta planta */}
        <View style={styles.cardWrapper}>
          <View style={styles.card}>
            <Text style={{ fontSize: 64 }}>🌱</Text>
            <Text style={styles.levelText}>Nivel 1</Text>
            <View style={styles.streakBadge}>
              <Text style={styles.streakNumber}>{streak}</Text>
              <Text style={styles.streakLabel}> días de racha</Text>
            </View>
          </View>
        </View>

        {/* FABs */}
        <View style={styles.fabArea}>
          <TouchableOpacity style={styles.fabChat} onPress={() => setChatOpen(true)}>
            <Text style={styles.fabChatText}>Chat</Text>
          </TouchableOpacity>
          <WaterButton onWater={() => {}} />
        </View>
      </SafeAreaView>

      <ChatModal visible={chatOpen} onClose={() => setChatOpen(false)} />
      <MenuModal visible={menuOpen} onClose={() => setMenuOpen(false)} />
      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg },
  gradientTL: {
    position: 'absolute', top: 0, left: 0,
    width: SW * 0.7, height: SH * 0.5,
    borderBottomRightRadius: SW,
    backgroundColor: 'rgba(180, 220, 170, 0.45)',
  },
  gradientBR: {
    position: 'absolute', bottom: 0, right: 0,
    width: SW * 0.65, height: SH * 0.5,
    borderTopLeftRadius: SW,
    backgroundColor: 'rgba(230, 200, 160, 0.38)',
  },
  safe: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 4, paddingBottom: 4,
  },
  headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerIcon: { fontSize: 20 },
  headerName: { fontSize: 17, fontWeight: '500', color: C.text },
  cardWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  card: {
    width: SW * 0.72, paddingVertical: 48, paddingHorizontal: 24,
    borderRadius: 28, backgroundColor: 'rgba(200, 230, 190, 0.48)',
    alignItems: 'center',
    shadowColor: C.shadow, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 4,
  },
  levelText: { marginTop: 14, fontSize: 15, color: C.text, fontWeight: '400' },
  streakBadge: {
    flexDirection: 'row', alignItems: 'center', marginTop: 12,
    backgroundColor: C.white, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 6,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 4, elevation: 1,
  },
  streakNumber: { fontSize: 15, fontWeight: '700', color: C.text },
  streakLabel: { fontSize: 14, color: C.textSoft },
  fabArea: {
    position: 'absolute', bottom: 36, right: 24,
    alignItems: 'center', gap: 12,
  },
  fabChat: {
    backgroundColor: C.green, borderRadius: 24,
    paddingHorizontal: 20, paddingVertical: 10,
    shadowColor: C.green, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  fabChatText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  waterBtnInner: {
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.water, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.water, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  waterBtnWatered: { backgroundColor: C.green },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.3)' },
  chatContainer: {
    backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    height: SH * 0.75,
  },
  chatHeader: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.green, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: 16, paddingVertical: 14, gap: 12,
  },
  chatClose: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  chatCloseText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  chatTitle: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  chatSubtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  bubble: {
    maxWidth: '75%', padding: 12, borderRadius: 16,
    backgroundColor: C.white,
    shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06, shadowRadius: 3, elevation: 1,
  },
  bubbleMine: { backgroundColor: C.green, alignSelf: 'flex-end' },
  bubbleOther: { alignSelf: 'flex-start' },
  bubbleText: { fontSize: 15, color: C.text, lineHeight: 20 },
  bubbleTextMine: { color: '#FFF' },
  bubbleTime: { fontSize: 11, color: C.textLight, marginTop: 4 },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.7)' },
  chatInputRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 12,
    backgroundColor: C.white, gap: 8,
    borderTopWidth: 1, borderTopColor: C.beige,
  },
  chatPlus: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  chatInputWrap: {
    flex: 1, backgroundColor: C.beige, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
  },
  chatInputPlaceholder: { color: C.textLight, fontSize: 14 },
  chatSend: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.beige, alignItems: 'center', justifyContent: 'center',
  },
  menuContainer: {
    backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 32, minHeight: SH * 0.5,
  },
  menuHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 20,
    borderBottomWidth: 1, borderBottomColor: C.beige,
  },
  menuTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  menuClose: { fontSize: 18, color: C.textSoft },
  lazoItem: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: C.beige,
  },
  lazoName: { fontSize: 15, fontWeight: '600', color: C.text },
  lazoLevel: { fontSize: 13, color: C.textSoft, marginTop: 2 },
  lazoStreak: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center',
  },
  lazoStreakNum: { fontSize: 15, fontWeight: '700', color: C.greenDark },
  newLazoBtn: {
    margin: 20, backgroundColor: C.green, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center',
  },
  newLazoBtnText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
  settingsItem: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.beige,
  },
  settingsIcon: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.beige, alignItems: 'center', justifyContent: 'center',
  },
  settingsTitle: { fontSize: 15, fontWeight: '600', color: C.text },
  settingsSub: { fontSize: 13, color: C.textSoft, marginTop: 2 },

  // ── Perfil ──
  profileInfo: {
    alignItems: 'center', paddingVertical: 28,
    borderBottomWidth: 1, borderBottomColor: C.beige,
    marginHorizontal: 20,
  },
  profileAvatar: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center',
    marginBottom: 12,
  },
  profileName: { fontSize: 20, fontWeight: '700', color: C.text },
  profileSub: { fontSize: 14, color: C.textSoft, marginTop: 4 },
  logoutBtn: {
    margin: 20, borderWidth: 1.5, borderColor: '#D9534F',
    borderRadius: 16, paddingVertical: 14, alignItems: 'center',
  },
  logoutText: { color: '#D9534F', fontSize: 15, fontWeight: '700' },
});
