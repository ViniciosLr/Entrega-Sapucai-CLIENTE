// app/(tabs)/history.tsx
import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useOrders } from '@/hooks/useOrders';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '@/lib/supabase';
import { paymentService } from '@/services/payment.service';

// Mapeamento de status para exibição
const STATUS_CONFIG: Record<string, {
  label: string;
  icon: string;
  color: string;
  bgColor: string;
  textColor: string;
}> = {
  criado: {
    label: 'Pedido Criado',
    icon: 'document-text-outline',
    color: '#6B7280',
    bgColor: '#F3F4F6',
    textColor: '#4B5563',
  },
  aceito: {
    label: 'Aceito',
    icon: 'checkmark-circle-outline',
    color: '#3B82F6',
    bgColor: '#EFF6FF',
    textColor: '#1D4ED8',
  },
  pronto: {
    label: 'Pronto',
    icon: 'restaurant-outline',
    color: '#F59E0B',
    bgColor: '#FFFBEB',
    textColor: '#B45309',
  },
  aguardando_motoboy: {
    label: 'Aguardando Motoboy',
    icon: 'bicycle-outline',
    color: '#8B5CF6',
    bgColor: '#F5F3FF',
    textColor: '#6D28D9',
  },
  motoboy_a_caminho: {
    label: 'Motoboy a Caminho',
    icon: 'bicycle-outline',
    color: '#6366F1',
    bgColor: '#EEF2FF',
    textColor: '#4338CA',
  },
  em_andamento: {
    label: 'Em Andamento',
    icon: 'sync-outline',
    color: '#06B6D4',
    bgColor: '#ECFEFF',
    textColor: '#155E75',
  },
  finalizado: {
    label: 'Finalizado',
    icon: 'checkmark-done-outline',
    color: '#10B981',
    bgColor: '#ECFDF5',
    textColor: '#065F46',
  },
  cancelado: {
    label: 'Cancelado',
    icon: 'close-circle-outline',
    color: '#EF4444',
    bgColor: '#FEF2F2',
    textColor: '#991B1B',
  },
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);

const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Agora mesmo';
  if (minutes < 60) return `Há ${minutes} min`;
  if (hours < 24) return `Há ${hours}h`;
  if (days < 7) return `Há ${days} dias`;
  
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

const getStatusInfo = (status: string) => {
  return STATUS_CONFIG[status] || {
    label: status.replace('_', ' '),
    icon: 'help-circle-outline',
    color: '#9CA3AF',
    bgColor: '#F9FAFB',
    textColor: '#6B7280',
  };
};

// 🔥 FUNÇÃO PARA VERIFICAR SE O PIX EXPIROU (mais de 30 minutos)
const isPixExpired = (createdAt: string): boolean => {
  const createdDate = new Date(createdAt);
  const now = new Date();
  const diffMinutes = (now.getTime() - createdDate.getTime()) / 1000 / 60;
  return diffMinutes > 30;
};

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { orders, loading, refreshOrders } = useOrders();
  const [refreshing, setRefreshing] = useState(false);

  const allOrders = orders || [];

  // Agrupa por data
  const groupedOrders = allOrders.reduce((groups: Record<string, any[]>, order) => {
    const date = new Date(order.created_at).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    });
    if (!groups[date]) groups[date] = [];
    groups[date].push(order);
    return groups;
  }, {});

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshOrders();
    setRefreshing(false);
  };

  // 🔥 FUNÇÃO VERIFICAR SE É PIX PENDENTE (NÃO EXPIROU)
  const isPixPendingOrder = (order: any): boolean => {
    return order.payment_method === 'pix' && 
           order.payment_status === 'pending' && 
           order.status === 'criado' &&
           !isPixExpired(order.created_at); // 🔥 IGNORA SE EXPIROU
  };

  // 🔥 FUNÇÃO VERIFICAR SE É PIX EXPIROU
  const isPixExpiredOrder = (order: any): boolean => {
    return order.payment_method === 'pix' && 
           order.payment_status === 'pending' && 
           order.status === 'criado' &&
           isPixExpired(order.created_at);
  };

  // 🔥 FUNÇÃO PARA BUSCAR DADOS DO PIX E REDIRECIONAR
  const handlePixPendingOrder = async (order: any) => {
    console.log('💰 Pedido com PIX pendente:', order.id);
    
    Alert.alert(
      'Pagamento pendente',
      'Você ainda não efetuou o pagamento do PIX. Deseja continuar com o pagamento?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Continuar',
          onPress: async () => {
            try {
              const { data: pedido, error } = await supabase
                .from('pedidos')
                .select('payment_details, payment_method, total_amount')
                .eq('id', order.id)
                .single();
              
              if (error) throw error;
              
              const paymentId = pedido.payment_details?.mp_payment_id;
              const pixData = pedido.payment_details?.pix_qr_code ? {
                qr_code: pedido.payment_details.pix_qr_code,
                qr_code_base64: pedido.payment_details.pix_qr_code_base64,
                ticket_url: pedido.payment_details.pix_ticket_url,
              } : null;
              
              if (paymentId) {
                router.push({
                  pathname: '/payment/pix-status',
                  params: {
                    pixData: pixData ? JSON.stringify(pixData) : '',
                    paymentId: paymentId,
                    orderId: order.id,
                    amount: formatPrice(pedido.total_amount || order.price),
                  },
                });
              } else {
                Alert.alert('Erro', 'Dados de pagamento não encontrados');
              }
            } catch (err) {
              console.error('Erro ao buscar pagamento:', err);
              Alert.alert('Erro', 'Não foi possível recuperar os dados do pagamento');
            }
          },
        },
      ]
    );
  };

  // 🔥 FUNÇÃO PARA MOSTRAR ALERTA DE PIX EXPIROU
  const handleExpiredPix = () => {
    Alert.alert(
      'PIX Expirado',
      'Este pedido não pode mais ser pago via PIX pois expirou após 30 minutos. O pedido será cancelado em breve.',
      [{ text: 'OK', style: 'default' }]
    );
  };

  const getServiceTypeIcon = (type: string) => {
    switch (type) {
      case 'delivery': return 'bicycle-outline';
      case 'takeaway': return 'bag-outline';
      case 'dine_in': return 'restaurant-outline';
      default: return 'cart-outline';
    }
  };

  const getServiceTypeLabel = (type: string) => {
    switch (type) {
      case 'delivery': return 'Entrega';
      case 'takeaway': return 'Retirada';
      case 'dine_in': return 'No local';
      default: return type;
    }
  };

  if (loading && !refreshing && orders.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#FF6B6B" />
          <Text style={styles.loadingText}>Carregando pedidos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#F9FAFB" />
      
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 80 }]}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={handleRefresh} 
            colors={['#FF6B6B']}
            tintColor="#FF6B6B"
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleSection}>
          <Text style={styles.mainTitle}>Meus Pedidos</Text>
          <Text style={styles.mainSubtitle}>
            Acompanhe todos os seus pedidos em tempo real
          </Text>
        </View>

        {allOrders.length > 0 && (
          <View style={styles.summaryCards}>
            <View style={[styles.summaryCard, { backgroundColor: '#EFF6FF' }]}>
              <Ionicons name="time-outline" size={24} color="#3B82F6" />
              <Text style={styles.summaryNumber}>
                {allOrders.filter(o => !['finalizado', 'cancelado'].includes(o.status)).length}
              </Text>
              <Text style={styles.summaryLabel}>Em andamento</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: '#ECFDF5' }]}>
              <Ionicons name="checkmark-done-outline" size={24} color="#10B981" />
              <Text style={styles.summaryNumber}>
                {allOrders.filter(o => o.status === 'finalizado').length}
              </Text>
              <Text style={styles.summaryLabel}>Finalizados</Text>
            </View>
            <View style={[styles.summaryCard, { backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="close-circle-outline" size={24} color="#EF4444" />
              <Text style={styles.summaryNumber}>
                {allOrders.filter(o => o.status === 'cancelado').length}
              </Text>
              <Text style={styles.summaryLabel}>Cancelados</Text>
            </View>
          </View>
        )}

        {allOrders.length === 0 ? (
          <View style={styles.emptyState}>
            <View style={styles.emptyIconCircle}>
              <Ionicons name="receipt-outline" size={48} color="#D1D5DB" />
            </View>
            <Text style={styles.emptyStateTitle}>Nenhum pedido ainda</Text>
            <Text style={styles.emptyStateSubtitle}>
              Seus pedidos aparecerão aqui.{'\n'}Comece explorando os comércios disponíveis!
            </Text>
            <TouchableOpacity 
              style={styles.exploreButton}
              onPress={() => router.push('/(tabs)')}
            >
              <Ionicons name="compass-outline" size={20} color="#FFF" />
              <Text style={styles.exploreButtonText}>Explorar Comércios</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.ordersContainer}>
            {Object.entries(groupedOrders).map(([date, dateOrders]) => (
              <View key={date} style={styles.dateGroup}>
                <View style={styles.dateHeader}>
                  <Ionicons name="calendar-outline" size={16} color="#9CA3AF" />
                  <Text style={styles.dateText}>{date}</Text>
                  <View style={styles.dateCount}>
                    <Text style={styles.dateCountText}>{dateOrders.length}</Text>
                  </View>
                </View>

                {dateOrders.map((order) => {
                  const statusInfo = getStatusInfo(order.status);
                  const isActive = !['finalizado', 'cancelado'].includes(order.status);
                  const needsPayment = isPixPendingOrder(order);
                  const isExpired = isPixExpiredOrder(order);
                  
                  return (
                    <TouchableOpacity
                      key={order.id}
                      style={[
                        styles.orderCard, 
                        isActive && styles.orderCardActive,
                        needsPayment && styles.orderCardNeedsPayment,
                        isExpired && styles.orderCardExpiredPix,
                      ]}
                      onPress={() => {
                        if (needsPayment) {
                          handlePixPendingOrder(order);
                        } else if (isExpired) {
                          handleExpiredPix();
                        } else {
                          router.push(`/order/${order.id}`);
                        }
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={styles.orderCardHeader}>
                        <View style={styles.orderIdRow}>
                          <Ionicons name="document-text-outline" size={14} color="#9CA3AF" />
                          <Text style={styles.orderId}>#{order.id?.slice(-8).toUpperCase()}</Text>
                        </View>
                        <View style={[
                          styles.statusBadge,
                          { backgroundColor: statusInfo.bgColor }
                        ]}>
                          <Ionicons name={statusInfo.icon as any} size={12} color={statusInfo.color} />
                          <Text style={[styles.statusText, { color: statusInfo.textColor }]}>
                            {statusInfo.label}
                          </Text>
                          {isActive && (
                            <View style={[styles.activeDot, { backgroundColor: statusInfo.color }]} />
                          )}
                        </View>
                      </View>

                      {/* Badge de PIX Pendente */}
                      {needsPayment && (
                        <View style={styles.paymentPendingBadge}>
                          <Ionicons name="alert-circle" size={14} color="#F59E0B" />
                          <Text style={styles.paymentPendingText}>Pagamento pendente</Text>
                        </View>
                      )}

                      {/* Badge de PIX Expirado */}
                      {isExpired && (
                        <View style={[styles.paymentPendingBadge, styles.expiredBadge]}>
                          <Ionicons name="time-outline" size={14} color="#6B7280" />
                          <Text style={[styles.paymentPendingText, styles.expiredText]}>
                            PIX expirado
                          </Text>
                        </View>
                      )}

                      <View style={styles.orderInfo}>
                        <View style={styles.orderInfoLeft}>
                          <View style={styles.serviceTypeRow}>
                            <Ionicons name={getServiceTypeIcon(order.service_type)} size={14} color="#6B7280" />
                            <Text style={styles.serviceTypeLabel}>
                              {getServiceTypeLabel(order.service_type)}
                            </Text>
                          </View>
                          
                          {order.product_items && Array.isArray(order.product_items) && (
                            <Text style={styles.productInfo} numberOfLines={2}>
                              {order.product_items.map((item: any) => item.name).join(', ')}
                            </Text>
                          )}
                          
                          {order.commerce_name && (
                            <Text style={styles.commerceName} numberOfLines={1}>
                              {order.commerce_name}
                            </Text>
                          )}
                        </View>
                        
                        <View style={styles.orderInfoRight}>
                          <Text style={[
                            styles.orderPrice,
                            needsPayment && { color: '#F59E0B' },
                            isExpired && { color: '#9CA3AF' }
                          ]}>
                            {formatPrice(order.total_amount || order.price)}
                          </Text>
                          <Text style={styles.orderDate}>
                            {formatDate(order.created_at)}
                          </Text>
                        </View>
                      </View>

                      <View style={styles.orderCardFooter}>
                        {order.payment_method && (
                          <View style={styles.paymentBadge}>
                            <Ionicons 
                              name={order.payment_method === 'pix' ? 'qr-code-outline' : 'card-outline'} 
                              size={12} 
                              color="#6B7280" 
                            />
                            <Text style={styles.paymentText}>
                              {order.payment_method === 'pix' ? 'Pix' : 
                               order.payment_method === 'dinheiro' ? 'Dinheiro' : 'Cartão'}
                            </Text>
                          </View>
                        )}
                        <TouchableOpacity 
                          style={styles.detailsButton}
                          onPress={() => {
                            if (needsPayment) {
                              handlePixPendingOrder(order);
                            } else if (isExpired) {
                              handleExpiredPix();
                            } else {
                              router.push(`/order/${order.id}`);
                            }
                          }}
                        >
                          <Text style={[
                            styles.detailsText,
                            isExpired && { color: '#9CA3AF' }
                          ]}>
                            {needsPayment ? 'Pagar agora' : 
                             isExpired ? 'Expirado' : 'Ver detalhes'}
                          </Text>
                          <Ionicons 
                            name="chevron-forward" 
                            size={14} 
                            color={isExpired ? '#9CA3AF' : '#FF6B6B'} 
                          />
                        </TouchableOpacity>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function getProgressWidth(status: string): string {
  const progress: Record<string, string> = {
    criado: '10%',
    aceito: '25%',
    pronto: '45%',
    aguardando_motoboy: '60%',
    motoboy_a_caminho: '75%',
    em_andamento: '90%',
  };
  return progress[status] || '5%';
}

function getProgressText(status: string): string {
  const texts: Record<string, string> = {
    criado: 'Pedido recebido',
    aceito: 'Preparando',
    pronto: 'Pronto para entrega',
    aguardando_motoboy: 'Buscando entregador',
    motoboy_a_caminho: 'Entregador a caminho',
    em_andamento: 'Quase lá!',
  };
  return texts[status] || '';
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  titleSection: {
    marginBottom: 24,
  },
  mainTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  mainSubtitle: {
    fontSize: 15,
    color: '#6B7280',
  },
  summaryCards: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 24,
  },
  summaryCard: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    alignItems: 'center',
    gap: 4,
  },
  summaryNumber: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 60,
  },
  emptyIconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  emptyStateSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  exploreButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  ordersContainer: {
    gap: 24,
  },
  dateGroup: {
    gap: 10,
  },
  dateHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  dateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    textTransform: 'capitalize',
  },
  dateCount: {
    backgroundColor: '#E5E7EB',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  dateCountText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  orderCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 4,
    elevation: 2,
    gap: 12,
  },
  orderCardActive: {
    borderLeftWidth: 3,
    borderLeftColor: '#FF6B6B',
  },
  orderCardNeedsPayment: {
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    backgroundColor: '#FFFBEB',
  },
  orderCardExpiredPix: {
    borderLeftWidth: 3,
    borderLeftColor: '#9CA3AF',
    backgroundColor: '#F9FAFB',
    opacity: 0.8,
  },
  orderCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  orderIdRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  orderId: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    letterSpacing: 0.5,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 2,
  },
  paymentPendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    gap: 6,
    alignSelf: 'flex-start',
  },
  paymentPendingText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#D97706',
  },
  expiredBadge: {
    backgroundColor: '#F3F4F6',
  },
  expiredText: {
    color: '#6B7280',
  },
  orderInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  orderInfoLeft: {
    flex: 1,
    gap: 4,
  },
  serviceTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  serviceTypeLabel: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  productInfo: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  commerceName: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  orderInfoRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  orderPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  orderDate: {
    fontSize: 11,
    color: '#9CA3AF',
  },
  orderCardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  paymentBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  paymentText: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailsText: {
    fontSize: 13,
    color: '#FF6B6B',
    fontWeight: '600',
  },
});