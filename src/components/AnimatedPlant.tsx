import React, { useRef, useEffect } from 'react';
import { Animated, Easing } from 'react-native';
import Svg, { Ellipse, Path, Circle, Line, G } from 'react-native-svg';

// ─── Paleta ───────────────────────────────────────────────────
const P = {
  stem:          '#5C8A48',
  stemDark:      '#4A7040',
  leaf:          '#6B9E78',
  leafDark:      '#4A7A58',
  leafLight:     '#9DC4A8',
  petal:         '#FF8A65',
  petalLight:    '#FFAB91',
  flowerCenter:  '#FFD54F',
  flowerCore:    '#FFB300',
  soil:          '#8D6E63',
  soilDark:      '#6D4C41',
  seed:          '#795548',
  deadStem:      '#A8A8A8',
  deadLeaf:      '#C0C0C0',
  deadSoil:      '#AEAEAE',
};

// ─── Suelo compartido ─────────────────────────────────────────
function Soil({ dead }: { dead?: boolean }) {
  const c = dead ? P.deadSoil : P.soil;
  const d = dead ? P.deadSoil : P.soilDark;
  return (
    <>
      <Ellipse cx={60} cy={150} rx={34} ry={10} fill={d} opacity={0.6} />
      <Ellipse cx={60} cy={147} rx={31} ry={8.5} fill={c} />
    </>
  );
}

// ─── Fases SVG ────────────────────────────────────────────────
function SeedSVG() {
  return (
    <G>
      <Soil />
      <Ellipse cx={60} cy={138} rx={12} ry={9} fill={P.seed} />
      <Ellipse cx={56} cy={135} rx={4} ry={3} fill={P.soilDark} opacity={0.35} />
      <Line x1={60} y1={132} x2={60} y2={116} stroke={P.stem} strokeWidth={2.5} strokeLinecap="round" />
      <Ellipse cx={52} cy={123} rx={8} ry={4} fill={P.leaf} transform="rotate(-38, 52, 123)" />
      <Ellipse cx={68} cy={121} rx={8} ry={4} fill={P.leaf} transform="rotate(38, 68, 121)" />
    </G>
  );
}

function SproutSVG() {
  return (
    <G>
      <Soil />
      <Path d="M 60 147 Q 57 128 60 102" stroke={P.stem} strokeWidth={3} strokeLinecap="round" fill="none" />
      <Ellipse cx={47} cy={120} rx={17} ry={7.5} fill={P.leafDark} transform="rotate(-38, 47, 120)" />
      <Ellipse cx={73} cy={114} rx={17} ry={7.5} fill={P.leafDark} transform="rotate(38, 73, 114)" />
      <Ellipse cx={60} cy={99} rx={5.5} ry={8} fill={P.leafDark} />
    </G>
  );
}

function SmallSVG() {
  return (
    <G>
      <Soil />
      <Path d="M 60 147 Q 55 118 60 80" stroke={P.stem} strokeWidth={3.5} strokeLinecap="round" fill="none" />
      <Path d="M 59 120 Q 42 114 36 100" stroke={P.stem} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Path d="M 60 108 Q 77 101 83 89" stroke={P.stem} strokeWidth={2} strokeLinecap="round" fill="none" />
      {/* Hojas bajas */}
      <Ellipse cx={51} cy={131} rx={16} ry={7} fill={P.leafDark} transform="rotate(-42, 51, 131)" />
      <Ellipse cx={69} cy={126} rx={16} ry={7} fill={P.leafDark} transform="rotate(42, 69, 126)" />
      {/* Hojas medias */}
      <Ellipse cx={40} cy={103} rx={19} ry={8} fill={P.leaf} transform="rotate(-18, 40, 103)" />
      <Ellipse cx={80} cy={93} rx={19} ry={8} fill={P.leaf} transform="rotate(18, 80, 93)" />
      <Ellipse cx={60} cy={77} rx={5.5} ry={8} fill={P.leafDark} />
    </G>
  );
}

function BigSVG() {
  return (
    <G>
      <Soil />
      <Path d="M 60 147 Q 53 112 60 62" stroke={P.stem} strokeWidth={4} strokeLinecap="round" fill="none" />
      <Path d="M 58 127 Q 38 120 30 105" stroke={P.stem} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      <Path d="M 61 114 Q 81 106 89 92" stroke={P.stem} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      <Path d="M 59 95 Q 40 87 33 72" stroke={P.stem} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Path d="M 60 83 Q 79 75 85 61" stroke={P.stem} strokeWidth={2} strokeLinecap="round" fill="none" />
      {/* Hojas en 3 pares */}
      <Ellipse cx={52} cy={134} rx={16} ry={7} fill={P.leafDark} transform="rotate(-45, 52, 134)" />
      <Ellipse cx={68} cy={130} rx={16} ry={7} fill={P.leafDark} transform="rotate(45, 68, 130)" />
      <Ellipse cx={35} cy={109} rx={20} ry={8.5} fill={P.leaf} transform="rotate(-14, 35, 109)" />
      <Ellipse cx={85} cy={96} rx={20} ry={8.5} fill={P.leaf} transform="rotate(14, 85, 96)" />
      <Ellipse cx={36} cy={75} rx={18} ry={7.5} fill={P.leafLight} transform="rotate(-20, 36, 75)" />
      <Ellipse cx={83} cy={65} rx={18} ry={7.5} fill={P.leafLight} transform="rotate(20, 83, 65)" />
      <Ellipse cx={60} cy={59} rx={6} ry={8.5} fill={P.leafDark} />
    </G>
  );
}

function FlowerSVG() {
  const cx = 60;
  const cy = 40;
  const outerAngles = [0, 60, 120, 180, 240, 300];
  const innerAngles = [30, 90, 150, 210, 270, 330];

  return (
    <G>
      <Soil />
      <Path d="M 60 147 Q 53 112 60 68" stroke={P.stem} strokeWidth={4} strokeLinecap="round" fill="none" />
      <Path d="M 58 127 Q 38 120 30 105" stroke={P.stem} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      <Path d="M 61 114 Q 81 106 89 92" stroke={P.stem} strokeWidth={2.5} strokeLinecap="round" fill="none" />
      <Path d="M 59 95 Q 40 87 33 72" stroke={P.stem} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Ellipse cx={52} cy={134} rx={16} ry={7} fill={P.leafDark} transform="rotate(-45, 52, 134)" />
      <Ellipse cx={68} cy={130} rx={16} ry={7} fill={P.leafDark} transform="rotate(45, 68, 130)" />
      <Ellipse cx={35} cy={109} rx={20} ry={8.5} fill={P.leaf} transform="rotate(-14, 35, 109)" />
      <Ellipse cx={85} cy={96} rx={20} ry={8.5} fill={P.leaf} transform="rotate(14, 85, 96)" />
      <Ellipse cx={36} cy={75} rx={18} ry={7.5} fill={P.leafLight} transform="rotate(-20, 36, 75)" />
      {/* Pétalos exteriores */}
      {outerAngles.map(a => {
        const rad = (a * Math.PI) / 180;
        const px = cx + 14 * Math.cos(rad);
        const py = cy + 14 * Math.sin(rad);
        return (
          <Ellipse key={a} cx={px} cy={py} rx={11} ry={6.5}
            fill={P.petal} transform={`rotate(${a}, ${px}, ${py})`} />
        );
      })}
      {/* Pétalos interiores */}
      {innerAngles.map(a => {
        const rad = (a * Math.PI) / 180;
        const px = cx + 9 * Math.cos(rad);
        const py = cy + 9 * Math.sin(rad);
        return (
          <Ellipse key={`i${a}`} cx={px} cy={py} rx={7} ry={4.5}
            fill={P.petalLight} transform={`rotate(${a}, ${px}, ${py})`} />
        );
      })}
      <Circle cx={cx} cy={cy} r={10} fill={P.flowerCenter} />
      <Circle cx={cx} cy={cy} r={5.5} fill={P.flowerCore} />
    </G>
  );
}

function DeadSVG() {
  return (
    <G>
      <Soil dead />
      {/* Tallo doblado */}
      <Path
        d="M 60 147 Q 59 128 63 112 Q 70 96 58 80"
        stroke={P.deadStem} strokeWidth={3.5} strokeLinecap="round" fill="none"
      />
      {/* Ramas caídas */}
      <Path d="M 63 112 Q 50 118 36 128" stroke={P.deadStem} strokeWidth={2} strokeLinecap="round" fill="none" />
      <Path d="M 61 128 Q 74 134 86 143" stroke={P.deadStem} strokeWidth={2} strokeLinecap="round" fill="none" />
      {/* Hojas mustias */}
      <Ellipse cx={40} cy={125} rx={17} ry={6.5} fill={P.deadLeaf} transform="rotate(22, 40, 125)" opacity={0.8} />
      <Ellipse cx={82} cy={140} rx={17} ry={6.5} fill={P.deadLeaf} transform="rotate(-18, 82, 140)" opacity={0.8} />
      <Ellipse cx={56} cy={84} rx={13} ry={5.5} fill={P.deadLeaf} transform="rotate(-55, 56, 84)" opacity={0.7} />
      {/* Cabeza caída */}
      <Ellipse cx={58} cy={78} rx={6.5} ry={9} fill={P.deadLeaf} transform="rotate(-18, 58, 78)" opacity={0.75} />
    </G>
  );
}

const PHASE_COMPONENTS: Record<string, React.FC> = {
  seed:   SeedSVG,
  sprout: SproutSVG,
  small:  SmallSVG,
  big:    BigSVG,
  flower: FlowerSVG,
  dead:   DeadSVG,
};

// ─── Componente principal ─────────────────────────────────────
interface AnimatedPlantProps {
  phase: string;
  /** Incrementar para disparar animación de celebración */
  celebrateKey?: number;
}

export function AnimatedPlant({ phase, celebrateKey = 0 }: AnimatedPlantProps) {
  const scaleAnim  = useRef(new Animated.Value(1)).current;
  const swayAnim   = useRef(new Animated.Value(0)).current;
  const prevPhase  = useRef(phase);
  const prevCelebrateKey = useRef(celebrateKey);

  // Vaivén suave continuo (usa hilo nativo)
  useEffect(() => {
    const sway = Animated.loop(
      Animated.sequence([
        Animated.timing(swayAnim, {
          toValue: 1, duration: 3800,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true,
        }),
        Animated.timing(swayAnim, {
          toValue: -1, duration: 3800,
          easing: Easing.inOut(Easing.sin), useNativeDriver: true,
        }),
      ]),
    );
    sway.start();
    return () => sway.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Transición al cambiar de fase: encogerse y hacer spring de vuelta
  useEffect(() => {
    if (phase !== prevPhase.current) {
      prevPhase.current = phase;
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 0.65, duration: 160,
          easing: Easing.in(Easing.quad), useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1, friction: 4, tension: 80, useNativeDriver: true,
        }),
      ]).start();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // Celebración al incrementar racha
  useEffect(() => {
    if (celebrateKey > 0 && celebrateKey !== prevCelebrateKey.current) {
      prevCelebrateKey.current = celebrateKey;
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.4, duration: 220,
          easing: Easing.out(Easing.quad), useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1, friction: 3, tension: 55, useNativeDriver: true,
        }),
      ]).start();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [celebrateKey]);

  const rotation = swayAnim.interpolate({
    inputRange: [-1, 1],
    outputRange: ['-2.2deg', '2.2deg'],
  });

  const PhaseComponent = PHASE_COMPONENTS[phase] ?? PHASE_COMPONENTS.seed;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }, { rotate: rotation }] }}>
      <Svg width={150} height={175} viewBox="0 0 120 160">
        <PhaseComponent />
      </Svg>
    </Animated.View>
  );
}
