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
  PanResponderGestureState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../hooks/useAuth';

const { width: SW, height: SH } = Dimensions.get('window');

// ─── Paleta cálida ────────────────────────────────────────────
const C = {
  bg: '#FDF6EE',
  beige: '#F5ECD7',
  green: '#6B9E78',
  greenDark: '#4A7A58',
  greenLight: '#D4EAD8',
  water: '#5B9BD5',
  text: '#3A2E1E',
  textSoft: '#7A6A55',
  textLight: '#B0A090',
  white: '#FFFDF8',
  shadow: '#C4A97D',
  overlay: 'rgba(40,28,16,0.38)',
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
        <Icon name="water" size={24} color="#FFF" />
      </View>
    </Animated.View>
  );
}

// ─── Chat con slide a pantalla completa ───────────────────────
const CHAT_HALF = SH * 0.28;  // posición inicial: ocupa 72% de pantalla desde abajo
const CHAT_FULL = 0;           // pantalla completa

function ChatModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const translateY = useRef(new Animated.Value(CHAT_HALF)).current;
  const currentSnap = useRef(CHAT_HALF);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const snapTo = (toValue: number) => {
    currentSnap.current = toValue;
    setIsFullscreen(toValue === CHAT_FULL);
    Animated.spring(translateY, {
      toValue,
      useNativeDriver: true,
      tension: 65,
      friction: 13,
    }).start();
  };

  const handleOpen = () => {
    currentSnap.current = CHAT_HALF;
    setIsFullscreen(false);
    translateY.setValue(CHAT_HALF);
  };

  const handleClose = () => {
    Animated.timing(translateY, {
      toValue: SH,
      duration: 220,
      useNativeDriver: true,
    }).start(() => {
      snapTo(CHAT_HALF);
      onClose();
    });
  };

  const headerPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 5,
      onPanResponderGrant: () => {
        translateY.setOffset(currentSnap.current);
        translateY.setValue(0);
      },
      onPanResponderMove: Animated.event([null, { dy: translateY }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_: any, gs: PanResponderGestureState) => {
        translateY.flattenOffset();
        if (gs.vy < -0.5 || gs.dy < -50) {
          snapTo(CHAT_FULL);
        } else if (gs.vy > 0.5 || gs.dy > 80) {
          handleClose();
        } else {
          snapTo(currentSnap.current);
        }
      },
    }),
  ).current;

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      onRequestClose={handleClose}
      onShow={handleOpen}>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        {/* Overlay solo toca para cerrar si no está fullscreen */}
        <TouchableOpacity
          style={[StyleSheet.absoluteFill, { backgroundColor: C.overlay }]}
          onPress={handleClose}
          activeOpacity={1}
        />
        <Animated.View style={[styles.chatContainer, { transform: [{ translateY }] }]}>

          {/* Header — zona de drag */}
          <View style={styles.chatHeader} {...headerPan.panHandlers}>
            <View style={styles.chatDragHandle} />
            <View style={styles.chatHeaderRow}>
              <TouchableOpacity onPress={handleClose} style={styles.chatClose}>
                <Icon name="close" size={20} color="#FFF" />
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={styles.chatTitle}>Mi primer lazo</Text>
                <Text style={styles.chatSubtitle}>En línea</Text>
              </View>
              <TouchableOpacity
                onPress={() => snapTo(isFullscreen ? CHAT_HALF : CHAT_FULL)}
                style={styles.chatExpandBtn}>
                <Icon
                  name={isFullscreen ? 'chevron-down' : 'chevron-up'}
                  size={22}
                  color="#FFF"
                />
              </TouchableOpacity>
            </View>
          </View>

          {/* Mensajes */}
          <FlatList
            data={MOCK_MESSAGES}
            keyExtractor={i => i.id}
            style={{ flex: 1, backgroundColor: C.bg }}
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

          {/* Input */}
          <View style={styles.chatInputRow}>
            <TouchableOpacity style={styles.chatPlus}>
              <Icon name="plus" size={22} color={C.textSoft} />
            </TouchableOpacity>
            <View style={styles.chatInputWrap}>
              <Text style={styles.chatInputPlaceholder}>Escribe un mensaje...</Text>
            </View>
            <TouchableOpacity style={styles.chatSend}>
              <Icon name="send" size={18} color={C.green} />
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Menú lateral izquierdo ───────────────────────────────────
function SideMenu({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const translateX = useRef(new Animated.Value(-SW * 0.78)).current;

  React.useEffect(() => {
    Animated.spring(translateX, {
      toValue: visible ? 0 : -SW * 0.78,
      useNativeDriver: true,
      tension: 65,
      friction: 14,
    }).start();
  }, [visible]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
        <TouchableOpacity
          style={[StyleSheet.absoluteFill, { backgroundColor: C.overlay }]}
          onPress={onClose}
          activeOpacity={1}
        />
        <Animated.View style={[styles.sideMenu, { transform: [{ translateX }] }]}>
          <SafeAreaView style={{ flex: 1 }} edges={['top', 'bottom']}>

            {/* Perfil */}
            <View style={styles.sideMenuHeader}>
              <View style={styles.sideMenuAvatar}>
                <Icon name="sprout" size={26} color={C.green} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sideMenuUser}>María González</Text>
                <Text style={styles.sideMenuSub}>3 lazos activos</Text>
              </View>
              <TouchableOpacity onPress={onClose}>
                <Icon name="close" size={20} color={C.textSoft} />
              </TouchableOpacity>
            </View>

            <Text style={styles.sideMenuSection}>MIS LAZOS</Text>

            <FlatList
              data={MOCK_LAZOS}
              keyExtractor={i => i.id}
              contentContainerStyle={{ paddingHorizontal: 16 }}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.lazoItem} onPress={onClose}>
                  <View style={styles.lazoIconWrap}>
                    <Icon name="leaf" size={17} color={C.green} />
                  </View>
                  <View style={{ flex: 1 }}>
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
              <Icon name="plus" size={18} color="#FFF" />
              <Text style={styles.newLazoBtnText}>Crear nuevo lazo</Text>
            </TouchableOpacity>
          </SafeAreaView>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Modal Ajustes ────────────────────────────────────────────
function SettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
	const { user, logout } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  const handleLogout = () => {
    Alert.alert('Cerrar sesión', '¿Seguro que quieres salir?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Cerrar sesión', style: 'destructive',
        onPress: async () => { onClose(); await logout(); } },
    ]);
  };
  const items = [
    { icon: 'account-outline', title: 'Perfil', sub: 'Edita tu información personal' },
    { icon: 'bell-outline', title: 'Notificaciones', sub: 'Gestiona tus notificaciones' },
    { icon: 'lock-outline', title: 'Privacidad', sub: 'Configuración de privacidad' },
    { icon: 'information-outline', title: 'Acerca de', sub: 'Información de la aplicación' },
  ];
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.menuContainer}>
          <View style={styles.menuHeader}>
            <Text style={styles.menuTitle}>Configuración</Text>
            <TouchableOpacity onPress={onClose}>
              <Icon name="close" size={22} color={C.textSoft} />
            </TouchableOpacity>
          </View>
          <View style={{ paddingHorizontal: 20 }}>
            {items.map(item => (
              <TouchableOpacity key={item.title} style={styles.settingsItem}>
                <View style={styles.settingsIconWrap}>
                  <Icon name={item.icon} size={22} color={C.greenDark} />
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
            <Icon name="menu" size={26} color={C.text} />
          </TouchableOpacity>
          <Text style={styles.headerName}>María González</Text>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setSettingsOpen(true)}>
            <Icon name="cog-outline" size={26} color={C.text} />
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
            <Icon name="chat-outline" size={16} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.fabChatText}>Chat</Text>
          </TouchableOpacity>
          <WaterButton onWater={() => {}} />
        </View>
      </SafeAreaView>

      <ChatModal visible={chatOpen} onClose={() => setChatOpen(false)} />
      <SideMenu visible={menuOpen} onClose={() => setMenuOpen(false)} />
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
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.green, borderRadius: 24,
    paddingHorizontal: 18, paddingVertical: 10,
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

  // ── Chat ──
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: C.overlay },
  chatContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    height: SH,
    backgroundColor: C.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  chatHeader: {
    backgroundColor: C.green,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingTop: 8, paddingBottom: 12, paddingHorizontal: 16,
  },
  chatDragHandle: {
    alignSelf: 'center', width: 36, height: 4,
    borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.5)',
    marginBottom: 10,
  },
  chatHeaderRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  chatClose: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  chatExpandBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
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

  // ── Menú lateral ──
  sideMenu: {
    position: 'absolute', top: 0, left: 0, bottom: 0,
    width: SW * 0.78, backgroundColor: C.white,
    shadowColor: '#000', shadowOffset: { width: 6, height: 0 },
    shadowOpacity: 0.18, shadowRadius: 20, elevation: 20,
  },
  sideMenuHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 20, paddingTop: 8, paddingBottom: 16,
    borderBottomWidth: 1, borderBottomColor: C.beige,
  },
  sideMenuAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center',
  },
  sideMenuUser: { fontSize: 16, fontWeight: '700', color: C.text },
  sideMenuSub: { fontSize: 13, color: C.textSoft, marginTop: 2 },
  sideMenuSection: {
    fontSize: 11, fontWeight: '700', color: C.textLight,
    letterSpacing: 1.2, paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
  },
  lazoItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: C.beige,
  },
  lazoIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center',
  },
  lazoName: { fontSize: 15, fontWeight: '600', color: C.text },
  lazoLevel: { fontSize: 13, color: C.textSoft, marginTop: 1 },
  lazoStreak: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center',
  },
  lazoStreakNum: { fontSize: 14, fontWeight: '700', color: C.greenDark },
  newLazoBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    margin: 20, backgroundColor: C.green, borderRadius: 16, paddingVertical: 14,
  },
  newLazoBtnText: { color: '#FFF', fontSize: 15, fontWeight: '700' },

  // ── Ajustes ──
  menuContainer: {
    backgroundColor: C.white, borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingBottom: 32,
  },
  menuHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 20, paddingVertical: 20,
    borderBottomWidth: 1, borderBottomColor: C.beige,
  },
  menuTitle: { fontSize: 18, fontWeight: '700', color: C.text },
  settingsItem: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: C.beige,
  },
  settingsIconWrap: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: C.beige, alignItems: 'center', justifyContent: 'center',
  },
  settingsTitle: { fontSize: 15, fontWeight: '600', color: C.text },
  settingsSub: { fontSize: 13, color: C.textSoft, marginTop: 2 },
});
