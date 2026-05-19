// app/products.tsx
import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';
import { useCart } from '@/contexts/CartContext';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  is_available: boolean;
  commerce_id: string;
  commerce?: {
    id: string;
    name: string;
    opening_time?: string;
    closing_time?: string;
    is_open?: boolean;
  };
}

interface ProductCategory {
  id: string;
  name: string;
}

/**
 * Função para verificar se um estabelecimento está aberto agora
 * Verifica o horário de abertura/fechamento baseado no dia da semana
 */
const isCommerceOpen = (
  opening_time?: string,
  closing_time?: string,
  commerceHours?: any[]
): boolean => {
  try {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = domingo, 6 = sábado
    const currentTime = now.getHours() * 60 + now.getMinutes(); // Converte para minutos

    // Se houver horários específicos por dia da semana
    if (commerceHours && commerceHours.length > 0) {
      const todayHours = commerceHours.find(
        (h) => h.day_of_week === dayOfWeek && !h.is_closed
      );

      if (!todayHours) {
        return false; // Fechado hoje ou é dia fechado
      }

      const [openHour, openMin] = todayHours.opening_time.split(':').map(Number);
      const [closeHour, closeMin] = todayHours.closing_time.split(':').map(Number);

      const openingMinutes = openHour * 60 + openMin;
      const closingMinutes = closeHour * 60 + closeMin;

      return currentTime >= openingMinutes && currentTime < closingMinutes;
    }

    // Fallback: usar opening_time e closing_time gerais
    if (opening_time && closing_time) {
      const [openHour, openMin] = opening_time.split(':').map(Number);
      const [closeHour, closeMin] = closing_time.split(':').map(Number);

      const openingMinutes = openHour * 60 + openMin;
      const closingMinutes = closeHour * 60 + closeMin;

      return currentTime >= openingMinutes && currentTime < closingMinutes;
    }

    return true; // Se não houver horário definido, considera aberto
  } catch (error) {
    console.warn('Erro ao verificar horário de funcionamento:', error);
    return true; // Em caso de erro, permite exibir
  }
};

/**
 * Formata o horário para exibição (HH:MM)
 */
const formatTime = (timeString?: string): string => {
  if (!timeString) return 'N/A';
  return timeString.slice(0, 5); // Pega apenas HH:MM
};

export default function ProductsScreen() {
  const router = useRouter();
  const { addToCart } = useCart();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [commerceHoursMap, setCommerceHoursMap] = useState<{
    [key: string]: any[];
  }>({});

  const loadProducts = async () => {
    try {
      // Buscar produtos disponíveis com dados do comércio
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`
          *,
          commerce:commerces (
            id, 
            name, 
            opening_time, 
            closing_time
          )
        `)
        .eq('is_available', true)
        .order('created_at', { ascending: false });

      if (productsError) throw productsError;

      // Buscar horários de funcionamento para cada comércio
      const commerceIds = [
        ...new Set((productsData || []).map((p) => p.commerce_id)),
      ];

      if (commerceIds.length > 0) {
        const { data: hoursData, error: hoursError } = await supabase
          .from('commerce_hours')
          .select('*')
          .in('commerce_id', commerceIds);

        if (!hoursError && hoursData) {
          const hoursMap: { [key: string]: any[] } = {};
          hoursData.forEach((hour) => {
            if (!hoursMap[hour.commerce_id]) {
              hoursMap[hour.commerce_id] = [];
            }
            hoursMap[hour.commerce_id].push(hour);
          });
          setCommerceHoursMap(hoursMap);
        }
      }

      // Adicionar informação se está aberto em cada produto
      const productsWithStatus = (productsData || []).map((product) => ({
        ...product,
        commerce: {
          ...product.commerce,
          is_open: isCommerceOpen(
            product.commerce?.opening_time,
            product.commerce?.closing_time,
            commerceHoursMap[product.commerce_id]
          ),
        },
      }));

      // Buscar categorias de produtos
      const { data: categoriesData, error: categoriesError } = await supabase
        .from('product_categories')
        .select('id, name')
        .eq('is_active', true)
        .order('name');

      if (categoriesError) console.warn('Erro ao carregar categorias:', categoriesError);

      setProducts(productsWithStatus);
      setCategories(categoriesData || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadProducts();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadProducts();
  }, []);

  const handleAddToCart = async (product: Product) => {
    try {
      // Verificar se o estabelecimento está aberto
      const isOpen = isCommerceOpen(
        product.commerce?.opening_time,
        product.commerce?.closing_time,
        commerceHoursMap[product.commerce_id]
      );

      if (!isOpen) {
        Alert.alert(
          '❌ Estabelecimento Fechado',
          `${product.commerce?.name || 'Este estabelecimento'} está fechado no momento. Horário de funcionamento: ${formatTime(product.commerce?.opening_time)} às ${formatTime(product.commerce?.closing_time)}`,
          [{ text: 'OK', style: 'cancel' }]
        );
        return;
      }

      await addToCart({
        product_id: product.id,
        name: product.name,
        price: product.price,
        quantity: 1,
        image_url: product.image_url,
        commerce_id: product.commerce_id,
        commerce_name: product.commerce?.name || '',
        observations: '',
      });

      Alert.alert('✅ Adicionado', `${product.name} foi adicionado ao carrinho!`, [
        { text: 'Continuar', style: 'cancel' },
        { text: 'Ver Carrinho', onPress: () => router.push('/cart') },
      ]);
    } catch (error) {
      console.error('Erro ao adicionar ao carrinho:', error);
      Alert.alert('Erro', 'Não foi possível adicionar o produto ao carrinho.');
    }
  };

  // FILTRO: Mostrar apenas produtos de estabelecimentos abertos
  const filteredProducts = products.filter((product) => {
    const isOpen = product.commerce?.is_open ?? true;
    
    // Se o estabelecimento está fechado, não mostrar o produto
    if (!isOpen) return false;

    const matchesSearch =
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (product.commerce?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory =
      selectedCategory === 'todos' ||
      (product as any).category_id === categories.find((c) => c.name === selectedCategory)?.id;
    
    return matchesSearch && matchesCategory;
  });

  const renderProductCard = ({ item }: { item: Product }) => {
    const isOpen = item.commerce?.is_open ?? true;

    return (
      <View style={styles.productCard}>
        <TouchableOpacity
          style={[styles.productContent, !isOpen && styles.productContentDisabled]}
          onPress={() => {
            if (isOpen) {
              router.push(`/product/${item.id}`);
            }
          }}
          activeOpacity={isOpen ? 0.8 : 1}
          disabled={!isOpen}
        >
          <Image
            source={{ uri: item.image_url || 'https://via.placeholder.com/150' }}
            style={[styles.productImage, !isOpen && styles.productImageDisabled]}
            resizeMode="cover"
          />
          <View style={styles.productInfo}>
            <Text style={styles.productName} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={styles.commerceName} numberOfLines={1}>
              {item.commerce?.name || 'Comércio'}
            </Text>

            {/* Mostrar status de abertura/fechamento */}
            <View style={styles.statusContainer}>
              <View style={[styles.statusBadge, isOpen ? styles.statusOpen : styles.statusClosed]}>
                <Ionicons
                  name={isOpen ? 'checkmark-circle' : 'close-circle'}
                  size={12}
                  color={isOpen ? '#4CAF50' : '#ff5252'}
                />
                <Text style={[styles.statusText, isOpen ? styles.statusTextOpen : styles.statusTextClosed]}>
                  {isOpen ? 'Aberto' : 'Fechado'}
                </Text>
              </View>
            </View>

            <Text style={styles.productPrice}>
              {new Intl.NumberFormat('pt-BR', {
                style: 'currency',
                currency: 'BRL',
              }).format(item.price)}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Botão de adicionar ao carrinho - desabilitado se fechado */}
        <TouchableOpacity
          style={[styles.addButton, !isOpen && styles.addButtonDisabled]}
          onPress={() => handleAddToCart(item)}
          disabled={!isOpen}
        >
          <Ionicons
            name="add-circle"
            size={28}
            color={isOpen ? '#ff5252' : '#ccc'}
          />
        </TouchableOpacity>
      </View>
    );
  };

  const renderCategoryChip = ({ item }: { item: ProductCategory | { id: string; name: string } }) => (
    <TouchableOpacity
      style={[styles.categoryChip, selectedCategory === item.name && styles.categoryChipActive]}
      onPress={() => setSelectedCategory(item.name)}
    >
      <Text
        style={[
          styles.categoryChipText,
          selectedCategory === item.name && styles.categoryChipTextActive,
        ]}
      >
        {item.name === 'todos' ? 'Todos' : item.name}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fb5252" />
        <Text style={styles.loadingText}>Carregando produtos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Todos os Produtos</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Busca e Filtros Integrados */}
      <View style={styles.filtersContainer}>
        {/* Barra de Busca */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar produto ou comércio..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={18} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        {/* Categorias em Scroll Horizontal */}
        {categories.length > 0 && (
          <View style={styles.categoriesRow}>
            <FlatList
              data={[{ id: 'todos', name: 'todos' }, ...categories]}
              renderItem={renderCategoryChip}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesListInline}
            />
          </View>
        )}
      </View>

      {/* Lista de Produtos - SEMPRE RENDERIZA O FLATLIST */}
      <FlatList
        key="product-list-2-columns"
        data={filteredProducts}
        renderItem={renderProductCard}
        keyExtractor={(item) => item.id}
        numColumns={2}
        columnWrapperStyle={styles.columnWrapper}
        contentContainerStyle={[
          styles.listContent,
          filteredProducts.length === 0 && styles.listContentEmpty,
        ]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="fast-food-outline" size={48} color="#CCC" />
            <Text style={styles.emptyStateText}>
              {searchQuery
                ? 'Nenhum produto encontrado'
                : 'Nenhum estabelecimento aberto no momento'}
            </Text>
            <Text style={styles.emptyStateSubtext}>
              Tente buscar ou retorne mais tarde
            </Text>
          </View>
        }
      />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 60,
    paddingBottom: 12,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },

  // Container de Filtros
  filtersContainer: {
    backgroundColor: '#FFF',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },

  // Barra de Busca
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 2,
    borderRadius: 10,
    height: 40,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    fontSize: 14,
    color: '#333',
  },

  // Linha de Categorias
  categoriesRow: {
    paddingBottom: 4,
  },

  // Lista de Categorias Inline
  categoriesListInline: {
    paddingHorizontal: 16,
    gap: 6,
  },

  // Chips de Categoria
  categoryChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#F5F5F5',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
  },
  categoryChipActive: {
    backgroundColor: '#d33c3c',
  },
  categoryChipText: {
    fontSize: 12,
    color: '#666',
    fontWeight: '500',
  },
  categoryChipTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },

  // Lista de Produtos
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  listContentEmpty: {
    flex: 1,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },

  // Cards de Produto
  productCard: {
    width: CARD_WIDTH,
    backgroundColor: '#FFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
  },
  productContent: {
    flex: 1,
    flexDirection: 'row',
  },
  productContentDisabled: {
    opacity: 0.6,
  },
  productImage: {
    width: 70,
    height: 70,
    borderRadius: 8,
  },
  productImageDisabled: {
    opacity: 0.5,
  },
  productInfo: {
    flex: 1,
    marginLeft: 8,
  },
  productName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 2,
  },
  commerceName: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
  },

  // Status Badge
  statusContainer: {
    marginBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  statusOpen: {
    backgroundColor: '#E8F5E9',
  },
  statusClosed: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: 10,
    fontWeight: '600',
    marginLeft: 4,
  },
  statusTextOpen: {
    color: '#4CAF50',
  },
  statusTextClosed: {
    color: '#ff5252',
  },

  productPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
  },

  // Botão Adicionar
  addButton: {
    padding: 8,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },

  // Estado Vazio
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '600',
    color: '#666',
    textAlign: 'center',
  },
  emptyStateSubtext: {
    marginTop: 6,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
});