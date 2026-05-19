// app/commerce/[id].tsx
import React, { useEffect, useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface Commerce {
  id: string;
  name: string;
  description: string;
  image_url: string;
  category: string;
  phone: string;
  address: string;
  opening_time: string;   // ex: "08:30"
  closing_time: string;   // ex: "18:00"
  is_active: boolean;
}

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  is_available: boolean;
  category_id: string;
  has_ingredients?: boolean;
}

interface ProductCategory {
  id: string;
  name: string;
  is_active: boolean;
}

interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  is_active: boolean;
  icon_name: string;
}

interface ProductIngredient {
  ingredient_name: string;
  quantity: number;
}

export default function CommerceDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  
  const [commerce, setCommerce] = useState<Commerce | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [productsIngredients, setProductsIngredients] = useState<{ [key: string]: ProductIngredient[] }>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    if (!id) return;
    
    try {
      // Buscar dados do comércio
      const { data: commerceData, error: commerceError } = await supabase
        .from('commerces')
        .select('*')
        .eq('id', id)
        .single();

      if (commerceError) throw commerceError;
      setCommerce(commerceData);

      // Buscar produtos do comércio
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('*')
        .eq('commerce_id', id)
        .eq('is_available', true)
        .order('name', { ascending: true });

      if (productsError) throw productsError;
      setProducts(productsData || []);

      // Buscar ingredientes dos produtos que têm has_ingredients = true
      if (productsData && productsData.length > 0) {
        const productsWithIngredients = productsData.filter(p => p.has_ingredients);
        
        if (productsWithIngredients.length > 0) {
          const ingredientsMap: { [key: string]: ProductIngredient[] } = {};
          
          for (const product of productsWithIngredients) {
            const { data: productIngredients, error: ingredientsError } = await supabase
              .from('product_ingredients')
              .select(`
                quantity,
                ingredient_groups!inner(
                  ingredient_items!inner(
                    name
                  )
                )
              `)
              .eq('product_id', product.id);

            if (!ingredientsError && productIngredients) {
              const items: ProductIngredient[] = [];
              
              productIngredients.forEach((pi: any) => {
                const ingredientGroup = pi.ingredient_groups;
                if (ingredientGroup && ingredientGroup.ingredient_items) {
                  const ingredientItems = Array.isArray(ingredientGroup.ingredient_items) 
                    ? ingredientGroup.ingredient_items 
                    : [ingredientGroup.ingredient_items];
                  
                  ingredientItems.forEach((item: any) => {
                    items.push({
                      ingredient_name: item.name,
                      quantity: pi.quantity || 1
                    });
                  });
                }
              });
              
              if (items.length > 0) {
                ingredientsMap[product.id] = items;
              }
            }
          }
          
          setProductsIngredients(ingredientsMap);
        }
      }

      // Buscar categorias dos produtos disponíveis
      if (productsData && productsData.length > 0) {
        const categoryIds = [...new Set(productsData.map(p => p.category_id).filter(Boolean))];
        
        if (categoryIds.length > 0) {
          const { data: categoriesData, error: categoriesError } = await supabase
            .from('product_categories')
            .select('*')
            .in('id', categoryIds)
            .eq('is_active', true)
            .order('name', { ascending: true });

          if (!categoriesError) {
            setCategories(categoriesData || []);
          }
        }
      }

      // Buscar métodos de pagamento
      const { data: paymentConfigData, error: paymentConfigError } = await supabase
        .from('commerce_payment_config')
        .select(`
          payment_method_code,
          is_active,
          payment_methods!inner(*)
        `)
        .eq('commerce_id', id)
        .eq('is_active', true);

      if (!paymentConfigError && paymentConfigData) {
        const methods = paymentConfigData
          .map((config: any) => config.payment_methods)
          .filter((method: any) => method && method.is_active);
        setPaymentMethods(methods);
      }
    } catch (error) {
      console.error('Erro ao carregar:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, [id]);

  // ====================== LÓGICA DE HORÁRIO ======================
  const isCommerceOpen = useMemo(() => {
    if (!commerce?.opening_time || !commerce?.closing_time) return false;

    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentMinutes = currentHour * 60 + currentMinute;

    const [openHour, openMinute] = commerce.opening_time.split(':').map(Number);
    const [closeHour, closeMinute] = commerce.closing_time.split(':').map(Number);

    const openMinutes = openHour * 60 + openMinute;
    const closeMinutes = closeHour * 60 + closeMinute;

    // Caso o comércio feche depois da meia-noite (ex: 22:00 - 02:00)
    if (closeMinutes < openMinutes) {
      return currentMinutes >= openMinutes || currentMinutes < closeMinutes;
    }

    return currentMinutes >= openMinutes && currentMinutes < closeMinutes;
  }, [commerce]);

  const getClosedMessage = () => {
    if (!commerce?.opening_time || !commerce?.closing_time) return 'Horário não informado';

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [openHour, openMinute] = commerce.opening_time.split(':').map(Number);
    const openMinutes = openHour * 60 + openMinute;

    return currentMinutes < openMinutes 
      ? 'O comércio ainda não abriu' 
      : 'O comércio já está fechado';
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(price);
  };

  const handleProductPress = (productId: string) => {
    if (!isCommerceOpen) {
      Alert.alert(
        'Fora do horário de atendimento',
        `${getClosedMessage()}\n\nVocê só pode fazer pedidos enquanto o comércio estiver aberto.`,
        [{ text: 'Entendi' }]
      );
      return;
    }
    router.push(`/product/${productId}`);
  };

  const handleLocation = () => {
    if (commerce?.address) {
      console.log('Abrir mapa:', commerce.address);
      // Implementar abertura do mapa aqui
    }
  };

  const getProductDescription = (product: Product) => {
    if (product.description && product.description.trim() !== '') {
      return product.description;
    }
    
    const ingredients = productsIngredients[product.id];
    if (ingredients && ingredients.length > 0) {
      const ingredientNames = ingredients.map(ing => 
        ing.quantity > 1 ? `${ing.quantity}x ${ing.ingredient_name}` : ing.ingredient_name
      );
      return `Contém: ${ingredientNames.join(', ')}`;
    }
    
    return 'Sem descrição';
  };

  const getProductsByCategory = () => {
    const grouped: { [key: string]: Product[] } = {};
    
    products.forEach(product => {
      const categoryId = product.category_id || 'sem-categoria';
      if (!grouped[categoryId]) grouped[categoryId] = [];
      grouped[categoryId].push(product);
    });
    
    return grouped;
  };

  const getCategoryName = (categoryId: string) => {
    if (categoryId === 'sem-categoria') return 'Outros';
    const category = categories.find(c => c.id === categoryId);
    return category?.name || 'Outros';
  };

  // NOVA FUNÇÃO: Define a ordem de exibição das categorias
  const getCategoryOrder = (categoryName: string): number => {
    const name = categoryName.toLowerCase();
    
    // Comidas (Lanches, Pizza, etc.) - Ordem 1
    if (name.includes('lanche') || 
        name.includes('pizza') || 
        name.includes('hambúrguer') ||
        name.includes('hamburguer') ||
        name.includes('sanduíche') ||
        name.includes('sanduiche') ||
        name.includes('porção') ||
        name.includes('porcao') ||
        name.includes('prato') ||
        name.includes('marmita') ||
        name.includes('comida') ||
        name.includes('almoço') ||
        name.includes('almoco') ||
        name.includes('jantar') ||
        name.includes('pastel') ||
        name.includes('salgado') ||
        name.includes('espeto') ||
        name.includes('churrasco') ||
        name.includes('petisco') ||
        name.includes('entrada') ||
        name.includes('principal')) {
      return 1;
    }
    
    // Bebidas - Ordem 2
    if (name.includes('bebida') || 
        name.includes('suco') || 
        name.includes('refrigerante') ||
        name.includes('cerveja') ||
        name.includes('drink') ||
        name.includes('água') ||
        name.includes('agua') ||
        name.includes('café') ||
        name.includes('cafe') ||
        name.includes('chá') ||
        name.includes('cha') ||
        name.includes('vinho') ||
        name.includes('destilado') ||
        name.includes('coquetel') ||
        name.includes('bebida')) {
      return 2;
    }
    
    // Sobremesas - Ordem 3 (se quiser separado)
    if (name.includes('sobremesa') || 
        name.includes('doce') ||
        name.includes('sorvete') ||
        name.includes('açaí') ||
        name.includes('acai') ||
        name.includes('torta') ||
        name.includes('bolo') ||
        name.includes('pudim')) {
      return 3;
    }
    
    // Diversos/Outros - Ordem 4
    return 4;
  };

  // NOVA FUNÇÃO: Ordena as categorias de acordo com a ordem definida
  const getSortedCategories = () => {
    const grouped = getProductsByCategory();
    
    return Object.entries(grouped).sort(([categoryIdA, productsA], [categoryIdB, productsB]) => {
      const categoryNameA = getCategoryName(categoryIdA);
      const categoryNameB = getCategoryName(categoryIdB);
      
      const orderA = getCategoryOrder(categoryNameA);
      const orderB = getCategoryOrder(categoryNameB);
      
      // Se forem da mesma ordem, ordena alfabeticamente
      if (orderA === orderB) {
        return categoryNameA.localeCompare(categoryNameB);
      }
      
      return orderA - orderB;
    });
  };

  const getPaymentIcon = (code: string): keyof typeof Ionicons.glyphMap => {
    const icons: { [key: string]: keyof typeof Ionicons.glyphMap } = {
      'pix': 'logo-usd',
      'debit': 'card-outline',
      'credit': 'card-outline',
      'cash': 'cash-outline',
      'meal_ticket': 'ticket-outline',
      'food_voucher': 'card-outline',
    };
    return icons[code] || 'cash-outline';
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingText}>Carregando comércio...</Text>
      </View>
    );
  }

  if (!commerce) {
    return (
      <View style={styles.errorContainer}>
        <Ionicons name="sad-outline" size={64} color="#CCC" />
        <Text style={styles.errorText}>Comércio não encontrado</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isOpen = isCommerceOpen;
  const closedMessage = getClosedMessage();
  const sortedCategories = getSortedCategories();

  return (
    <View style={styles.container}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Imagem de capa */}
        <Image
          source={{ uri: commerce.image_url || 'https://via.placeholder.com/400x200' }}
          style={styles.coverImage}
          resizeMode="cover"
        />
        
        <TouchableOpacity
          style={[styles.backButtonHeader, { top: insets.top + 16 }]}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>

        {/* Informações do comércio */}
        <View style={styles.commerceInfo}>
          <Text style={styles.commerceName}>{commerce.name}</Text>
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{commerce.category}</Text>
          </View>
          
          <Text style={styles.description}>{commerce.description || 'Bem-vindo ao nosso estabelecimento!'}</Text>
          
          <View style={styles.infoRow}>
            <Ionicons name="location-outline" size={18} color="#666" />
            <Text style={styles.infoText}>{commerce.address}</Text>
          </View>
          
          <View style={styles.infoRow}>
            <Ionicons name="time-outline" size={18} color="#666" />
            <Text style={styles.infoText}>
              {commerce.opening_time && commerce.closing_time 
                ? `${commerce.opening_time} - ${commerce.closing_time}`
                : 'Horário não informado'}
            </Text>
          </View>
          
          {/* Botão Como Chegar ou Mensagem de Fechado */}
          {isOpen ? (
            <TouchableOpacity style={styles.locationButtonFull} onPress={handleLocation}>
              <Ionicons name="navigate-outline" size={20} color="#FFF" />
              <Text style={styles.locationButtonText}>Como chegar</Text>
            </TouchableOpacity>
          ) : (
            <View style={[styles.locationButtonFull, { backgroundColor: '#FF9800' }]}>
              <Ionicons name="time-outline" size={20} color="#FFF" />
              <Text style={styles.locationButtonText}>{closedMessage}</Text>
            </View>
          )}
        </View>

        {/* Métodos de Pagamento */}
        {paymentMethods.length > 0 && (
          <View style={styles.paymentSection}>
            <Text style={styles.sectionTitle}>Formas de Pagamento</Text>
            <View style={styles.paymentMethodsContainer}>
              {paymentMethods.map((method) => (
                <View key={method.id} style={styles.paymentMethodBadge}>
                  <Ionicons name={getPaymentIcon(method.code)} size={20} color="#4CAF50" />
                  <Text style={styles.paymentMethodText}>{method.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Cardápio - AGORA SEMPRE VISÍVEL */}
        <View style={styles.productsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Cardápio</Text>
            {!isOpen && (
              <View style={styles.closedBadge}>
                <Ionicons name="lock-closed" size={14} color="#FFF" />
                <Text style={styles.closedBadgeText}>Fechado</Text>
              </View>
            )}
          </View>
          
          {!isOpen && (
            <View style={styles.closedWarning}>
              <Ionicons name="information-circle" size={20} color="#FF9800" />
              <Text style={styles.closedWarningText}>
                {closedMessage}. Você pode visualizar o cardápio, mas não é possível fazer pedidos no momento.
              </Text>
            </View>
          )}
          
          {products.length === 0 ? (
            <View style={styles.emptyProducts}>
              <Ionicons name="fast-food-outline" size={48} color="#CCC" />
              <Text style={styles.emptyText}>Nenhum produto disponível no momento</Text>
            </View>
          ) : (
            <>
              {sortedCategories.map(([categoryId, categoryProducts]) => (
                <View key={categoryId} style={styles.categorySection}>
                  <Text style={styles.categoryTitle}>{getCategoryName(categoryId)}</Text>
                  
                  {categoryProducts.map((product) => (
                    <TouchableOpacity
                      key={product.id}
                      style={[
                        styles.productCard,
                        !isOpen && styles.productCardDisabled
                      ]}
                      onPress={() => handleProductPress(product.id)}
                      activeOpacity={isOpen ? 0.8 : 1}
                    >
                      <Image
                        source={{ uri: product.image_url || 'https://via.placeholder.com/80' }}
                        style={[
                          styles.productImage,
                          !isOpen && styles.productImageDisabled
                        ]}
                        resizeMode="cover"
                      />
                      <View style={styles.productInfo}>
                        <Text style={[
                          styles.productName,
                          !isOpen && styles.productTextDisabled
                        ]}>
                          {product.name}
                        </Text>
                        <Text 
                          style={[
                            styles.productDescription, 
                            !isOpen && styles.productTextDisabled
                          ]} 
                          numberOfLines={2}
                        >
                          {getProductDescription(product)}
                        </Text>
                        <Text style={[
                          styles.productPrice,
                          !isOpen && styles.productTextDisabled
                        ]}>
                          {formatPrice(product.price)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    color: '#666',
  },
  backButton: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#FF6B6B',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  coverImage: {
    width: '100%',
    height: 200,
  },
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
  commerceInfo: {
    backgroundColor: '#FFF',
    marginTop: -20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
  },
  commerceName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  categoryBadge: {
    backgroundColor: '#FF6B6B15',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 12,
  },
  categoryText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '600',
  },
  description: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
  },
  locationButtonFull: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B6B',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
    marginTop: 16,
  },
  locationButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 16,
  },
  paymentSection: {
    backgroundColor: '#FFF',
    marginTop: 8,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  paymentMethodsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  paymentMethodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F0F9F0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  paymentMethodText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: '500',
  },
  productsSection: {
    padding: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  closedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF9800',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    gap: 4,
  },
  closedBadgeText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: '600',
  },
  closedWarning: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#FFF3E0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
    gap: 8,
  },
  closedWarningText: {
    flex: 1,
    fontSize: 14,
    color: '#E65100',
    lineHeight: 20,
  },
  categorySection: {
    marginBottom: 20,
  },
  categoryTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FF6B6B',
    marginBottom: 12,
    paddingBottom: 4,
    borderBottomWidth: 2,
    borderBottomColor: '#FF6B6B20',
  },
  emptyProducts: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  productCardDisabled: {
    opacity: 0.7,
    backgroundColor: '#F5F5F5',
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  productImageDisabled: {
    opacity: 0.5,
  },
  productInfo: {
    flex: 1,
    marginLeft: 12,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  productTextDisabled: {
    color: '#999',
  },
});