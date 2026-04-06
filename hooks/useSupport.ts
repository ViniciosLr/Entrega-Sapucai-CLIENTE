import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

// Tipos baseados nas tabelas novas
export interface SupportMessage {
  id: string;
  chamado_id: string;
  user_id: string;
  mensagem: string;
  lido: boolean;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  cliente_id: string;
  pedido_id?: string;
  status: 'pendente' | 'ativo' | 'resolvido';
  created_at: string;
  updated_at: string;
}

export function useSupport() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [currentTicket, setCurrentTicket] = useState<SupportTicket | null>(null);
  const [loading, setLoading] = useState(true);

  // Helper para saber o status atual facilmente na UI
  const ticketStatus = currentTicket ? currentTicket.status : null;

  // Busca o chamado atual (Aberto ou Pendente)
  const fetchCurrentTicket = useCallback(async (pedidoId?: string) => {
    if (!user) return;
    
    try {
      setLoading(true);
      // Busca o chamado mais recente que NÃO esteja resolvido
      let query = supabase
        .from('suporte_chamados')
        .select('*')
        .eq('cliente_id', user.id)
        .neq('status', 'resolvido') 
        .order('created_at', { ascending: false })
        .limit(1);

      if (pedidoId) {
        query = query.eq('pedido_id', pedidoId);
      }

      const { data, error } = await query.single();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao buscar chamado:', error);
      }

      if (data) {
        setCurrentTicket(data);
        await fetchMessages(data.id);
      } else {
        setCurrentTicket(null);
        setMessages([]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  // Busca mensagens de um chamado específico
  const fetchMessages = async (ticketId: string) => {
    const { data, error } = await supabase
      .from('suporte_mensagens')
      .select('*')
      .eq('chamado_id', ticketId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Erro ao buscar mensagens:', error);
      return;
    }
    setMessages(data || []);
  };

  // 1. Função para CRIAR o chamado (Botão Criar)
  const createTicket = async (pedidoId?: string) => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('suporte_chamados')
        .insert({
          cliente_id: user.id,
          pedido_id: pedidoId || null,
          status: 'pendente', // CORRIGIDO: Agora nasce como 'pendente'
        })
        .select()
        .single();

      if (error) throw error;
      
      setCurrentTicket(data);
      return data;
    } catch (error) {
      console.error('Erro ao criar chamado:', error);
      throw error;
    }
  };

  // 2. Função para ENVIAR mensagem (Só funciona se status == ativo)
  const sendMessage = async (texto: string, pedidoId?: string) => {
    if (!user || !currentTicket) return;

    // Dupla verificação de segurança
    if (currentTicket.status !== 'ativo') {
      console.warn('Tentativa de enviar mensagem em chamado não ativo');
      return;
    }

    try {
      const { error } = await supabase
        .from('suporte_mensagens')
        .insert({
          chamado_id: currentTicket.id,
          user_id: user.id,
          mensagem: texto,
          lido: false,
        });

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      throw error;
    }
  };

  // Setup do Realtime
  useEffect(() => {
    if (!user) return;

    fetchCurrentTicket(); 

    const ticketSubscription = supabase
      .channel('public:suporte_chamados')
      .on(
        'postgres_changes',
        {
          event: '*', 
          schema: 'public',
          table: 'suporte_chamados',
          filter: `cliente_id=eq.${user.id}`,
        },
        (payload) => {
          if (payload.eventType === 'UPDATE' && currentTicket?.id === payload.new.id) {
             setCurrentTicket(payload.new as SupportTicket);
          }
          if (payload.eventType === 'INSERT') {
             setCurrentTicket(payload.new as SupportTicket);
          }
        }
      )
      .subscribe();

    const messageSubscription = supabase
      .channel('public:suporte_mensagens')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'suporte_mensagens',
          filter: currentTicket ? `chamado_id=eq.${currentTicket.id}` : undefined, 
        },
        (payload) => {
          const newMessage = payload.new as SupportMessage;
          if (currentTicket && newMessage.chamado_id === currentTicket.id) {
            setMessages((prev) => [...prev, newMessage]);
          }
        }
      )
      .subscribe();

    return () => {
      ticketSubscription.unsubscribe();
      messageSubscription.unsubscribe();
    };
  }, [user, currentTicket?.id]); 

  return {
    messages,
    currentTicket,
    ticketStatus,
    loading,
    createTicket,
    sendMessage,
    refresh: fetchCurrentTicket
  };
}