// hooks/useSupabase.ts
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export function useSupabase<T>(table: string, options?: {
  filter?: string;
  realtime?: boolean;
  limit?: number;
}) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      let query = supabase.from(table).select('*');
      
      if (options?.filter) {
        // Adicione filtros específicos aqui
      }
      
      if (options?.limit) {
        query = query.limit(options.limit);
      }
      
      const { data: result, error: fetchError } = await query;
      
      if (fetchError) throw fetchError;
      
      setData(result as T[]);
      setError(null);
    } catch (err: any) {
      setError(err.message);
      console.error(`Erro ao buscar dados de ${table}:`, err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    
    // Se realtime estiver ativado, escute mudanças
    if (options?.realtime) {
      const subscription = supabase
        .channel(`public:${table}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table
          },
          () => {
            fetchData(); // Re-fetch quando houver mudanças
          }
        )
        .subscribe();

      return () => {
        subscription.unsubscribe();
      };
    }
  }, [table, options?.filter]);

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    isEmpty: data.length === 0
  };
}