import {
  View,
  Text,
  StyleSheet,
  Animated,
  Image,
  Easing,
  Dimensions,
} from 'react-native';
import { useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  onFinish: () => void;
};

const { width, height } = Dimensions.get('window');

// Tamanho responsivo do logo: 65% da menor dimensão, máximo 280
const LOGO_SIZE = Math.min(width, height) * 0.65;
const LOGO_SIZE_CAPPED = Math.min(LOGO_SIZE, 280);

export default function SplashScreen({ onFinish }: Props) {
  // ── Entrance ──────────────────────────────────────────────
  const logoOpacity   = useRef(new Animated.Value(0)).current;
  const logoScale     = useRef(new Animated.Value(0.4)).current;

  // ── Continuous floating ───────────────────────────────────
  const floatY        = useRef(new Animated.Value(0)).current;
  const floatScale    = useRef(new Animated.Value(1)).current;

  // ── Glow pulse rings ──────────────────────────────────────
  const ring1Scale    = useRef(new Animated.Value(1)).current;
  const ring1Opacity  = useRef(new Animated.Value(0.55)).current;
  const ring2Scale    = useRef(new Animated.Value(1)).current;
  const ring2Opacity  = useRef(new Animated.Value(0.35)).current;
  const ring3Scale    = useRef(new Animated.Value(1)).current;
  const ring3Opacity  = useRef(new Animated.Value(0.18)).current;

  // ── Text ──────────────────────────────────────────────────
  const textOpacity   = useRef(new Animated.Value(0)).current;
  const textTranslateY = useRef(new Animated.Value(28)).current;
  const textScale     = useRef(new Animated.Value(0.85)).current;

  // ── Exit ──────────────────────────────────────────────────
  const containerOpacity = useRef(new Animated.Value(1)).current;

  // ── Shine sweep ───────────────────────────────────────────
  const shineX        = useRef(new Animated.Value(-LOGO_SIZE_CAPPED * 1.5)).current;

  useEffect(() => {
    // Helper: infinite loop animating a value back and forth
    const loop = (
      anim: Animated.Value,
      toA: number,
      toB: number,
      durationA: number,
      durationB: number,
      easingFn = Easing.inOut(Easing.sin),
    ) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(anim, {
            toValue: toA,
            duration: durationA,
            easing: easingFn,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: toB,
            duration: durationB,
            easing: easingFn,
            useNativeDriver: true,
          }),
        ]),
      );

    // Helper: infinite pulse ring (scale + opacity)
    const pulseRing = (
      scale: Animated.Value,
      opacity: Animated.Value,
      toScale: number,
      toOpacity: number,
      duration: number,
    ) =>
      Animated.loop(
        Animated.parallel([
          Animated.sequence([
            Animated.timing(scale, {
              toValue: toScale,
              duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(scale, {
              toValue: 1,
              duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
          Animated.sequence([
            Animated.timing(opacity, {
              toValue: toOpacity,
              duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: opacity === ring1Opacity ? 0.55 : opacity === ring2Opacity ? 0.35 : 0.18,
              duration,
              easing: Easing.inOut(Easing.sin),
              useNativeDriver: true,
            }),
          ]),
        ]),
      );

    // ── Phase 1: Logo entrance (scale + fade) ──────────────
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 5,
        tension: 45,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // ── Phase 2: Shine sweep once logo is visible ─────────
      Animated.timing(shineX, {
        toValue: LOGO_SIZE_CAPPED * 1.5,
        duration: 750,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }).start();

      // ── Phase 3: Text entrance after short delay ──────────
      Animated.sequence([
        Animated.delay(300),
        Animated.parallel([
          Animated.timing(textOpacity, {
            toValue: 1,
            duration: 550,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.spring(textTranslateY, {
            toValue: 0,
            friction: 7,
            tension: 55,
            useNativeDriver: true,
          }),
          Animated.spring(textScale, {
            toValue: 1,
            friction: 6,
            tension: 42,
            useNativeDriver: true,
          }),
        ]),
      ]).start();

      // ── Continuous: gentle float ──────────────────────────
      loop(floatY, -10, 6, 1800, 2000).start();

      // ── Continuous: subtle breathe scale ─────────────────
      loop(floatScale, 1.055, 0.97, 2200, 2000).start();

      // ── Continuous: glow rings pulsing (staggered) ────────
      pulseRing(ring1Scale, ring1Opacity, 1.18, 0.15, 1600).start();
      setTimeout(
        () => pulseRing(ring2Scale, ring2Opacity, 1.32, 0.08, 1800).start(),
        400,
      );
      setTimeout(
        () => pulseRing(ring3Scale, ring3Opacity, 1.52, 0.04, 2100).start(),
        800,
      );

      // ── Phase 4: Exit after hold ──────────────────────────
      Animated.sequence([
        Animated.delay(2200),
        Animated.timing(containerOpacity, {
          toValue: 0,
          duration: 480,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]).start(() => onFinish());
    });
  }, []);

  return (
    <Animated.View style={[styles.wrapper, { opacity: containerOpacity }]}>
      <SafeAreaView style={styles.container} edges={['left', 'right']}>
        {/* Conteúdo principal flexível - centralizado verticalmente */}
        <View style={styles.content}>
          {/* ── Glow rings ────────────────────────────────── */}
          <Animated.View
            style={[
              styles.ring,
              styles.ring1,
              { transform: [{ scale: ring1Scale }], opacity: ring1Opacity },
            ]}
          />
          <Animated.View
            style={[
              styles.ring,
              styles.ring2,
              { transform: [{ scale: ring2Scale }], opacity: ring2Opacity },
            ]}
          />
          <Animated.View
            style={[
              styles.ring,
              styles.ring3,
              { transform: [{ scale: ring3Scale }], opacity: ring3Opacity },
            ]}
          />

          {/* ── Logo ──────────────────────────────────────── */}
          <Animated.View
            style={[
              styles.logoContainer,
              {
                opacity: logoOpacity,
                transform: [
                  { scale: Animated.multiply(logoScale, floatScale) },
                  { translateY: floatY },
                ],
              },
            ]}
          >
            {/* Outer glow halo */}
            <View style={styles.haloOuter} />
            <View style={styles.haloInner} />

            {/* Icon with overflow-hidden for shine */}
            <View style={styles.iconWrapper}>
              <Image
                source={require('../assets/images/icon.png')}
                style={styles.icon}
                resizeMode="contain"
              />

              {/* Shine sweep */}
              <Animated.View
                style={[
                  styles.shine,
                  { transform: [{ translateX: shineX }, { skewX: '-18deg' }] },
                ]}
              />
            </View>
          </Animated.View>
        </View>

        {/* ── SWT text ──────────────────────────────────── 
            AGORA NA PARTE INFERIOR, PRÓXIMO AOS BOTÕES DE NAVEGAÇÃO
        */}
        <Animated.View
          style={[
            styles.bottomTextContainer,
            {
              opacity: textOpacity,
              transform: [
                { translateY: textTranslateY },
                { scale: textScale },
              ],
            },
          ]}
        >
          {/* Shadow layer (stroke illusion) */}
          <Text style={[styles.swtText, styles.swtShadow]} aria-hidden>
            SWT
          </Text>
          {/* Actual text on top */}
          <Text style={styles.swtText}>SWT</Text>

          {/* Thin accent bar */}
          <View style={styles.accentBar} />
        </Animated.View>

        {/* ── Loading dots ──────────────────────────────────── */}
        <View style={styles.loadingContainer}>
          {[1, 0.5, 0.2].map((opacity, i) => (
            <View key={i} style={[styles.dot, { opacity }]} />
          ))}
        </View>
      </SafeAreaView>
    </Animated.View>
  );
}

// ─── Dimensions helpers ──────────────────────────────────────────────────────
const S = LOGO_SIZE_CAPPED;
const RING_BASE = S + 12;

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },

  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },

  // Conteúdo principal ocupando espaço flexível
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // ── Glow rings ──────────────────────────────────────────────────────────────
  ring: {
    position: 'absolute',
    borderRadius: 9999,
  },
  ring1: {
    width: RING_BASE,
    height: RING_BASE,
    backgroundColor: 'rgba(255, 107, 53, 0.55)',
  },
  ring2: {
    width: RING_BASE,
    height: RING_BASE,
    backgroundColor: 'rgba(255, 107, 53, 0.35)',
  },
  ring3: {
    width: RING_BASE,
    height: RING_BASE,
    backgroundColor: 'rgba(255, 140, 66, 0.18)',
  },

  // ── Logo ────────────────────────────────────────────────────────────────────
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },

  haloOuter: {
    position: 'absolute',
    width: S + 40,
    height: S + 40,
    borderRadius: (S + 40) / 2,
    backgroundColor: 'rgba(255, 107, 53, 0.12)',
  },
  haloInner: {
    position: 'absolute',
    width: S + 16,
    height: S + 16,
    borderRadius: (S + 16) / 2,
    backgroundColor: 'rgba(255, 107, 53, 0.22)',
  },

  iconWrapper: {
    width: S,
    height: S,
    borderRadius: S / 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 24,
    elevation: 16,
  },

  icon: {
    width: S,
    height: S,
    borderRadius: S / 2,
  },

  shine: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: S * 0.45,
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.38)',
  },

  // ── SWT text ────────────────────────────────────────────────────────────────
  // 🔥 NOVO: Container do texto na parte inferior
  bottomTextContainer: {
    alignItems: 'center',
    marginBottom: 60, // Espaço dos botões de navegação
  },

  swtText: {
    fontSize: Math.min(width * 0.19, 72),
    fontWeight: '900',
    color: '#FF6B35',
    letterSpacing: 10,
    textShadowColor: '#000000',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 0,
  },

  swtShadow: {
    position: 'absolute',
    color: '#1A1A1A',
    textShadowColor: '#1A1A1A',
    textShadowOffset: { width: 3, height: 3 },
    textShadowRadius: 2,
  },

  accentBar: {
    marginTop: 10,
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#FF6B35',
    opacity: 0.7,
  },

  // ── Loading dots ────────────────────────────────────────────────────────────
  loadingContainer: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },

  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B35',
    marginHorizontal: 5,
  },
});