import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Search, ListFilter as Filter, Calendar, Clock } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useOrders } from '@/hooks/useOrders';
import { OrderCard } from '@/components/OrderCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';

export default function HistoryScreen() {
  const router = useRouter();
  const { orders, loading, refreshOrders } = useOrders();
  const [refreshing, setRefreshing] = useState(false);

  // --- LÓGICA DE FILTRO ---
  // Filtramos apenas pedidos que já terminaram o ciclo de vida
  const completedOrders = orders.filter((order) =>
    ['finalizado', 'cancelado'].includes(order.status)
  );

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshOrders();
    setRefreshing(false);
  };

  if (loading && !refreshing && orders.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner size="large" />
        <Text style={styles.loadingText}>Carregando histórico...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Cabeçalho Customizado */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Histórico</Text>
        <Text style={styles.headerSubtitle}>
          Pedidos finalizados e cancelados
        </Text>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh} 
            colors={['#2563EB']} // Cor do spinner no Android
            tintColor="#2563EB"    // Cor do spinner no iOS
          />
        }
        showsVerticalScrollIndicator={false}>
        
        {/* Barra de Filtros (Visual) */}
        <View style={styles.filtersContainer}>
          <TouchableOpacity style={styles.filterButton} activeOpacity={0.7}>
            <Search size={16} color="#6B7280" />
            <Text style={styles.filterButtonText}>Buscar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterButton} activeOpacity={0.7}>
            <Filter size={16} color="#6B7280" />
            <Text style={styles.filterButtonText}>Filtrar</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.filterButton} activeOpacity={0.7}>
            <Calendar size={16} color="#6B7280" />
            <Text style={styles.filterButtonText}>Data</Text>
          </TouchableOpacity>
        </View>

        {completedOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Clock size={40} color="#9CA3AF" />
            </View>
            <Text style={styles.emptyStateTitle}>Histórico vazio</Text>
            <Text style={styles.emptyStateSubtitle}>
              Você ainda não possui pedidos finalizados ou cancelados para exibir.
            </Text>
          </View>
        ) : (
          <View style={styles.ordersList}>
            <View style={styles.sectionHeader}>
               <Text style={styles.sectionTitle}>Seus pedidos</Text>
               <View style={styles.badge}>
                  <Text style={styles.badgeText}>{completedOrders.length}</Text>
               </View>
            </View>

            {completedOrders.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                // Redireciona para a página de detalhes do pedido
                onPress={() => router.push(`/order/${order.id}`)}
                showStatus={true}
                showDate={true}
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
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    fontWeight: '500',
  },
  header: {
    backgroundColor: '#374151',
    paddingTop: 60,
    paddingBottom: 24,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 15,
    color: '#D1D5DB',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  filtersContainer: {
    flexDirection: 'row',
    marginBottom: 24,
    gap: 10,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    flex: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filterButtonText: {
    fontSize: 13,
    color: '#4B5563',
    fontWeight: '600',
    marginLeft: 6,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 60,
    paddingHorizontal: 40,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  ordersList: {
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  badge: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#4B5563',
  },
});