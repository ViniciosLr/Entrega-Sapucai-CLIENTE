import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Truck, Clock, Headset, UserCircle } from 'lucide-react-native';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      key={insets.bottom} // 🔥 força recalcular quando o Android informa os insets
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#FFFFFF',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',

          // ✅ SAFE AREA REAL
          paddingBottom: insets.bottom,
          paddingTop: 8,
          height: 64 + insets.bottom,
        },
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#6B7280',
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Pedidos',
          tabBarIcon: ({ size, color }) => (
            <Truck size={size} color={color} strokeWidth={2} />
          ),
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: 'Histórico',
          tabBarIcon: ({ size, color }) => (
            <Clock size={size} color={color} strokeWidth={2} />
          ),
        }}
      />

      <Tabs.Screen
        name="support"
        options={{
          title: 'Suporte',
          tabBarIcon: ({ size, color }) => (
            <Headset size={size} color={color} strokeWidth={2} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarIcon: ({ size, color }) => (
            <UserCircle size={size} color={color} strokeWidth={2} />
          ),
        }}
      />
    </Tabs>
  );
}