import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export interface Order {
  id: string;
  customer_id: string;
  motoboy_id?: string;
  pickup_address: string;
  delivery_address: string;
  distance_km: number;
  price: number;
  platform_fee: number;
  status: string;
  notes?: string;
  created_at: string;
  updated_at: string;
  motoboy?: {
    name: string;
    phone: string;
    vehicle_type: string;
  };
}

export function useOrders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchOrders = useCallback(async () => {
    if (!user) return;

    try {
      // 1. PRIMEIRO: Descobrir o ID interno da tabela clientes
      const { data: cliente, error: clientError } = await supabase
        .from('clientes')
        .select('id')
        .eq('user_id', user.id)
        .single();

      if (clientError || !cliente) {
        console.warn('Perfil de cliente não encontrado para este usuário.');
        setOrders([]);
        return;
      }

      // 2. SEGUNDO: Buscar os pedidos usando o ID correto (cliente.id)
      const { data, error } = await supabase
        .from('pedidos')
        .select(`
          *,
          motoboy:motoboys(name, phone, vehicle_type)
        `)
        .eq('customer_id', cliente.id) // O PULO DO GATO ESTÁ AQUI
        .order('created_at', { ascending: false });

      if (error) throw error;
      setOrders(data || []);
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const refreshOrders = async () => {
    setLoading(true);
    await fetchOrders();
  };

  useEffect(() => {
    fetchOrders();

    // 3. REALTIME: Escutar mudanças apenas para os pedidos deste cliente
    let subscription: any;

    const setupRealtime = async () => {
      // Precisamos do ID do cliente para o filtro do Realtime também
      const { data: cliente } = await supabase
        .from('clientes')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (cliente) {
        subscription = supabase
          .channel(`pedidos_customer_${cliente.id}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'pedidos',
              filter: `customer_id=eq.${cliente.id}`,
            },
            () => {
              fetchOrders();
            }
          )
          .subscribe();
      }
    };

    if (user) setupRealtime();

    return () => {
      if (subscription) subscription.unsubscribe();
    };
  }, [user, fetchOrders]);

  return {
    orders,
    loading,
    refreshOrders,
  };
}