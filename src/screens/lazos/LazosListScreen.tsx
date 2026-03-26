import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  TouchableOpacity,
  PanResponder,
  Animated,
  Easing,
  StatusBar,
  Modal,
  FlatList,
  Alert,
  TextInput,
  Switch,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../../hooks/useAuth';
import { LazosModal } from '../../components/LazosModal';
import { AnimatedPlant } from '../../components/AnimatedPlant';
import { fetchLazos, waterLazo as waterLazoApi } from '../../services/lazosService';
import {
  getMessages as fetchMessages,
  sendMessage as apiSendMessage,
} from '../../services/messages';
import { Message } from '../../types';

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

// ─── Tipos ────────────────────────────────────────────────────
type Lazo = {
  id: string;
  partnerUsername: string;
  partnerId: string;
  streak: number;
  plantPhase: string;
  plantXp: number;
  iWateredToday: boolean;
  partnerWateredToday: boolean;
  daysWithoutMutual: number;
};

const PHASE_LABEL: Record<string, string> = {
  seed:   'Semilla',
  sprout: 'Brote',
  small:  'Planta pequeña',
  big:    'Planta grande',
  flower: 'Florecida',
  dead:   'Planta muerta',
};

const PHASE_EMOJI: Record<string, string> = {
  seed:   '🌱',
  sprout: '🪴',
  small:  '🌿',
  big:    '🌳',
  flower: '🌸',
  dead:   '🥀',
};

// ─── Dimensiones del botón de regar ──────────────────────────
const WATER_BTN_SIZE = 52;

// ─── Partícula de lluvia individual ──────────────────────────
function RainParticle({
  offsetX,
  delay,
  active,
}: {
  offsetX: number;
  delay: number;
  active: boolean;
}) {
  const anim = useRef(new Animated.Value(0)).current;
  const containerOpacity = useRef(new Animated.Value(0)).current;
  const loopRef = useRef<Animated.CompositeAnimation | null>(null);

  useEffect(() => {
    if (active) {
      containerOpacity.setValue(1);
      const timeout = setTimeout(() => {
        loopRef.current = Animated.loop(
          Animated.timing(anim, {
            toValue: 1,
            duration: 500 + delay * 1.2,
            useNativeDriver: true,
          }),
        );
        loopRef.current.start();
      }, delay);
      return () => {
        clearTimeout(timeout);
        loopRef.current?.stop();
        anim.setValue(0);
      };
    } else {
      containerOpacity.setValue(0);
      loopRef.current?.stop();
      anim.setValue(0);
    }
  }, [active, anim, delay, containerOpacity]);

  const FALL_DISTANCE = WATER_BTN_SIZE * 1.5;
  const translateY = anim.interpolate({ inputRange: [0, 1], outputRange: [0, FALL_DISTANCE] });
  const dropOpacity = anim.interpolate({
    inputRange: [0, 0.15, 0.75, 1],
    outputRange: [0, 0.9, 0.9, 0],
  });

  return (
    <Animated.View style={{ position: 'absolute', opacity: containerOpacity }}>
      <Animated.View
        style={{
          position: 'absolute',
          top: WATER_BTN_SIZE + 2,
          left: offsetX,
          width: 2.5,
          height: 9,
          borderRadius: 2,
          backgroundColor: '#5B9BD5',
          opacity: dropOpacity,
          transform: [{ translateY }],
        }}
      />
    </Animated.View>
  );
}

// ─── Indicador de riego animado ───────────────────────────────
const INDICATOR_SIZE = 44;

function WateringIndicator({
  active,
  holdAnim,
  label,
}: {
  active: boolean;
  holdAnim?: Animated.Value;
  label: string;
}) {
  const fillAnim = useRef(new Animated.Value(active ? 1 : 0)).current;
  const waveAnim = useRef(new Animated.Value(0)).current;
  const waveLoopRef = useRef<Animated.CompositeAnimation | null>(null);
  const prevActive = useRef(active);

  const startWave = useCallback(() => {
    waveLoopRef.current?.stop();
    waveLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(waveAnim, { toValue: 1, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
        Animated.timing(waveAnim, { toValue: 0, duration: 1600, easing: Easing.inOut(Easing.sin), useNativeDriver: false }),
      ]),
    );
    waveLoopRef.current.start();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Arrancar ola si ya está activo al montar
  useEffect(() => {
    if (active) { startWave(); }
    return () => { waveLoopRef.current?.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reaccionar a cambios de active
  useEffect(() => {
    if (active === prevActive.current) { return; }
    prevActive.current = active;
    if (active) {
      fillAnim.setValue(1);
      startWave();
    } else {
      waveLoopRef.current?.stop();
      waveAnim.setValue(0);
      fillAnim.setValue(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // El agua sube desde abajo: la fuente es holdAnim durante el riego, fillAnim en reposo/completado
  const sourceAnim = !active && holdAnim ? holdAnim : fillAnim;
  // outputRange empieza en INDICATOR_SIZE + 14 para que el contenedor quede completamente oculto al inicio
  const translateY = sourceAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [INDICATOR_SIZE + 14, 0],
  });
  const waveX  = waveAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 10] });
  const waveX2 = waveAnim.interpolate({ inputRange: [0, 1], outputRange: [8, -8] });

  return (
    <View style={styles.wateringItem}>
      <View style={[styles.wateringCircle, active && styles.wateringCircleActive]}>
        <Animated.View style={[styles.waterFillContainer, { transform: [{ translateY }] }]}>
          <Animated.View style={[styles.waveCap, styles.waveCap1, { transform: [{ translateX: waveX }] }]} />
          <Animated.View style={[styles.waveCap, styles.waveCap2, { transform: [{ translateX: waveX2 }] }]} />
          <View style={styles.waterBody} />
        </Animated.View>
        <View style={styles.waterIconOverlay}>
          <Icon
            name={active ? 'water' : 'water-outline'}
            size={16}
            color={active ? '#FFF' : C.textLight}
          />
        </View>
      </View>
      <Text style={[styles.wateringLabel, active && styles.wateringLabelActive]}>{label}</Text>
    </View>
  );
}

// ─── Zona inicial de la planta ────────────────────────────────
const PLANT_ZONE = {
  x: SW / 2,
  y: SH * 0.42,
  radius: SW * 0.38,
};

// ─── Botón regar drag & drop con fill progresivo (3 s) ────────
function WaterButton({
  onWater,
  plantZone,
  disabled,
  holdAnim,
}: {
  onWater: () => void;
  plantZone: { x: number; y: number; radius: number };
  disabled?: boolean;
  holdAnim: Animated.Value;
}) {
  const pan = useRef(new Animated.ValueXY({ x: 0, y: 0 })).current;
  const [watered, setWatered]     = useState(false);
  const [isRaining, setIsRaining] = useState(false);
  const btnAbsPos   = useRef({ x: 0, y: 0 });
  const animRef     = useRef<Animated.CompositeAnimation | null>(null);
  const completedRef = useRef(false);
  const isNearRef   = useRef(false);

  const disabledRef  = useRef(disabled ?? false);
  const plantZoneRef = useRef(plantZone);
  const onWaterRef   = useRef(onWater);
  const holdAnimRef  = useRef(holdAnim);
  disabledRef.current  = disabled ?? false;
  plantZoneRef.current = plantZone;
  onWaterRef.current   = onWater;
  holdAnimRef.current  = holdAnim;

  const rainParticles = [
    { offsetX: 4,  delay: 0   },
    { offsetX: 12, delay: 70  },
    { offsetX: 20, delay: 140 },
    { offsetX: 30, delay: 35  },
    { offsetX: 40, delay: 110 },
    { offsetX: 48, delay: 175 },
  ];

  const isNearPlant = (absX: number, absY: number): boolean => {
    const { x, y, radius } = plantZoneRef.current;
    return Math.sqrt((absX - x) ** 2 + (absY - y) ** 2) < radius;
  };

  const startFill = () => {
    completedRef.current = false;
    holdAnimRef.current.setValue(0);
    animRef.current = Animated.timing(holdAnimRef.current, {
      toValue: 1,
      duration: 3000,
      easing: Easing.linear,
      useNativeDriver: false,
    });
    animRef.current.start(({ finished }) => {
      if (finished) {
        completedRef.current = true;
        setIsRaining(false);
        setWatered(true);
        // Volver al origen antes de que disabled=true elimine los panHandlers
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
          tension: 40,
          friction: 7,
        }).start(() => setTimeout(() => setWatered(false), 1500));
        onWaterRef.current();
      }
    });
  };

  const resetFill = () => {
    animRef.current?.stop();
    Animated.timing(holdAnimRef.current, {
      toValue: 0,
      duration: 300,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  };

  const returnToOrigin = () => {
    Animated.spring(pan, {
      toValue: { x: 0, y: 0 },
      useNativeDriver: false,
      tension: 40,
      friction: 7,
    }).start(() => setTimeout(() => setWatered(false), 1500));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => !disabledRef.current,
      onMoveShouldSetPanResponder:  () => !disabledRef.current,
      onPanResponderGrant: () => {
        pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
        pan.setValue({ x: 0, y: 0 });
        isNearRef.current   = false;
        completedRef.current = false;
      },
      onPanResponderMove: (_, gs) => {
        (pan.x as any).setValue(gs.dx);
        (pan.y as any).setValue(gs.dy);
        const near = isNearPlant(
          btnAbsPos.current.x + gs.dx,
          btnAbsPos.current.y + gs.dy,
        );
        if (near && !isNearRef.current) {
          isNearRef.current = true;
          setIsRaining(true);
          startFill();
        } else if (!near && isNearRef.current) {
          isNearRef.current = false;
          setIsRaining(false);
          resetFill();
        }
      },
      onPanResponderRelease: () => {
        pan.flattenOffset();
        isNearRef.current = false;
        setIsRaining(false);
        if (!completedRef.current) { resetFill(); }
        returnToOrigin();
      },
      onPanResponderTerminate: () => {
        pan.flattenOffset();
        isNearRef.current = false;
        setIsRaining(false);
        resetFill();
        Animated.spring(pan, {
          toValue: { x: 0, y: 0 },
          useNativeDriver: false,
          tension: 40,
          friction: 7,
        }).start();
      },
    }),
  ).current;

  useEffect(() => { return () => { animRef.current?.stop(); }; }, []);

  return (
    <Animated.View
      style={{ transform: pan.getTranslateTransform() }}
      {...(disabled ? {} : panResponder.panHandlers)}
      onLayout={e => {
        e.target.measure((_x, _y, _w, _h, pageX, pageY) => {
          btnAbsPos.current = { x: pageX + WATER_BTN_SIZE / 2, y: pageY + WATER_BTN_SIZE / 2 };
        });
      }}>
      {!disabled && rainParticles.map((p, i) => (
        <RainParticle key={i} offsetX={p.offsetX} delay={p.delay} active={isRaining} />
      ))}
      <View style={[
        styles.waterBtnInner,
        watered && styles.waterBtnWatered,
        disabled && styles.waterBtnDone,
      ]}>
        <Icon name={disabled ? 'check' : 'water'} size={24} color="#FFF" />
      </View>
    </Animated.View>
  );
}

// ─── Chat con slide a pantalla completa ───────────────────────
const CHAT_HALF_HEIGHT = SH * 0.52; // altura visible en modo medio

function ChatModal({
  visible,
  onClose,
  lazo,
}: {
  visible: boolean;
  onClose: () => void;
  lazo: Lazo | null;
}) {
  const insets = useSafeAreaInsets();
  const CHAT_FULL_OFFSET = insets.top > 0 ? insets.top : (StatusBar.currentHeight ?? 24) + 4;
  const chatFullHeight = SH - CHAT_FULL_OFFSET;
  const { user } = useAuth();

  const containerHeight = useRef(new Animated.Value(CHAT_HALF_HEIGHT)).current;
  const currentSnap = useRef(CHAT_HALF_HEIGHT);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // ── Chat state ──
  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [sending, setSending] = useState(false);
  const [inputText, setInputText] = useState('');
  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Fetch helpers ──
  const loadPage = useCallback(
    async (page: number) => {
      if (!lazo) { return; }
      try {
        const msgs = await fetchMessages(lazo.id, page);
        if (page === 1) {
          setMessages(msgs);
        } else {
          setMessages(prev => [...prev, ...msgs]);
        }
        setHasMore(msgs.length === 20);
        pageRef.current = page;
      } catch {
        // silent
      }
    },
    [lazo],
  );

  // ── Start/stop polling when visible changes ──
  useEffect(() => {
    if (!visible || !lazo) { return; }

    setMessages([]);
    setHasMore(true);
    pageRef.current = 1;
    loadingMoreRef.current = false;

    loadPage(1);

    pollingRef.current = setInterval(async () => {
      try {
        const fresh = await fetchMessages(lazo.id, 1);
        setMessages(prev => {
          if (fresh.length === 0) { return prev; }
          const existingIds = new Set(prev.map(m => m.id));
          const newOnes = fresh.filter(m => !existingIds.has(m.id));
          if (newOnes.length === 0) { return prev; }
          return [...newOnes, ...prev];
        });
      } catch {
        // silent
      }
    }, 3000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, lazo?.id]);

  // ── Pagination ──
  const handleEndReached = useCallback(() => {
    if (!hasMore || loadingMoreRef.current || !lazo) { return; }
    loadingMoreRef.current = true;
    const nextPage = pageRef.current + 1;
    loadPage(nextPage).finally(() => { loadingMoreRef.current = false; });
  }, [hasMore, lazo, loadPage]);

  // ── Send message ──
  const handleSend = useCallback(async () => {
    if (!lazo || !inputText.trim() || sending) { return; }
    const text = inputText.trim();
    setInputText('');
    setSending(true);
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      lazoId: lazo.id,
      senderId: user?.id ?? '',
      content: text,
      type: 'text',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [optimistic, ...prev]);
    try {
      const sent = await apiSendMessage(lazo.id, text);
      setMessages(prev => {
        const mapped = prev.map(m => (m.id === tempId ? sent : m));
        // Deduplicate in case polling already added it
        const seen = new Set<string>();
        return mapped.filter(m => {
          if (seen.has(m.id)) { return false; }
          seen.add(m.id);
          return true;
        });
      });
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      Alert.alert('Error', err.message ?? 'No se pudo enviar el mensaje');
    } finally {
      setSending(false);
    }
  }, [lazo, inputText, sending, user?.id]);

  const formatTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });
    } catch {
      return '';
    }
  };

  // ── Slide animation ──
  const snapTo = useCallback(
    (toValue: number) => {
      currentSnap.current = toValue;
      setIsFullscreen(toValue === chatFullHeight);
      Animated.spring(containerHeight, {
        toValue,
        useNativeDriver: false,
        tension: 65,
        friction: 13,
      }).start();
    },
    [chatFullHeight, containerHeight],
  );

  const handleOpen = useCallback(() => {
    currentSnap.current = CHAT_HALF_HEIGHT;
    setIsFullscreen(false);
    containerHeight.setValue(CHAT_HALF_HEIGHT);
  }, [containerHeight]);

  const handleClose = useCallback(() => {
    Animated.timing(containerHeight, {
      toValue: 0,
      duration: 220,
      useNativeDriver: false,
    }).start(() => {
      currentSnap.current = CHAT_HALF_HEIGHT;
      setIsFullscreen(false);
      containerHeight.setValue(CHAT_HALF_HEIGHT);
      onClose();
    });
  }, [containerHeight, onClose]);

  const headerPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dy) > 5,
      onPanResponderGrant: () => {
        // currentSnap.current es la altura base
      },
      onPanResponderMove: (_: any, gs: any) => {
        // Arrastrar arriba (dy negativo) = aumentar altura
        const newH = currentSnap.current - gs.dy;
        containerHeight.setValue(Math.max(60, Math.min(SH, newH)));
      },
      onPanResponderRelease: (_: any, gs: any) => {
        if (gs.vy < -0.5 || gs.dy < -50) {
          snapTo(chatFullHeight);
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
        <TouchableOpacity
          style={[StyleSheet.absoluteFill, { backgroundColor: C.overlay }]}
          onPress={handleClose}
          activeOpacity={1}
        />
        {/* Wrapper: crece desde abajo, altura animada */}
        <Animated.View style={[styles.chatContainer, { height: containerHeight }]}>

          {/* Drag strip — visible solo en modo medio, encima del inner content */}
          {!isFullscreen && (
            <View style={styles.chatDragStrip} {...headerPan.panHandlers}>
              <View style={styles.chatDragHandle} />
            </View>
          )}

          {/* Inner content anclado al fondo: en modo medio solo se ve la parte inferior */}
          <View style={[styles.chatInner, { height: chatFullHeight }]}>

            {/* Header completo — visible solo en pantalla completa */}
            <SafeAreaView edges={['top']} style={{ backgroundColor: C.green }}>
            <View style={styles.chatHeader} {...headerPan.panHandlers}>
              <View style={styles.chatHeaderRow}>
                <TouchableOpacity onPress={handleClose} style={styles.chatClose}>
                  <Icon name="close" size={20} color="#FFF" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <Text style={styles.chatTitle}>{lazo?.partnerUsername ?? '—'}</Text>
                  <Text style={styles.chatSubtitle}>En línea</Text>
                </View>
                <TouchableOpacity
                  onPress={() => snapTo(isFullscreen ? CHAT_HALF_HEIGHT : chatFullHeight)}
                  style={styles.chatExpandBtn}>
                  <Icon
                    name={isFullscreen ? 'chevron-down' : 'chevron-up'}
                    size={22}
                    color="#FFF"
                  />
                </TouchableOpacity>
              </View>
            </View>
            </SafeAreaView>

            {/* Mensajes */}
            <FlatList
              data={messages}
              inverted
              keyExtractor={m => m.id}
              style={{ flex: 1, backgroundColor: C.bg }}
              contentContainerStyle={{ padding: 16, gap: 12 }}
              onEndReached={handleEndReached}
              onEndReachedThreshold={0.3}
              renderItem={({ item }) => {
                const mine = item.senderId === user?.id;
                return (
                  <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleOther]}>
                    <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>
                      {item.content}
                    </Text>
                    <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                      {formatTime(item.createdAt)}
                    </Text>
                  </View>
                );
              }}
            />

            {/* Input */}
            <SafeAreaView edges={['bottom']} style={{ backgroundColor: C.white, paddingBottom: 12 }}>
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
                  onFocus={() => { if (!isFullscreen) { snapTo(chatFullHeight); } }}
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
            </SafeAreaView>

          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Menú lateral izquierdo ───────────────────────────────────
function SideMenu({
  visible,
  onClose,
  username,
  lazos,
  onSelectLazo,
  onNewLazo,
}: {
  visible: boolean;
  onClose: () => void;
  username?: string;
  lazos: Lazo[];
  onSelectLazo: (lazo: Lazo) => void;
  onNewLazo: () => void;
}) {
  const translateX = useRef(new Animated.Value(-SW * 0.78)).current;

  // ── Estado de edición (in-memory) ──
  const [editMode, setEditMode] = useState(false);
  const [localLazos, setLocalLazos] = useState<Lazo[]>(lazos);
  const [deletedLazo, setDeletedLazo] = useState<Lazo | null>(null);
  const [editingLazo, setEditingLazo] = useState<Lazo | null>(null);
  const [editName, setEditName] = useState('');
  const [lazosModalOpen, setLazosModalOpen] = useState(false);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync when parent updates lazos
  useEffect(() => {
    setLocalLazos(lazos);
  }, [lazos]);

  // ── Handlers ──
  const handleDelete = (lazo: Lazo) => {
    setLocalLazos(prev => prev.filter(l => l.id !== lazo.id));
    setDeletedLazo(lazo);
    if (undoTimer.current) { clearTimeout(undoTimer.current); }
    undoTimer.current = setTimeout(() => setDeletedLazo(null), 4000);
  };

  const handleUndo = () => {
    if (!deletedLazo) { return; }
    setLocalLazos(prev => [...prev, deletedLazo]);
    setDeletedLazo(null);
    if (undoTimer.current) { clearTimeout(undoTimer.current); }
  };

  const handleEditOpen = (lazo: Lazo) => {
    setEditingLazo(lazo);
    setEditName(lazo.partnerUsername);
  };

  const handleEditSave = () => {
    if (!editingLazo) { return; }
    setLocalLazos(prev =>
      prev.map(l =>
        l.id === editingLazo.id
          ? { ...l, partnerUsername: editName.trim() || l.partnerUsername }
          : l,
      ),
    );
    setEditingLazo(null);
  };

  // ── Animación slide ──
  useEffect(() => {
    Animated.spring(translateX, {
      toValue: visible ? 0 : -SW * 0.78,
      useNativeDriver: true,
      tension: 65,
      friction: 14,
    }).start();
    if (!visible) { setEditMode(false); }
  }, [visible, translateX]);

  return (
    <>
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
                  <Text style={styles.sideMenuUser}>{username ?? 'Usuario'}</Text>
                  <Text style={styles.sideMenuSub}>{localLazos.length} lazos activos</Text>
                </View>
                <TouchableOpacity onPress={onClose}>
                  <Icon name="close" size={20} color={C.textSoft} />
                </TouchableOpacity>
              </View>

              {/* Cabecera sección + botón editar */}
              <View style={styles.sideMenuSectionRow}>
                <Text style={styles.sideMenuSection}>MIS LAZOS</Text>
                <TouchableOpacity
                  onPress={() => setEditMode(e => !e)}
                  style={[styles.editModeBtn, editMode && styles.editModeBtnActive]}>
                  <Icon name="pencil" size={15} color={editMode ? C.greenDark : C.textSoft} />
                </TouchableOpacity>
              </View>

              {/* Lista de lazos */}
              <FlatList
                data={localLazos}
                keyExtractor={i => i.id}
                contentContainerStyle={{ paddingHorizontal: 16 }}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={styles.lazoItem}
                    onPress={editMode ? undefined : () => { onSelectLazo(item); onClose(); }}
                    activeOpacity={editMode ? 1 : 0.7}>

                    {/* Icono izquierdo */}
                    <View style={styles.lazoIconWrap}>
                      {editMode ? (
                        <TouchableOpacity
                          onPress={() => handleDelete(item)}
                          style={styles.deleteBtn}>
                          <Icon name="delete-outline" size={18} color="#D9534F" />
                        </TouchableOpacity>
                      ) : (
                        <Icon name="leaf" size={17} color={C.green} />
                      )}
                    </View>

                    {/* Nombre y fase */}
                    <View style={{ flex: 1 }}>
                      <Text style={styles.lazoName}>{item.partnerUsername}</Text>
                      <Text style={styles.lazoLevel}>{PHASE_LABEL[item.plantPhase] ?? item.plantPhase}</Text>
                    </View>

                    {/* Icono derecho */}
                    {editMode ? (
                      <TouchableOpacity
                        onPress={() => handleEditOpen(item)}
                        style={styles.editBtn}>
                        <Icon name="pencil-outline" size={17} color={C.textSoft} />
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.lazoStreak}>
                        <Text style={styles.lazoStreakNum}>{item.streak}</Text>
                      </View>
                    )}
                  </TouchableOpacity>
                )}
              />

              {/* Botón crear lazo */}
              <TouchableOpacity style={styles.newLazoBtn} onPress={() => { onClose(); onNewLazo(); }}>
                <Icon name="plus" size={18} color="#FFF" />
                <Text style={styles.newLazoBtnText}>Crear nuevo lazo</Text>
              </TouchableOpacity>

              {/* Snackbar deshacer */}
              {deletedLazo && (
                <View style={styles.snackbar}>
                  <Text style={styles.snackbarText}>Lazo eliminado</Text>
                  <TouchableOpacity onPress={handleUndo} style={styles.snackbarBtn}>
                    <Text style={styles.snackbarBtnText}>Deshacer</Text>
                  </TouchableOpacity>
                </View>
              )}

              {/* Overlay edición de nombre */}
              {editingLazo && (
                <View style={styles.editOverlay}>
                  <View style={styles.editCard}>
                    <Text style={styles.editCardTitle}>Editar nombre del lazo</Text>
                    <TextInput
                      value={editName}
                      onChangeText={setEditName}
                      style={styles.editInput}
                      autoFocus
                      maxLength={30}
                      selectTextOnFocus
                    />
                    <View style={styles.editCardActions}>
                      <TouchableOpacity
                        onPress={() => setEditingLazo(null)}
                        style={styles.editCancelBtn}>
                        <Text style={styles.editCancelText}>Cancelar</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={handleEditSave}
                        style={styles.editSaveBtn}>
                        <Text style={styles.editSaveText}>Guardar</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              )}

            </SafeAreaView>
          </Animated.View>
        </View>
      </Modal>

      <LazosModal visible={lazosModalOpen} onClose={() => setLazosModalOpen(false)} />
    </>
  );
}

// ─── Modal de ajustes ─────────────────────────────────────────
function SettingsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { user, logout } = useAuth();
  const [profileOpen,  setProfileOpen]  = useState(false);
  const [notifOpen,    setNotifOpen]    = useState(false);
  const [aboutOpen,    setAboutOpen]    = useState(false);
  const [notifMsg,     setNotifMsg]     = useState(true);
  const [notifRemind,  setNotifRemind]  = useState(true);

  const handleLogout = () => {
    Alert.alert(
      'Cerrar sesión',
      '¿Seguro que quieres salir?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar sesión',
          style: 'destructive',
          onPress: async () => { onClose(); await logout(); },
        },
      ],
    );
  };

  const goBack = (setter: (v: boolean) => void) => () => setter(false);

  // ── Sub-modal genérico ──────────────────────────────────────
  const SubModal = ({
    subVisible, onBack, title, children,
  }: { subVisible: boolean; onBack: () => void; title: string; children: React.ReactNode }) => (
    <Modal visible={subVisible} animationType="slide" transparent onRequestClose={onBack}>
      <View style={styles.modalOverlay}>
        <View style={styles.menuContainer}>
          <View style={styles.menuHeader}>
            <TouchableOpacity onPress={onBack}>
              <Icon name="chevron-left" size={24} color={C.textSoft} />
            </TouchableOpacity>
            <Text style={[styles.menuTitle, { flex: 1, textAlign: 'center' }]}>{title}</Text>
            <TouchableOpacity onPress={() => { onBack(); onClose(); }}>
              <Icon name="close" size={22} color={C.textSoft} />
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      {/* ── Modal principal ───────────────────────────────────── */}
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

              {/* Perfil */}
              <TouchableOpacity style={styles.settingsItem} onPress={() => setProfileOpen(true)}>
                <View style={styles.settingsIconWrap}>
                  <Icon name="account-outline" size={22} color={C.greenDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsTitle}>Perfil</Text>
                  <Text style={styles.settingsSub}>{user?.username ?? 'Mi perfil'}</Text>
                </View>
                <Icon name="chevron-right" size={20} color={C.textLight} />
              </TouchableOpacity>

              {/* Notificaciones */}
              <TouchableOpacity style={styles.settingsItem} onPress={() => setNotifOpen(true)}>
                <View style={styles.settingsIconWrap}>
                  <Icon name="bell-outline" size={22} color={C.greenDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsTitle}>Notificaciones</Text>
                  <Text style={styles.settingsSub}>Gestiona tus notificaciones</Text>
                </View>
                <Icon name="chevron-right" size={20} color={C.textLight} />
              </TouchableOpacity>

              {/* Acerca de */}
              <TouchableOpacity style={styles.settingsItem} onPress={() => setAboutOpen(true)}>
                <View style={styles.settingsIconWrap}>
                  <Icon name="information-outline" size={22} color={C.greenDark} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.settingsTitle}>Acerca de</Text>
                  <Text style={styles.settingsSub}>Información de la aplicación</Text>
                </View>
                <Icon name="chevron-right" size={20} color={C.textLight} />
              </TouchableOpacity>

            </View>
          </View>
        </View>
      </Modal>

      {/* ── Perfil ─────────────────────────────────────────────── */}
      <SubModal subVisible={profileOpen} onBack={goBack(setProfileOpen)} title="Perfil">
        <View style={styles.profileInfo}>
          <View style={styles.profileAvatar}>
            <Text style={{ fontSize: 32 }}>🌱</Text>
          </View>
          <Text style={styles.profileName}>{user?.username ?? '—'}</Text>
          <Text style={styles.profileSub}>Miembro de Lazos</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Cerrar sesión</Text>
        </TouchableOpacity>
      </SubModal>

      {/* ── Notificaciones ─────────────────────────────────────── */}
      <SubModal subVisible={notifOpen} onBack={goBack(setNotifOpen)} title="Notificaciones">
        <View style={{ paddingHorizontal: 20, paddingTop: 8 }}>

          <View style={styles.settingsItem}>
            <View style={styles.settingsIconWrap}>
              <Icon name="message-outline" size={22} color={C.greenDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsTitle}>Mensajes</Text>
              <Text style={styles.settingsSub}>Notificar cuando recibes un mensaje</Text>
            </View>
            <Switch
              value={notifMsg}
              onValueChange={setNotifMsg}
              trackColor={{ false: C.beige, true: C.green }}
              thumbColor="#FFF"
            />
          </View>

          <View style={styles.settingsItem}>
            <View style={styles.settingsIconWrap}>
              <Icon name="water-outline" size={22} color={C.greenDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.settingsTitle}>Recordatorios de riego</Text>
              <Text style={styles.settingsSub}>Recordarte regar tu planta cada día</Text>
            </View>
            <Switch
              value={notifRemind}
              onValueChange={setNotifRemind}
              trackColor={{ false: C.beige, true: C.green }}
              thumbColor="#FFF"
            />
          </View>

        </View>
      </SubModal>

      {/* ── Acerca de ──────────────────────────────────────────── */}
      <SubModal subVisible={aboutOpen} onBack={goBack(setAboutOpen)} title="Acerca de">
        <View style={styles.aboutContainer}>
          <View style={styles.aboutPlantWrap}>
            <Text style={{ fontSize: 52 }}>🌿</Text>
          </View>
          <Text style={styles.aboutAppName}>Lazos</Text>
          <Text style={styles.aboutVersion}>Versión 1.0</Text>
          <Text style={styles.aboutDesc}>
            Lazos es una app para mantener viva la conexión con las personas que más importan.
            Cuida tu planta juntos, día a día.
          </Text>
          <View style={styles.aboutDivider} />
          <Text style={styles.aboutCreator}>Creado por</Text>
          <Text style={styles.aboutCreatorName}>Axel Dueñas</Text>
        </View>
      </SubModal>
    </>
  );
}

// ─── Pantalla principal ───────────────────────────────────────
export function LazosListScreen() {
  const { user } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lazosModalOpen, setLazosModalOpen] = useState(false);

  const [lazos, setLazos] = useState<Lazo[]>([]);
  const [activeLazo, setActiveLazo] = useState<Lazo | null>(null);
  const [celebrateKey, setCelebrateKey] = useState(0);
  const [plantZone, setPlantZone] = useState(PLANT_ZONE);
  const cardRef = useRef<View>(null);

  const holdAnim = useRef(new Animated.Value(0)).current;

  const loadLazos = useCallback(() => {
    fetchLazos()
      .then(raw => {
        const mapped: Lazo[] = raw.map((l: any) => ({
          id: l.id,
          partnerUsername: l.partner_username,
          partnerId: l.partner_id,
          streak: Number(l.streak),
          plantPhase: l.plant_phase,
          plantXp: Number(l.plant_xp),
          iWateredToday: Boolean(l.i_watered_today),
          partnerWateredToday: Boolean(l.partner_watered_today),
          daysWithoutMutual: Number(l.days_without_mutual ?? 0),
        }));
        setLazos(mapped);
        setActiveLazo(prev => {
          if (!prev) { return mapped.length > 0 ? mapped[0] : null; }
          // Actualizar activeLazo con datos frescos si sigue existiendo
          const fresh = mapped.find(l => l.id === prev.id);
          return fresh ?? (mapped.length > 0 ? mapped[0] : null);
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => { loadLazos(); }, [loadLazos]);

  const handleWater = useCallback(async () => {
    if (!activeLazo) { return; }
    try {
      const result = await waterLazoApi(activeLazo.id);
      const updater = (l: Lazo): Lazo => l.id === activeLazo.id
        ? {
            ...l,
            streak: result.streak,
            plantPhase: result.plantPhase,
            plantXp: result.plantXp,
            iWateredToday: true,
            partnerWateredToday: result.partnerWateredToday,
          }
        : l;
      setLazos(prev => prev.map(updater));
      setActiveLazo(prev => prev ? updater(prev) : prev);
      if (result.justStreaked) { setCelebrateKey(k => k + 1); }
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'No se pudo regar');
    }
  }, [activeLazo]);

  const onCardLayout = () => {
    if (cardRef.current) {
      cardRef.current.measure((_x, _y, w, h, pageX, pageY) => {
        setPlantZone({
          x: pageX + w / 2,
          y: pageY + h / 2,
          radius: Math.min(w, h) * 0.55,
        });
      });
    }
  };

  // Resetear progreso de riego al cambiar de lazo
  useEffect(() => { holdAnim.setValue(0); }, [activeLazo?.id, holdAnim]);

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
          <Text style={styles.headerName}>{user?.username ?? 'Lazos'}</Text>
          <TouchableOpacity style={styles.headerBtn} onPress={() => setSettingsOpen(true)}>
            <Icon name="cog-outline" size={26} color={C.text} />
          </TouchableOpacity>
        </View>

        {/* Tarjeta planta */}
        <View style={styles.cardWrapper}>
          <View ref={cardRef} style={styles.card} onLayout={onCardLayout}>
            {/* Aviso de peligro */}
            {activeLazo && activeLazo.daysWithoutMutual >= 3 && activeLazo.plantPhase !== 'dead' && (
              <View style={styles.warningBadge}>
                <Text style={styles.warningText}>
                  ⚠️ {activeLazo.daysWithoutMutual} día{activeLazo.daysWithoutMutual !== 1 ? 's' : ''} sin regar juntos
                </Text>
              </View>
            )}

            {/* Planta SVG animada */}
            <AnimatedPlant
              phase={activeLazo?.plantPhase ?? 'seed'}
              celebrateKey={celebrateKey}
            />

            <Text style={styles.levelText}>
              {activeLazo ? PHASE_LABEL[activeLazo.plantPhase] ?? activeLazo.plantPhase : 'Sin lazos'}
            </Text>
            <View style={styles.streakBadge}>
              <Text style={styles.streakNumber}>{activeLazo?.streak ?? 0}</Text>
              <Text style={styles.streakLabel}> días de racha</Text>
            </View>

            {/* Indicadores de riego animados */}
            {activeLazo && (
              <View style={styles.wateringRow}>
                <WateringIndicator active={activeLazo.iWateredToday} holdAnim={holdAnim} label="Tú" />
                <WateringIndicator
                  active={activeLazo.partnerWateredToday}
                  label={activeLazo.partnerUsername.charAt(0).toUpperCase()}
                />
              </View>
            )}
          </View>
        </View>

        {/* FABs */}
        <View style={styles.fabArea}>
          <TouchableOpacity
            style={[styles.fabChat, !activeLazo && { opacity: 0.5 }]}
            onPress={() => activeLazo && setChatOpen(true)}
            disabled={!activeLazo}>
            <Icon name="chat-outline" size={16} color="#FFF" style={{ marginRight: 6 }} />
            <Text style={styles.fabChatText}>Chat</Text>
          </TouchableOpacity>
          <WaterButton
            onWater={handleWater}
            plantZone={plantZone}
            holdAnim={holdAnim}
            disabled={!activeLazo || activeLazo.iWateredToday}
          />
        </View>
      </SafeAreaView>

      <ChatModal visible={chatOpen} onClose={() => setChatOpen(false)} lazo={activeLazo} />
      <SideMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        username={user?.username}
        lazos={lazos}
        onSelectLazo={lazo => setActiveLazo(lazo)}
        onNewLazo={() => setLazosModalOpen(true)}
      />
      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} />
      <LazosModal visible={lazosModalOpen} onClose={() => setLazosModalOpen(false)} onLazoCreated={loadLazos} />
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
    width: WATER_BTN_SIZE, height: WATER_BTN_SIZE, borderRadius: WATER_BTN_SIZE / 2,
    backgroundColor: C.water, alignItems: 'center', justifyContent: 'center',
    shadowColor: C.water, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4, shadowRadius: 8, elevation: 6,
  },
  waterBtnWatered: { backgroundColor: C.green },
  waterBtnDone: { backgroundColor: C.greenDark },

  // ── Indicadores de riego ──
  warningBadge: {
    backgroundColor: '#FFF3CD',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginBottom: 10,
  },
  warningText: { fontSize: 12, color: '#856404', fontWeight: '500' },
  wateringRow: {
    flexDirection: 'row', gap: 24, marginTop: 14,
  },
  wateringItem: {
    alignItems: 'center', gap: 5,
  },
  wateringCircle: {
    width: INDICATOR_SIZE, height: INDICATOR_SIZE,
    borderRadius: INDICATOR_SIZE / 2,
    borderWidth: 1.5, borderColor: C.textLight,
    overflow: 'hidden',
    backgroundColor: 'rgba(180,210,180,0.12)',
  },
  wateringCircleActive: {
    borderColor: C.green,
  },
  waterFillContainer: {
    position: 'absolute',
    bottom: 0, left: 0, right: 0,
    height: INDICATOR_SIZE + 14,
  },
  waveCap: {
    position: 'absolute',
    top: 0,
    left: -INDICATOR_SIZE,
    width: INDICATOR_SIZE * 3,
    height: 16,
    borderRadius: 8,
  },
  waveCap1: { backgroundColor: C.green, opacity: 0.95 },
  waveCap2: { backgroundColor: C.greenLight, opacity: 0.6, top: 3 },
  waterBody: {
    position: 'absolute',
    top: 8, left: 0, right: 0, bottom: 0,
    backgroundColor: C.green,
  },
  waterIconOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    alignItems: 'center', justifyContent: 'center',
  },
  wateringLabel: {
    fontSize: 11, color: C.textLight, fontWeight: '500',
  },
  wateringLabelActive: {
    color: C.greenDark,
  },

  // ── Chat ──
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: C.overlay },
  chatContainer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.green,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  // Drag strip visible en modo medio (encima del inner content)
  chatDragStrip: {
    position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
    backgroundColor: C.green,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    alignItems: 'center', paddingTop: 10, paddingBottom: 8,
  },
  // Inner content anclado al fondo; más alto que el wrapper → en modo medio se ve su parte inferior
  chatInner: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
  },
  chatHeader: {
    backgroundColor: C.green,
    paddingTop: 8, paddingBottom: 12, paddingHorizontal: 16,
  },
  chatDragHandle: {
    width: 36, height: 4,
    borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.5)',
  },
  chatHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
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
  chatInput: {
    flex: 1, backgroundColor: C.beige, borderRadius: 20,
    paddingHorizontal: 16, paddingVertical: 10,
    maxHeight: 100, fontSize: 14, color: C.text,
  },
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
  sideMenuSectionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8,
  },
  sideMenuSection: {
    fontSize: 11, fontWeight: '700', color: C.textLight, letterSpacing: 1.2,
  },
  editModeBtn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: C.beige, alignItems: 'center', justifyContent: 'center',
  },
  editModeBtnActive: { backgroundColor: C.greenLight },
  lazoItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 12, paddingHorizontal: 4,
    borderBottomWidth: 1, borderBottomColor: C.beige,
  },
  lazoIconWrap: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.greenLight, alignItems: 'center', justifyContent: 'center',
  },
  deleteBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: '#FDE8E8', alignItems: 'center', justifyContent: 'center',
  },
  editBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: C.beige, alignItems: 'center', justifyContent: 'center',
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

  // ── Snackbar ──
  snackbar: {
    position: 'absolute', bottom: 90, left: 16, right: 16,
    backgroundColor: C.text, borderRadius: 12,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12, gap: 10,
    elevation: 8,
  },
  snackbarText: { flex: 1, color: '#FFF', fontSize: 13 },
  snackbarBtn: {
    backgroundColor: C.green, borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  snackbarBtnText: { color: '#FFF', fontWeight: '700', fontSize: 13 },

  // ── Edición de nombre ──
  editOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24,
  },
  editCard: {
    backgroundColor: C.white, borderRadius: 20, padding: 24, width: '100%',
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15, shadowRadius: 20, elevation: 10,
  },
  editCardTitle: { fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 16 },
  editInput: {
    backgroundColor: C.beige, borderRadius: 12,
    paddingHorizontal: 16, paddingVertical: 10,
    fontSize: 15, color: C.text,
  },
  editCardActions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  editCancelBtn: {
    flex: 1, borderWidth: 1.5, borderColor: C.beige,
    borderRadius: 12, paddingVertical: 12, alignItems: 'center',
  },
  editCancelText: { color: C.textSoft, fontWeight: '600', fontSize: 14 },
  editSaveBtn: {
    flex: 1, backgroundColor: C.green,
    borderRadius: 12, paddingVertical: 12, alignItems: 'center',
  },
  editSaveText: { color: '#FFF', fontWeight: '700', fontSize: 14 },

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
  profileInfo: {
    alignItems: 'center', paddingVertical: 28,
    borderBottomWidth: 1, borderBottomColor: C.beige, marginHorizontal: 20,
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

  // ── Acerca de ──────────────────────────────────────────────
  aboutContainer: {
    alignItems: 'center', paddingHorizontal: 28, paddingTop: 16, paddingBottom: 32,
  },
  aboutPlantWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center',
    marginBottom: 16,
  },
  aboutAppName: { fontSize: 28, fontWeight: '800', color: C.greenDark, letterSpacing: 0.5 },
  aboutVersion: { fontSize: 13, color: C.textLight, marginTop: 4, marginBottom: 16 },
  aboutDesc: {
    fontSize: 14, color: C.textSoft, textAlign: 'center', lineHeight: 21,
  },
  aboutDivider: {
    width: 40, height: 2, borderRadius: 1, backgroundColor: C.beige,
    marginVertical: 20,
  },
  aboutCreator: { fontSize: 12, color: C.textLight, letterSpacing: 0.5, textTransform: 'uppercase' },
  aboutCreatorName: { fontSize: 18, fontWeight: '700', color: C.text, marginTop: 4 },
});
