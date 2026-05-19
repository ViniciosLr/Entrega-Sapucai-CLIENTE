// contexts/CartContext.tsx (CORRIGIDO - SEM DUPLICAÇÃO)
import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export interface CartItem {
  id: string;
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  image_url: string;
  commerce_id: string;
  commerce_name: string;
  observations?: string;
  total_price: number;
}

interface CartContextData {
  cartItems: CartItem[];
  addToCart: (item: Omit<CartItem, 'id' | 'total_price'>) => Promise<void>;
  removeFromCart: (productId: string) => Promise<void>;
  updateQuantity: (productId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  getCartTotal: () => number;
  getCartCount: () => number;
  getCurrentCommerce: () => { id: string; name: string } | null;
  hasDifferentCommerce: (commerceId: string) => boolean;
  loading: boolean;
}

const CartContext = createContext<CartContextData>({} as CartContextData);
const STORAGE_KEY = '@delivery_cart';
const SYNC_FLAG_KEY = '@cart_synced'; // 🔥 NOVO: flag para evitar dupla sincronização

export function useCart() {
  return useContext(CartContext);
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [customerId, setCustomerId] = useState<string | null>(null);
  
  // 🔥 NOVO: flags para controle de inicialização
  const isInitialized = useRef(false);
  const isSyncing = useRef(false);

  // 🔥 1. CARREGAR CARRINHO DO ARMAZENAMENTO LOCAL (APENAS UMA VEZ)
  useEffect(() => {
    if (!isInitialized.current) {
      loadCartFromStorage();
      isInitialized.current = true;
    }
  }, []);

  // 🔥 2. BUSCAR ID DO CLIENTE QUANDO USUÁRIO LOGAR
  useEffect(() => {
    async function fetchCustomerId() {
      if (!user?.id) {
        setCustomerId(null);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('clientes')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (error) {
        console.error('Erro ao buscar cliente:', error);
        setCustomerId(null);
      } else {
        setCustomerId(data.id);
        // 🔥 CORRIGIDO: Sincronizar apenas se ainda não foi sincronizado nesta sessão
        await syncLocalCartToServerOnce(data.id);
      }
      setLoading(false);
    }

    fetchCustomerId();
  }, [user]);

  // 🔥 3. CARREGAR DO BACKEND QUANDO CUSTOMER_ID MUDA (APENAS UMA VEZ)
  useEffect(() => {
    if (customerId && !isSyncing.current) {
      loadCartFromBackend();
    }
  }, [customerId]);

  // ============ FUNÇÕES DE ARMAZENAMENTO LOCAL ============
  
  const loadCartFromStorage = async () => {
    try {
      const storedCart = await AsyncStorage.getItem(STORAGE_KEY);
      if (storedCart) {
        const parsedCart = JSON.parse(storedCart);
        // 🔥 NOVO: Remover duplicatas antes de carregar
        const uniqueCart = removeDuplicates(parsedCart);
        setCartItems(uniqueCart);
        console.log('📦 Carrinho carregado do AsyncStorage:', uniqueCart.length, 'itens');
        
        // Se havia duplicatas, salvar versão limpa
        if (uniqueCart.length !== parsedCart.length) {
          await saveCartToStorage(uniqueCart);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar carrinho do storage:', error);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 NOVO: Função para remover itens duplicados
  const removeDuplicates = (items: CartItem[]): CartItem[] => {
    const uniqueMap = new Map<string, CartItem>();
    
    for (const item of items) {
      const existing = uniqueMap.get(item.product_id);
      if (existing) {
        // Soma as quantidades se for o mesmo produto
        const newQuantity = existing.quantity + item.quantity;
        uniqueMap.set(item.product_id, {
          ...existing,
          quantity: newQuantity,
          total_price: existing.price * newQuantity,
        });
        console.log(`🔧 Duplicata removida para ${item.name}: ${existing.quantity} + ${item.quantity} = ${newQuantity}`);
      } else {
        uniqueMap.set(item.product_id, item);
      }
    }
    
    return Array.from(uniqueMap.values());
  };

  const saveCartToStorage = async (items: CartItem[]) => {
    try {
      // 🔥 Garantir que não salvamos duplicatas
      const uniqueItems = removeDuplicates(items);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(uniqueItems));
      console.log('💾 Carrinho salvo no AsyncStorage:', uniqueItems.length, 'itens');
    } catch (error) {
      console.error('Erro ao salvar carrinho no storage:', error);
    }
  };

  // ============ FUNÇÕES DO BACKEND ============

  const loadCartFromBackend = async () => {
    if (!customerId) return;

    try {
      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          *,
          commerce:commerces (
            name
          )
        `)
        .eq('customer_id', customerId);

      if (error) throw error;

      const formattedItems: CartItem[] = (data || []).map(item => ({
        id: item.id,
        product_id: item.product_id,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        image_url: item.image_url || '',
        commerce_id: item.commerce_id,
        commerce_name: item.commerce?.name || '',
        observations: item.observations || '',
        total_price: item.price * item.quantity,
      }));

      // 🔥 Remover duplicatas também do backend
      const uniqueItems = removeDuplicates(formattedItems);
      setCartItems(uniqueItems);
      await saveCartToStorage(uniqueItems);
    } catch (error) {
      console.error('Erro ao carregar carrinho do backend:', error);
    }
  };

  // 🔥 CORRIGIDO: Sincronizar APENAS UMA VEZ
  const syncLocalCartToServerOnce = async (customerIdParam: string) => {
    // Verificar se já sincronizou nesta sessão
    const syncFlag = await AsyncStorage.getItem(`${SYNC_FLAG_KEY}_${customerIdParam}`);
    if (syncFlag === 'true') {
      console.log('⏭️ Carrinho já sincronizado anteriormente, ignorando...');
      return;
    }

    if (isSyncing.current) {
      console.log('⏭️ Sincronização em andamento, ignorando...');
      return;
    }

    isSyncing.current = true;
    
    // Aguardar o carrinho local carregar
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const localCart = cartItems;
    if (localCart.length === 0) {
      console.log('📭 Nenhum item local para sincronizar');
      isSyncing.current = false;
      return;
    }

    console.log('🔄 Sincronizando carrinho local com servidor...', localCart.length, 'itens');

    try {
      // 🔥 CORRIGIDO: Buscar todos os itens atuais do servidor de uma vez
      const { data: serverItems } = await supabase
        .from('cart_items')
        .select('product_id, quantity, id')
        .eq('customer_id', customerIdParam);

      const serverItemMap = new Map();
      serverItems?.forEach(item => {
        serverItemMap.set(item.product_id, item);
      });

      for (const item of localCart) {
        const existingItem = serverItemMap.get(item.product_id);

        if (existingItem) {
          // 🔥 CORRIGIDO: Atualizar sem duplicar
          console.log(`📝 Atualizando item existente: ${item.name} (qtd: ${existingItem.quantity} -> ${existingItem.quantity + item.quantity})`);
          await supabase
            .from('cart_items')
            .update({ 
              quantity: existingItem.quantity + item.quantity,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingItem.id);
        } else {
          // Inserir novo item
          console.log(`➕ Inserindo novo item: ${item.name}`);
          await supabase
            .from('cart_items')
            .insert({
              customer_id: customerIdParam,
              product_id: item.product_id,
              commerce_id: item.commerce_id,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              image_url: item.image_url,
              observations: item.observations || null,
            });
        }
      }
      
      // Marcar como sincronizado
      await AsyncStorage.setItem(`${SYNC_FLAG_KEY}_${customerIdParam}`, 'true');
      console.log('✅ Carrinho sincronizado com servidor!');
      
      // Recarregar do backend para garantir consistência
      await loadCartFromBackend();
    } catch (error) {
      console.error('Erro ao sincronizar carrinho:', error);
    } finally {
      isSyncing.current = false;
    }
  };

  // ============ CRUD DO CARRINHO ============

  const addToCart = async (item: Omit<CartItem, 'id' | 'total_price'>) => {
    try {
      // 🔥 CORRIGIDO: Verificar se o item já existe ANTES de adicionar
      const existingItem = cartItems.find(i => i.product_id === item.product_id);
      
      let updatedCart: CartItem[];
      
      if (existingItem) {
        // Atualizar quantidade do item existente
        updatedCart = cartItems.map(i =>
          i.product_id === item.product_id
            ? { 
                ...i, 
                quantity: i.quantity + item.quantity,
                total_price: i.price * (i.quantity + item.quantity)
              }
            : i
        );
        console.log(`📝 Atualizando item existente: ${item.name} (nova qtd: ${existingItem.quantity + item.quantity})`);
      } else {
        // Adicionar novo item
        const newItem: CartItem = {
          ...item,
          id: `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          total_price: item.price * item.quantity,
        };
        updatedCart = [...cartItems, newItem];
        console.log(`➕ Adicionando novo item: ${item.name}`);
      }

      // 🔥 Remover duplicatas antes de salvar
      const uniqueCart = removeDuplicates(updatedCart);
      
      setCartItems(uniqueCart);
      await saveCartToStorage(uniqueCart);

      // Se estiver logado, salvar no backend
      if (customerId) {
        const { data: existingBackend } = await supabase
          .from('cart_items')
          .select('id, quantity')
          .eq('customer_id', customerId)
          .eq('product_id', item.product_id)
          .single();

        if (existingBackend) {
          await supabase
            .from('cart_items')
            .update({ 
              quantity: existingBackend.quantity + item.quantity,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingBackend.id);
        } else {
          await supabase
            .from('cart_items')
            .insert({
              customer_id: customerId,
              product_id: item.product_id,
              commerce_id: item.commerce_id,
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              image_url: item.image_url,
              observations: item.observations || null,
            });
        }
        
        // Recarregar para garantir consistência (sem duplicar)
        await loadCartFromBackend();
      }

      console.log('✅ Item adicionado ao carrinho:', item.name);
    } catch (error) {
      console.error('Erro ao adicionar ao carrinho:', error);
      throw error;
    }
  };

  const removeFromCart = async (productId: string) => {
    try {
      const updatedCart = cartItems.filter(item => item.product_id !== productId);
      
      setCartItems(updatedCart);
      await saveCartToStorage(updatedCart);

      if (customerId) {
        const itemToRemove = cartItems.find(i => i.product_id === productId);
        if (itemToRemove && !itemToRemove.id.startsWith('local_')) {
          await supabase
            .from('cart_items')
            .delete()
            .eq('id', itemToRemove.id);
        }
        
        await loadCartFromBackend();
      }
    } catch (error) {
      console.error('Erro ao remover do carrinho:', error);
    }
  };

  const updateQuantity = async (productId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeFromCart(productId);
      return;
    }

    try {
      const updatedCart = cartItems.map(item =>
        item.product_id === productId
          ? { ...item, quantity, total_price: item.price * quantity }
          : item
      );
      
      setCartItems(updatedCart);
      await saveCartToStorage(updatedCart);

      if (customerId) {
        const itemToUpdate = cartItems.find(i => i.product_id === productId);
        if (itemToUpdate && !itemToUpdate.id.startsWith('local_')) {
          await supabase
            .from('cart_items')
            .update({ quantity, updated_at: new Date().toISOString() })
            .eq('id', itemToUpdate.id);
        }
        
        await loadCartFromBackend();
      }
    } catch (error) {
      console.error('Erro ao atualizar quantidade:', error);
    }
  };

  const clearCart = async () => {
    try {
      setCartItems([]);
      await saveCartToStorage([]);

      if (customerId) {
        await supabase
          .from('cart_items')
          .delete()
          .eq('customer_id', customerId);
      }
      
      // 🔥 Resetar flag de sincronização
      if (customerId) {
        await AsyncStorage.removeItem(`${SYNC_FLAG_KEY}_${customerId}`);
      }
    } catch (error) {
      console.error('Erro ao limpar carrinho:', error);
    }
  };

  // ============ FUNÇÕES AUXILIARES ============

  const getCartTotal = () => {
    return cartItems.reduce((total, item) => total + item.total_price, 0);
  };

  const getCartCount = () => {
    return cartItems.reduce((count, item) => count + item.quantity, 0);
  };

  const getCurrentCommerce = () => {
    if (cartItems.length === 0) return null;
    const firstItem = cartItems[0];
    return {
      id: firstItem.commerce_id,
      name: firstItem.commerce_name,
    };
  };

  const hasDifferentCommerce = (commerceId: string) => {
    if (cartItems.length === 0) return false;
    return cartItems.some(item => item.commerce_id !== commerceId);
  };

  return (
    <CartContext.Provider
      value={{
        cartItems,
        addToCart,
        removeFromCart,
        updateQuantity,
        clearCart,
        getCartTotal,
        getCartCount,
        getCurrentCommerce,
        hasDifferentCommerce,
        loading,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}