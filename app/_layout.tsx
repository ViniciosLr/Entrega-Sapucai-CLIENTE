// app/_layout.tsx (CORRIGIDO)
import { useEffect, useState, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { CartProvider } from '@/contexts/CartContext';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as ExpoSplashScreen from 'expo-splash-screen';
import { registerForPushNotifications } from '@/lib/push';
import { supabase } from '@/lib/supabase';
import SplashScreen from './SplashScreen';

ExpoSplashScreen.preventAutoHideAsync();

function InitialLayout() {
  const { user, loading, saveExpoPushToken } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const pushInitializedRef = useRef(false);

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === 'auth';
    const inCart = segments[0] === 'cart';
    const inCheckout = segments[0] === 'checkout';
    
    // 🔥 PERMITE ACESSO SEM LOGIN: Home (tabs), Carrinho, Produtos, Commerces
    const publicRoutes = ['(tabs)', 'cart', 'product', 'commerce'];
    const currentRoute = segments[0];
    const isPublicRoute = publicRoutes.includes(currentRoute) || !currentRoute;

    // 🔥 NOVA LÓGICA: Só protege rotas que PRECISAM de login
    const needsAuth = ['orders', 'profile', 'history', 'payment'].includes(currentRoute);
    
    if (!user && needsAuth) {
      router.replace('/auth/login');
    } else if (!user && inCheckout) {
      // Checkout também precisa de login
      router.replace('/auth/login');
    } else if (!user && inAuthGroup) {
      // Tela de login - não faz nada
      return;
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
    // 🔥 QUALQUER OUTRA ROTA (home, cart, product, commerce) - DEIXA ACESSAR SEM LOGIN
  }, [user, loading, segments, router]);

  useEffect(() => {
    if (!user) return;
    if (pushInitializedRef.current) return;

    pushInitializedRef.current = true;

    async function initPush() {
      const token = await registerForPushNotifications();
      if (!token) {
        console.log('Push token não gerado');
        return;
      }

      const { data, error } = await supabase
        .from('clientes')
        .select('expo_push_token')
        .eq('user_id', user.id)
        .single();

      if (!error && data?.expo_push_token === token) {
        console.log('🔔 Token já está salvo, não atualizei.');
        return;
      }

      await saveExpoPushToken(token);
    }

    initPush();
  }, [user, saveExpoPushToken]);

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#0A66C2" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth" />
      <Stack.Screen name="cart" />
      <Stack.Screen name="checkout" />
      <Stack.Screen name="product" />
      <Stack.Screen name="commerce" />
      <Stack.Screen name="index" />
      <Stack.Screen name="+not-found" />
    </Stack>
  );
}

function AppContent() {
  const [nativeReady, setNativeReady] = useState(false);
  const [showAnimatedSplash, setShowAnimatedSplash] = useState(true);

  useEffect(() => {
    async function prepare() {
      try {
        await new Promise(resolve => setTimeout(resolve, 400));
      } finally {
        setNativeReady(true);
        await ExpoSplashScreen.hideAsync();
      }
    }

    prepare();
  }, []);

  if (!nativeReady) return null;

  return (
    <>
      <InitialLayout />
      <StatusBar style="light" />
      {showAnimatedSplash && (
        <SplashScreen onFinish={() => setShowAnimatedSplash(false)} />
      )}
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <CartProvider>
          <AppContent />
        </CartProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
});