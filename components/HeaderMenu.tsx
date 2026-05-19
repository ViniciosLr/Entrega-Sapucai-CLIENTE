// components/HeaderMenu.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TouchableWithoutFeedback,
  Dimensions,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, usePathname } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');

interface HeaderMenuProps {
  userName?: string;
  userEmail?: string;
  userAvatar?: string;
}

export function HeaderMenu({ userName, userEmail, userAvatar }: HeaderMenuProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, user } = useAuth();
  const isLoggedIn = !!session && !!user;
  const [menuVisible, setMenuVisible] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [clienteNome, setClienteNome] = useState<string>('');
  const [loadingProfile, setLoadingProfile] = useState(true);

  // Menu DINÂMICO baseado no login
  const getMenuItems = () => {
    const baseItems = [
      { icon: 'home-outline', title: 'Início', route: '/(tabs)' },
    ];
    
    // Itens que só aparecem se estiver LOGADO
    if (isLoggedIn) {
      baseItems.push(
        { icon: 'time-outline', title: 'Histórico', route: '/(tabs)/history' },
        { icon: 'heart-outline', title: 'Favoritos', route: '/favorites' },
        { icon: 'card-outline', title: 'Formas de Pagamento', route: '/payments' },
        { icon: 'chatbubble-outline', title: 'Suporte', route: '/(tabs)/support' },
        { icon: 'person-outline', title: 'Meu Perfil', route: '/(tabs)/profile' }
      );
    } else {
      // Item de login para usuários não logados
      baseItems.push(
        { icon: 'log-in-outline', title: 'Fazer Login', route: '/auth/login' }
      );
    }
    
    return baseItems;
  };

  // Buscar foto e nome do cliente (só se estiver logado)
  useEffect(() => {
    const fetchClienteProfile = async () => {
      if (!isLoggedIn || !user?.id) {
        setLoadingProfile(false);
        return;
      }

      try {
        const { data: cliente, error } = await supabase
          .from('clientes')
          .select('name, profile_image_url')
          .eq('user_id', user.id)
          .single();

        if (error) {
          console.error('Erro ao buscar perfil do cliente:', error);
          setClienteNome(userName || user?.user_metadata?.name || 'Cliente');
          setAvatarUrl(userAvatar || user?.user_metadata?.avatar_url || null);
          return;
        }

        if (cliente) {
          setClienteNome(cliente.name || userName || user?.user_metadata?.name || 'Cliente');
          
          if (cliente.profile_image_url) {
            setAvatarUrl(cliente.profile_image_url);
          } else {
            setAvatarUrl(userAvatar || user?.user_metadata?.avatar_url || null);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar dados do cliente:', error);
        setClienteNome(userName || user?.user_metadata?.name || 'Cliente');
        setAvatarUrl(userAvatar || user?.user_metadata?.avatar_url || null);
      } finally {
        setLoadingProfile(false);
      }
    };

    fetchClienteProfile();
  }, [isLoggedIn, user?.id, userName, userAvatar]);

  const handleNavigate = (route: string) => {
    setMenuVisible(false);
    router.push(route as any);
  };

  const handleLogout = async () => {
    setMenuVisible(false);
    try {
      await supabase.auth.signOut();
      router.replace('/auth/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
      Alert.alert('Erro', 'Não foi possível sair da conta');
    }
  };

  const isActive = (route: string) => {
    return pathname === route || pathname.startsWith(route);
  };

  const profileImageUrl = avatarUrl || 'https://via.placeholder.com/80';

  return (
    <>
      <TouchableOpacity style={styles.menuButton} onPress={() => setMenuVisible(true)}>
        <Ionicons name="menu-outline" size={28} color="#FFF" />
      </TouchableOpacity>

      <Modal
        visible={menuVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setMenuVisible(false)}
      >
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
            <View style={styles.backdrop} />
          </TouchableWithoutFeedback>
          
          <View style={styles.drawerContainer}>
            <TouchableOpacity style={styles.closeButton} onPress={() => setMenuVisible(false)}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>

            {/* Header do menu - só mostra foto se estiver logado */}
            <View style={styles.drawerHeader}>
              {isLoggedIn ? (
                loadingProfile ? (
                  <View style={styles.avatarLoading}>
                    <ActivityIndicator color="#FFF" size="small" />
                  </View>
                ) : (
                  <Image
                    source={{ uri: profileImageUrl }}
                    style={styles.avatar}
                    onError={() => setAvatarUrl(null)}
                  />
                )
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Ionicons name="person-outline" size={40} color="#FFF" />
                </View>
              )}
              
              <Text style={styles.userName} numberOfLines={1}>
                {isLoggedIn 
                  ? (loadingProfile ? 'Carregando...' : clienteNome)
                  : 'Bem-vindo!'}
              </Text>
              
              {isLoggedIn && (
                <Text style={styles.userEmail} numberOfLines={1}>
                  {userEmail || user?.email || ''}
                </Text>
              )}
            </View>

            {/* Menu DINÂMICO */}
            <ScrollView style={styles.menuContainer} showsVerticalScrollIndicator={false}>
              {getMenuItems().map((item, index) => (
                <TouchableOpacity
                  key={index}
                  style={[styles.menuItem, isActive(item.route) && styles.menuItemActive]}
                  onPress={() => handleNavigate(item.route)}
                >
                  <Ionicons 
                    name={item.icon as any} 
                    size={22} 
                    color={isActive(item.route) ? '#FF6B6B' : '#666'} 
                  />
                  <Text style={[styles.menuItemText, isActive(item.route) && styles.menuItemTextActive]}>
                    {item.title}
                  </Text>
                  <Ionicons name="chevron-forward-outline" size={18} color="#CCC" />
                </TouchableOpacity>
              ))}
            </ScrollView>

            {/* Footer - só mostra logout se estiver logado */}
            <View style={styles.drawerFooter}>
              {isLoggedIn ? (
                <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
                  <Ionicons name="log-out-outline" size={22} color="#DC2626" />
                  <Text style={styles.logoutText}>Sair da Conta</Text>
                </TouchableOpacity>
              ) : (
                <Text style={styles.guestText}>
                  Faça login para acessar histórico, favoritos e mais!
                </Text>
              )}
              <Text style={styles.versionText}>Versão 5.05.19</Text>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  menuButton: {
    padding: 4,
  },
  overlay: {
    flex: 1,
    flexDirection: 'row',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  drawerContainer: {
    width: width * 0.8,
    backgroundColor: '#FFF',
    height: '100%',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  drawerHeader: {
    backgroundColor: '#FF6B6B',
    paddingTop: 60,
    paddingBottom: 30,
    paddingHorizontal: 20,
    alignItems: 'center',
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#FFF',
    marginBottom: 12,
    backgroundColor: '#E0E0E0',
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#FFF',
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLoading: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#FFF',
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 4,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  userEmail: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  menuContainer: {
    flex: 1,
    paddingTop: 16,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  menuItemActive: {
    backgroundColor: '#FFF0F0',
  },
  menuItemText: {
    flex: 1,
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
  menuItemTextActive: {
    color: '#FF6B6B',
    fontWeight: '600',
  },
  drawerFooter: {
    padding: 20,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  logoutText: {
    fontSize: 16,
    color: '#DC2626',
    fontWeight: '600',
  },
  guestText: {
    textAlign: 'center',
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
    fontStyle: 'italic',
  },
  versionText: {
    textAlign: 'center',
    fontSize: 12,
    color: '#CCC',
    marginTop: 12,
  },
});