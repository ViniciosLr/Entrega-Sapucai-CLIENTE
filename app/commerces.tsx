// app/commerces.tsx
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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2; // 2 colunas com margens

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

export default function CommercesScreen() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [commerces, setCommerces] = useState<Commerce[]>([]);
  const [hoursByCommerce, setHoursByCommerce] = useState<Record<string, CommerceHour[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('todos');
  const [onlyOpen, setOnlyOpen] = useState(false);
  const [categories, setCategories] = useState<string[]>([]);

  const loadCommerces = async () => {
    try {
      const { data: commercesData, error: commercesError } = await supabase
        .from('commerces')
        .select('id, name, description, image_url, category, is_active, phone, address, opening_time, closing_time')
        .eq('is_active', true)
        .order('name');

      if (commercesError) throw commercesError;

      const commerceIds = (commercesData || []).map((c) => c.id);
      let hoursMap: Record<string, CommerceHour[]> = {};

      if (commerceIds.length > 0) {
        const { data: hoursData, error: hoursError } = await supabase
          .from('commerce_hours')
          .select('commerce_id, day_of_week, opening_time, closing_time, is_closed')
          .in('commerce_id', commerceIds);

        if (!hoursError && hoursData) {
          hoursData.forEach((h: CommerceHour) => {
            if (!hoursMap[h.commerce_id]) hoursMap[h.commerce_id] = [];
            hoursMap[h.commerce_id].push(h);
          });
        }
      }

      const uniqueCategories = commercesData
        ? [...new Set(commercesData.map((item) => item.category).filter(Boolean))]
        : [];

      setCommerces(commercesData || []);
      setHoursByCommerce(hoursMap);
      setCategories(['todos', ...uniqueCategories]);
    } catch (error) {
      console.error('Erro ao carregar comércios:', error);
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCommerces();
    setRefreshing(false);
  }, []);

  useEffect(() => {
    loadCommerces();
  }, []);

  const filteredCommerces = commerces.filter((commerce) => {
    const matchesCategory = selectedCategory === 'todos' || commerce.category === selectedCategory;
    const matchesSearch =
      commerce.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (commerce.description && commerce.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesOpen = !onlyOpen || checkIsOpen(commerce, hoursByCommerce);
    return matchesCategory && matchesSearch && matchesOpen;
  });

  const openCount = commerces.filter((c) => checkIsOpen(c, hoursByCommerce)).length;

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

  const renderCategoryChip = ({ item }: { item: string }) => (
    <TouchableOpacity
      style={[styles.categoryChip, selectedCategory === item && styles.categoryChipActive]}
      onPress={() => setSelectedCategory(item)}
    >
      <Text
        style={[styles.categoryChipText, selectedCategory === item && styles.categoryChipTextActive]}
      >
        {item === 'todos' ? 'Todos' : item.charAt(0).toUpperCase() + item.slice(1)}
      </Text>
    </TouchableOpacity>
  );

  if (loading) {
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
      
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Todos os Comércios</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Busca e Filtros Integrados */}
      <View style={styles.filtersContainer}>
        {/* Barra de Busca */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={18} color="#999" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Buscar comércio..."
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

        {/* Linha de Filtros */}
        <View style={styles.filterRow}>
          {/* Filtro Aberto Agora */}
          <TouchableOpacity
            style={[styles.filterChip, onlyOpen && styles.filterChipActive]}
            onPress={() => setOnlyOpen(!onlyOpen)}
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

          {/* Categorias em Scroll Horizontal */}
          {categories.length > 1 && (
            <FlatList
              data={categories}
              renderItem={renderCategoryChip}
              keyExtractor={(item) => item}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.categoriesListInline}
            />
          )}
        </View>
      </View>

      {/* Lista de Comércios */}
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
        </View>
      ) : (
        <FlatList
          data={filteredCommerces}
          renderItem={renderCommerceCard}
          keyExtractor={(item) => item.id}
          numColumns={2}
          columnWrapperStyle={styles.columnWrapper}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          showsVerticalScrollIndicator={false}
        />
      )}
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
  
  // Container de Filtros Redesenhado
  filtersContainer: {
    backgroundColor: '#FFF',
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: 4,
  },
  
  // Barra de Busca Mais Compacta
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
  
  // Linha de Filtros
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
    gap: 8,
  },
  
  // Chip de Filtro Aberto Agora
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 5,
    height: 32,
  },
  filterChipActive: {
    backgroundColor: '#ECFDF5',
    borderColor: '#059669',
  },
  filterDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#D1D5DB',
  },
  filterDotActive: {
    backgroundColor: '#059669',
  },
  filterChipText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#059669',
    fontWeight: '600',
  },
  filterBadge: {
    backgroundColor: '#059669',
    borderRadius: 8,
    minWidth: 18,
    height: 18,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '700',
  },
  
  // Categorias em Linha (junto com os filtros)
  categoriesListInline: {
    paddingRight: 16,
    gap: 6,
  },
  
  // Chips de Categoria Redesenhados
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
  
  // Lista de Comércios
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 20,
  },
  columnWrapper: {
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  
  // Cards de Comércio
  commerceCard: {
    width: CARD_WIDTH,
    backgroundColor: '#FFF',
    borderRadius: 12,
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
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyStateText: {
    marginTop: 12,
    fontSize: 14,
    color: '#999',
    textAlign: 'center',
  },
});