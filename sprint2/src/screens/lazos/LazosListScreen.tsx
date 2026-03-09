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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path, Ellipse, G } from 'react-native-svg';

const { width: SW, height: SH } = Dimensions.get('window');

// ─── Planta SVG (brote) ───────────────────────────────────────
function PlantSVG() {
  return (
    <Svg width={80} height={80} viewBox="0 0 80 80">
      {/* Tallo */}
      <Path
        d="M40 70 Q40 50 40 35"
        stroke="#5A8A3C"
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
      {/* Hoja izquierda */}
      <Path
        d="M40 48 Q28 38 22 28 Q34 30 40 42"
        fill="#6BAF42"
        opacity={0.9}
      />
      {/* Hoja derecha */}
      <Path
        d="M40 42 Q52 30 58 20 Q48 26 40 38"
        fill="#7DC455"
        opacity={0.9}
      />
      {/* Hoja central pequeña */}
      <Path
        d="M40 35 Q44 26 40 18 Q36 26 40 35"
        fill="#5A8A3C"
      />
    </Svg>
  );
}

// ─── Botón regar (drag and drop) ─────────────────────────────
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
        // Snap de vuelta a posición original
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
    <Animated.View
      style={[styles.waterBtn, { transform: pan.getTranslateTransform() }]}
      {...panResponder.panHandlers}>
      <View style={[styles.waterBtnInner, watered && styles.waterBtnWatered]}>
        <Svg width={28} height={28} viewBox="0 0 24 24">
          <Path
            d="M12 2C12 2 5 10 5 15a7 7 0 0014 0C19 10 12 2 12 2z"
            fill={watered ? '#FFFFFF' : '#FFFFFF'}
            opacity={0.95}
          />
        </Svg>
      </View>
    </Animated.View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────
export function LazosListScreen({ navigation }: any) {
  const [streak] = useState(7);
  const [watered, setWatered] = useState(false);

  return (
    <View style={styles.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="dark-content" />

      {/* Fondo degradado completo */}
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        {/* Esquina superior izquierda — azul verdoso */}
        <View style={styles.gradientTL} />
        {/* Esquina inferior derecha — verde */}
        <View style={styles.gradientBR} />
        {/* Centro — blanco suave */}
        <View style={styles.gradientCenter} />
      </View>

      <SafeAreaView style={styles.safe}>
        {/* ─── Header ─── */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation?.navigate?.('LazosList')}>
            <Svg width={22} height={22} viewBox="0 0 24 24">
              <Path d="M3 6h18M3 12h18M3 18h18" stroke="#444" strokeWidth={2} strokeLinecap="round" />
            </Svg>
          </TouchableOpacity>

          <Text style={styles.headerName}>María González</Text>

          <TouchableOpacity
            style={styles.headerBtn}
            onPress={() => navigation?.navigate?.('Settings')}>
            <Svg width={22} height={22} viewBox="0 0 24 24">
              <Path
                d="M12 15a3 3 0 100-6 3 3 0 000 6z"
                stroke="#444"
                strokeWidth={1.8}
                fill="none"
              />
              <Path
                d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
                stroke="#444"
                strokeWidth={1.8}
                fill="none"
              />
            </Svg>
          </TouchableOpacity>
        </View>

        {/* ─── Tarjeta de planta ─── */}
        <View style={styles.cardWrapper}>
          <View style={styles.card}>
            <PlantSVG />

            <Text style={styles.levelText}>Nivel 1</Text>

            {/* Racha — sin emoji, solo número y texto */}
            <View style={styles.streakBadge}>
              <Text style={styles.streakNumber}>{streak}</Text>
              <Text style={styles.streakLabel}> días de racha</Text>
            </View>

            <Text style={styles.svgPlaceholder}>Espacio para planta SVG</Text>
          </View>
        </View>

        {/* ─── FABs esquina inferior derecha ─── */}
        <View style={styles.fabArea}>
          {/* Botón Chat */}
          <TouchableOpacity
            style={styles.fabChat}
            onPress={() => navigation?.navigate?.('Chat')}>
            <Text style={styles.fabChatText}>Chat</Text>
          </TouchableOpacity>

          {/* Botón regar — drag and drop */}
          <WaterButton onWater={() => setWatered(true)} />
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────
const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F8FFFE',
  },

  // Degradado en capas
  gradientTL: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: SW * 0.6,
    height: SH * 0.5,
    borderBottomRightRadius: SW,
    backgroundColor: 'rgba(200, 230, 240, 0.55)',
  },
  gradientBR: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: SW * 0.65,
    height: SH * 0.55,
    borderTopLeftRadius: SW,
    backgroundColor: 'rgba(195, 235, 210, 0.5)',
  },
  gradientCenter: {
    position: 'absolute',
    top: SH * 0.2,
    left: SW * 0.1,
    width: SW * 0.8,
    height: SH * 0.6,
    borderRadius: SW,
    backgroundColor: 'rgba(255,255,255,0.3)',
  },

  safe: { flex: 1 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerName: {
    fontSize: 17,
    fontWeight: '500',
    color: '#222',
    letterSpacing: 0.2,
  },

  // Tarjeta
  cardWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    width: SW * 0.72,
    paddingVertical: 48,
    paddingHorizontal: 24,
    borderRadius: 28,
    backgroundColor: 'rgba(220, 245, 228, 0.55)',
    alignItems: 'center',
    shadowColor: '#A8D5B5',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 4,
  },
  levelText: {
    marginTop: 14,
    fontSize: 15,
    color: '#444',
    fontWeight: '400',
    letterSpacing: 0.3,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 1,
  },
  streakNumber: {
    fontSize: 15,
    fontWeight: '700',
    color: '#222',
  },
  streakLabel: {
    fontSize: 14,
    color: '#555',
    fontWeight: '400',
  },
  svgPlaceholder: {
    marginTop: 16,
    fontSize: 12,
    color: '#AAA',
    letterSpacing: 0.2,
  },

  // FABs
  fabArea: {
    position: 'absolute',
    bottom: 36,
    right: 24,
    alignItems: 'center',
    gap: 12,
  },
  fabChat: {
    backgroundColor: '#4CAF7D',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
    shadowColor: '#4CAF7D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  fabChatText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
    letterSpacing: 0.3,
  },
  waterBtn: {
    position: 'relative',
  },
  waterBtnInner: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#3B9EE8',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B9EE8',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  waterBtnWatered: {
    backgroundColor: '#27AE60',
  },
});
