// app/product/[id].tsx
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '@/contexts/CartContext';

interface IngredientItem {
  id: string;
  name: string;
  price_adjustment: number;
  is_available: boolean;
  default_quantity: number;
  allow_multiple: boolean;
  max_quantity: number;
}

interface ProductIngredient {
  id: string;
  ingredient_item_id: string;
  quantity: number;
  sort_order: number;
  ingredient_items: IngredientItem | null;
}

interface SelectedIngredient {
  ingredient_item_id: string;
  name: string;
  price_adjustment: number;
  quantity: number;
  max_quantity: number;
  allow_multiple: boolean;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  commerce_id: string;
  has_ingredients: boolean;
  commerce?: {
    id: string;
    name: string;
    phone: string;
  };
}

export default function ProductDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { addToCart } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [productIngredients, setProductIngredients] = useState<ProductIngredient[]>([]);
  const [selectedIngredients, setSelectedIngredients] = useState<Record<string, SelectedIngredient>>({});
  const [loading, setLoading] = useState(true);
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const loadProduct = async () => {
    if (!id) {
      console.log('❌ ID do produto não encontrado');
      setLoading(false);
      return;
    }

    try {
      console.log('🔄 Carregando produto ID:', id);

      const { data: productData, error: productError } = await supabase
        .from('products')
        .select(`
          *,
          commerce:commerces (id, name, phone)
        `)
        .eq('id', id)
        .single();

      if (productError) throw productError;

      console.log('✅ Produto carregado:', productData?.name);
      setProduct(productData);

      if (productData.has_ingredients) {
        console.log('🔄 Carregando ingredientes do produto...');

        const { data: ingData, error: ingError } = await supabase
          .from('product_ingredients')
          .select(`
            id,
            ingredient_item_id,
            quantity,
            sort_order,
            ingredient_items!product_ingredients_ingredient_item_id_fkey (
              id,
              name,
              price_adjustment,
              is_available,
              default_quantity,
              allow_multiple,
              max_quantity
            )
          `)
          .eq('product_id', id)
          .order('sort_order');

        if (ingError) throw ingError;

        const validIngredients = (ingData || []).filter((pi: any) => 
          pi?.ingredient_items && pi.ingredient_items.is_available === true
        );

        setProductIngredients(validIngredients);

        // ✅ TODOS os ingredientes começam com quantidade 0
        // Não usamos mais default_quantity para pré-selecionar
        setSelectedIngredients({});
      }
    } catch (error: any) {
      console.error('❌ Erro ao carregar produto:', error.message || error);
      Alert.alert('Erro', 'Não foi possível carregar o produto.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProduct();
  }, [id]);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const ingredientsExtraTotal = Object.values(selectedIngredients).reduce(
    (sum, ing) => sum + ing.price_adjustment * ing.quantity,
    0
  );

  const totalPrice = ((product?.price || 0) + ingredientsExtraTotal) * quantity;

  const handleIngredientChange = (item: IngredientItem, delta: number) => {
    setSelectedIngredients((prev) => {
      const currentQty = prev[item.id]?.quantity || 0;
      const newQty = Math.max(0, Math.min(item.max_quantity, currentQty + delta));

      if (newQty === 0) {
        const updated = { ...prev };
        delete updated[item.id];
        return updated;
      }

      return {
        ...prev,
        [item.id]: {
          ingredient_item_id: item.id,
          name: item.name,
          price_adjustment: item.price_adjustment,
          quantity: newQty,
          max_quantity: item.max_quantity,
          allow_multiple: item.allow_multiple,
        },
      };
    });
  };

  const handleAddToCart = async () => {
    if (!product) return;

    setAddingToCart(true);

    try {
      const selectedList = Object.values(selectedIngredients);

      await addToCart({
        product_id: product.id,
        name: product.name,
        price: product.price + ingredientsExtraTotal,
        quantity: quantity,
        image_url: product.image_url,
        commerce_id: product.commerce_id,
        commerce_name: product.commerce?.name || '',
        observations: selectedList.length > 0
          ? selectedList.map((i) => `${i.name} x${i.quantity}`).join(', ')
          : '',
      });

      setShowSuccessModal(true);
    } catch (error) {
      console.error('Erro ao adicionar ao carrinho:', error);
      Alert.alert('Erro', 'Não foi possível adicionar ao carrinho.');
    } finally {
      setAddingToCart(false);
    }
  };

  const handleGoToCheckout = () => {
    setShowSuccessModal(false);
    router.push('/checkout');
  };

  const handleContinueShopping = () => {
    setShowSuccessModal(false);
    router.back();
  };

  const handleGoToCommerce = () => {
    if (product?.commerce_id) {
      router.push(`/commerce/${product.commerce_id}`);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingText}>Carregando produto...</Text>
      </View>
    );
  }

  if (!product) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="sad-outline" size={64} color="#CCC" />
        <Text style={styles.errorText}>Produto não encontrado</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
        {/* Imagem */}
        <Image
          source={{ uri: product.image_url || 'https://via.placeholder.com/400' }}
          style={styles.productImage}
          resizeMode="cover"
        />

        <TouchableOpacity
          style={[styles.backButtonHeader, { top: insets.top + 16 }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>

        {/* Informações */}
        <View style={styles.productInfo}>
          <Text style={styles.productName}>{product.name}</Text>

          <TouchableOpacity style={styles.commerceLink} onPress={handleGoToCommerce}>
            <Ionicons name="storefront-outline" size={16} color="#FF6B6B" />
            <Text style={styles.commerceName}>{product.commerce?.name}</Text>
            <Ionicons name="chevron-forward" size={16} color="#FF6B6B" />
          </TouchableOpacity>

          <Text style={styles.productPrice}>{formatPrice(product.price)}</Text>

          <Text style={styles.descriptionTitle}>Descrição</Text>
          <Text style={styles.description}>
            {product.description || 'Nenhuma descrição disponível para este produto.'}
          </Text>

          {/* Seção de Ingredientes */}
          {product.has_ingredients && (
            <View style={styles.ingredientsSection}>
              <View style={styles.ingredientsSectionHeader}>
                <Ionicons name="restaurant-outline" size={18} color="#333" />
                <Text style={styles.ingredientsTitle}>Ingredientes</Text>
              </View>
              <Text style={styles.ingredientsSubtitle}>
                Personalize seu pedido removendo ou adicionando itens
              </Text>

              {productIngredients.length > 0 ? (
                productIngredients.map((pi) => {
                  const item = pi.ingredient_items!;
                  const currentQty = selectedIngredients[item.id]?.quantity || 0;

                  return (
                    <View key={pi.id} style={styles.ingredientRow}>
                      <View style={styles.ingredientInfo}>
                        <Text style={styles.ingredientName}>{item.name}</Text>
                        {item.price_adjustment !== 0 && (
                          <Text style={[
                            styles.ingredientPrice,
                            item.price_adjustment > 0 ? styles.ingredientPricePositive : styles.ingredientPriceNegative
                          ]}>
                            {item.price_adjustment > 0 ? '+' : ''}{formatPrice(item.price_adjustment)}
                          </Text>
                        )}
                      </View>

                      <View style={styles.ingredientControls}>
                        <TouchableOpacity
                          style={[styles.ingButton, currentQty === 0 && styles.ingButtonDisabled]}
                          onPress={() => handleIngredientChange(item, -1)}
                          disabled={currentQty === 0}
                        >
                          <Ionicons name="remove" size={16} color={currentQty === 0 ? '#CCC' : '#FF6B6B'} />
                        </TouchableOpacity>

                        <Text style={[styles.ingQtyText, currentQty === 0 && styles.ingQtyTextZero]}>
                          {currentQty}
                        </Text>

                        <TouchableOpacity
                          style={[
                            styles.ingButton,
                            (!item.allow_multiple && currentQty >= 1) || currentQty >= item.max_quantity
                              ? styles.ingButtonDisabled
                              : null,
                          ]}
                          onPress={() => handleIngredientChange(item, 1)}
                          disabled={(!item.allow_multiple && currentQty >= 1) || currentQty >= item.max_quantity}
                        >
                          <Ionicons
                            name="add"
                            size={16}
                            color={
                              (!item.allow_multiple && currentQty >= 1) || currentQty >= item.max_quantity
                                ? '#CCC'
                                : '#FF6B6B'
                            }
                          />
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              ) : (
                <Text style={{ color: '#999', marginTop: 12, fontStyle: 'italic' }}>
                  Nenhum ingrediente disponível no momento.
                </Text>
              )}

              {ingredientsExtraTotal !== 0 && (
                <View style={styles.extrasTotal}>
                  <Text style={styles.extrasTotalLabel}>Total dos extras</Text>
                  <Text style={[
                    styles.extrasTotalValue,
                    ingredientsExtraTotal > 0 ? styles.ingredientPricePositive : styles.ingredientPriceNegative
                  ]}>
                    {ingredientsExtraTotal > 0 ? '+' : ''}{formatPrice(ingredientsExtraTotal)}
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Barra inferior de compra */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
        <View style={styles.quantitySelector}>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => setQuantity(Math.max(1, quantity - 1))}
            disabled={addingToCart}
          >
            <Ionicons name="remove" size={20} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.quantityText}>{quantity}</Text>
          <TouchableOpacity
            style={styles.quantityButton}
            onPress={() => setQuantity(quantity + 1)}
            disabled={addingToCart}
          >
            <Ionicons name="add" size={20} color="#FFF" />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.addButton, addingToCart && styles.addButtonDisabled]}
          onPress={handleAddToCart}
          disabled={addingToCart}
        >
          {addingToCart ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <Text style={styles.addButtonText}>
              Comprar • {formatPrice(totalPrice)}
            </Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Modal de Sucesso */}
      <Modal
        visible={showSuccessModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Ionicons name="checkmark-circle" size={80} color="#4CAF50" />
            
            <Text style={styles.modalTitle}>Produto adicionado!</Text>
            <Text style={styles.modalSubtitle}>
              {quantity} × {product.name} foi adicionado ao carrinho
            </Text>

            <TouchableOpacity style={styles.checkoutButton} onPress={handleGoToCheckout}>
              <Text style={styles.checkoutButtonText}>Finalizar Compra</Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.continueButton} onPress={handleContinueShopping}>
              <Text style={styles.continueButtonText}>Continuar Comprando</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' },
  loadingText: { marginTop: 12, fontSize: 16, color: '#666' },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' },
  errorText: { marginTop: 16, fontSize: 18, color: '#666' },
  backButton: { marginTop: 20, paddingHorizontal: 24, paddingVertical: 12, backgroundColor: '#FF6B6B', borderRadius: 8 },
  backButtonText: { color: '#FFF', fontWeight: '600' },

  productImage: { width: '100%', height: 300 },
  backButtonHeader: {
    position: 'absolute',
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  productInfo: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    marginTop: -20,
    padding: 20,
  },
  productName: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  commerceLink: { flexDirection: 'row', alignItems: 'center', marginBottom: 12, gap: 4 },
  commerceName: { fontSize: 14, color: '#FF6B6B', fontWeight: '500' },
  productPrice: { fontSize: 28, fontWeight: 'bold', color: '#4CAF50', marginBottom: 16 },
  descriptionTitle: { fontSize: 18, fontWeight: '600', color: '#333', marginBottom: 8 },
  description: { fontSize: 14, color: '#666', lineHeight: 20 },

  ingredientsSection: { marginTop: 24, borderTopWidth: 1, borderTopColor: '#F0F0F0', paddingTop: 20 },
  ingredientsSectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
  ingredientsTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  ingredientsSubtitle: { fontSize: 12, color: '#999', marginBottom: 16 },
  ingredientRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F5F5F5' },
  ingredientInfo: { flex: 1, marginRight: 12 },
  ingredientName: { fontSize: 15, color: '#333', fontWeight: '500' },
  ingredientPrice: { fontSize: 13, marginTop: 2, fontWeight: '600' },
  ingredientPricePositive: { color: '#FF6B6B' },
  ingredientPriceNegative: { color: '#4CAF50' },
  ingredientControls: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  ingButton: { width: 32, height: 32, borderRadius: 8, borderWidth: 1.5, borderColor: '#FF6B6B', justifyContent: 'center', alignItems: 'center' },
  ingButtonDisabled: { borderColor: '#E0E0E0' },
  ingQtyText: { fontSize: 16, fontWeight: '700', color: '#333', minWidth: 20, textAlign: 'center' },
  ingQtyTextZero: { color: '#CCC' },
  extrasTotal: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  extrasTotalLabel: { fontSize: 14, color: '#666', fontWeight: '500' },
  extrasTotalValue: { fontSize: 16, fontWeight: '700' },

  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  quantitySelector: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8F9FA', borderRadius: 12, padding: 4 },
  quantityButton: { width: 40, height: 40, backgroundColor: '#FF6B6B', borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  quantityText: { fontSize: 18, fontWeight: '600', color: '#333', marginHorizontal: 16 },
  addButton: { flex: 1, backgroundColor: '#FF6B6B', paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  addButtonDisabled: { backgroundColor: '#FFB3B3' },
  addButtonText: { fontSize: 16, fontWeight: 'bold', color: '#FFF' },

  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    alignItems: 'center',
    paddingBottom: 40,
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginBottom: 24,
  },
  checkoutButton: {
    backgroundColor: '#FF6B6B',
    width: '100%',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 12,
  },
  checkoutButtonText: {
    color: '#FFF',
    fontSize: 17,
    fontWeight: 'bold',
  },
  continueButton: {
    paddingVertical: 14,
  },
  continueButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
  },
});