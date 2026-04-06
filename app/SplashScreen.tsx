import { View, Text, StyleSheet, Animated, Image, Easing } from 'react-native';
import { useEffect, useRef } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';

type Props = {
  onFinish: () => void;
};

export default function SplashScreen({ onFinish }: Props) {
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.9)).current;
  const logoTranslateY = useRef(new Animated.Value(40)).current;

  const byOpacity = useRef(new Animated.Value(0)).current;
  const byTranslateY = useRef(new Animated.Value(20)).current;

  const containerOpacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 6,
          tension: 60,
          useNativeDriver: true,
        }),
        Animated.timing(logoTranslateY, {
          toValue: 0,
          duration: 900,
          easing: Easing.out(Easing.exp),
          useNativeDriver: true,
        }),
      ]),

      Animated.parallel([
        Animated.timing(byOpacity, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(byTranslateY, {
          toValue: 0,
          duration: 500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: true,
        }),
      ]),

      Animated.delay(900),

      Animated.timing(containerOpacity, {
        toValue: 0,
        duration: 350,
        easing: Easing.inOut(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onFinish();
    });
  }, [logoOpacity, logoScale, logoTranslateY, byOpacity, byTranslateY, containerOpacity, onFinish]);

  return (
    <Animated.View style={[styles.wrapper, { opacity: containerOpacity }]}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Animated.View
          style={[
            styles.content,
            {
              opacity: logoOpacity,
              transform: [{ scale: logoScale }, { translateY: logoTranslateY }],
            },
          ]}
        >
          <View style={styles.iconWrapper}>
            <Image
              source={require('../assets/images/icon.png')}
              style={styles.icon}
              resizeMode="contain"
            />
          </View>
        </Animated.View>

        <Animated.Text
          style={[
            styles.by,
            {
              opacity: byOpacity,
              transform: [{ translateY: byTranslateY }],
            },
          ]}
        >
          by SWT
        </Animated.Text>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
  },

  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },

  content: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  icon: {
    width: 320,
    height: 320,
  },

  by: {
    position: 'absolute',
    bottom: 28,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(0, 8, 255, 0.45)',
    letterSpacing: 0.4,
  },
});