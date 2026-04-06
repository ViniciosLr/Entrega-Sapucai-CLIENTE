import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

export interface ClientProfile {
  id: string;
  user_id: string;
  name: string;
  phone: string;
  address?: string | null;
  cpf?: string | null;
  city?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  expo_push_token?: string | null;
  total_orders?: number | null;
  is_blocked?: boolean | null;
  profile_image_url?: string | null;
  ban_reason?: string | null;
  banned_at?: string | null;
  banned_by?: string | null;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user?.id) {
      setProfile(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('clientes')
        .select(`
          id,
          user_id,
          name,
          phone,
          address,
          cpf,
          city,
          created_at,
          updated_at,
          expo_push_token,
          total_orders,
          is_blocked,
          profile_image_url,
          ban_reason,
          banned_at,
          banned_by
        `)
        .eq('user_id', user.id)
        .maybeSingle();

      if (error) throw error;

      console.log('PROFILE clientes:', data);
      setProfile(data ?? null);
    } catch (error) {
      console.error('Erro ao buscar perfil:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  const updateProfile = async (updates: Partial<ClientProfile>) => {
    if (!user?.id) {
      throw new Error('Usuário não autenticado');
    }

    try {
      const payload = {
        ...updates,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('clientes')
        .update(payload)
        .eq('user_id', user.id);

      if (error) throw error;

      await fetchProfile();
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      throw error;
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    loading,
    updateProfile,
    fetchProfile,
  };
}