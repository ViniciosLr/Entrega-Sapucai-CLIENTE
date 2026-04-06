import { useEffect, useState, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
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

    if (!user && !inAuthGroup) {
      router.replace('/auth/login');
    } else if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
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
        <AppContent />
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