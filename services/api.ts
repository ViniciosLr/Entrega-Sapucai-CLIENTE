// services/api.ts
import { supabase } from '../lib/supabase';

export interface Commerce {
  id: string;
  name: string;
  description: string;
  image_url: string;
  category: string;
  is_active: boolean;
  delivery_config: any;
  service_config: any;
  phone: string;
  address: string;
}

export interface Product {
  id: string;
  commerce_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  is_available: boolean;
  category_id: string;
  has_ingredients: boolean;
  commerce?: Commerce;
}

export interface PartnerBanner {
  id: string;
  title: string;
  image_url: string;
  target_url: string;
  is_active: boolean;
  sort_order: number;
}

export const api = {
  // Buscar comércios ativos
  async getActiveCommerces(): Promise<Commerce[]> {
    const { data, error } = await supabase
      .from('commerces')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Buscar produtos em destaque (últimos 10 produtos ativos)
  async getFeaturedProducts(limit: number = 10): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select(`
        *,
        commerce:commerces (
          id,
          name,
          image_url,
          category
        )
      `)
      .eq('is_available', true)
      .eq('commerces.is_active', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  // Buscar produtos por comércio
  async getProductsByCommerce(commerceId: string): Promise<Product[]> {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .eq('commerce_id', commerceId)
      .eq('is_available', true)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  // Buscar banners ativos dos parceiros
  async getActiveBanners(): Promise<PartnerBanner[]> {
    const now = new Date().toISOString();
    
    const { data, error } = await supabase
      .from('partner_banners')
      .select('*')
      .eq('is_active', true)
      .lte('start_at', now)
      .gte('end_at', now)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Buscar comércios por categoria
  async getCommercesByCategory(category: string): Promise<Commerce[]> {
    const { data, error } = await supabase
      .from('commerces')
      .select('*')
      .eq('is_active', true)
      .eq('category', category)
      .order('name', { ascending: true });

    if (error) throw error;
    return data || [];
  },

  // Buscar categorias únicas dos comércios
  async getUniqueCategories(): Promise<string[]> {
    const { data, error } = await supabase
      .from('commerces')
      .select('category')
      .eq('is_active', true)
      .not('category', 'is', null);

    if (error) throw error;
    
    const categories = [...new Set(data.map(item => item.category))];
    return categories;
  }
};