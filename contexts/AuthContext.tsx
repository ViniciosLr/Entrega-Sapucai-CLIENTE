import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { registerForPushNotifications } from '@/lib/push';

type ClienteRow = {
  id: string;
  user_id: string | null;
  name: string;
  phone: string;
  address: string;
  cpf?: string | null;
  expo_push_token?: string | null;
  created_at?: string;
  updated_at?: string;
  is_blocked?: boolean;
  ban_reason?: string | null;
  banned_at?: string | null;
  banned_by?: string | null;
  total_orders?: number;
  city?: string | null;
  profile_image_url?: string | null;
};

interface AuthContextType {
  session: Session | null;
  user: User | null;
  cliente: ClienteRow | null;
  loading: boolean;

  signUp: (email: string, password: string, metadata?: any) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<void>;

  refreshCliente: () => Promise<void>;
  updateCliente: (updates: Partial<ClienteRow>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [cliente, setCliente] = useState<ClienteRow | null>(null);
  const [loading, setLoading] = useState(true);

  // ===============================
  // 🔔 Push Token
  // ===============================
  const syncPushToken = async (userId: string) => {
    try {
      const { data: sessionData, error: sessionError } =
        await supabase.auth.getSession();

      if (sessionError) {
        console.error('Erro ao obter sessão antes de salvar push token:', sessionError);
        return;
      }

      const sessionUser = sessionData?.session?.user;

      if (!sessionUser) {
        console.log('Sem sessão válida para sincronizar push token');
        return;
      }

      if (sessionUser.id !== userId) {
        console.log('Usuário da sessão diferente do userId recebido');
        return;
      }

      const token = await registerForPushNotifications();

      if (!token) {
        console.log('Push token não gerado');
        return;
      }

      const { data: clienteRow, error: clienteError } = await supabase
        .from('clientes')
        .select('id, expo_push_token')
        .eq('user_id', userId)
        .maybeSingle();

      if (clienteError) {
        console.error('Erro ao buscar cliente para sincronizar push token:', clienteError);
        return;
      }

      if (!clienteRow) {
        console.log('Cliente ainda não encontrado para salvar push token');
        return;
      }

      if (clienteRow.expo_push_token === token) {
        console.log('Expo push token já está atualizado');
        return;
      }

      const { error: updateError } = await supabase
        .from('clientes')
        .update({ expo_push_token: token })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Erro ao salvar expo_push_token:', updateError);
        return;
      }

      console.log('Expo push token salvo com sucesso');
    } catch (err) {
      console.error('Erro ao sincronizar push token:', err);
    }
  };

  // ===============================
  // 🚫 Verifica se cliente está banido
  // ===============================
  const checkIfClienteIsBlocked = async (userId: string) => {
    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('Erro ao verificar bloqueio do cliente:', error);
      throw new Error('Erro ao verificar status da conta.');
    }

    if (data?.is_blocked) {
      const motivo =
        data.ban_reason?.trim() || 'Sua conta foi bloqueada pela administração.';
      throw new Error(`CONTA_BANIDA::${motivo}`);
    }

    return data as ClienteRow | null;
  };

  // ===============================
  // 🧱 Garante perfil cliente
  // ===============================
  const ensureClienteProfile = async (u: User) => {
    try {
      const { data: up, error: upErr } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', u.id)
        .maybeSingle();

      if (upErr) {
        console.error('Erro ao buscar user_profiles:', upErr);
      }

      if (!up) {
        const { error: insUpErr } = await supabase
          .from('user_profiles')
          .insert({ id: u.id, role: 'cliente' });

        if (insUpErr) {
          console.error('Erro ao criar user_profiles:', insUpErr);
        }
      }

      const { data: c, error: cErr } = await supabase
        .from('clientes')
        .select('*')
        .eq('user_id', u.id)
        .maybeSingle();

      if (cErr) {
        console.error('Erro ao buscar cliente:', cErr);
        return;
      }

      if (!c) {
        const { data: created, error: createErr } = await supabase
          .from('clientes')
          .insert({
            user_id: u.id,
            name: u.user_metadata?.nome || 'Cliente Sem Nome',
            phone: u.user_metadata?.telefone || 'Sem telefone',
            address: u.user_metadata?.address || '',
            city: u.user_metadata?.city || null,
          })
          .select('*')
          .maybeSingle();

        if (createErr) {
          console.error('Erro ao criar cliente:', createErr);
          return;
        }

        setCliente((created ?? null) as ClienteRow | null);
      } else {
        setCliente((c ?? null) as ClienteRow | null);
      }
    } catch (err) {
      console.error('Erro inesperado em ensureClienteProfile:', err);
    }
  };

  // ===============================
  // 🔎 Busca cliente
  // ===============================
  const fetchCliente = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Erro ao buscar cliente:', error);
        return;
      }

      if (data?.is_blocked) {
        const motivo =
          data.ban_reason?.trim() || 'Sua conta foi bloqueada pela administração.';

        await supabase.auth.signOut();
        setSession(null);
        setUser(null);
        setCliente(null);
        setLoading(false);

        throw new Error(`CONTA_BANIDA::${motivo}`);
      }

      setCliente((data ?? null) as ClienteRow | null);
    } catch (err) {
      console.error('Erro inesperado ao buscar cliente:', err);
      throw err;
    }
  };

  // ===============================
  // 🔄 Init + Listener
  // ===============================
  useEffect(() => {
    let mounted = true;

    const init = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!mounted) return;

        if (data.session?.user) {
          try {
            await checkIfClienteIsBlocked(data.session.user.id);

            if (!mounted) return;
            setSession(data.session);
            setUser(data.session.user);
            await ensureClienteProfile(data.session.user);
          } catch (err: any) {
            const message = String(err?.message || '');

            if (message.startsWith('CONTA_BANIDA::')) {
              await supabase.auth.signOut();

              if (!mounted) return;
              setSession(null);
              setUser(null);
              setCliente(null);
            } else {
              throw err;
            }
          }
        }
      } catch (err) {
        console.error('Erro na inicialização da sessão:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    init();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;

      if (!session?.user) {
        setSession(null);
        setUser(null);
        setCliente(null);
        setLoading(false);
        return;
      }

      try {
        await checkIfClienteIsBlocked(session.user.id);

        if (!mounted) return;
        setSession(session);
        setUser(session.user);

        if (event === 'SIGNED_IN') {
          setLoading(true);
          try {
            await ensureClienteProfile(session.user);
          } finally {
            if (mounted) setLoading(false);
          }
        } else {
          await fetchCliente(session.user.id);
          if (mounted) setLoading(false);
        }
      } catch (err: any) {
        const message = String(err?.message || '');

        if (message.startsWith('CONTA_BANIDA::')) {
          await supabase.auth.signOut();

          if (!mounted) return;
          setSession(null);
          setUser(null);
          setCliente(null);
          setLoading(false);
        } else {
          console.error('Erro ao validar usuário no auth state change:', err);
          if (mounted) setLoading(false);
        }
      }
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  // ===============================
  // 🔔 Sincroniza push token só quando user e cliente estiverem prontos
  // ===============================
  useEffect(() => {
    if (!user?.id || !cliente?.id) return;

    syncPushToken(user.id).catch(console.error);
  }, [user?.id, cliente?.id]);

  // ===============================
  // 🔐 LOGIN
  // ===============================
  const signIn = async (email: string, password: string) => {
    setLoading(true);

    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      const authUser = data.user;
      if (!authUser) {
        throw new Error('Usuário não encontrado após login.');
      }

      try {
        await checkIfClienteIsBlocked(authUser.id);
      } catch (blockError) {
        await supabase.auth.signOut();
        throw blockError;
      }
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  // ===============================
  // 📝 CADASTRO
  // ===============================
  const signUp = async (email: string, password: string, metadata: any = {}) => {
    setLoading(true);

    try {
      const { data: authData, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: metadata },
      });

      if (error) throw error;

      if (authData.user) {
        await ensureClienteProfile(authData.user);
      }
    } catch (err) {
      setLoading(false);
      throw err;
    } finally {
      if (!session) setLoading(false);
    }
  };

  // ===============================
  // 📩 RECUPERAR SENHA
  // ===============================
  const forgotPassword = async (email: string) => {
    if (!email?.trim()) {
      throw new Error('Informe um email válido.');
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'familiamotoboy://reset-password',
    });

    if (error) {
      console.error('Erro ao enviar email de recuperação:', error);
      throw error;
    }
  };

  // ===============================
  // 🚪 LOGOUT
  // ===============================
  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setCliente(null);
    } finally {
      setLoading(false);
    }
  };

  // ===============================
  // ✏️ UPDATE CLIENTE
  // ===============================
  const updateCliente = async (updates: Partial<ClienteRow>) => {
    const uid = user?.id;
    if (!uid) return;

    const { data, error } = await supabase
      .from('clientes')
      .update(updates)
      .eq('user_id', uid)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Erro ao atualizar cliente:', error);
      throw error;
    }

    setCliente((data ?? null) as ClienteRow | null);
  };

  const refreshCliente = async () => {
    const uid = user?.id;
    if (!uid) return;
    await fetchCliente(uid);
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        cliente,
        loading,
        signUp,
        signIn,
        signOut,
        forgotPassword,
        refreshCliente,
        updateCliente,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
};