// app/(tabs)/_layout.tsx
import { Stack } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomHeader } from '@/components/CustomHeader';

export default function TabLayout() {
  const insets = useSafeAreaInsets();

  return (
    <Stack
      screenOptions={{
        header: ({ route }) => (
          <CustomHeader 
            title={route.name === 'index' ? 'Início' : 
                   route.name === 'orders' ? 'Meus Pedidos' :
                   route.name === 'history' ? 'Histórico' :
                   route.name === 'support' ? 'Suporte' :
                   route.name === 'profile' ? 'Meu Perfil' : 'Familia Motoboy'}
            showBackButton={route.name !== 'index'}
            showCart={route.name !== 'cart'}
          />
        ),
        contentStyle: {
          backgroundColor: '#F8F9FA',
        },
      }}
    >
      {/* HOME - Início */}
      <Stack.Screen
        name="index"
        options={{
          title: 'Início',
        }}
      />

      {/* ORDERS - Meus Pedidos */}
      <Stack.Screen
        name="orders"
        options={{
          title: 'Pedidos',
        }}
      />

      {/* HISTORY - Histórico */}
      <Stack.Screen
        name="history"
        options={{
          title: 'Histórico',
        }}
      />

      {/* SUPPORT - Suporte */}
      <Stack.Screen
        name="support"
        options={{
          title: 'Suporte',
        }}
      />

      {/* PROFILE - Perfil */}
      <Stack.Screen
        name="profile"
        options={{
          title: 'Perfil',
        }}
      />
    </Stack>
  );
}