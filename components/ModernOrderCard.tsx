// components/ModernOrderCard.tsx
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Pizza,
  Coffee,
  Beef,
  Package,
  Clock,
  MapPin,
  ChevronRight,
  DollarSign,
} from 'lucide-react-native';

// Mapeamento de tipos de mercadoria para ícones e cores
const merchandiseConfig: Record<string, { icon: any; color: string; label: string }> = {
  pizza: { icon: Pizza, color: '#EF4444', label: 'Pizza' },
  lanche: { icon: Beef, color: '#F59E0B', label: 'Lanche' },
  bebida: { icon: Coffee, color: '#3B82F6', label: 'Bebida' },
  mercado: { icon: Package, color: '#10B981', label: 'Mercado' },
  padaria: { icon: Coffee, color: '#8B5CF6', label: 'Padaria' },
  restaurante: { icon: Beef, color: '#EC4899', label: 'Restaurante' },
  default: { icon: Package, color: '#6B7280', label: 'Mercadoria' },
};

const statusConfig: Record<string, { color: string; bg: string; label: string }> = {
  criado: { color: '#F59E0B', bg: '#FEF3C7', label: 'Criado' },
  aceito: { color: '#3B82F6', bg: '#DBEAFE', label: 'Aceito' },
  pronto: { color: '#8B5CF6', bg: '#EDE9FE', label: 'Pronto' },
  aguardando_motoboy: { color: '#F97316', bg: '#FFEDD5', label: 'Aguardando' },
  motoboy_a_caminho: { color: '#06B6D4', bg: '#CFFAFE', label: 'Motoboy à caminho' },
  em_andamento: { color: '#10B981', bg: '#D1FAE5', label: 'Em andamento' },
  finalizado: { color: '#6B7280', bg: '#F3F4F6', label: 'Finalizado' },
  cancelado: { color: '#EF4444', bg: '#FEE2E2', label: 'Cancelado' },
};

interface ModernOrderCardProps {
  order: {
    id: string;
    merchandise_type?: string;
    status: string;
    created_at: string;
    price: number;
    delivery_address: string;
    pickup_address: string;
    commerce_id?: string;
    commerce?: {
      name: string;
      image_url?: string;
    };
  };
  onPress: () => void;
  showStatus?: boolean;
}

export function ModernOrderCard({ order, onPress, showStatus = true }: ModernOrderCardProps) {
  const merchandiseType = order.merchandise_type?.toLowerCase() || 'default';
  const config = merchandiseConfig[merchandiseType] || merchandiseConfig.default;
  const IconComponent = config.icon;
  const status = statusConfig[order.status] || statusConfig.criado;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = diff / (1000 * 60 * 60);
    
    if (hours < 24) {
      return `Há ${Math.floor(hours)} hora${Math.floor(hours) !== 1 ? 's' : ''}`;
    }
    return date.toLocaleDateString('pt-BR');
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <LinearGradient
        colors={['#FFFFFF', '#F9FAFB']}
        style={styles.cardGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      >
        {/* Header com tipo de mercadoria e status */}
        <View style={styles.cardHeader}>
          <View style={[styles.merchandiseBadge, { backgroundColor: `${config.color}15` }]}>
            <IconComponent size={18} color={config.color} />
            <Text style={[styles.merchandiseText, { color: config.color }]}>
              {config.label}
            </Text>
          </View>
          
          {showStatus && (
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <View style={[styles.statusDot, { backgroundColor: status.color }]} />
              <Text style={[styles.statusText, { color: status.color }]}>
                {status.label}
              </Text>
            </View>
          )}
        </View>

        {/* Info do comércio */}
        <View style={styles.commerceSection}>
          {order.commerce?.image_url ? (
            <Image source={{ uri: order.commerce.image_url }} style={styles.commerceImage} />
          ) : (
            <View style={[styles.commerceImagePlaceholder, { backgroundColor: `${config.color}20` }]}>
              <IconComponent size={20} color={config.color} />
            </View>
          )}
          <View style={styles.commerceInfo}>
            <Text style={styles.commerceName}>
              {order.commerce?.name || 'Comércio'}
            </Text>
            <Text style={styles.orderTime}>
              <Clock size={12} color="#9CA3AF" /> {formatDate(order.created_at)}
            </Text>
          </View>
        </View>

        {/* Detalhes do pedido */}
        <View style={styles.detailsSection}>
          <View style={styles.detailRow}>
            <MapPin size={16} color="#6B7280" />
            <Text style={styles.detailText} numberOfLines={1}>
              {order.pickup_address?.split(',')[0] || 'Retirada'}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <MapPin size={16} color="#6B7280" />
            <Text style={styles.detailText} numberOfLines={1}>
              {order.delivery_address?.split(',')[0] || 'Entrega'}
            </Text>
          </View>
        </View>

        {/* Footer com preço e ação */}
        <View style={styles.cardFooter}>
          <View style={styles.priceContainer}>
            <DollarSign size={16} color="#059669" />
            <Text style={styles.priceText}>{formatPrice(order.price)}</Text>
          </View>
          <ChevronRight size={20} color="#9CA3AF" />
        </View>
      </LinearGradient>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 16,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 3,
  },
  cardGradient: {
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: '#F0F0F0',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  merchandiseBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  merchandiseText: {
    fontSize: 13,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    gap: 5,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  commerceSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 12,
  },
  commerceImage: {
    width: 44,
    height: 44,
    borderRadius: 12,
  },
  commerceImagePlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  commerceInfo: {
    flex: 1,
  },
  commerceName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 4,
  },
  orderTime: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  detailsSection: {
    marginBottom: 16,
    gap: 8,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 13,
    color: '#4B5563',
    flex: 1,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  priceContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  priceText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#059669',
  },
});