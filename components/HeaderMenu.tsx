// components/HeaderMenu.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, StyleSheet, Pressable, Alert } from 'react-native';
import { 
  Menu, 
  LogOut, 
  Package, 
  History, 
  MessageCircle, 
  User 
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router'; // 👈 Importante para navegar

export function HeaderMenu() {
  const [visible, setVisible] = useState(false);
  const insets = useSafeAreaInsets();
  const router = useRouter(); // 👈 Hook de navegação

  const toggleMenu = () => setVisible(!visible);

  const handleNavigate = (route: string) => {
    setVisible(false);
    // @ts-ignore - Ignora erro de tipagem se a rota for string pura
    router.push(route); 
  };

  const handleLogout = () => {
    setVisible(false);
    Alert.alert('Sair', 'Você clicou em sair.');
    // Adicione sua lógica de logout aqui
  };

  return (
    <View style={{ marginRight: 16 }}>
      {/* Botão Hambúrguer */}
      <TouchableOpacity onPress={toggleMenu} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
        <Menu color="#1F2937" size={24} />
      </TouchableOpacity>

      <Modal
        transparent={true}
        visible={visible}
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setVisible(false)}>
          
          {/* Menu Dropdown */}
          <View style={[styles.menuContainer, { top: insets.top + 40 }]}>
            
            {/* Opção: Pedidos (Index) */}
            <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigate('/')}>
              <Package size={20} color="#4B5563" style={{ marginRight: 12 }} />
              <Text style={styles.menuText}>Pedidos</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Opção: Histórico */}
            <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigate('/history')}>
              <History size={20} color="#4B5563" style={{ marginRight: 12 }} />
              <Text style={styles.menuText}>Histórico</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Opção: Suporte */}
            <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigate('/support')}>
              <MessageCircle size={20} color="#4B5563" style={{ marginRight: 12 }} />
              <Text style={styles.menuText}>Suporte</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Opção: Perfil */}
            <TouchableOpacity style={styles.menuItem} onPress={() => handleNavigate('/profile')}>
              <User size={20} color="#4B5563" style={{ marginRight: 12 }} />
              <Text style={styles.menuText}>Perfil</Text>
            </TouchableOpacity>

            <View style={styles.divider} />

            {/* Opção: Sair */}
            <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
              <LogOut size={20} color="#EF4444" style={{ marginRight: 12 }} />
              <Text style={[styles.menuText, { color: '#EF4444' }]}>Sair</Text>
            </TouchableOpacity>

          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  menuContainer: {
    position: 'absolute',
    right: 16,
    backgroundColor: 'white',
    borderRadius: 12,
    paddingVertical: 8,
    minWidth: 200, // Aumentei um pouco a largura
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14, // Aumentei um pouco o touch area
    paddingHorizontal: 16,
  },
  menuText: {
    fontSize: 16,
    color: '#374151',
    fontWeight: '500',
  },
  divider: {
    height: 1,
    backgroundColor: '#F3F4F6',
    marginHorizontal: 16,
  }
});