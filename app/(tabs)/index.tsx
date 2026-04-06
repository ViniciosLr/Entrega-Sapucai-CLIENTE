import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ImageBackground,
} from 'react-native';
import { Plus, MapPin, Sparkles } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useOrders } from '@/hooks/useOrders';
import { OrderCard } from '@/components/OrderCard';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { LinearGradient } from 'expo-linear-gradient';
import icon from '@/assets/images/icon.png';

// ✅ NOVO
import { PartnerCarousel } from '@/components/PartnerCarousel';

export default function OrdersScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { orders, loading, refreshOrders } = useOrders();
  const [refreshing, setRefreshing] = useState(false);

  // ✅ SOMENTE finalizado e cancelado encerram pedido
  const activeOrders = orders.filter(
    order => !['finalizado', 'cancelado'].includes(order.status)
  );

  const hasActiveOrder = activeOrders.length > 0;

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshOrders();
    setRefreshing(false);
  };

  const handleNewOrder = () => {
    if (hasActiveOrder) return; // Não faz nada se tiver pedido ativo
    router.push('/order/create');
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
    <ImageBackground
      source={icon}
      style={styles.container}
      imageStyle={styles.backgroundImage}
      resizeMode="contain"
    >
      <LinearGradient
        colors={['#1E40AF', '#2563EB', '#3B82F6']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.headerGradient}
      >
        <View style={styles.headerTop}>
          <View style={styles.headerTextBlock}>
            <Text style={styles.headerTitle}>Meus Pedidos</Text>
            <Text style={styles.headerSubtitle}>
              Acompanhe suas entregas em tempo real
            </Text>
          </View>

          <View style={styles.badgeContainer}>
            <Text style={styles.badgeLabel}>Ativos</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{activeOrders.length}</Text>
            </View>
          </View>
        </View>
      </LinearGradient>

      {/* ✅ Wrapper pra permitir carrossel fixo no rodapé */}
      <View style={styles.body}>
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* Botão de Criar Novo Pedido com lógica de desabilitação */}
          <TouchableOpacity
            style={[
              styles.newOrderButtonWrapper,
              hasActiveOrder && styles.disabledButtonWrapper
            ]}
            onPress={handleNewOrder}
            activeOpacity={hasActiveOrder ? 1 : 0.8}
            disabled={hasActiveOrder}
          >
            <LinearGradient
              colors={hasActiveOrder
                ? ['#6B7280', '#9CA3AF', '#D1D5DB']
                : ['#059669', '#10B981', '#34D399']
              }
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.newOrderButton}
            >
              <Plus size={20} color="#fff" />
              <Text style={styles.newOrderButtonText}>
                {hasActiveOrder ? 'Pedido Ativo' : 'Criar Novo Pedido'}
              </Text>
              {!hasActiveOrder && <Sparkles size={18} color="#fff" />}
              {hasActiveOrder && (
                <Text style={styles.activeOrderText}>
                  ({activeOrders.length} ativo)
                </Text>
              )}
            </LinearGradient>
          </TouchableOpacity>

          {activeOrders.length === 0 ? (
            <View style={styles.emptyState}>
              <MapPin size={48} color="#3B82F6" />
              <Text style={styles.emptyStateTitle}>Nenhum pedido ativo</Text>
              <Text style={styles.emptyStateSubtitle}>
                Crie seu primeiro pedido
              </Text>
            </View>
          ) : (
            <View style={styles.ordersList}>
              {activeOrders.map(order => (
                <OrderCard
                  key={order.id}
                  order={order}
                  onPress={() => router.push(`/order/${order.id}`)}
                  showStatus
                />
              ))}
            </View>
          )}
        </ScrollView>

        {/* ✅ CARROSSEL FIXO — GRUDADO NA TAB */}
        <View style={styles.carouselFixed}>
          <PartnerCarousel />
        </View>
      </View>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },

  backgroundImage: {
    opacity: 0.05,
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center'
  },

  loadingText: {
    marginTop: 12,
    color: '#64748B'
  },

  headerGradient: {
    paddingTop: 48,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    shadowColor: '#1E3A8A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 8,
  },

  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  headerTextBlock: {
    flex: 1,
    paddingRight: 12,
  },

  headerEyebrow: {
    fontSize: 11,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.78)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginBottom: 4,
  },

  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 2,
  },

  headerSubtitle: {
    color: '#DBEAFE',
    fontSize: 13,
    lineHeight: 18,
  },

  badgeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  badgeLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 10,
    fontWeight: '700',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },

  badge: {
    minWidth: 46,
    height: 46,
    backgroundColor: 'rgba(255,255,255,.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,.22)',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 12,
  },

  badgeText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 18,
  },

  body: { flex: 1 },

  content: { flex: 1 },

  // ✅ importante: aumenta paddingBottom pro conteúdo não ficar atrás do carrossel + tab
  contentContainer: {
    padding: 20,
    paddingBottom: 160, // ✅ reserva espaço pro carrossel fixo + tab bar
  },

  newOrderButtonWrapper: {
    marginBottom: 24,
  },

  disabledButtonWrapper: {
    opacity: 0.7,
  },

  newOrderButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 18,
    borderRadius: 16,
    gap: 10
  },

  newOrderButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },

  activeOrderText: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.9,
    marginLeft: 4,
  },

  emptyState: {
    alignItems: 'center',
    marginTop: 60
  },

  emptyStateTitle: {
    fontSize: 22,
    fontWeight: '700',
    marginTop: 12,
  },

  emptyStateSubtitle: {
    color: '#64748B',
    marginTop: 4,
  },

  ordersList: {
    gap: 12
  },

  // ✅ FIXO + CENTRALIZADO + GRUDADO
  carouselFixed: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingBottom: 2,
  },
});