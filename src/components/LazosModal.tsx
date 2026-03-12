import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Clipboard,
  ActivityIndicator,
  Animated,
  Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { generateInviteCode, joinWithCode } from '../services/lazosService';

// ─── Paleta (misma que LazosListScreen) ──────────────────────
const C = {
  bg: '#FDF6EE',
  beige: '#F5ECD7',
  green: '#6B9E78',
  greenDark: '#4A7A58',
  greenLight: '#D4EAD8',
  text: '#3A2E1E',
  textSoft: '#7A6A55',
  textLight: '#B0A090',
  white: '#FFFDF8',
  red: '#D9534F',
  redLight: '#FDE8E8',
  overlay: 'rgba(40,28,16,0.38)',
};

interface Props {
  visible: boolean;
  onClose: () => void;
  onLazoCreated?: () => void; // callback para refrescar la lista si es necesario
}

export function LazosModal({ visible, onClose, onLazoCreated }: Props) {
  const [inputCode, setInputCode]         = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [timeLeft, setTimeLeft]           = useState(900);
  const [loadingGen, setLoadingGen]       = useState(false);
  const [loadingJoin, setLoadingJoin]     = useState(false);
  const [joinError, setJoinError]         = useState('');
  const [copied, setCopied]               = useState(false);
  const [joinSuccess, setJoinSuccess]     = useState(false);

  const timerRef   = useRef<ReturnType<typeof setInterval> | null>(null);
  const slideAnim  = useRef(new Animated.Value(400)).current;

  // ── Animación entrada / salida ────────────────────────────
  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 13,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 400,
        duration: 200,
        useNativeDriver: true,
      }).start();
      // Limpiar estado al cerrar
      setTimeout(() => {
        setInputCode('');
        setGeneratedCode('');
        setJoinError('');
        setCopied(false);
        setJoinSuccess(false);
        setTimeLeft(900);
        if (timerRef.current) { clearInterval(timerRef.current); }
      }, 220);
    }
  }, [visible, slideAnim]);

  // ── Countdown del código generado ────────────────────────
  useEffect(() => {
    if (!generatedCode) { return; }
    if (timerRef.current) { clearInterval(timerRef.current); }
    setTimeLeft(900);
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          setGeneratedCode('');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) { clearInterval(timerRef.current); } };
  }, [generatedCode]);

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60).toString().padStart(2, '0');
    const s = (secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // ── Generar código ────────────────────────────────────────
  const handleGenerate = async () => {
    setLoadingGen(true);
    try {
      const { code } = await generateInviteCode();
      setGeneratedCode(code);
    } catch (err: any) {
      // Si no hay backend aún, mostrar código de demostración
      const demoCode = ['abcd', 'ef12', '34gh']
        .map(() => Math.random().toString(36).slice(2, 6))
        .join('-');
      setGeneratedCode(demoCode);
    } finally {
      setLoadingGen(false);
    }
  };

  // ── Unirse con código ─────────────────────────────────────
  const handleJoin = async () => {
    const code = inputCode.toLowerCase().replace(/[^a-z0-9-]/g, '').trim();
    if (code.replace(/-/g, '').length < 12) {
      setJoinError('El código debe tener el formato xxxx-xxxx-xxxx');
      return;
    }
    setLoadingJoin(true);
    setJoinError('');
    try {
      await joinWithCode(code);
      setJoinSuccess(true);
      onLazoCreated?.();
      setTimeout(() => { onClose(); }, 1500);
    } catch (err: any) {
      setJoinError(err.message ?? 'Código inválido o expirado');
    } finally {
      setLoadingJoin(false);
    }
  };

  // ── Copiar código ─────────────────────────────────────────
  const handleCopy = () => {
    Clipboard.setString(generatedCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Formatear input automáticamente: xxxx-xxxx-xxxx ──────
  const handleInputChange = (text: string) => {
    setJoinError('');
    const clean = text.toLowerCase().replace(/[^a-z0-9]/g, '');
    let formatted = clean;
    if (clean.length > 4 && clean.length <= 8) {
      formatted = `${clean.slice(0, 4)}-${clean.slice(4)}`;
    } else if (clean.length > 8) {
      formatted = `${clean.slice(0, 4)}-${clean.slice(4, 8)}-${clean.slice(8, 12)}`;
    }
    setInputCode(formatted);
  };

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={s.backdrop}>
        <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} activeOpacity={1} />

        <Animated.View style={[s.card, { transform: [{ translateY: slideAnim }] }]}>

          {/* Header */}
          <View style={s.header}>
            <Text style={s.title}>Crear lazo</Text>
            <TouchableOpacity onPress={onClose} style={s.closeBtn}>
              <Icon name="close" size={20} color={C.textSoft} />
            </TouchableOpacity>
          </View>

          {/* ── Sección: unirse con código ── */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>¿Tienes un código?</Text>

            <View style={[s.inputRow, joinError ? s.inputRowError : null]}>
              <TextInput
                value={inputCode}
                onChangeText={handleInputChange}
                placeholder="xxxx-xxxx-xxxx"
                placeholderTextColor={C.textLight}
                style={s.input}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={14}
                keyboardType="default"
              />
            </View>

            {/* Error de código inválido */}
            {joinError ? (
              <View style={s.errorRow}>
                <Icon name="alert-circle-outline" size={15} color={C.red} />
                <Text style={s.errorText}>{joinError}</Text>
              </View>
            ) : null}

            {/* Éxito */}
            {joinSuccess ? (
              <View style={s.successRow}>
                <Icon name="check-circle-outline" size={15} color={C.green} />
                <Text style={s.successText}>¡Lazo creado correctamente!</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[s.joinBtn, (!inputCode || loadingJoin) && s.btnDisabled]}
              onPress={handleJoin}
              disabled={!inputCode || loadingJoin}>
              {loadingJoin
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Text style={s.joinBtnText}>Unirse al lazo</Text>
              }
            </TouchableOpacity>
          </View>

          {/* Divider */}
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerText}>o</Text>
            <View style={s.dividerLine} />
          </View>

          {/* ── Sección: generar código ── */}
          <View style={s.section}>
            <Text style={s.sectionLabel}>¿Quieres invitar a alguien?</Text>

            <TouchableOpacity
              style={[s.generateBtn, loadingGen && s.btnDisabled]}
              onPress={handleGenerate}
              disabled={loadingGen}>
              {loadingGen
                ? <ActivityIndicator size="small" color="#FFF" />
                : <>
                    <Icon name="qrcode-plus" size={18} color="#FFF" style={{ marginRight: 8 }} />
                    <Text style={s.generateBtnText}>Generar código</Text>
                  </>
              }
            </TouchableOpacity>

            {/* Código generado */}
            {generatedCode ? (
              <View style={s.codeBox}>
                <Text style={s.codeText}>{generatedCode}</Text>
                <TouchableOpacity onPress={handleCopy} style={s.copyBtn}>
                  <Icon
                    name={copied ? 'check' : 'content-copy'}
                    size={20}
                    color={copied ? C.green : C.textSoft}
                  />
                </TouchableOpacity>
              </View>
            ) : null}

            {/* Mensaje de validez */}
            {generatedCode ? (
              <View style={s.validityRow}>
                <Icon name="clock-outline" size={13} color={C.textLight} />
                <Text style={s.validityText}>
                  Este código expira en{' '}
                  <Text style={s.validityTimer}>{formatTime(timeLeft)}</Text>
                </Text>
              </View>
            ) : null}
          </View>

        </Animated.View>
      </View>
    </Modal>
  );
}

// ─── Estilos ──────────────────────────────────────────────────
const s = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: C.overlay,
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: C.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: C.text,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.beige,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    gap: 10,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textSoft,
    letterSpacing: 0.3,
    marginBottom: 2,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.beige,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: 16,
  },
  inputRowError: {
    borderColor: C.red,
    backgroundColor: C.redLight,
  },
  input: {
    flex: 1,
    fontSize: 17,
    color: C.text,
    paddingVertical: 14,
    letterSpacing: 1.5,
    fontWeight: '600',
  },
  errorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  errorText: {
    fontSize: 13,
    color: C.red,
    fontWeight: '500',
  },
  successRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  successText: {
    fontSize: 13,
    color: C.green,
    fontWeight: '500',
  },
  joinBtn: {
    backgroundColor: C.green,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: C.green,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  joinBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
  btnDisabled: {
    opacity: 0.55,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: C.beige,
  },
  dividerText: {
    fontSize: 13,
    color: C.textLight,
    fontWeight: '500',
  },
  generateBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.greenDark,
    borderRadius: 14,
    paddingVertical: 14,
    shadowColor: C.greenDark,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  generateBtnText: {
    color: '#FFF',
    fontWeight: '700',
    fontSize: 15,
  },
  codeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: C.greenLight,
    borderRadius: 14,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderWidth: 1.5,
    borderColor: C.green,
  },
  codeText: {
    fontSize: 22,
    fontWeight: '700',
    color: C.greenDark,
    letterSpacing: 2.5,
    flex: 1,
    textAlign: 'center',
  },
  copyBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  validityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    justifyContent: 'center',
    marginTop: 2,
  },
  validityText: {
    fontSize: 12,
    color: C.textLight,
  },
  validityTimer: {
    fontWeight: '700',
    color: C.textSoft,
  },
});
