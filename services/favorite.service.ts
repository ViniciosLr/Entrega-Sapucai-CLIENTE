// services/favorite.service.ts
import { supabase } from '@/lib/supabase';

export interface FavoriteCommerce {
  id: string;
  commerce_id: string;
  commerce_name: string;
  commerce_image?: string;
  commerce_category?: string;
  commerce_address?: string;
  commerce_phone?: string;
  is_active: boolean;
  is_open?: boolean;
  created_at: string;
}

export const favoriteService = {
  /**
   * Busca os favoritos do cliente com dados do comércio
   */
  async getFavorites(userId: string): Promise<FavoriteCommerce[]> {
    // 1. Busca o customer_id
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (clienteError || !cliente) {
      console.error('Cliente não encontrado:', clienteError);
      return [];
    }

    // 2. Busca favoritos com JOIN nos comércios
    const { data, error } = await supabase
      .from('client_favorites')
      .select(`
        id,
        commerce_id,
        created_at,
        commerces!inner (
          id,
          name,
          phone,
          address,
          category,
          image_url,
          is_active,
          opening_time,
          closing_time
        )
      `)
      .eq('customer_id', cliente.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Erro ao buscar favoritos:', error);
      throw new Error('Não foi possível carregar os favoritos');
    }

    // 3. Formata os dados
    return (data || []).map((fav: any) => {
      const commerce = fav.commerces;
      const now = new Date();
      const currentHour = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTime = `${currentHour.toString().padStart(2, '0')}:${currentMinutes.toString().padStart(2, '0')}`;
      
      // Verifica se está aberto
      let isOpen = false;
      if (commerce.opening_time && commerce.closing_time) {
        isOpen = currentTime >= commerce.opening_time && currentTime <= commerce.closing_time;
      }

      return {
        id: fav.id,
        commerce_id: commerce.id,
        commerce_name: commerce.name,
        commerce_image: commerce.image_url,
        commerce_category: commerce.category,
        commerce_address: commerce.address,
        commerce_phone: commerce.phone,
        is_active: commerce.is_active,
        is_open: isOpen,
        created_at: fav.created_at,
      };
    });
  },

  /**
   * Adiciona um comércio aos favoritos
   */
  async addFavorite(userId: string, commerceId: string): Promise<void> {
    // Busca customer_id
    const { data: cliente, error: clienteError } = await supabase
      .from('clientes')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (clienteError || !cliente) {
      throw new Error('Cliente não encontrado');
    }

    const { error } = await supabase
      .from('client_favorites')
      .insert({
        customer_id: cliente.id,
        commerce_id: commerceId,
      });

    if (error) {
      // Se for erro de duplicata, ignora
      if (error.code === '23505') {
        console.log('Comércio já está nos favoritos');
        return;
      }
      console.error('Erro ao adicionar favorito:', error);
      throw new Error('Não foi possível adicionar aos favoritos');
    }
  },

  /**
   * Remove um comércio dos favoritos
   */
  async removeFavorite(favoriteId: string): Promise<void> {
    const { error } = await supabase
      .from('client_favorites')
      .delete()
      .eq('id', favoriteId);

    if (error) {
      console.error('Erro ao remover favorito:', error);
      throw new Error('Não foi possível remover dos favoritos');
    }
  },

  /**
   * Remove favorito pelo commerce_id
   */
  async removeFavoriteByCommerce(userId: string, commerceId: string): Promise<void> {
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!cliente) throw new Error('Cliente não encontrado');

    const { error } = await supabase
      .from('client_favorites')
      .delete()
      .eq('customer_id', cliente.id)
      .eq('commerce_id', commerceId);

    if (error) {
      console.error('Erro ao remover favorito:', error);
      throw new Error('Não foi possível remover dos favoritos');
    }
  },

  /**
   * Verifica se um comércio está nos favoritos
   */
  async isFavorite(userId: string, commerceId: string): Promise<boolean> {
    const { data: cliente } = await supabase
      .from('clientes')
      .select('id')
      .eq('user_id', userId)
      .single();

    if (!cliente) return false;

    const { data, error } = await supabase
      .from('client_favorites')
      .select('id')
      .eq('customer_id', cliente.id)
      .eq('commerce_id', commerceId)
      .single();

    return !!data;
  },

  /**
   * Busca todos os comércios disponíveis para favoritar
   */
  async getAvailableCommerces(userId: string): Promise<any[]> {
    const { data, error } = await supabase
      .from('commerces')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Erro ao buscar comércios:', error);
      throw new Error('Não foi possível carregar os comércios');
    }

    return data || [];
  },
};