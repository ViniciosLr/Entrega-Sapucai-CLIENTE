// app/cart/index.tsx

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Image,
  TouchableOpacity,
  Alert,
  SafeAreaView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCart } from '@/contexts/CartContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

export default function CartScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const {
    cartItems,
    removeFromCart,
    updateQuantity,
    getCartTotal,
    clearCart,
    getCurrentCommerce,
  } = useCart();

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const handleCheckout = () => {
    if (cartItems.length === 0) {
      Alert.alert(
        'Carrinho vazio',
        'Adicione itens ao carrinho antes de finalizar.'
      );
      return;
    }

    router.push('/checkout');
  };

  const handleGoBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.push('/');
    }
  };

  const handleClearCart = () => {
    if (cartItems.length === 0) return;

    Alert.alert(
      'Limpar Carrinho',
      'Tem certeza que deseja remover todos os itens?',
      [
        {
          text: 'Cancelar',
          style: 'cancel',
        },
        {
          text: 'Limpar',
          style: 'destructive',
          onPress: () => clearCart(),
        },
      ]
    );
  };

  const renderCartItem = ({ item }: { item: any }) => (
    <View style={styles.cartItem}>
      <Image
        source={{
          uri: item.image_url || 'https://via.placeholder.com/80',
        }}
        style={styles.itemImage}
        resizeMode="cover"
      />

      <View style={styles.itemInfo}>
        <Text style={styles.itemName} numberOfLines={2}>
          {item.name}
        </Text>

        <Text style={styles.itemCommerce} numberOfLines={1}>
          {item.commerce_name}
        </Text>

        <Text style={styles.itemPrice}>
          {formatPrice(item.price)}
        </Text>
      </View>

      <View style={styles.itemActions}>
        <View style={styles.quantityControl}>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() =>
              updateQuantity(item.product_id, item.quantity - 1)
            }
          >
            <Ionicons name="remove" size={16} color="#FFF" />
          </TouchableOpacity>

          <Text style={styles.quantityText}>
            {item.quantity}
          </Text>

          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() =>
              updateQuantity(item.product_id, item.quantity + 1)
            }
          >
            <Ionicons name="add" size={16} color="#FFF" />
          </TouchableOpacity>
        </View>

        <Text style={styles.itemTotal}>
          {formatPrice(item.total_price)}
        </Text>

        <TouchableOpacity
          style={styles.removeButton}
          onPress={() => removeFromCart(item.product_id)}
        >
          <Ionicons
            name="trash-outline"
            size={20}
            color="#DC2626"
          />
        </TouchableOpacity>
      </View>
    </View>
  );

  if (cartItems.length === 0) {
    return (
      <SafeAreaView style={styles.emptyContainer}>
        {/* BOTÃO VOLTAR */}
        <TouchableOpacity
          style={[
            styles.floatingBackButton,
            { top: insets.top + 10 },
          ]}
          onPress={handleGoBack}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color="#333"
          />
        </TouchableOpacity>

        <Ionicons
          name="cart-outline"
          size={80}
          color="#CCC"
        />

        <Text style={styles.emptyTitle}>
          Carrinho vazio
        </Text>

        <Text style={styles.emptyText}>
          Adicione produtos para continuar
        </Text>

        <TouchableOpacity
          style={styles.continueButton}
          onPress={handleGoBack}
        >
          <Text style={styles.continueButtonText}>
            Continuar Comprando
          </Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const total = getCartTotal();
  const currentCommerce = getCurrentCommerce();

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <LinearGradient
        colors={['#FF6B6B', '#FF8E53']}
        style={[
          styles.header,
          {
            paddingTop: insets.top + 16,
          },
        ]}
      >
        {/* BOTÃO VOLTAR */}
        <TouchableOpacity
          onPress={handleGoBack}
          style={styles.backButton}
        >
          <Ionicons
            name="arrow-back"
            size={24}
            color="#FFF"
          />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>
          Meu Carrinho
        </Text>

        <TouchableOpacity
          onPress={handleClearCart}
          style={styles.clearButton}
        >
          <Text style={styles.clearButtonText}>
            Limpar
          </Text>
        </TouchableOpacity>
      </LinearGradient>

      {/* COMÉRCIO */}
      {currentCommerce && (
        <View style={styles.commerceBadge}>
          <Ionicons
            name="business-outline"
            size={16}
            color="#FF6B6B"
          />

          <Text
            style={styles.commerceBadgeText}
            numberOfLines={1}
          >
            {currentCommerce.name}
          </Text>
        </View>
      )}

      {/* LISTA */}
      <FlatList
        data={cartItems}
        keyExtractor={(item) => item.id}
        renderItem={renderCartItem}
        contentContainerStyle={styles.cartList}
        showsVerticalScrollIndicator={false}
      />

      {/* FOOTER */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + 16,
          },
        ]}
      >
        <View style={styles.totalContainer}>
          <View style={styles.totalInfo}>
            <Text style={styles.totalItems}>
              {cartItems.length}{' '}
              {cartItems.length === 1
                ? 'item'
                : 'itens'}
            </Text>

            <Text style={styles.totalLabel}>
              Valor total
            </Text>
          </View>

          <Text style={styles.totalValue}>
            {formatPrice(total)}
          </Text>
        </View>

        <Text style={styles.checkoutNote}>
          A taxa de entrega e forma de pagamento serão
          definidas na próxima etapa
        </Text>

        <TouchableOpacity
          style={styles.checkoutButton}
          onPress={handleCheckout}
        >
          <LinearGradient
            colors={['#059669', '#10B981']}
            style={styles.checkoutGradient}
          >
            <Text style={styles.checkoutButtonText}>
              Continuar para Pagamento
            </Text>

            <Ionicons
              name="arrow-forward"
              size={20}
              color="#FFF"
            />
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },

  backButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  floatingBackButton: {
    position: 'absolute',
    left: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    zIndex: 10,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },

  clearButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
  },

  clearButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },

  commerceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#FFE0E0',
  },

  commerceBadgeText: {
    fontSize: 13,
    color: '#FF6B6B',
    fontWeight: '500',
    flex: 1,
  },

  cartList: {
    padding: 16,
  },

  cartItem: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },

  itemImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
  },

  itemInfo: {
    flex: 1,
    marginLeft: 12,
  },

  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },

  itemCommerce: {
    fontSize: 12,
    color: '#999',
    marginBottom: 4,
  },

  itemPrice: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },

  itemActions: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },

  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    marginBottom: 8,
  },

  quantityButton: {
    width: 28,
    height: 28,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
  },

  quantityText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginHorizontal: 12,
  },

  itemTotal: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },

  removeButton: {
    padding: 4,
  },

  footer: {
    backgroundColor: '#FFF',
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    padding: 20,
  },

  totalContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },

  totalInfo: {
    flex: 1,
  },

  totalItems: {
    fontSize: 13,
    color: '#888',
    marginBottom: 4,
  },

  totalLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },

  totalValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#059669',
  },

  checkoutNote: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
    marginBottom: 12,
    fontStyle: 'italic',
  },

  checkoutButton: {
    borderRadius: 12,
    overflow: 'hidden',
  },

  checkoutGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },

  checkoutButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFF',
  },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    paddingHorizontal: 24,
  },

  emptyTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
  },

  emptyText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    marginBottom: 24,
    textAlign: 'center',
  },

  continueButton: {
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },

  continueButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
});