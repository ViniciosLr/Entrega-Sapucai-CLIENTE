// app/favorites.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StatusBar,
  Image,
  RefreshControl,
  Modal,
  TextInput,
  FlatList,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { HeaderMenu } from '@/components/HeaderMenu';
import { favoriteService, FavoriteCommerce } from '@/services/favorite.service';

const CATEGORY_ICONS: Record<string, string> = {
  diversos: 'grid-outline',
  restaurante: 'restaurant-outline',
  lanchonete: 'fast-food-outline',
  pizzaria: 'pizza-outline',
  mercado: 'cart-outline',
  farmacia: 'medkit-outline',
  padaria: 'cafe-outline',
  acougue: 'nutrition-outline',
  hortifruti: 'leaf-outline',
  bebidas: 'wine-outline',
  pet: 'paw-outline',
};

// Funções auxiliares
function capitalizeFirst(text: string): string {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function getCategoryColor(category?: string): string {
  const colors: Record<string, string> = {
    restaurante: '#EF4444',
    lanchonete: '#F59E0B',
    pizzaria: '#DC2626',
    mercado: '#10B981',
    farmacia: '#3B82F6',
    padaria: '#D97706',
    acougue: '#EF4444',
    hortifruti: '#059669',
    bebidas: '#8B5CF6',
    pet: '#EC4899',
    diversos: '#6B7280',
  };
  return colors[category || ''] || colors.diversos;
}

function getCategoryIcon(category?: string): string {
  return CATEGORY_ICONS[category || ''] || CATEGORY_ICONS.diversos;
}

export default function FavoritesScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [favorites, setFavorites] = useState<FavoriteCommerce[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchVisible, setSearchVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [availableCommerces, setAvailableCommerces] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [savingFavorite, setSavingFavorite] = useState<string | null>(null);

  // Carregar favoritos
  const loadFavorites = async () => {
    try {
      if (!user?.id) {
        setFavorites([]);
        return;
      }

      const data = await favoriteService.getFavorites(user.id);
      setFavorites(data);
    } catch (error) {
      console.error('Erro ao carregar favoritos:', error);
      Alert.alert('Erro', 'Não foi possível carregar seus favoritos');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadFavorites();
  }, [user?.id]);

  // Pull to refresh
  const onRefresh = () => {
    setRefreshing(true);
    loadFavorites();
  };

  // Remover favorito
  const handleRemoveFavorite = (
    favoriteId: string,
    commerceName: string
  ) => {
    Alert.alert(
      'Remover Favorito',
      `Deseja remover "${commerceName}" dos favoritos?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Remover',
          style: 'destructive',
          onPress: async () => {
            try {
              await favoriteService.removeFavorite(favoriteId);

              setFavorites(prev =>
                prev.filter(f => f.id !== favoriteId)
              );

              Alert.alert(
                'Removido',
                'Estabelecimento removido dos favoritos'
              );
            } catch (error) {
              Alert.alert(
                'Erro',
                'Falha ao remover favorito'
              );
            }
          },
        },
      ]
    );
  };

  // Abrir busca de comércios
  const handleOpenSearch = async () => {
    setSearchVisible(true);
    setSearching(true);

    try {
      const commerces =
        await favoriteService.getAvailableCommerces(
          user?.id || ''
        );

      setAvailableCommerces(commerces);
    } catch (error) {
      Alert.alert(
        'Erro',
        'Não foi possível carregar os comércios'
      );
    } finally {
      setSearching(false);
    }
  };

  // Adicionar favorito
  const handleAddFavorite = async (commerce: any) => {
    if (!user?.id) return;

    setSavingFavorite(commerce.id);

    try {
      const alreadyFavorite = favorites.some(
        f => f.commerce_id === commerce.id
      );

      if (alreadyFavorite) {
        Alert.alert(
          'Atenção',
          'Este estabelecimento já está nos seus favoritos'
        );
        return;
      }

      await favoriteService.addFavorite(
        user.id,
        commerce.id
      );

      const newFavorite: FavoriteCommerce = {
        id: Date.now().toString(),
        commerce_id: commerce.id,
        commerce_name: commerce.name,
        commerce_image: commerce.image_url,
        commerce_category: commerce.category,
        commerce_address: commerce.address,
        commerce_phone: commerce.phone,
        is_active: commerce.is_active,
        created_at: new Date().toISOString(),
      };

      setFavorites(prev => [newFavorite, ...prev]);

      Alert.alert(
        'Adicionado',
        `${commerce.name} foi adicionado aos favoritos!`
      );
    } catch (error: any) {
      Alert.alert(
        'Erro',
        error.message || 'Falha ao adicionar favorito'
      );
    } finally {
      setSavingFavorite(null);
    }
  };

  // Navegar para comércio
  const handleNavigateToCommerce = (
    commerceId: string
  ) => {
    router.push(`/commerce/${commerceId}` as any);
  };

  // Filtrar comércios
  const filteredCommerces =
    availableCommerces.filter(
      commerce =>
        commerce.name
          .toLowerCase()
          .includes(searchText.toLowerCase()) ||
        commerce.category
          ?.toLowerCase()
          .includes(searchText.toLowerCase())
    );

  const renderFavoriteCard = (
    favorite: FavoriteCommerce
  ) => (
    <View key={favorite.id} style={styles.card}>
      <TouchableOpacity
        style={styles.cardContent}
        onPress={() =>
          handleNavigateToCommerce(
            favorite.commerce_id
          )
        }
        activeOpacity={0.7}
      >
        <View style={styles.imageContainer}>
          {favorite.commerce_image ? (
            <Image
              source={{
                uri: favorite.commerce_image,
              }}
              style={styles.commerceImage}
              resizeMode="cover"
            />
          ) : (
            <View
              style={[
                styles.imagePlaceholder,
                {
                  backgroundColor:
                    getCategoryColor(
                      favorite.commerce_category
                    ),
                },
              ]}
            >
              <Ionicons
                name={getCategoryIcon(
                  favorite.commerce_category
                )}
                size={32}
                color="#FFF"
              />
            </View>
          )}

          {favorite.is_active && (
            <View
              style={[
                styles.statusBadge,
                favorite.is_open
                  ? styles.openBadge
                  : styles.closedBadge,
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  favorite.is_open
                    ? styles.openDot
                    : styles.closedDot,
                ]}
              />

              <Text style={styles.statusText}>
                {favorite.is_open
                  ? 'Aberto'
                  : 'Fechado'}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.cardInfo}>
          <Text
            style={styles.commerceName}
            numberOfLines={1}
          >
            {favorite.commerce_name}
          </Text>

          {favorite.commerce_category && (
            <View style={styles.categoryRow}>
              <Ionicons
                name={getCategoryIcon(
                  favorite.commerce_category
                )}
                size={14}
                color="#888"
              />

              <Text style={styles.categoryText}>
                {capitalizeFirst(
                  favorite.commerce_category
                )}
              </Text>
            </View>
          )}

          {favorite.commerce_address && (
            <View style={styles.infoRow}>
              <Ionicons
                name="location-outline"
                size={14}
                color="#AAA"
              />

              <Text
                style={styles.infoText}
                numberOfLines={1}
              >
                {favorite.commerce_address}
              </Text>
            </View>
          )}
        </View>
      </TouchableOpacity>

      <View style={styles.cardActions}>
        <TouchableOpacity
          style={styles.removeButton}
          onPress={() =>
            handleRemoveFavorite(
              favorite.id,
              favorite.commerce_name
            )
          }
        >
          <Ionicons
            name="heart-dislike-outline"
            size={20}
            color="#DC2626"
          />

          <Text style={styles.removeText}>
            Remover
          </Text>
        </TouchableOpacity>

        <Ionicons
          name="chevron-forward"
          size={20}
          color="#CCC"
        />
      </View>
    </View>
  );

  const renderCommerceItem = ({
    item,
  }: {
    item: any;
  }) => {
    const isAlreadyFav = favorites.some(
      f => f.commerce_id === item.id
    );

    const isLoading =
      savingFavorite === item.id;

    return (
      <View style={styles.searchItem}>
        <View style={styles.searchItemInfo}>
          <View
            style={[
              styles.searchItemIcon,
              {
                backgroundColor:
                  getCategoryColor(item.category),
              },
            ]}
          >
            <Ionicons
              name={getCategoryIcon(item.category)}
              size={20}
              color="#FFF"
            />
          </View>

          <View style={styles.searchItemText}>
            <Text
              style={styles.searchItemName}
              numberOfLines={1}
            >
              {item.name}
            </Text>

            <Text
              style={styles.searchItemCategory}
            >
              {item.category || 'Diversos'}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.addButton,
            isAlreadyFav &&
              styles.addedButton,
          ]}
          onPress={() =>
            !isAlreadyFav &&
            handleAddFavorite(item)
          }
          disabled={
            isAlreadyFav || isLoading
          }
        >
          {isLoading ? (
            <ActivityIndicator
              size="small"
              color="#FFF"
            />
          ) : (
            <Ionicons
              name={
                isAlreadyFav
                  ? 'heart'
                  : 'heart-outline'
              }
              size={20}
              color={
                isAlreadyFav
                  ? '#FF6B6B'
                  : '#FFF'
              }
            />
          )}
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
      edges={['top', 'bottom']}
    >
      <StatusBar
        barStyle="light-content"
        backgroundColor="#FF6B6B"
      />

      {/* Header */}
      <View style={styles.header}>
        <HeaderMenu />

        <Text style={styles.headerTitle}>
          Favoritos
        </Text>

        <TouchableOpacity
          style={styles.addHeaderButton}
          onPress={handleOpenSearch}
        >
          <Ionicons
            name="add-circle-outline"
            size={28}
            color="#FFF"
          />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={
          styles.contentContainer
        }
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={['#FF6B6B']}
          />
        }
      >
        <Text style={styles.sectionTitle}>
          Estabelecimentos Favoritos
        </Text>

        <Text style={styles.sectionSubtitle}>
          Seus comércios favoritos para acesso
          rápido
        </Text>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator
              size="large"
              color="#FF6B6B"
            />

            <Text style={styles.loadingText}>
              Carregando favoritos...
            </Text>
          </View>
        ) : favorites.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons
              name="heart-outline"
              size={80}
              color="#DDD"
            />

            <Text style={styles.emptyTitle}>
              Nenhum favorito ainda
            </Text>

            <Text
              style={
                styles.emptyDescription
              }
            >
              Adicione seus estabelecimentos
              favoritos para acessá-los
              rapidamente
            </Text>

            <TouchableOpacity
              style={styles.exploreButton}
              onPress={handleOpenSearch}
            >
              <Ionicons
                name="search-outline"
                size={20}
                color="#FFF"
              />

              <Text
                style={
                  styles.exploreButtonText
                }
              >
                Explorar Comércios
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.favoritesList}>
            {favorites.map(favorite =>
              renderFavoriteCard(favorite)
            )}
          </View>
        )}
      </ScrollView>

      {/* Modal */}
      <Modal
        visible={searchVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() =>
          setSearchVisible(false)
        }
      >
        <SafeAreaView
          style={styles.modalSafeArea}
          edges={['top', 'bottom']}
        >
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() =>
                setSearchVisible(false)
              }
            >
              <Ionicons
                name="close"
                size={28}
                color="#333"
              />
            </TouchableOpacity>

            <Text style={styles.modalTitle}>
              Adicionar Favorito
            </Text>

            <View style={{ width: 28 }} />
          </View>

          <View style={styles.searchContainer}>
            <Ionicons
              name="search-outline"
              size={20}
              color="#999"
            />

            <TextInput
              style={styles.searchInput}
              placeholder="Buscar comércio por nome ou categoria..."
              value={searchText}
              onChangeText={setSearchText}
              placeholderTextColor="#999"
              autoFocus
            />

            {searchText.length > 0 && (
              <TouchableOpacity
                onPress={() =>
                  setSearchText('')
                }
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color="#CCC"
                />
              </TouchableOpacity>
            )}
          </View>

          {searching ? (
            <View style={styles.centered}>
              <ActivityIndicator
                size="large"
                color="#FF6B6B"
              />

              <Text style={styles.loadingText}>
                Buscando comércios...
              </Text>
            </View>
          ) : (
            <FlatList
              data={filteredCommerces}
              keyExtractor={item => item.id}
              renderItem={renderCommerceItem}
              contentContainerStyle={
                styles.searchList
              }
              showsVerticalScrollIndicator={
                false
              }
              ListEmptyComponent={
                <View
                  style={styles.emptySearch}
                >
                  <Ionicons
                    name="business-outline"
                    size={48}
                    color="#DDD"
                  />

                  <Text
                    style={
                      styles.emptySearchText
                    }
                  >
                    {searchText.length > 0
                      ? 'Nenhum comércio encontrado'
                      : 'Nenhum comércio disponível'}
                  </Text>
                </View>
              }
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F9F9F9',
  },

  header: {
    backgroundColor: '#FF6B6B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 14,
    paddingTop: Platform.OS === 'android' ? 8 : 12,
  },

  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },

  addHeaderButton: {
    padding: 4,
  },

  content: {
    flex: 1,
  },

  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },

  sectionTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 4,
  },

  sectionSubtitle: {
    fontSize: 14,
    color: '#888',
    marginBottom: 20,
  },

  centered: {
    alignItems: 'center',
    marginTop: 60,
  },

  loadingText: {
    marginTop: 12,
    color: '#888',
    fontSize: 14,
  },

  emptyState: {
    alignItems: 'center',
    marginTop: 60,
  },

  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#555',
    marginTop: 16,
  },

  emptyDescription: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
    paddingHorizontal: 40,
    lineHeight: 20,
  },

  exploreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FF6B6B',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 25,
    marginTop: 24,
    gap: 8,
  },

  exploreButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },

  favoritesList: {
    gap: 12,
  },

  card: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    padding: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },

  cardContent: {
    flexDirection: 'row',
    gap: 12,
  },

  imageContainer: {
    position: 'relative',
    width: 80,
    height: 80,
  },

  commerceImage: {
    width: 80,
    height: 80,
    borderRadius: 12,
  },

  imagePlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  statusBadge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
    gap: 4,
  },

  openBadge: {
    backgroundColor: '#DCFCE7',
  },

  closedBadge: {
    backgroundColor: '#FEE2E2',
  },

  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },

  openDot: {
    backgroundColor: '#10B981',
  },

  closedDot: {
    backgroundColor: '#EF4444',
  },

  statusText: {
    fontSize: 10,
    fontWeight: '600',
  },

  cardInfo: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },

  commerceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },

  categoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  categoryText: {
    fontSize: 12,
    color: '#888',
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },

  infoText: {
    fontSize: 12,
    color: '#AAA',
    flex: 1,
  },

  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },

  removeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },

  removeText: {
    fontSize: 13,
    color: '#DC2626',
    fontWeight: '500',
  },

  modalSafeArea: {
    flex: 1,
    backgroundColor: '#FFF',
  },

  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },

  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 20,
    paddingHorizontal: 16,
    backgroundColor: '#F9F9F9',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    gap: 10,
  },

  searchInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: '#333',
  },

  searchList: {
    paddingHorizontal: 20,
    paddingBottom: 40,
  },

  searchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },

  searchItemInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },

  searchItemIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },

  searchItemText: {
    flex: 1,
  },

  searchItemName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },

  searchItemCategory: {
    fontSize: 13,
    color: '#888',
  },

  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B6B',
    justifyContent: 'center',
    alignItems: 'center',
  },

  addedButton: {
    backgroundColor: '#FFF',
    borderWidth: 2,
    borderColor: '#FF6B6B',
  },

  emptySearch: {
    alignItems: 'center',
    marginTop: 60,
  },

  emptySearchText: {
    fontSize: 16,
    color: '#999',
    marginTop: 12,
    textAlign: 'center',
  },
});