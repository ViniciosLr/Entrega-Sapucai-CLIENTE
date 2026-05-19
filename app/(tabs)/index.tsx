// app/(tabs)/index.tsx
import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  FlatList,
  Dimensions,
  Alert,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/contexts/CartContext';

const { width } = Dimensions.get('window');

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface Commerce {
  id: string;
  name: string;
  description: string;
  image_url: string;
  category: string;
  is_active: boolean;
  phone: string;
  address: string;
  opening_time?: string | null;
  closing_time?: string | null;
}

interface CommerceHour {
  commerce_id: string;
  day_of_week: number;
  opening_time: string | null;
  closing_time: string | null;
  is_closed: boolean;
}

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
  };
}

interface Banner {
  id: string;
  title: string;
  image_url: string;
  target_url: string;
  is_active: boolean;
  sort_order: number;
  badge_text?: string | null;
  badge_color?: string | null;
  subtitle?: string | null;
  cta_text?: string | null;
}

// ─── Utilitários ──────────────────────────────────────────────────────────────

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

function checkIsOpen(
  commerce: Commerce,
  hoursByCommerce: Record<string, CommerceHour[]>,
): boolean {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const hours = hoursByCommerce[commerce.id];

  if (hours && hours.length > 0) {
    const todayHours = hours.find((h) => h.day_of_week === dayOfWeek);
    if (todayHours) {
      if (todayHours.is_closed) return false;
      if (!todayHours.opening_time || !todayHours.closing_time) return true;
      return (
        currentMinutes >= timeToMinutes(todayHours.opening_time) &&
        currentMinutes < timeToMinutes(todayHours.closing_time)
      );
    }
  }

  if (commerce.opening_time && commerce.closing_time) {
    return (
      currentMinutes >= timeToMinutes(commerce.opening_time) &&
      currentMinutes < timeToMinutes(commerce.closing_time)
    );
  }

  return true;
}

// ─── Componente BannerCarousel ─────────────────────────────────────────────────

interface BannerCarouselProps {
  banners: Banner[];
}

function BannerCarousel({ banners }: BannerCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (banners.length <= 1) return;
    const interval = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % banners.length;
        flatListRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 4000);
    return () => clearInterval(interval);
  }, [banners.length]);

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / (width - 32));
    setActiveIndex(index);
  };

  const getBadgeStyle = (badge?: string | null, color?: string | null) => {
    if (!badge) return null;
    const lower = badge.toLowerCase();
    let bg = color || '#FF3B30';
    if (!color) {
      if (lower.includes('cupom') || lower.includes('desconto')) bg = '#FF6B00';
      else if (lower.includes('cashback')) bg = '#34C759';
      else if (lower.includes('frete')) bg = '#007AFF';
      else if (lower.includes('novo') || lower.includes('nova')) bg = '#AF52DE';
    }
    return bg;
  };

  const renderBannerItem = ({ item }: { item: Banner }) => {
    const badgeColor = getBadgeStyle(item.badge_text, item.badge_color);

    return (
      <TouchableOpacity
        style={bannerStyles.card}
        activeOpacity={0.95}
        onPress={() => item.target_url && console.log('Abrir banner:', item.target_url)}
      >
        <Image
          source={{ uri: item.image_url || 'https://via.placeholder.com/600x220' }}
          style={bannerStyles.image}
          resizeMode="cover"
        />
        <LinearGradient
          colors={['rgba(0,0,0,0.05)', 'rgba(0,0,0,0.72)']}
          locations={[0.2, 1]}
          style={bannerStyles.overlay}
        />
        {item.badge_text && badgeColor && (
          <View style={[bannerStyles.badge, { backgroundColor: badgeColor }]}>
            <Text style={bannerStyles.badgeText}>{item.badge_text.toUpperCase()}</Text>
          </View>
        )}
        <View style={bannerStyles.content}>
          {item.subtitle ? (
            <Text style={bannerStyles.subtitle} numberOfLines={1}>
              {item.subtitle}
            </Text>
          ) : null}
          <Text style={bannerStyles.title} numberOfLines={2}>
            {item.title}
          </Text>
          {item.cta_text ? (
            <View style={bannerStyles.ctaButton}>
              <Text style={bannerStyles.ctaText}>{item.cta_text}</Text>
              <Ionicons name="arrow-forward" size={13} color="#FFF" style={{ marginLeft: 4 }} />
            </View>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  if (banners.length === 0) return null;

  return (
    <View style={bannerStyles.wrapper}>
      <FlatList
        ref={flatListRef}
        data={banners}
        renderItem={renderBannerItem}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={width - 32}
        snapToAlignment="start"
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={bannerStyles.list}
        getItemLayout={(_, index) => ({
          length: width - 32,
          offset: (width - 32) * index,
          index,
        })}
      />
      {banners.length > 1 && (
        <View style={bannerStyles.dotsRow}>
          {banners.map((_, i) => (
            <View
              key={i}
              style={[
                bannerStyles.dot,
                i === activeIndex ? bannerStyles.dotActive : bannerStyles.dotInactive,
              ]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const bannerStyles = StyleSheet.create({
  wrapper: { marginBottom: 8 },
  list: { paddingHorizontal: 16, gap: 0 },
  card: {
    width: width - 32,
    height: 180,
    borderRadius: 18,
    overflow: 'hidden',
    marginRight: 0,
    backgroundColor: '#1A1A2E',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 8,
  },
  image: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  overlay: { ...StyleSheet.absoluteFillObject },
  badge: {
    position: 'absolute',
    top: 14,
    left: 14,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 20,
  },
  badgeText: { color: '#FFF', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  content: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 16 },
  subtitle: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 3,
    letterSpacing: 0.3,
  },
  title: {
    color: '#FFF',
    fontSize: 20,
    fontWeight: '800',
    lineHeight: 24,
    letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.22)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  ctaText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  dotsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    gap: 5,
  },
  dot: { height: 6, borderRadius: 3 },
  dotActive: { width: 20, backgroundColor: '#FF3B30' },
  dotInactive: { width: 6, backgroundColor: '#D1D5DB' },
});

// ─── Tela Home ─────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { addToCart, getCartCount, loading: cartLoading } = useCart();
  const cartCount = getCartCount();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allCommerces, setAllCommerces] = useState<Commerce[]>([]);
  const [hoursByCommerce, setHoursByCommerce] = useState<Record<string, CommerceHour[]>>({});
  const [featuredProducts, setFeaturedProducts] = useState<Product[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [onlyOpen, setOnlyOpen] = useState(false);

  const loadData = async () => {
    try {
      const { data: commercesData, error: commercesError } = await supabase
        .from('commerces')
        .select(
          'id, name, description, image_url, category, is_active, phone, address, opening_time, closing_time',
        )
        .eq('is_active', true)
        .order('name', { ascending: true });

      if (commercesError) throw commercesError;

      const commerceIds = (commercesData || []).map((c) => c.id);
      let hoursMap: Record<string, CommerceHour[]> = {};

      if (commerceIds.length > 0) {
        const { data: hoursData, error: hoursError } = await supabase
          .from('commerce_hours')
          .select('commerce_id, day_of_week, opening_time, closing_time, is_closed')
          .in('commerce_id', commerceIds);

        if (hoursError) {
          console.warn('Erro ao buscar horários:', hoursError);
        } else {
          (hoursData || []).forEach((h: CommerceHour) => {
            if (!hoursMap[h.commerce_id]) hoursMap[h.commerce_id] = [];
            hoursMap[h.commerce_id].push(h);
          });
        }
      }

      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select(`*, commerce:commerces (id, name, opening_time, closing_time)`)
        .eq('is_available', true)
        .order('created_at', { ascending: false })
        .limit(12);

      if (productsError) throw productsError;

      const now = new Date().toISOString();
      const { data: bannersData, error: bannersError } = await supabase
        .from('partner_banners')
        .select('id, title, image_url, target_url, is_active, sort_order, badge_text, badge_color, subtitle, cta_text')
        .eq('is_active', true)
        .lte('start_at', now)
        .gte('end_at', now)
        .order('sort_order', { ascending: true });

      if (bannersError) throw bannersError;

      const uniqueCategories = commercesData
        ? [...new Set(commercesData.map((item) => item.category).filter(Boolean))]
        : [];

      setAllCommerces(commercesData || []);
      setHoursByCommerce(hoursMap);
      setFeaturedProducts(productsData || []);
      setBanners(bannersData || []);
      setCategories(['todos', ...uniqueCategories]);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadData();
  }, []);

  const filteredCommerces = allCommerces.filter((commerce) => {
    const matchesCategory =
      selectedCategory === 'todos' || commerce.category === selectedCategory;
    const matchesSearch =
      commerce.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (commerce.description &&
        commerce.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesOpen = !onlyOpen || checkIsOpen(commerce, hoursByCommerce);
    return matchesCategory && matchesSearch && matchesOpen;
  });

  // Produtos filtrados pela busca
  const filteredProducts = useMemo(() => {
    if (!searchQuery) return featuredProducts;
    const query = searchQuery.toLowerCase();
    return featuredProducts.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        (p.description && p.description.toLowerCase().includes(query)) ||
        (p.commerce?.name && p.commerce.name.toLowerCase().includes(query))
    );
  }, [featuredProducts, searchQuery]);

  const openCount = allCommerces.filter((c) => checkIsOpen(c, hoursByCommerce)).length;

  const isProductCommerceOpen = (product: Product): boolean => {
    const commerce = allCommerces.find((c) => c.id === product.commerce_id);
    if (!commerce) {
      if (product.commerce) {
        const productCommerce: Commerce = {
          id: product.commerce.id,
          name: product.commerce.name,
          description: '',
          image_url: '',
          category: '',
          is_active: true,
          phone: '',
          address: '',
          opening_time: null,
          closing_time: null,
        };
        return checkIsOpen(productCommerce, hoursByCommerce);
      }
      return true;
    }
    return checkIsOpen(commerce, hoursByCommerce);
  };

  const handleProductPress = (product: Product) => {
    if (!isProductCommerceOpen(product)) {
      Alert.alert(
        'Estabelecimento fechado',
        `"${product.commerce?.name || 'Este estabelecimento'}" está fechado no momento. Não é possível visualizar o produto.`,
        [{ text: 'Entendi' }],
      );
      return;
    }
    router.push(`/product/${product.id}`);
  };

  const handleAddToCart = async (product: Product) => {
    if (!isProductCommerceOpen(product)) {
      Alert.alert(
        'Estabelecimento fechado',
        `"${product.commerce?.name || 'Este estabelecimento'}" está fechado no momento. Não é possível adicionar itens ao carrinho.`,
        [{ text: 'Entendi' }],
      );
      return;
    }

    try {
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
      Alert.alert('Erro', 'Não foi possível adicionar o produto ao carrinho. Tente novamente.');
    }
  };

  const renderCommerceCard = ({ item }: { item: Commerce }) => {
    const isOpen = checkIsOpen(item, hoursByCommerce);
    return (
      <TouchableOpacity
        style={[styles.commerceCard, !isOpen && styles.commerceCardClosed]}
        onPress={() => router.push(`/commerce/${item.id}`)}
        activeOpacity={0.8}
      >
        <Image
          source={{ uri: item.image_url || 'https://via.placeholder.com/150' }}
          style={[styles.commerceImage, !isOpen && styles.commerceImageClosed]}
          resizeMode="cover"
        />
        <View style={styles.commerceBadge}>
          <Text style={styles.commerceCategory}>{item.category}</Text>
        </View>
        <View style={[styles.statusBadge, isOpen ? styles.statusBadgeOpen : styles.statusBadgeClosed]}>
          <View style={[styles.statusDot, isOpen ? styles.statusDotOpen : styles.statusDotClosed]} />
          <Text style={styles.statusBadgeText}>{isOpen ? 'Aberto' : 'Fechado'}</Text>
        </View>
        <View style={styles.commerceInfo}>
          <Text style={[styles.commerceName, !isOpen && styles.commerceNameClosed]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.commerceDescription} numberOfLines={2}>
            {item.description || 'Clique para ver o cardápio'}
          </Text>
          <View style={styles.commerceFooter}>
            <Ionicons name="star" size={14} color="#FFB800" />
            <Text style={styles.commerceRating}>4.5</Text>
            <Text style={styles.commerceTime}> • 30-45min</Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  const renderProductCard = ({ item }: { item: Product }) => {
    const isCommerceOpen = isProductCommerceOpen(item);

    return (
      <View style={[styles.productCard, !isCommerceOpen && styles.productCardDisabled]}>
        <TouchableOpacity
          style={styles.productContent}
          onPress={() => handleProductPress(item)}
          activeOpacity={isCommerceOpen ? 0.8 : 1}
          disabled={!isCommerceOpen}
        >
          <Image
            source={{ uri: item.image_url || 'https://via.placeholder.com/150' }}
            style={[styles.productImage, !isCommerceOpen && styles.productImageDisabled]}
            resizeMode="cover"
          />
          <View style={styles.productInfo}>
            <Text style={[styles.productName, !isCommerceOpen && styles.productTextDisabled]} numberOfLines={2}>
              {item.name}
            </Text>
            <Text style={[styles.commerceNameSmall, !isCommerceOpen && styles.productTextDisabled]} numberOfLines={1}>
              {item.commerce?.name || 'Comércio'}
              {!isCommerceOpen && ' • Fechado'}
            </Text>
            <Text style={[styles.productPrice, !isCommerceOpen && styles.productTextDisabled]}>
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
            </Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.addButton, !isCommerceOpen && styles.addButtonDisabled]}
          onPress={() => handleAddToCart(item)}
          disabled={!isCommerceOpen}
        >
          <Ionicons
            name={isCommerceOpen ? 'add-circle' : 'lock-closed'}
            size={28}
            color={isCommerceOpen ? '#ff5252' : '#CCC'}
          />
        </TouchableOpacity>
      </View>
    );
  };

  const renderCategory = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={[styles.categoryChip, selectedCategory === item && styles.categoryChipActive]}
      onPress={() => setSelectedCategory(item)}
    >
      <Text style={[styles.categoryChipText, selectedCategory === item && styles.categoryChipTextActive]}>
        {item === 'todos' ? 'Todos' : item.charAt(0).toUpperCase() + item.slice(1)}
      </Text>
    </TouchableOpacity>
  );

  if (loading || cartLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#fb5252" />
        <Text style={styles.loadingText}>Carregando comércios...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Busca */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar comércio ou produto..."
            placeholderTextColor="#999"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#999" />
            </TouchableOpacity>
          )}
        </View>

        {/* Filtro "Aberto agora" – mantido mesmo durante a busca */}
        <View style={styles.filterRow}>
          <TouchableOpacity
            style={[styles.filterChip, onlyOpen && styles.filterChipActive]}
            onPress={() => setOnlyOpen((prev) => !prev)}
            activeOpacity={0.8}
          >
            <View style={[styles.filterDot, onlyOpen && styles.filterDotActive]} />
            <Text style={[styles.filterChipText, onlyOpen && styles.filterChipTextActive]}>
              Aberto agora
            </Text>
            {onlyOpen && (
              <View style={styles.filterBadge}>
                <Text style={styles.filterBadgeText}>{openCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Banners e categorias só aparecem sem busca */}
        {searchQuery === '' && (
          <>
            {banners.length > 0 && (
              <View style={styles.bannersSection}>
                <BannerCarousel banners={banners} />
              </View>
            )}
            {categories.length > 1 && (
              <View style={styles.categoriesSection}>
                <FlatList
                  data={categories}
                  renderItem={renderCategory}
                  keyExtractor={(item) => item}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.categoriesList}
                />
              </View>
            )}
          </>
        )}

        {/* ── COMÉRCIOS (sempre visível, já filtrado) ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {onlyOpen ? 'Abertos agora' : searchQuery ? 'Resultados' : 'Comércios'}
            </Text>
            {searchQuery === '' && (
              <TouchableOpacity onPress={() => router.push('/commerces')}>
                <Text style={styles.seeAllButton}>Ver todos</Text>
              </TouchableOpacity>
            )}
          </View>

          {filteredCommerces.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="storefront-outline" size={48} color="#CCC" />
              <Text style={styles.emptyStateText}>
                {searchQuery
                  ? 'Nenhum comércio encontrado'
                  : onlyOpen
                  ? 'Nenhum comércio aberto agora'
                  : 'Nenhum comércio disponível'}
              </Text>
              {!searchQuery && onlyOpen && (
                <Text style={styles.emptyStateSubText}>
                  Desative o filtro para ver todos os comércios
                </Text>
              )}
            </View>
          ) : (
            <FlatList
              data={filteredCommerces}
              renderItem={renderCommerceCard}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={
                searchQuery === '' ? styles.commercesList : styles.searchResultsList
              }
            />
          )}
        </View>

        {/* ── PRODUTOS (sempre visível, filtrado) ── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {searchQuery ? 'Produtos encontrados' : 'Produtos em Destaque'}
            </Text>
            {searchQuery === '' && (
              <TouchableOpacity onPress={() => router.push('/products')}>
                <Text style={styles.seeAllButton}>Ver todos</Text>
              </TouchableOpacity>
            )}
          </View>

          {filteredProducts.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="fast-food-outline" size={48} color="#CCC" />
              <Text style={styles.emptyStateText}>
                {searchQuery ? 'Nenhum produto encontrado' : 'Nenhum produto em destaque'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredProducts}
              renderItem={renderProductCard}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={
                searchQuery === '' ? styles.productsList : styles.searchResultsList
              }
            />
          )}
        </View>

        <View style={styles.bottomSpacing} />
      </ScrollView>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 20,
    marginTop: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#333',
  },
  filterRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  filterChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  filterDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#D1D5DB',
  },
  filterDotActive: {
    backgroundColor: '#059669',
  },
  filterChipText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#059669',
    fontWeight: '700',
  },
  filterBadge: {
    backgroundColor: '#059669',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  filterBadgeText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: '700',
  },
  bannersSection: {
    marginBottom: 20,
  },
  categoriesSection: {
    marginBottom: 24,
  },
  categoriesList: {
    paddingHorizontal: 20,
  },
  categoryChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#FFF',
    borderRadius: 20,
    marginRight: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  categoryChipActive: {
    backgroundColor: '#d33c3c',
  },
  categoryChipText: {
    fontSize: 14,
    color: '#666',
  },
  categoryChipTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  seeAllButton: {
    fontSize: 14,
    color: '#b04646',
    fontWeight: '600',
  },
  commercesList: {
    paddingLeft: 20,
  },
  commerceCard: {
    width: width * 0.43,
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginRight: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'hidden',
  },
  commerceCardClosed: {
    opacity: 0.65,
  },
  commerceImage: {
    width: '100%',
    height: 120,
  },
  commerceImageClosed: {
    opacity: 0.7,
  },
  commerceBadge: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  commerceCategory: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
  },
  statusBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statusBadgeOpen: {
    backgroundColor: 'rgba(5, 150, 105, 0.9)',
  },
  statusBadgeClosed: {
    backgroundColor: 'rgba(100, 100, 100, 0.85)',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusDotOpen: {
    backgroundColor: '#6EE7B7',
  },
  statusDotClosed: {
    backgroundColor: '#D1D5DB',
  },
  statusBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  commerceInfo: {
    padding: 10,
  },
  commerceName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },
  commerceNameClosed: {
    color: '#999',
  },
  commerceDescription: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  commerceFooter: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  commerceRating: {
    fontSize: 12,
    color: '#666',
    marginLeft: 4,
  },
  commerceTime: {
    fontSize: 12,
    color: '#999',
  },
  productsList: {
    paddingLeft: 20,
  },
  productCard: {
    width: width * 0.45,
    backgroundColor: '#FFF',
    borderRadius: 12,
    marginRight: 12,
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
  productCardDisabled: {
    opacity: 0.7,
    backgroundColor: '#F5F5F5',
  },
  productContent: {
    flex: 1,
    flexDirection: 'row',
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
  commerceNameSmall: {
    fontSize: 11,
    color: '#999',
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4CAF50',
  },
  productTextDisabled: {
    color: '#999',
  },
  addButton: {
    padding: 8,
  },
  addButtonDisabled: {
    opacity: 0.5,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
  emptyStateSubText: {
    marginTop: 6,
    fontSize: 12,
    color: '#BBB',
    textAlign: 'center',
  },
  searchResultsList: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  bottomSpacing: {
    height: 20,
  },
});