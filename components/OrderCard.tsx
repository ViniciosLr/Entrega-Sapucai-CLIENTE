import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MapPin, Clock, User, Package, CircleCheck as CheckCircle, Circle as XCircle, Loader } from 'lucide-react-native';
import { Order } from '@/hooks/useOrders';

interface OrderCardProps {
  order: Order;
  onPress: () => void;
  showStatus?: boolean;
  showDate?: boolean;
}

export function OrderCard({ order, onPress, showStatus = false, showDate = false }: OrderCardProps) {
  // Configuração de Status ajustada para o seu SQL
  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'criado':
        return { label: 'Aguardando Motoboy', color: '#6B7280', icon: Clock };
      case 'aceito':
        return { label: 'A caminho da retirada', color: '#2563EB', icon: User };
      case 'em_andamento':
        return { label: 'A caminho da entrega', color: '#EA580C', icon: Loader };
      case 'finalizado':
        return { label: 'Pedido Entregue', color: '#059669', icon: CheckCircle };
      case 'cancelado':
        return { label: 'Cancelado', color: '#DC2626', icon: XCircle };
      default:
        return { label: 'Processando', color: '#6B7280', icon: Clock };
    }
  };

  const statusConfig = getStatusConfig(order.status);
  const StatusIcon = statusConfig.icon;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value || 0);
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <View style={styles.orderInfo}>
          <Text style={styles.orderId}>#{order.id.slice(-8)}</Text>
          <Text style={styles.orderType}>
            {order.merchandise_type || 'Mercadoria'}
          </Text>
        </View>
        <View style={styles.priceContainer}>
          <Text style={styles.price}>{formatCurrency(order.price)}</Text>
        </View>
      </View>

      {showStatus && (
        <View style={[styles.statusContainer, { backgroundColor: statusConfig.color + '15' }]}>
          <StatusIcon size={14} color={statusConfig.color} strokeWidth={2.5} />
          <Text style={[styles.statusText, { color: statusConfig.color }]}>
            {statusConfig.label}
          </Text>
        </View>
      )}

      <View style={styles.locationContainer}>
        <View style={styles.locationItem}>
          <MapPin size={16} color="#059669" strokeWidth={2} />
          <View style={styles.addressWrapper}>
            <Text style={styles.locationLabel}>RETIRADA</Text>
            <Text style={styles.locationText} numberOfLines={1}>
              {order.pickup_address}
            </Text>
          </View>
        </View>

        <View style={styles.connector} />

        <View style={styles.locationItem}>
          <MapPin size={16} color="#DC2626" strokeWidth={2} />
          <View style={styles.addressWrapper}>
            <Text style={styles.locationLabel}>ENTREGA</Text>
            <Text style={styles.locationText} numberOfLines={1}>
              {order.delivery_address}
            </Text>
          </View>
        </View>
      </View>

      {order.motoboy && (
        <View style={styles.motoboyContainer}>
          <User size={16} color="#6B7280" strokeWidth={1.5} />
          <Text style={styles.motoboyText}>
            {order.motoboy.name} • {order.motoboy.vehicle_type.toUpperCase()}
          </Text>
        </View>
      )}

      {showDate && (
        <View style={styles.dateContainer}>
          <Clock size={14} color="#9CA3AF" strokeWidth={1.5} />
          <Text style={styles.dateText}>{formatDate(order.created_at)}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fffcfc4e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  orderInfo: {
    flex: 1,
  },
  orderId: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#9CA3AF',
    marginBottom: 2,
  },
  orderType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    textTransform: 'capitalize',
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  price: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#059669',
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    marginBottom: 16,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  locationContainer: {
    marginBottom: 8,
  },
  locationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  addressWrapper: {
    marginLeft: 10,
    flex: 1,
  },
  locationLabel: {
    fontSize: 10,
    color: '#9CA3AF',
    fontWeight: 'bold',
    marginBottom: 2,
  },
  locationText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  connector: {
    width: 1,
    height: 15,
    backgroundColor: '#E5E7EB',
    marginLeft: 7,
    marginVertical: 2,
  },
  motoboyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  motoboyText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
  },
  dateText: {
    fontSize: 12,
    color: '#9CA3AF',
    marginLeft: 6,
  },
});