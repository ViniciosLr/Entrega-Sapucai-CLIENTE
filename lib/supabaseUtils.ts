// lib/supabaseUtils.ts
import { supabase } from './supabase';

// Tipos comuns
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  success: boolean;
}

// Funções utilitárias
export const supabaseUtils = {
  
  // Função para buscar dados com tratamento de erro
  async fetchData<T>(table: string, query?: string) {
    try {
      let queryBuilder = supabase.from(table).select('*');
      
      if (query) {
        // Adicione lógica de filtro se necessário
      }
      
      const { data, error } = await queryBuilder;
      
      if (error) throw error;
      
      return {
        data: data as T,
        error: null,
        success: true
      };
    } catch (error: any) {
      console.error(`Erro ao buscar dados de ${table}:`, error);
      return {
        data: null,
        error: error.message || 'Erro desconhecido',
        success: false
      };
    }
  },
  
  // Função para inserir dados
  async insertData<T>(table: string, data: any) {
    try {
      const { data: result, error } = await supabase
        .from(table)
        .insert(data)
        .select()
        .single();
      
      if (error) throw error;
      
      return {
        data: result as T,
        error: null,
        success: true
      };
    } catch (error: any) {
      console.error(`Erro ao inserir dados em ${table}:`, error);
      return {
        data: null,
        error: error.message || 'Erro desconhecido',
        success: false
      };
    }
  },
  
  // Função para atualizar dados
  async updateData<T>(table: string, id: string, data: any) {
    try {
      const { data: result, error } = await supabase
        .from(table)
        .update(data)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      
      return {
        data: result as T,
        error: null,
        success: true
      };
    } catch (error: any) {
      console.error(`Erro ao atualizar dados em ${table}:`, error);
      return {
        data: null,
        error: error.message || 'Erro desconhecido',
        success: false
      };
    }
  },
  
  // Função para deletar dados
  async deleteData(table: string, id: string) {
    try {
      const { error } = await supabase
        .from(table)
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      
      return {
        data: null,
        error: null,
        success: true
      };
    } catch (error: any) {
      console.error(`Erro ao deletar dados de ${table}:`, error);
      return {
        data: null,
        error: error.message || 'Erro desconhecido',
        success: false
      };
    }
  },
  
  // Função para escutar mudanças em tempo real
  subscribeToTable(table: string, filter: string, callback: (payload: any) => void) {
    return supabase
      .channel(`public:${table}:${filter}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table,
          filter: filter ? `id=eq.${filter}` : undefined
        },
        callback
      )
      .subscribe();
  }
};