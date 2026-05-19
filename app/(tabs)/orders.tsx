// app/(tabs)/orders.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { MapPin } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useOrders } from '@/hooks/useOrders';
import { ModernOrderCard } from '@/components/ModernOrderCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function OrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { orders, loading, refreshOrders } = useOrders();
  const [refreshing, setRefreshing] = useState(false);

  // Somente finalizado e cancelado encerram pedido
  const activeOrders = orders.filter(
    order => !['finalizado', 'cancelado'].includes(order.status)
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshOrders();
    setRefreshing(false);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner size="large" />
        <Text style={styles.loadingText}>Carregando pedidos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {activeOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconContainer}>
              <MapPin size={48} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyStateTitle}>Nenhum pedido ativo</Text>
            <Text style={styles.emptyStateSubtitle}>
              Seus pedidos aparecerão aqui
            </Text>
          </View>
        ) : (
          <View style={styles.ordersList}>
            {activeOrders.map(order => (
              <ModernOrderCard
                key={order.id}
                order={order}
                onPress={() => router.push(`/order/${order.id}`)}
                showStatus
              />
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC', // Branco gelo
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 12,
    color: '#64748B',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  emptyState: {
    alignItems: 'center',
    marginTop: 80,
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  ordersList: {
    gap: 12,
  },
});