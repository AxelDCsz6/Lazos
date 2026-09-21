import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
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
  DeviceEventEmitter,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { Swipeable, FlatList as GHFlatList, GestureHandlerRootView } from 'react-native-gesture-handler';
import { useAuth } from '../../hooks/useAuth';
import { LazosModal } from '../../components/LazosModal';
import { AnimatedPlant } from '../../components/AnimatedPlant';
import { ChatInput } from '../../components/ChatInput';
import { MessageText } from '../../components/MessageText';
import { LinkPreviewCard } from '../../components/LinkPreviewCard';
import { fetchLazos, waterLazo as waterLazoApi, deleteLazoRemote } from '../../services/lazosService';
import {
  getPendingDeletes,
  addPendingDelete,
  removePendingDelete,
  flushPendingDeletes,
} from '../../services/pendingDeletesService';
import {
  getMessages as fetchMessages,
  sendMessage as apiSendMessage,
  toggleReaction as apiToggleReaction,
} from '../../services/messages';
import { Message } from '../../types';
import {
  getAllUnread,
  incrementUnread,
  clearUnread,
  formatUnreadBadge,
  UNREAD_CHANGED,
} from '../../services/unreadService';
import { setActiveChatLazo, getActiveChatLazo } from '../../services/notificationService';
import { joinLazos } from '../../services/realtimeService';
import {
  pickFromCamera,
  pickFromGallery,
  uploadMedia,
  resolveMediaUrl,
} from '../../services/mediaService';
import ImageViewing from 'react-native-image-viewing';
import Video from 'react-native-video';
import { formatChatDateSeparator, isSameCalendarDay } from '../../utils/dateFormat';
import { extractFirstUrl } from '../../utils/links';

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const PHASE_EMOJI: Record<string, string> = {
  seed:   '🌱',
  sprout: '🪴',
  small:  '🌿',
  big:    '🌳',
  flower: '🌸',
  dead:   '🥀',
};

// ─── Etiqueta de cita de reply: "Foto"/"Video" para media, contenido para texto ──
function replyQuoteLabel(msg: Message): string {
  if (msg.replyType === 'photo') { return 'Foto'; }
  if (msg.replyType === 'video') { return 'Video'; }
  return msg.replyContent ?? '';
}

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
  // Un único valor para el nivel de llenado (0 = vacío, 1 = lleno).
  // Cuando active=false y se está regando, el padre escribe sobre holdAnim;
  // un listener replica ese valor a levelAnim. Cuando active pasa a true,
  // levelAnim se fija síncronamente a 1 para evitar el frame intermedio vacío.
  const levelAnim = useRef(new Animated.Value(active ? 1 : 0)).current;
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

  // Listener que replica holdAnim sobre levelAnim mientras active=false.
  // Cuando active=true, no escuchamos: levelAnim queda fijo en 1.
  useEffect(() => {
    if (active || !holdAnim) { return; }
    const id = holdAnim.addListener(({ value }) => {
      levelAnim.setValue(value);
    });
    return () => { holdAnim.removeListener(id); };
  }, [active, holdAnim, levelAnim]);

  // Reaccionar a cambios de active
  useEffect(() => {
    if (active === prevActive.current) { return; }
    prevActive.current = active;
    if (active) {
      // Fijamos a 1 de forma síncrona ANTES del próximo render para evitar
      // el parpadeo vacío entre que termina la animación de holdAnim y se
      // monta con active=true.
      levelAnim.setValue(1);
      startWave();
    } else {
      waveLoopRef.current?.stop();
      waveAnim.setValue(0);
      levelAnim.setValue(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  // outputRange empieza en INDICATOR_SIZE + 14 para que el contenedor quede completamente oculto al inicio
  const translateY = levelAnim.interpolate({
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
      if (!finished) { return; }
      completedRef.current = true;
      isNearRef.current = false;
      setIsRaining(false);
      setWatered(true);
      // Aplanar el offset acumulado para que el spring vaya al origen real,
      // no a la posición donde el dedo todavía está apoyado.
      pan.flattenOffset();
      Animated.spring(pan, {
        toValue: { x: 0, y: 0 },
        useNativeDriver: false,
        tension: 40,
        friction: 7,
      }).start(() => setTimeout(() => setWatered(false), 1500));
      onWaterRef.current();
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
        // Tras completar el riego, ignorar micro-movimientos: el botón ya está
        // en su spring de retorno y NO debe re-arrastrarse bajo el dedo.
        if (completedRef.current) { return; }
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
        // Limpieza idempotente: SIEMPRE devolver el botón al origen, incluso
        // si el riego ya completó (el completion callback ya hizo flattenOffset
        // y disparó su spring, pero repetirlo es inofensivo y garantiza que
        // el botón nunca quede atascado lejos del origen).
        pan.flattenOffset();
        isNearRef.current = false;
        setIsRaining(false);
        if (!completedRef.current) {
          resetFill();
        }
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

  // Cuando disabled pasa de false→true (el riego terminó en el padre),
  // limpiamos cualquier animación pendiente y dejamos holdAnim en 1 para
  // que el indicador "Tú" muestre lleno sin transición espuria.
  const prevDisabledRef = useRef(disabled ?? false);
  useEffect(() => {
    const wasDisabled = prevDisabledRef.current;
    const isDisabled = disabled ?? false;
    if (!wasDisabled && isDisabled) {
      animRef.current?.stop();
      animRef.current = null;
      holdAnimRef.current.setValue(1);
      isNearRef.current = false;
      setIsRaining(false);
      // Red de seguridad: forzar posición de origen al quedar deshabilitado.
      pan.setValue({ x: 0, y: 0 });
    }
    prevDisabledRef.current = isDisabled;
  }, [disabled, pan]);

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

const STATUS_BAR_H = StatusBar.currentHeight ?? 24;

const ChatHeader = React.memo(function ChatHeader({
  partnerUsername,
  isFullscreen,
  onClose,
  onToggleFullscreen,
  panHandlers,
}: {
  partnerUsername: string;
  isFullscreen: boolean;
  onClose: () => void;
  onToggleFullscreen: () => void;
  panHandlers: object;
}) {
  return (
    <View
      style={[styles.chatHeader, { paddingTop: isFullscreen ? STATUS_BAR_H + 8 : 8 }]}
      {...panHandlers}>
      <View style={styles.chatHeaderRow}>
        <TouchableOpacity onPress={onClose} style={styles.chatClose}>
          <Icon name="close" size={20} color="#FFF" />
        </TouchableOpacity>
        <Text style={[styles.chatTitle, { flex: 1 }]}>{partnerUsername}</Text>
        <TouchableOpacity onPress={onToggleFullscreen} style={styles.chatExpandBtn}>
          <Icon
            name={isFullscreen ? 'chevron-down' : 'chevron-up'}
            size={22}
            color="#FFF"
          />
        </TouchableOpacity>
      </View>
    </View>
  );
});

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
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const pageRef = useRef(1);
  const loadingMoreRef = useRef(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const flatListRef = useRef<any>(null);
  const idToIndexRef = useRef<Map<string, number>>(new Map());
  // Heart animation: messageId -> Animated.Value
  const heartAnims = useRef<Map<string, Animated.Value>>(new Map()).current;
  // Double-tap timestamps: messageId -> last tap ms
  const tapTimestamps = useRef<Map<string, number>>(new Map()).current;
  // Swipeable refs: messageId -> Swipeable instance for instant close
  const swipeableRefs = useRef<Map<string, Swipeable>>(new Map()).current;
  // Ref al TextInput del ChatInput para enfocarlo programáticamente (swipe-reply)
  const inputRef = useRef<TextInput>(null);

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

  // ── Marcar chat activo y limpiar contador de no leídos al abrir ──
  useEffect(() => {
    if (visible && lazo) {
      setActiveChatLazo(lazo.id);
      clearUnread(lazo.id).catch(() => {});
    } else {
      setActiveChatLazo(null);
    }
    return () => { setActiveChatLazo(null); };
  }, [visible, lazo]);

  // ── Start/stop polling when visible changes ──
  useEffect(() => {
    if (!visible || !lazo) { return; }

    setHasMore(true);
    pageRef.current = 1;
    loadingMoreRef.current = false;

    loadPage(1);

    // Polling como fallback por si el socket está caído. Intervalo amplio
    // (10s) porque el camino normal es el realtime más abajo.
    pollingRef.current = setInterval(async () => {
      try {
        const fresh = await fetchMessages(lazo.id, 1);
        setMessages(prev => {
          if (fresh.length === 0) { return prev; }
          const freshMap = new Map(fresh.map(m => [m.id, m]));
          // Update reactions on existing messages + add new ones
          let changed = false;
          const updated = prev.map(m => {
            const freshMsg = freshMap.get(m.id);
            if (freshMsg && JSON.stringify(freshMsg.reactions) !== JSON.stringify(m.reactions)) {
              changed = true;
              return { ...m, reactions: freshMsg.reactions };
            }
            return m;
          });
          const existingIds = new Set(prev.map(m => m.id));
          const newOnes = fresh.filter(m => !existingIds.has(m.id));
          if (newOnes.length === 0 && !changed) { return prev; }
          return [...newOnes, ...updated];
        });
      } catch {
        // silent
      }
    }, 10000);

    // Realtime: insertar mensajes nuevos al vuelo (dedupe por id).
    const subMsg = DeviceEventEmitter.addListener('rt:message:new', (raw: any) => {
      if (!raw || raw.lazo_id !== lazo.id) { return; }
      const incoming: Message = {
        id: raw.id,
        lazoId: raw.lazo_id,
        senderId: raw.sender_id,
        content: raw.content,
        type: raw.type,
        status: raw.status,
        createdAt: raw.created_at,
        replyToId: raw.reply_to_id ?? undefined,
        replyContent: raw.reply_content ?? undefined,
        replySenderId: raw.reply_sender_id ?? undefined,
        replyType: raw.reply_type ?? undefined,
        replyMediaUrl: raw.reply_media_url ?? undefined,
        replyMediaMime: raw.reply_media_mime ?? undefined,
        reactions: Array.isArray(raw.reactions)
          ? raw.reactions.map((r: any) => ({ userId: r.userId ?? r.user_id, type: r.type }))
          : [],
        mediaUrl: raw.media_url ?? undefined,
        mediaMime: raw.media_mime ?? undefined,
        mediaWidth: raw.media_width ?? undefined,
        mediaHeight: raw.media_height ?? undefined,
        mediaDurationMs: raw.media_duration_ms ?? undefined,
      };
      setMessages(prev => {
        if (prev.some(m => m.id === incoming.id)) { return prev; }
        return [incoming, ...prev];
      });
    });

    // Realtime: actualizar reacciones (con o sin nueva creación).
    const subReact = DeviceEventEmitter.addListener('rt:message:reaction', (p: any) => {
      if (!p || p.lazoId !== lazo.id) { return; }
      const reactions = Array.isArray(p.reactions)
        ? p.reactions.map((r: any) => ({ userId: r.userId ?? r.user_id, type: r.type }))
        : [];
      setMessages(prev => prev.map(m => m.id === p.messageId ? { ...m, reactions } : m));
    });

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      subMsg.remove();
      subReact.remove();
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

  // ── Build id→index map for scroll-to-reply ──
  useEffect(() => {
    const map = new Map<string, number>();
    messages.forEach((m, i) => map.set(m.id, i));
    idToIndexRef.current = map;
  }, [messages]);

  // ── Send message ──
  const handleSend = useCallback(async (text: string) => {
    if (!lazo) { return; }
    const replyId = replyTarget?.id;
    setReplyTarget(null);
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      lazoId: lazo.id,
      senderId: user?.id ?? '',
      content: text,
      type: 'text',
      status: 'pending',
      createdAt: new Date().toISOString(),
      replyToId: replyId,
      replyContent: replyTarget?.content,
      replySenderId: replyTarget?.senderId,
      replyType: replyTarget?.type,
      replyMediaUrl: replyTarget?.mediaUrl,
      replyMediaMime: replyTarget?.mediaMime,
      reactions: [],
    };
    setMessages(prev => [optimistic, ...prev]);
    try {
      const sent = await apiSendMessage(lazo.id, text, replyId);
      setMessages(prev => {
        const mapped = prev.map(m => (m.id === tempId ? sent : m));
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
    }
  }, [lazo, replyTarget, user?.id]);

  // ── Visor fullscreen de media ──
  // Para fotos usamos react-native-image-viewing (pinch zoom incluido).
  // Para video, un modal propio con react-native-video.
  const [photoViewerUri, setPhotoViewerUri] = useState<string | null>(null);
  const [videoViewerUri, setVideoViewerUri] = useState<string | null>(null);

  // ── Envío de media (foto/video) ──
  const handlePickMedia = useCallback(async (source: 'camera' | 'gallery') => {
    if (!lazo) { return; }
    const asset = source === 'camera' ? await pickFromCamera() : await pickFromGallery();
    if (!asset || !asset.uri) { return; }

    const isVideo = (asset.type ?? '').startsWith('video/');
    const replyId = replyTarget?.id;
    setReplyTarget(null);
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      lazoId: lazo.id,
      senderId: user?.id ?? '',
      content: '',
      type: isVideo ? 'video' : 'photo',
      status: 'pending',
      createdAt: new Date().toISOString(),
      replyToId: replyId,
      replyContent: replyTarget?.content,
      replySenderId: replyTarget?.senderId,
      replyType: replyTarget?.type,
      replyMediaUrl: replyTarget?.mediaUrl,
      replyMediaMime: replyTarget?.mediaMime,
      reactions: [],
      mediaUrl: asset.uri,
      mediaMime: asset.type,
      mediaWidth: asset.width,
      mediaHeight: asset.height,
    };
    setMessages(prev => [optimistic, ...prev]);
    try {
      const sent = await uploadMedia(lazo.id, asset, replyId);
      setMessages(prev => prev.map(m => (m.id === tempId ? sent : m)));
    } catch (err: any) {
      setMessages(prev => prev.filter(m => m.id !== tempId));
      Alert.alert('Error', err.message ?? 'No se pudo subir el archivo');
    }
  }, [lazo, replyTarget, user?.id]);

  const handlePickCamera  = useCallback(() => { handlePickMedia('camera'); },  [handlePickMedia]);
  const handlePickGallery = useCallback(() => { handlePickMedia('gallery'); }, [handlePickMedia]);

  // ── Toggle heart reaction ──
  const handleReact = useCallback(async (msg: Message) => {
    if (!lazo) { return; }
    // Optimistic update
    const userId = user?.id ?? '';
    const alreadyReacted = (msg.reactions ?? []).some(r => r.userId === userId && r.type === 'heart');
    setMessages(prev => prev.map(m => {
      if (m.id !== msg.id) { return m; }
      const newReactions = alreadyReacted
        ? (m.reactions ?? []).filter(r => !(r.userId === userId && r.type === 'heart'))
        : [...(m.reactions ?? []), { userId, type: 'heart' }];
      return { ...m, reactions: newReactions };
    }));

    // Animate heart
    if (!alreadyReacted) {
      if (!heartAnims.has(msg.id)) {
        heartAnims.set(msg.id, new Animated.Value(0));
      }
      const anim = heartAnims.get(msg.id)!;
      anim.setValue(0);
      Animated.sequence([
        Animated.spring(anim, { toValue: 1, useNativeDriver: true, tension: 200, friction: 5 }),
        Animated.timing(anim, { toValue: 0, duration: 600, delay: 400, useNativeDriver: true }),
      ]).start();
    }

    try {
      const updated = await apiToggleReaction(lazo.id, msg.id);
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reactions: updated } : m));
    } catch {
      // Revert optimistic on error
      setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, reactions: msg.reactions } : m));
    }
  }, [lazo, user?.id, heartAnims]);

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

  const handleToggleFullscreen = useCallback(() => {
    snapTo(isFullscreen ? CHAT_HALF_HEIGHT : chatFullHeight);
  }, [snapTo, isFullscreen, chatFullHeight]);

  const handleFocusExpand = useCallback(() => {
    if (!isFullscreen) {
      // Expandir inmediatamente sin animar para evitar flicker por recalculo de layout
      currentSnap.current = chatFullHeight;
      setIsFullscreen(true);
      containerHeight.setValue(chatFullHeight);
    }
  }, [isFullscreen, chatFullHeight, containerHeight]);

  const handleOpen = useCallback(() => {
    currentSnap.current = CHAT_HALF_HEIGHT;
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
      <GestureHandlerRootView style={StyleSheet.absoluteFill}>
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
            <ChatHeader
              partnerUsername={lazo?.partnerUsername ?? '—'}
              isFullscreen={isFullscreen}
              onClose={handleClose}
              onToggleFullscreen={handleToggleFullscreen}
              panHandlers={headerPan.panHandlers}
            />

            {/* Mensajes */}
            <GHFlatList
              ref={flatListRef}
              data={messages}
              inverted
              keyExtractor={m => m.id}
              style={{ flex: 1, backgroundColor: C.bg }}
              contentContainerStyle={{ padding: 16, paddingBottom: 20 }}
              onEndReached={handleEndReached}
              onEndReachedThreshold={0.3}
              ItemSeparatorComponent={() => <View style={{ height: 14 }} />}
              renderItem={({ item, index }) => {
                const mine = item.senderId === user?.id;
                const heartCount = (item.reactions ?? []).filter(r => r.type === 'heart').length;
                const iReacted = (item.reactions ?? []).some(r => r.userId === user?.id && r.type === 'heart');
                const heartAnim = heartAnims.get(item.id);
                // Separador de día: al último mensaje (más antiguo) o cuando el
                // mensaje cronológicamente anterior (index+1, lista invertida y
                // ordenada descendente) es de otro día.
                const showDaySeparator =
                  index === messages.length - 1 ||
                  !isSameCalendarDay(messages[index + 1].createdAt, item.createdAt);

                // Mensaje de sistema (riego, avisos de racha): pill centrado
                // sin burbuja, sin swipe, sin reacciones.
                if (item.type === 'system') {
                  return (
                    <View>
                      {showDaySeparator && (
                        <View style={styles.daySeparator}>
                          <Text style={styles.daySeparatorText}>
                            {formatChatDateSeparator(item.createdAt)}
                          </Text>
                        </View>
                      )}
                      <View style={styles.systemMessage}>
                        <Text style={styles.systemMessageText}>{item.content}</Text>
                      </View>
                    </View>
                  );
                }

                return (
                  <View style={{ overflow: 'visible', marginBottom: heartCount > 0 ? 12 : 0 }}>
                    {showDaySeparator && (
                      <View style={styles.daySeparator}>
                        <Text style={styles.daySeparatorText}>
                          {formatChatDateSeparator(item.createdAt)}
                        </Text>
                      </View>
                    )}
                    <Swipeable
                      ref={ref => {
                        if (ref) { swipeableRefs.set(item.id, ref); }
                        else { swipeableRefs.delete(item.id); }
                      }}
                      renderLeftActions={() => (
                        <View style={styles.swipeReplyHint}>
                          <Icon name="reply" size={20} color={C.green} />
                        </View>
                      )}
                      onSwipeableWillOpen={(direction: 'left' | 'right') => {
                        if (direction === 'left') {
                          setReplyTarget(item);
                          swipeableRefs.get(item.id)?.close();
                          handleFocusExpand();
                          inputRef.current?.focus();
                        }
                      }}
                      overshootFriction={8}
                      overshootLeft={false}
                      leftThreshold={60}>
                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => {
                          const now = Date.now();
                          const last = tapTimestamps.get(item.id) ?? 0;
                          if (now - last < 300) {
                            handleReact(item);
                            tapTimestamps.delete(item.id);
                          } else {
                            tapTimestamps.set(item.id, now);
                          }
                        }}>
                        <View style={[
                          styles.bubble,
                          mine ? styles.bubbleMine : styles.bubbleOther,
                          (item.type === 'photo' || item.type === 'video') && styles.bubbleMedia,
                        ]}>
                          {/* Reply quote */}
                          {item.replyToId && (item.replyContent || item.replyType) && (
                            <TouchableOpacity
                              style={[
                                styles.replyQuote,
                                mine && styles.replyQuoteMine,
                                (item.replyType === 'photo' || item.replyType === 'video') && styles.replyQuoteMedia,
                              ]}
                              onPress={() => {
                                const idx = idToIndexRef.current.get(item.replyToId!);
                                if (idx !== undefined) {
                                  flatListRef.current?.scrollToIndex({ index: idx, animated: true });
                                }
                              }}>
                              {item.replyType === 'photo' && item.replyMediaUrl && (
                                <Image
                                  source={{ uri: resolveMediaUrl(item.replyMediaUrl) }}
                                  style={styles.replyQuoteThumb}
                                  resizeMode="cover"
                                />
                              )}
                              {item.replyType === 'video' && (
                                <View style={[styles.replyQuoteThumb, styles.replyQuoteVideoThumb]}>
                                  <Icon
                                    name="play-circle"
                                    size={18}
                                    color={mine ? 'rgba(255,255,255,0.9)' : C.textSoft}
                                  />
                                </View>
                              )}
                              <Text style={[styles.replyQuoteText, mine && styles.replyQuoteTextMine]} numberOfLines={2}>
                                {replyQuoteLabel(item)}
                              </Text>
                            </TouchableOpacity>
                          )}
                          {item.type === 'photo' && item.mediaUrl && (
                            <TouchableOpacity
                              activeOpacity={0.9}
                              onPress={() => {
                                const uri = resolveMediaUrl(item.mediaUrl);
                                if (uri) { setPhotoViewerUri(uri); }
                              }}>
                              <Image
                                source={{ uri: resolveMediaUrl(item.mediaUrl) }}
                                style={[
                                  styles.mediaImage,
                                  item.mediaWidth && item.mediaHeight
                                    ? { aspectRatio: item.mediaWidth / item.mediaHeight }
                                    : null,
                                ]}
                                resizeMode="cover"
                              />
                              {item.status === 'pending' && (
                                <View style={styles.mediaOverlay}>
                                  <ActivityIndicator color="#FFF" />
                                </View>
                              )}
                            </TouchableOpacity>
                          )}
                          {item.type === 'video' && item.mediaUrl && (
                            <TouchableOpacity
                              activeOpacity={0.9}
                              onPress={() => {
                                const uri = resolveMediaUrl(item.mediaUrl);
                                if (uri) { setVideoViewerUri(uri); }
                              }}>
                              <View style={[
                                styles.mediaImage,
                                item.mediaWidth && item.mediaHeight
                                  ? { aspectRatio: item.mediaWidth / item.mediaHeight }
                                  : { aspectRatio: 16 / 9 },
                                styles.videoThumb,
                              ]}>
                                <Icon name="play-circle" size={56} color="rgba(255,255,255,0.95)" />
                              </View>
                              {item.status === 'pending' && (
                                <View style={styles.mediaOverlay}>
                                  <ActivityIndicator color="#FFF" />
                                </View>
                              )}
                            </TouchableOpacity>
                          )}
                          {item.type === 'text' && (
                            <>
                              <MessageText
                                text={item.content}
                                style={[styles.bubbleText, mine && styles.bubbleTextMine]}
                                linkStyle={mine ? styles.linkTextMine : styles.linkText}
                              />
                              {(() => {
                                const firstUrl = extractFirstUrl(item.content);
                                if (!firstUrl || !lazo) { return null; }
                                return (
                                  <LinkPreviewCard
                                    lazoId={lazo.id}
                                    url={firstUrl}
                                    mine={mine}
                                    width={Math.min(SW * 0.75 - 24, 240)}
                                  />
                                );
                              })()}
                            </>
                          )}
                          <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                            {formatTime(item.createdAt)}
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </Swipeable>
                    {/* Heart reaction badge — OUTSIDE Swipeable to avoid clipping */}
                    {heartCount > 0 && (
                      <View style={[styles.heartBadge, mine ? styles.heartBadgeMine : styles.heartBadgeOther]}>
                        <Text style={[styles.heartBadgeText, iReacted && styles.heartBadgeTextActive]}>
                          {'❤️'} {heartCount > 1 ? heartCount : ''}
                        </Text>
                      </View>
                    )}
                    {/* Heart animation — OUTSIDE Swipeable to avoid clipping */}
                    {heartAnim && (
                      <Animated.View
                        style={[
                          styles.heartFloating,
                          mine ? styles.heartFloatingMine : styles.heartFloatingOther,
                          {
                            opacity: heartAnim,
                            transform: [{ scale: heartAnim.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1.4] }) }],
                          },
                        ]}
                        pointerEvents="none">
                        <Text style={{ fontSize: 28 }}>❤️</Text>
                      </Animated.View>
                    )}
                  </View>
                );
              }}
            />

            {/* Reply preview */}
            {replyTarget && (
              <View style={styles.replyPreview}>
                <View style={styles.replyPreviewBar} />
                {replyTarget.type === 'photo' && replyTarget.mediaUrl && (
                  <Image
                    source={{ uri: resolveMediaUrl(replyTarget.mediaUrl) }}
                    style={styles.replyPreviewThumb}
                    resizeMode="cover"
                  />
                )}
                {replyTarget.type === 'video' && (
                  <View style={[styles.replyPreviewThumb, styles.replyQuoteVideoThumb]}>
                    <Icon name="play-circle" size={18} color={C.textSoft} />
                  </View>
                )}
                <Text style={styles.replyPreviewText} numberOfLines={1}>
                  {replyQuoteLabel(replyTarget)}
                </Text>
                <TouchableOpacity onPress={() => setReplyTarget(null)} style={styles.replyPreviewClose}>
                  <Icon name="close" size={18} color={C.textSoft} />
                </TouchableOpacity>
              </View>
            )}

            {/* Input (isolated component — no re-render of header on keystroke) */}
            <ChatInput
              onSend={handleSend}
              onFocusExpand={handleFocusExpand}
              onPickFromCamera={handlePickCamera}
              onPickFromGallery={handlePickGallery}
              inputRef={inputRef}
            />

          </View>
        </Animated.View>
      </View>
      </GestureHandlerRootView>

      {/* Visor fullscreen de foto (pinch zoom) */}
      <ImageViewing
        images={photoViewerUri ? [{ uri: photoViewerUri }] : []}
        imageIndex={0}
        visible={!!photoViewerUri}
        onRequestClose={() => setPhotoViewerUri(null)}
        backgroundColor="#000"
      />

      {/* Visor fullscreen de video */}
      <Modal
        visible={!!videoViewerUri}
        animationType="fade"
        transparent={false}
        onRequestClose={() => setVideoViewerUri(null)}>
        <View style={styles.videoViewer}>
          {videoViewerUri && (
            <Video
              source={{ uri: videoViewerUri }}
              style={StyleSheet.absoluteFill}
              controls
              resizeMode="contain"
              onEnd={() => setVideoViewerUri(null)}
            />
          )}
          <TouchableOpacity
            style={styles.videoViewerClose}
            onPress={() => setVideoViewerUri(null)}>
            <Icon name="close" size={28} color="#FFF" />
          </TouchableOpacity>
        </View>
      </Modal>
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
  pendingDeleteIds,
  onRequestDelete,
  onUndoDelete,
  deletedSnackbar,
}: {
  visible: boolean;
  onClose: () => void;
  username?: string;
  lazos: Lazo[];
  onSelectLazo: (lazo: Lazo) => void;
  onNewLazo: () => void;
  pendingDeleteIds: Set<string>;
  onRequestDelete: (lazoId: string) => void;
  onUndoDelete: (lazoId: string) => void;
  deletedSnackbar: { lazoId: string; partnerUsername: string } | null;
}) {
  const translateX = useRef(new Animated.Value(-SW * 0.78)).current;

  // ── Estado de edición (in-memory) ──
  const [editMode, setEditMode] = useState(false);
  // Edición cosmética/local de nombres (no persiste). Sólo guardamos overrides
  // sobre los lazos del padre — el borrado se delega completamente.
  const [nameOverrides, setNameOverrides] = useState<Record<string, string>>({});
  const [editingLazo, setEditingLazo] = useState<Lazo | null>(null);
  const [editName, setEditName] = useState('');
  const [lazosModalOpen, setLazosModalOpen] = useState(false);

  // Lazos visibles: filtrar los marcados como pendientes de borrado por el padre
  // y aplicar los overrides cosméticos de nombres.
  const visibleLazos = lazos
    .filter(l => !pendingDeleteIds.has(l.id))
    .map(l => nameOverrides[l.id] ? { ...l, partnerUsername: nameOverrides[l.id] } : l);

  // ── Badges de no leídos ──
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  useEffect(() => {
    let mounted = true;
    getAllUnread().then(m => { if (mounted) { setUnreadMap(m); } });
    const sub = DeviceEventEmitter.addListener(
      UNREAD_CHANGED,
      ({ lazoId, count }: { lazoId: string; count: number }) => {
        setUnreadMap(prev => {
          const next = { ...prev };
          if (count <= 0) { delete next[lazoId]; } else { next[lazoId] = count; }
          return next;
        });
      },
    );
    return () => { mounted = false; sub.remove(); };
  }, []);

  // ── Handlers ──
  const handleDelete = (lazo: Lazo) => {
    onRequestDelete(lazo.id);
  };

  const handleUndo = () => {
    if (!deletedSnackbar) { return; }
    onUndoDelete(deletedSnackbar.lazoId);
  };

  const handleEditOpen = (lazo: Lazo) => {
    setEditingLazo(lazo);
    setEditName(lazo.partnerUsername);
  };

  const handleEditSave = () => {
    if (!editingLazo) { return; }
    const trimmed = editName.trim();
    if (trimmed) {
      setNameOverrides(prev => ({ ...prev, [editingLazo.id]: trimmed }));
    }
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
                  <Text style={styles.sideMenuSub}>{visibleLazos.length} lazos activos</Text>
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
                data={visibleLazos}
                keyExtractor={i => i.id}
                contentContainerStyle={{ paddingHorizontal: 16 }}
                renderItem={({ item }) => {
                  const unread = unreadMap[item.id] ?? 0;
                  return (
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
                      {/* Badge de no leídos: aparece por encima del icono del lazo */}
                      {!editMode && unread > 0 && (
                        <View style={styles.unreadBadge}>
                          <Text style={styles.unreadBadgeText}>{formatUnreadBadge(unread)}</Text>
                        </View>
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
                  );
                }}
              />

              {/* Botón crear lazo */}
              <TouchableOpacity style={styles.newLazoBtn} onPress={() => { onClose(); onNewLazo(); }}>
                <Icon name="plus" size={18} color="#FFF" />
                <Text style={styles.newLazoBtnText}>Crear nuevo lazo</Text>
              </TouchableOpacity>

              {/* Snackbar deshacer (estado controlado por el padre) */}
              {deletedSnackbar && (
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

  // ── Borrado de lazos (pendientes 4s con opción "Deshacer") ──
  const [pendingDeleteIds, setPendingDeleteIds] = useState<Set<string>>(new Set());
  const pendingDeleteIdsRef = useRef<Set<string>>(new Set());
  const pendingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingSnapshotsRef = useRef<Map<string, Lazo>>(new Map());
  const [deletedSnackbar, setDeletedSnackbar] = useState<{ lazoId: string; partnerUsername: string } | null>(null);

  // ── Badge de no leídos para el FAB "Chat" ──
  const [unreadMap, setUnreadMap] = useState<Record<string, number>>({});
  useEffect(() => {
    let mounted = true;
    getAllUnread().then(m => { if (mounted) { setUnreadMap(m); } });
    const sub = DeviceEventEmitter.addListener(
      UNREAD_CHANGED,
      ({ lazoId, count }: { lazoId: string; count: number }) => {
        setUnreadMap(prev => {
          const next = { ...prev };
          if (count <= 0) { delete next[lazoId]; } else { next[lazoId] = count; }
          return next;
        });
      },
    );
    return () => { mounted = false; sub.remove(); };
  }, []);

  const loadLazos = useCallback(() => {
    // Aplicar el filtro de borrados pendientes (outbox) antes de mostrar la
    // lista para que un lazo pendiente no parpadee al arrancar.
    getPendingDeletes()
      .then(pending => {
      if (pending.length > 0) {
        const next = new Set(pendingDeleteIdsRef.current);
        pending.forEach(id => next.add(id));
        pendingDeleteIdsRef.current = next;
      }
      return fetchLazos();
    })
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
        // Excluir los lazos marcados como "pendientes de borrar" para que no
        // reaparezcan al refrescar dentro de la ventana de 4s.
        const pending = pendingDeleteIdsRef.current;
        const visible = pending.size > 0
          ? mapped.filter(l => !pending.has(l.id))
          : mapped;
        setLazos(visible);
        setActiveLazo(prev => {
          if (!prev) { return visible.length > 0 ? visible[0] : null; }
          // Actualizar activeLazo con datos frescos si sigue existiendo
          const fresh = visible.find(l => l.id === prev.id);
          return fresh ?? (visible.length > 0 ? visible[0] : null);
        });
      })
      .catch(() => {});
  }, []);

  useEffect(() => { loadLazos(); }, [loadLazos]);

  // ── Outbox de borrados: ejecutar DELETEs que quedaron pendientes porque
  // la app se cerró dentro de la ventana de "Deshacer" (4s) ──
  useEffect(() => {
    let mounted = true;
    (async () => {
      const pending = await getPendingDeletes();
      if (!mounted || pending.length === 0) { return; }
      // Filtrar visualmente mientras corre el flush
      const next = new Set(pendingDeleteIdsRef.current);
      pending.forEach(id => next.add(id));
      pendingDeleteIdsRef.current = next;
      setPendingDeleteIds(new Set(next));
      await flushPendingDeletes();
      if (!mounted) { return; }
      const remaining = new Set(await getPendingDeletes());
      pendingDeleteIdsRef.current = remaining;
      setPendingDeleteIds(new Set(remaining));
      loadLazos();
    })();
    return () => { mounted = false; };
  }, [loadLazos]);

  // Refrescar al volver a la pantalla (fallback cuando FCM falla)
  useFocusEffect(useCallback(() => { loadLazos(); }, [loadLazos]));

  // Suscripciones a eventos en tiempo real
  useEffect(() => {
    const subRefresh = DeviceEventEmitter.addListener(
      'lazos:refresh',
      () => { loadLazos(); },
    );
    const subDeleted = DeviceEventEmitter.addListener(
      'lazos:deleted-by-partner',
      ({ deleterUsername }: { lazoId: string; deleterUsername: string }) => {
        loadLazos();
        Alert.alert('Lazo eliminado', `${deleterUsername} eliminó su lazo contigo`);
      },
    );

    // Socket.IO: riego del compañero / lazo creado / lazo borrado
    const subRtWatering = DeviceEventEmitter.addListener(
      'rt:watering',
      (p: any) => {
        if (!p || !p.lazoId) { return; }
        const updater = (l: Lazo): Lazo => l.id === p.lazoId
          ? {
              ...l,
              streak: Number(p.streak ?? l.streak),
              plantPhase: p.plantPhase ?? l.plantPhase,
              plantXp: Number(p.plantXp ?? l.plantXp),
              // El payload viene desde la perspectiva del emisor: el usuario
              // que regó es "wateredByUserId". Si soy yo, marca iWateredToday;
              // si no, marca partnerWateredToday.
              iWateredToday: String(p.wateredByUserId) === String(user?.id)
                ? true : l.iWateredToday,
              partnerWateredToday: String(p.wateredByUserId) !== String(user?.id)
                ? true : l.partnerWateredToday,
            }
          : l;
        setLazos(prev => prev.map(updater));
        setActiveLazo(prev => prev ? updater(prev) : prev);
      },
    );
    const subRtDeleted = DeviceEventEmitter.addListener(
      'rt:lazo:deleted',
      ({ deleterUsername }: { lazoId: string; deleterUsername: string }) => {
        loadLazos();
        Alert.alert('Lazo eliminado', `${deleterUsername} eliminó su lazo contigo`);
      },
    );
    const subRtCreated = DeviceEventEmitter.addListener(
      'rt:lazo:created',
      () => { loadLazos(); },
    );

    // Mensajes nuevos vía socket con la app abierta y el chat cerrado:
    // incrementar el badge de no leídos del lazo. Los mensajes propios no
    // cuentan, ni los del chat que esté abierto en pantalla.
    // Nota: si en el futuro FCM foreground llegara a dispararse junto con el
    // socket para el mismo mensaje habría doble conteo; hoy FCM foreground
    // está inactivo (ver C1), así que el socket es la única fuente.
    // Los mensajes de sistema (riego, avisos) no incrementan no leídos.
    const subRtMessage = DeviceEventEmitter.addListener(
      'rt:message:new',
      (raw: any) => {
        if (!raw || typeof raw.lazo_id !== 'string') { return; }
        if (raw.type === 'system') { return; }
        if (String(raw.sender_id ?? '') === String(user?.id ?? '')) { return; }
        if (getActiveChatLazo() === raw.lazo_id) { return; }
        incrementUnread(raw.lazo_id).catch(() => {});
      },
    );

    return () => {
      subRefresh.remove();
      subDeleted.remove();
      subRtWatering.remove();
      subRtDeleted.remove();
      subRtCreated.remove();
      subRtMessage.remove();
    };
  }, [loadLazos, user?.id]);

  // Mantener al socket suscrito a las salas correspondientes. Re-emitimos el
  // join cuando cambia el conjunto de ids (orden-insensible) para no spamear.
  const lazoIdsHash = lazos.map(l => l.id).sort().join(',');
  useEffect(() => {
    const ids = lazoIdsHash ? lazoIdsHash.split(',') : [];
    joinLazos(ids);
  }, [lazoIdsHash]);

  // ── Borrado de lazos: marcar como pendiente, programar DELETE en 4s ──
  const markPendingDelete = useCallback((lazoId: string) => {
    // Tomar snapshot del lazo para poder restaurarlo en caso de error / undo.
    const snapshot = lazos.find(l => l.id === lazoId)
      ?? (activeLazo?.id === lazoId ? activeLazo : undefined);
    if (snapshot) { pendingSnapshotsRef.current.set(lazoId, snapshot); }

    // Actualizar refs + state para que cualquier render / loadLazos lo oculte.
    pendingDeleteIdsRef.current = new Set(pendingDeleteIdsRef.current).add(lazoId);
    setPendingDeleteIds(new Set(pendingDeleteIdsRef.current));

    // Mover activeLazo si era el que se está borrando.
    setLazos(prev => {
      const remaining = prev.filter(l => l.id !== lazoId);
      setActiveLazo(curr => {
        if (curr?.id !== lazoId) { return curr; }
        return remaining.length > 0 ? remaining[0] : null;
      });
      return remaining;
    });

    // Snackbar
    setDeletedSnackbar({
      lazoId,
      partnerUsername: snapshot?.partnerUsername ?? '',
    });

    // Outbox: persistir el borrado ANTES de programar el timer, para que
    // sobreviva si la app muere dentro de la ventana de 4s.
    addPendingDelete(lazoId).catch(() => {});

    // Timer 4s → confirmar borrado en backend
    const existing = pendingTimersRef.current.get(lazoId);
    if (existing) { clearTimeout(existing); }
    const timer = setTimeout(async () => {
      pendingTimersRef.current.delete(lazoId);
      try {
        await deleteLazoRemote(lazoId);
      } catch (err: any) {
        // Restaurar visualmente si falla el DELETE
        removePendingDelete(lazoId).catch(() => {});
        const snap = pendingSnapshotsRef.current.get(lazoId);
        pendingSnapshotsRef.current.delete(lazoId);
        const nextSet = new Set(pendingDeleteIdsRef.current);
        nextSet.delete(lazoId);
        pendingDeleteIdsRef.current = nextSet;
        setPendingDeleteIds(new Set(nextSet));
        if (snap) {
          setLazos(prev => prev.some(l => l.id === lazoId) ? prev : [...prev, snap]);
        }
        Alert.alert('Error', err?.message ?? 'No se pudo eliminar el lazo');
        return;
      }
      // Éxito: quitar del set y outbox, refrescar lista.
      removePendingDelete(lazoId).catch(() => {});
      pendingSnapshotsRef.current.delete(lazoId);
      const nextSet = new Set(pendingDeleteIdsRef.current);
      nextSet.delete(lazoId);
      pendingDeleteIdsRef.current = nextSet;
      setPendingDeleteIds(new Set(nextSet));
      setDeletedSnackbar(curr => curr?.lazoId === lazoId ? null : curr);
      loadLazos();
    }, 4000);
    pendingTimersRef.current.set(lazoId, timer);
  }, [lazos, activeLazo, loadLazos]);

  const undoDelete = useCallback((lazoId: string) => {
    const timer = pendingTimersRef.current.get(lazoId);
    if (timer) { clearTimeout(timer); pendingTimersRef.current.delete(lazoId); }
    removePendingDelete(lazoId).catch(() => {});
    const snap = pendingSnapshotsRef.current.get(lazoId);
    pendingSnapshotsRef.current.delete(lazoId);
    const nextSet = new Set(pendingDeleteIdsRef.current);
    nextSet.delete(lazoId);
    pendingDeleteIdsRef.current = nextSet;
    setPendingDeleteIds(new Set(nextSet));
    if (snap) {
      setLazos(prev => prev.some(l => l.id === lazoId) ? prev : [...prev, snap]);
    }
    setDeletedSnackbar(curr => curr?.lazoId === lazoId ? null : curr);
  }, []);

  // Cleanup de timers al desmontar
  useEffect(() => () => {
    pendingTimersRef.current.forEach(t => clearTimeout(t));
    pendingTimersRef.current.clear();
  }, []);

  const activeLazoUnread = activeLazo ? (unreadMap[activeLazo.id] ?? 0) : 0;

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
          <Text style={styles.headerName} numberOfLines={1}>
            {activeLazo?.partnerUsername ?? user?.username ?? 'Lazos'}
          </Text>
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

            {/* Planta muerta: flujo de revivir (mismo riego, mismo endpoint) */}
            {activeLazo && activeLazo.plantPhase === 'dead' && !activeLazo.iWateredToday && (
              <View style={[styles.warningBadge, styles.deadBadge]}>
                <Text style={[styles.warningText, styles.deadBadgeText]}>
                  🥀 Tu planta murió — ¡Revívela! Arrastra la gota para regar
                </Text>
              </View>
            )}
            {activeLazo && activeLazo.plantPhase === 'dead' && activeLazo.iWateredToday && !activeLazo.partnerWateredToday && (
              <View style={[styles.warningBadge, styles.deadBadge]}>
                <Text style={[styles.warningText, styles.deadBadgeText]}>
                  Ya regaste. Cuando {activeLazo.partnerUsername} también riegue, la planta revivirá 🌱
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
          <View style={styles.fabChatWrap}>
            <TouchableOpacity
              style={[styles.fabChat, !activeLazo && { opacity: 0.5 }]}
              onPress={() => activeLazo && setChatOpen(true)}
              disabled={!activeLazo}>
              <Icon name="chat-outline" size={16} color="#FFF" style={{ marginRight: 6 }} />
              <Text style={styles.fabChatText}>Chat</Text>
            </TouchableOpacity>
            {activeLazoUnread > 0 && (
              <View style={styles.fabChatBadge} pointerEvents="none">
                <Text style={styles.fabChatBadgeText}>{formatUnreadBadge(activeLazoUnread)}</Text>
              </View>
            )}
          </View>
          <WaterButton
            onWater={handleWater}
            plantZone={plantZone}
            holdAnim={holdAnim}
            disabled={!activeLazo || activeLazo.iWateredToday}
          />
        </View>
      </SafeAreaView>

      <ChatModal visible={chatOpen} onClose={() => { setChatOpen(false); loadLazos(); }} lazo={activeLazo} />
      <SideMenu
        visible={menuOpen}
        onClose={() => setMenuOpen(false)}
        username={user?.username}
        lazos={lazos}
        onSelectLazo={lazo => setActiveLazo(lazo)}
        onNewLazo={() => setLazosModalOpen(true)}
        pendingDeleteIds={pendingDeleteIds}
        onRequestDelete={markPendingDelete}
        onUndoDelete={undoDelete}
        deletedSnackbar={deletedSnackbar}
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
  fabChatWrap: { position: 'relative', overflow: 'visible' },
  fabChat: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.green, borderRadius: 24,
    paddingHorizontal: 18, paddingVertical: 10,
    shadowColor: C.green, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35, shadowRadius: 8, elevation: 6,
  },
  fabChatText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  fabChatBadge: {
    position: 'absolute',
    top: -6, right: -6,
    minWidth: 20, height: 20,
    paddingHorizontal: 6, borderRadius: 10,
    backgroundColor: '#D9534F',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: C.bg,
  },
  fabChatBadgeText: { color: '#FFF', fontSize: 11, fontWeight: '700' },
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
  deadBadge: {
    backgroundColor: '#F8D7DA',
  },
  deadBadgeText: { color: '#721C24' },
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
    marginBottom: 2,
  },
  bubbleMine: { backgroundColor: C.green, alignSelf: 'flex-end' },
  bubbleOther: { alignSelf: 'flex-start' },
  bubbleText: { fontSize: 15, color: C.text, lineHeight: 20 },
  bubbleTextMine: { color: '#FFF' },
  linkText: { color: '#1B74E4', textDecorationLine: 'underline' },
  linkTextMine: { color: '#D8E8FF', textDecorationLine: 'underline' },
  bubbleTime: { fontSize: 11, color: C.textLight, marginTop: 4 },
  bubbleTimeMine: { color: 'rgba(255,255,255,0.7)' },
  bubbleMedia: { padding: 4, overflow: 'hidden' },
  mediaImage: {
    width: 220,
    minHeight: 140,
    maxHeight: 320,
    borderRadius: 12,
    backgroundColor: '#0002',
  },
  mediaOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  videoThumb: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
  },
  videoViewer: {
    flex: 1,
    backgroundColor: '#000',
  },
  videoViewerClose: {
    position: 'absolute',
    top: 40,
    right: 20,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
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

  // ── Swipe reply ──
  swipeReplyHint: {
    width: 60, alignItems: 'center', justifyContent: 'center',
    paddingLeft: 12,
  },

  // ── Separador de día (chat) ──
  daySeparator: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 3,
    marginBottom: 6,
  },
  daySeparatorText: {
    fontSize: 11,
    color: C.textSoft,
    fontWeight: '600',
  },

  // ── Mensaje de sistema (riego, avisos) ──
  systemMessage: {
    alignSelf: 'center',
    backgroundColor: 'rgba(0,0,0,0.06)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  systemMessageText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: C.textSoft,
    textAlign: 'center',
  },

  // ── Reply quote inside bubble ──
  replyQuote: {
    borderLeftWidth: 3, borderLeftColor: 'rgba(255,255,255,0.6)',
    paddingLeft: 8, marginBottom: 6,
    backgroundColor: 'rgba(0,0,0,0.08)',
    borderRadius: 6, padding: 6,
  },
  replyQuoteMine: {
    borderLeftColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  replyQuoteText: { fontSize: 12, color: C.textSoft },
  replyQuoteTextMine: { color: 'rgba(255,255,255,0.85)' },
  replyQuoteMedia: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  replyQuoteThumb: {
    width: 40,
    height: 40,
    borderRadius: 6,
    marginRight: 8,
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
  replyQuoteVideoThumb: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Reply preview bar (above input) ──
  replyPreview: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: C.beige,
    borderTopWidth: 1, borderTopColor: C.beige,
  },
  replyPreviewBar: {
    width: 3, height: '100%', borderRadius: 2,
    backgroundColor: C.green, alignSelf: 'stretch', minHeight: 16,
  },
  replyPreviewText: { flex: 1, fontSize: 13, color: C.textSoft },
  replyPreviewThumb: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  replyPreviewClose: { padding: 4 },

  // ── Heart reaction badge ──
  heartBadge: {
    position: 'absolute', bottom: -8,
    backgroundColor: C.white,
    borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1,
    borderWidth: 1, borderColor: C.beige,
    elevation: 2, zIndex: 10,
  },
  heartBadgeMine: { right: 6 },
  heartBadgeOther: { left: 6 },
  heartBadgeText: { fontSize: 12 },
  heartBadgeTextActive: {},

  // ── Heart floating animation ──
  heartFloating: {
    position: 'absolute', top: '30%', zIndex: 20,
  },
  heartFloatingMine: { right: '30%' },
  heartFloatingOther: { left: '30%' },

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
  unreadBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    backgroundColor: '#D9534F',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: C.white,
  },
  unreadBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
    lineHeight: 12,
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
