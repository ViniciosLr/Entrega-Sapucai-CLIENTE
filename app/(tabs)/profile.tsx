import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  TextInput,
  Image,
  SafeAreaView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import {
  User as UserIcon,
  Phone,
  CreditCard,
  LogOut,
  Shield,
  Camera,
  Edit3,
  Save,
  X,
  Package,
  CheckCircle,
  XCircle,
  ShoppingBag,
  Calendar,
  DollarSign,
  Percent,
  Building,
  User,
  Briefcase,
  MapPin,
  Gift,
  TrendingUp,
  Clock,
  ChevronRight,
  Star,
  Heart,
} from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '@/lib/supabase';

interface ProfileStats {
  total_orders: number;
  completed_orders: number;
  cancelled_orders: number;
  total_spent: number;
  favorite_merchandise: string;
  most_frequent_bairro: string;
  last_order_date: string;
  account_type: 'pf' | 'pj';
  cnpj?: string;
  cashRango_balance: number;
  cashRango_total_earned: number;
  cashRango_history: CashRangoTransaction[];
}

interface CashRangoTransaction {
  id: string;
  order_id: string;
  amount: number;
  type: 'earned' | 'used';
  order_value: number;
  created_at: string;
}

const formatCPF = (value?: string | null) => {
  if (!value) return '';

  const digits = value.replace(/\D/g, '');

  if (digits.length !== 11) {
    return value;
  }

  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
};

const formatCNPJ = (value?: string | null) => {
  if (!value) return '';

  const digits = value.replace(/\D/g, '');

  if (digits.length !== 14) {
    return value;
  }

  return digits.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/,
    '$1.$2.$3/$4-$5'
  );
};

const formatPhone = (value?: string | null) => {
  if (!value) return '';

  const digits = value.replace(/\D/g, '');

  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  }

  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3');
  }

  return value;
};

const formatCPFInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return digits.replace(/(\d{3})(\d+)/, '$1.$2');
  if (digits.length <= 9) {
    return digits.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3');
  }

  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})/, '$1.$2.$3-$4');
};

const formatCNPJInput = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 14);

  if (digits.length <= 2) return digits;
  if (digits.length <= 5) return digits.replace(/(\d{2})(\d+)/, '$1.$2');
  if (digits.length <= 8) return digits.replace(/(\d{2})(\d{3})(\d+)/, '$1.$2.$3');
  if (digits.length <= 12) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d+)/, '$1.$2.$3/$4');
  }

  return digits.replace(
    /(\d{2})(\d{3})(\d{3})(\d{4})(\d{1,2})/,
    '$1.$2.$3/$4-$5'
  );
};

export default function DetailedProfileScreen() {
  const { user, signOut } = useAuth();
  const { profile, updateProfile, loading } = useProfile();

  const [editing, setEditing] = useState(false);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showCashRangoHistory, setShowCashRangoHistory] = useState(false);

  const [formData, setFormData] = useState({
    phone: '',
    name: '',
    cpf: '',
    cnpj: '',
    city: '',
    account_type: 'pf' as 'pf' | 'pj',
  });

  const [avatar, setAvatar] = useState<string | null>(null);

  useEffect(() => {
    if (profile) {
      setFormData({
        phone: profile.phone || '',
        name: profile.name || '',
        cpf: formatCPF(profile.cpf || ''),
        cnpj: formatCNPJ(profile.cnpj || ''),
        city: profile.city || '',
        account_type: profile.cnpj ? 'pj' : 'pf',
      });

      setAvatar(profile.profile_image_url || null);
      fetchProfileStats(profile.id);
    }
  }, [profile]);

  // Função para calcular cashRango (0,10 R$ por compra)
  const calculateCashRango = (orderValue: number): number => {
    return 0.10; // 10 centavos fixos por compra
  };

  const fetchProfileStats = async (clientId: string) => {
    try {
      const { data: orders, error } = await supabase
        .from('pedidos')
        .select('*')
        .eq('customer_id', clientId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const totalOrders = orders?.length || 0;
      const completedOrders =
        orders?.filter(order => order.status === 'finalizado').length || 0;
      const cancelledOrders =
        orders?.filter(order => order.status === 'cancelado').length || 0;

      const totalSpent =
        orders
          ?.filter(order => order.status === 'finalizado')
          .reduce((sum, order) => sum + (Number(order.price) || 0), 0) || 0;

      // Buscar transações do cashRango
      const { data: cashRangoData } = await supabase
        .from('cashrango_transactions')
        .select('*')
        .eq('customer_id', clientId)
        .order('created_at', { ascending: false });

      const cashRangoTransactions = cashRangoData || [];
      
      const cashRangoBalance = cashRangoTransactions.reduce((sum, trans) => {
        return sum + (trans.type === 'earned' ? trans.amount : -trans.amount);
      }, 0);

      const cashRangoTotalEarned = cashRangoTransactions
        .filter(t => t.type === 'earned')
        .reduce((sum, t) => sum + t.amount, 0);

      const merchandiseCounts = orders?.reduce((acc: Record<string, number>, order) => {
        const type = order.merchandise_type || 'Outro';
        acc[type] = (acc[type] || 0) + 1;
        return acc;
      }, {});

      const favoriteMerchandise = merchandiseCounts
        ? Object.entries(merchandiseCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Nenhum'
        : 'Nenhum';

      const bairroCounts = orders?.reduce((acc: Record<string, number>, order) => {
        const bairro = order.delivery_bairro || 'Não informado';
        acc[bairro] = (acc[bairro] || 0) + 1;
        return acc;
      }, {});

      const mostFrequentBairro = bairroCounts
        ? Object.entries(bairroCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Não informado'
        : 'Não informado';

      const lastOrderDate = orders?.[0]?.created_at
        ? new Date(orders[0].created_at).toLocaleDateString('pt-BR')
        : 'Nenhum pedido';

      const accountType = profile?.cnpj ? 'pj' : 'pf';

      setStats({
        total_orders: totalOrders,
        completed_orders: completedOrders,
        cancelled_orders: cancelledOrders,
        total_spent: totalSpent,
        favorite_merchandise: favoriteMerchandise,
        most_frequent_bairro: mostFrequentBairro,
        last_order_date: lastOrderDate,
        account_type: accountType,
        cnpj: profile?.cnpj || undefined,
        cashRango_balance: cashRangoBalance,
        cashRango_total_earned: cashRangoTotalEarned,
        cashRango_history: cashRangoTransactions,
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      Alert.alert('Erro', 'Não foi possível carregar as estatísticas');
    } finally {
      setLoadingStats(false);
    }
  };

  // Função para resgatar cashRango
  const handleRedeemCashRango = async () => {
    if (!stats || stats.cashRango_balance <= 0) {
      Alert.alert('Saldo Insuficiente', 'Você não tem cashRango suficiente para resgatar.');
      return;
    }

    Alert.alert(
      'Resgatar cashRango',
      `Você tem R$ ${stats.cashRango_balance.toFixed(2)} disponíveis. Deseja resgatar agora?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Resgatar',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('cashrango_transactions')
                .insert({
                  customer_id: profile?.id,
                  amount: stats.cashRango_balance,
                  type: 'used',
                  order_id: null,
                  created_at: new Date().toISOString(),
                });

              if (error) throw error;

              Alert.alert('Sucesso', 'cashRango resgatado com sucesso!');
              fetchProfileStats(profile?.id || '');
            } catch (error) {
              Alert.alert('Erro', 'Não foi possível resgatar o cashRango');
            }
          },
        },
      ]
    );
  };

  const base64ToUint8Array = (base64: string) => {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    let str = '';
    const output: number[] = [];

    for (
      let bc = 0, bs: number, buffer: number, idx = 0;
      (buffer = base64.charAt(idx++).charCodeAt(0));
      ~buffer &&
      ((bs = bc % 4 ? (bs as number) * 64 + buffer : buffer),
      bc++ % 4)
        ? output.push(255 & ((bs as number) >> ((-2 * bc) & 6)))
        : 0
    ) {
      buffer = chars.indexOf(String.fromCharCode(buffer));
    }

    return Uint8Array.from(output);
  };

  const uploadProfileImage = async (uri: string) => {
    if (!user?.id) throw new Error('Usuário não autenticado');

    const fileInfo = await FileSystem.getInfoAsync(uri);
    if (!fileInfo.exists) {
      throw new Error('Arquivo da imagem não encontrado');
    }

    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const filePath = `${user.id}/profile-${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('profile-images')
      .upload(filePath, base64ToUint8Array(base64), {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage
      .from('profile-images')
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const pickImage = async () => {
    if (!editing) return;

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Permissão necessária', 'Permita acesso às fotos');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaType.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      setAvatar(result.assets[0].uri);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      let finalProfileImageUrl = avatar;

      if (avatar && !avatar.startsWith('http')) {
        finalProfileImageUrl = await uploadProfileImage(avatar);
      }

      const payload = {
        name: formData.name,
        phone: formData.phone,
        cpf: formData.account_type === 'pf' ? formData.cpf.replace(/\D/g, '') : null,
        cnpj: formData.account_type === 'pj' ? formData.cnpj.replace(/\D/g, '') : null,
        profile_image_url: finalProfileImageUrl,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('clientes')
        .update(payload)
        .eq('user_id', user?.id);

      if (error) throw error;

      await updateProfile(payload);

      setAvatar(finalProfileImageUrl || null);
      setEditing(false);
      Alert.alert('Sucesso', 'Perfil atualizado com sucesso!');
    } catch (error) {
      console.error('Erro ao atualizar perfil:', error);
      Alert.alert('Erro', 'Não foi possível atualizar o perfil');
    } finally {
      setSaving(false);
    }
  };

  const handlePrivacyPolicy = () => {
    Alert.alert(
      'Privacidade e Segurança',
      'Termos de Uso e Política de Privacidade\n\n' +
        '1. Coleta de Dados: Coletamos apenas as informações necessárias para o processamento de seus pedidos e melhoria da experiência no aplicativo.\n\n' +
        '2. Segurança: Todos os seus dados pessoais e de pagamento são criptografados e armazenados com segurança.\n\n' +
        '3. Compartilhamento: Não compartilhamos seus dados com terceiros, exceto quando necessário para a entrega do serviço.\n\n' +
        'Ao continuar utilizando o aplicativo, você concorda com estes termos.',
      [{ text: 'Entendi', style: 'default' }]
    );
  };

  const handleSignOut = () => {
    Alert.alert(
      'Sair',
      'Tem certeza que deseja sair da sua conta?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Sair', style: 'destructive', onPress: signOut },
      ]
    );
  };

  const toggleAccountType = () => {
    setFormData(prev => ({
      ...prev,
      account_type: prev.account_type === 'pf' ? 'pj' : 'pf',
      cpf: prev.account_type === 'pf' ? '' : prev.cpf,
      cnpj: prev.account_type === 'pj' ? '' : prev.cnpj,
    }));
  };

  if (loading || loadingStats) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <LoadingSpinner size="large" color="#FF6B35" />
          <Text style={styles.loadingText}>Carregando seu perfil...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const successRate = stats?.total_orders
    ? ((stats.completed_orders / stats.total_orders) * 100).toFixed(1)
    : '0.0';

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
        {/* Header com CashRango */}
        <LinearGradient
          colors={['#FF6B35', '#EC4C43', '#EC4C43']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.headerGradient}
        >
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.avatarContainer}
              onPress={pickImage}
              activeOpacity={editing ? 0.7 : 1}
            >
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatarImage} />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <UserIcon size={30} color="#FFFFFF" strokeWidth={2} />
                </View>
              )}

              {editing && (
                <View style={styles.cameraIconContainer}>
                  <LinearGradient
                    colors={['#FF6B35', '#FF8C42']}
                    style={styles.cameraIcon}
                  >
                    <Camera size={14} color="#FFFFFF" strokeWidth={2.5} />
                  </LinearGradient>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>{profile?.name || 'FoodLover'}</Text>
              <Text style={styles.headerSubtitle}>{user?.email}</Text>
            </View>
          </View>

          {/* Card do cashRango */}
          <View style={styles.cashRangoCard}>
            <LinearGradient
              colors={['#1A1A2E', '#16213E']}
              style={styles.cashRangoGradient}
            >
              <View style={styles.cashRangoHeader}>
                <View style={styles.cashRangoLogo}>
                  <Gift size={20} color="#FF6B35" />
                  <Text style={styles.cashRangoTitle}>cashRango</Text>
                </View>
                <TouchableOpacity 
                  style={styles.historyButton}
                  onPress={() => setShowCashRangoHistory(!showCashRangoHistory)}
                >
                  <Clock size={16} color="#FF6B35" />
                  <Text style={styles.historyButtonText}>Histórico</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.cashRangoBalance}>
                <Text style={styles.cashRangoBalanceLabel}>Saldo disponível</Text>
                <Text style={styles.cashRangoBalanceValue}>
                  R$ {stats?.cashRango_balance.toFixed(2) || '0.00'}
                </Text>
              </View>

              <View style={styles.cashRangoInfo}>
                <View style={styles.cashRangoInfoItem}>
                  <TrendingUp size={16} color="#10B981" />
                  <Text style={styles.cashRangoInfoText}>
                    Total acumulado: R$ {stats?.cashRango_total_earned.toFixed(2) || '0.00'}
                  </Text>
                </View>
                <Text style={styles.cashRangoRule}>
                  Ganhe R$ 0,10 a cada compra realizada!
                </Text>
              </View>

              {stats && stats.cashRango_balance > 0 && (
                <TouchableOpacity
                  style={styles.redeemButton}
                  onPress={handleRedeemCashRango}
                >
                  <Text style={styles.redeemButtonText}>Resgatar Saldo</Text>
                </TouchableOpacity>
              )}
            </LinearGradient>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          {/* Histórico do cashRango */}
          {showCashRangoHistory && stats?.cashRango_history && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Histórico cashRango</Text>
              {stats.cashRango_history.length === 0 ? (
                <Text style={styles.emptyText}>Nenhuma transação ainda</Text>
              ) : (
                stats.cashRango_history.map((transaction) => (
                  <View key={transaction.id} style={styles.transactionItem}>
                    <View style={styles.transactionIcon}>
                      {transaction.type === 'earned' ? (
                        <Gift size={20} color="#10B981" />
                      ) : (
                        <DollarSign size={20} color="#EF4444" />
                      )}
                    </View>
                    <View style={styles.transactionInfo}>
                      <Text style={styles.transactionTitle}>
                        {transaction.type === 'earned' ? 'Ganhou' : 'Resgatou'} cashRango
                      </Text>
                      <Text style={styles.transactionDate}>
                        {new Date(transaction.created_at).toLocaleDateString('pt-BR')}
                      </Text>
                    </View>
                    <Text style={[
                      styles.transactionAmount,
                      { color: transaction.type === 'earned' ? '#10B981' : '#EF4444' }
                    ]}>
                      {transaction.type === 'earned' ? '+' : '-'} R$ {transaction.amount.toFixed(2)}
                    </Text>
                  </View>
                ))
              )}
            </View>
          )}

          {/* Favoritos rápidos */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <Heart size={20} color="#FF6B35" />
                <Text style={styles.sectionTitle}>Seus Favoritos</Text>
              </View>
            </View>
            
            <View style={styles.favoritesGrid}>
              <TouchableOpacity style={styles.favoriteCard}>
                <LinearGradient
                  colors={['#FF6B35', '#FF8C42']}
                  style={styles.favoriteIcon}
                >
                  <Star size={20} color="#FFFFFF" />
                </LinearGradient>
                <Text style={styles.favoriteName}>{stats?.favorite_merchandise || 'Adicionar'}</Text>
                <Text style={styles.favoriteLabel}>Pedido preferido</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.favoriteCard}>
                <LinearGradient
                  colors={['#10B981', '#059669']}
                  style={styles.favoriteIcon}
                >
                  <MapPin size={20} color="#FFFFFF" />
                </LinearGradient>
                <Text style={styles.favoriteName}>{stats?.most_frequent_bairro || 'Adicionar'}</Text>
                <Text style={styles.favoriteLabel}>Bairro frequente</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Estatísticas simplificadas */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <ShoppingBag size={20} color="#FF6B35" />
                <Text style={styles.sectionTitle}>Suas Estatísticas</Text>
              </View>
            </View>

            {stats && (
              <View style={styles.statsGrid}>
                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.total_orders}</Text>
                  <Text style={styles.statLabel}>Pedidos</Text>
                </View>

                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{stats.completed_orders}</Text>
                  <Text style={styles.statLabel}>Concluídos</Text>
                </View>

                <View style={styles.statCard}>
                  <Text style={styles.statValue}>{successRate}%</Text>
                  <Text style={styles.statLabel}>Sucesso</Text>
                </View>

                <View style={styles.statCard}>
                  <Text style={styles.statValue}>
                    {new Date(stats.last_order_date).toLocaleDateString('pt-BR', { 
                      day: '2-digit', 
                      month: '2-digit' 
                    })}
                  </Text>
                  <Text style={styles.statLabel}>Último pedido</Text>
                </View>
              </View>
            )}
          </View>

          {/* Informações Pessoais */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View style={styles.sectionTitleRow}>
                <UserIcon size={20} color="#FF6B35" />
                <Text style={styles.sectionTitle}>Informações Pessoais</Text>
              </View>

              <TouchableOpacity
                style={[styles.editButton, editing && styles.editButtonActive]}
                onPress={() => setEditing(!editing)}
                activeOpacity={0.7}
              >
                {editing ? (
                  <>
                    <X size={16} color="#EF4444" strokeWidth={2.5} />
                    <Text style={styles.editButtonTextCancel}>Cancelar</Text>
                  </>
                ) : (
                  <>
                    <Edit3 size={16} color="#FF6B35" strokeWidth={2.5} />
                    <Text style={styles.editButtonText}>Editar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nome completo</Text>
              {editing ? (
                <View style={styles.textInputWrapper}>
                  <View style={styles.iconCircle}>
                    <UserIcon size={18} color="#FF6B35" strokeWidth={2} />
                  </View>
                  <TextInput
                    style={styles.textInput}
                    value={formData.name}
                    onChangeText={text => setFormData(prev => ({ ...prev, name: text }))}
                    placeholder="Seu nome completo"
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              ) : (
                <View style={styles.infoCard}>
                  <View style={styles.iconCircle}>
                    <UserIcon size={18} color="#FF6B35" strokeWidth={2} />
                  </View>
                  <Text style={styles.infoText}>{profile?.name || 'Não informado'}</Text>
                </View>
              )}
            </View>

            {formData.account_type === 'pf' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>CPF</Text>
                {editing ? (
                  <View style={styles.textInputWrapper}>
                    <View style={styles.iconCircle}>
                      <CreditCard size={18} color="#FF6B35" strokeWidth={2} />
                    </View>
                    <TextInput
                      style={styles.textInput}
                      value={formData.cpf}
                      onChangeText={text =>
                        setFormData(prev => ({
                          ...prev,
                          cpf: formatCPFInput(text),
                        }))
                      }
                      placeholder="000.000.000-00"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                    />
                  </View>
                ) : (
                  <View style={styles.infoCard}>
                    <View style={styles.iconCircle}>
                      <CreditCard size={18} color="#FF6B35" strokeWidth={2} />
                    </View>
                    <Text style={styles.infoText}>
                      {formatCPF(profile?.cpf) || 'CPF não informado'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            {formData.account_type === 'pj' && (
              <View style={styles.inputGroup}>
                <Text style={styles.inputLabel}>CNPJ</Text>
                {editing ? (
                  <View style={styles.textInputWrapper}>
                    <View style={styles.iconCircle}>
                      <Briefcase size={18} color="#059669" strokeWidth={2} />
                    </View>
                    <TextInput
                      style={styles.textInput}
                      value={formData.cnpj}
                      onChangeText={text =>
                        setFormData(prev => ({
                          ...prev,
                          cnpj: formatCNPJInput(text),
                        }))
                      }
                      placeholder="00.000.000/0000-00"
                      placeholderTextColor="#9CA3AF"
                      keyboardType="numeric"
                    />
                  </View>
                ) : (
                  <View style={styles.infoCard}>
                    <View style={styles.iconCircle}>
                      <Briefcase size={18} color="#059669" strokeWidth={2} />
                    </View>
                    <Text style={styles.infoText}>
                      {formatCNPJ(profile?.cnpj) || 'CNPJ não informado'}
                    </Text>
                  </View>
                )}
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Telefone</Text>
              {editing ? (
                <View style={styles.textInputWrapper}>
                  <View style={styles.iconCircle}>
                    <Phone size={18} color="#FF6B35" strokeWidth={2} />
                  </View>
                  <TextInput
                    style={styles.textInput}
                    value={formData.phone}
                    onChangeText={text => setFormData(prev => ({ ...prev, phone: text }))}
                    placeholder="(11) 99999-9999"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="phone-pad"
                  />
                </View>
              ) : (
                <View style={styles.infoCard}>
                  <View style={styles.iconCircle}>
                    <Phone size={18} color="#FF6B35" strokeWidth={2} />
                  </View>
                  <Text style={styles.infoText}>
                    {formatPhone(profile?.phone) || 'Não informado'}
                  </Text>
                </View>
              )}
            </View>

            {editing && (
              <TouchableOpacity
                style={styles.saveButtonWrapper}
                onPress={handleSave}
                activeOpacity={0.8}
                disabled={saving}
              >
                <LinearGradient
                  colors={['#FF6B35', '#FF8C42', '#FFA751']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveButton}
                >
                  <Save size={20} color="#FFFFFF" strokeWidth={2.5} />
                  <Text style={styles.saveButtonText}>
                    {saving ? 'Salvando...' : 'Salvar Alterações'}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            )}
          </View>

          {/* Configurações */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.menuItem}
              onPress={handlePrivacyPolicy}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconCircle}>
                <Shield size={20} color="#64748B" strokeWidth={2} />
              </View>
              <Text style={styles.menuItemText}>Privacidade e Segurança</Text>
              <ChevronRight size={20} color="#CBD5E1" />
            </TouchableOpacity>
          </View>

          {/* Sair */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={handleSignOut}
              activeOpacity={0.7}
            >
              <View style={styles.signOutIconCircle}>
                <LogOut size={20} color="#DC2626" strokeWidth={2.5} />
              </View>
              <Text style={styles.signOutText}>Sair da Conta</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FF6B35',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFF5F0',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF5F0',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  headerGradient: {
    paddingTop: 34,
    paddingBottom: 30,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    borderRadius: 14,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  cameraIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  headerInfo: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#FFE4D6',
    fontWeight: '400',
  },
  cashRangoCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 10,
    overflow: 'hidden',
  },
  cashRangoGradient: {
    padding: 20,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 107, 53, 0.3)',
  },
  cashRangoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  cashRangoLogo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cashRangoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FF6B35',
    letterSpacing: -0.5,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 107, 53, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  historyButtonText: {
    fontSize: 12,
    color: '#FF6B35',
    fontWeight: '600',
  },
  cashRangoBalance: {
    marginBottom: 16,
  },
  cashRangoBalanceLabel: {
    fontSize: 12,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  cashRangoBalanceValue: {
    fontSize: 36,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -1,
  },
  cashRangoInfo: {
    gap: 8,
  },
  cashRangoInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  cashRangoInfoText: {
    fontSize: 14,
    color: '#D1D5DB',
  },
  cashRangoRule: {
    fontSize: 12,
    color: '#6B7280',
    fontStyle: 'italic',
  },
  redeemButton: {
    marginTop: 16,
    backgroundColor: '#FF6B35',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  redeemButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    padding: 20,
    paddingTop: 24,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  sectionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: -0.3,
  },
  emptyText: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    paddingVertical: 20,
  },
  transactionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    gap: 12,
  },
  transactionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
  },
  transactionDate: {
    fontSize: 12,
    color: '#64748B',
    marginTop: 2,
  },
  transactionAmount: {
    fontSize: 16,
    fontWeight: '700',
  },
  favoritesGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  favoriteCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: '#FFF5F0',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#FFE4D6',
  },
  favoriteIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  favoriteName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    textAlign: 'center',
  },
  favoriteLabel: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 4,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statCard: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 11,
    color: '#64748B',
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#FFF5F0',
    gap: 4,
  },
  editButtonActive: {
    backgroundColor: '#FEF2F2',
  },
  editButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FF6B35',
  },
  editButtonTextCancel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#EF4444',
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  textInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: '#FF6B35',
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#FFF5F0',
    gap: 10,
  },
  textInput: {
    flex: 1,
    fontSize: 15,
    color: '#1E293B',
    paddingVertical: 10,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF5F0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FFE4D6',
    gap: 10,
  },
  iconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FFE4D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    fontSize: 15,
    color: '#1E293B',
    flex: 1,
    fontWeight: '500',
  },
  saveButtonWrapper: {
    marginTop: 20,
    borderRadius: 12,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 8,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  menuIconCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemText: {
    fontSize: 15,
    color: '#1E293B',
    fontWeight: '500',
    flex: 1,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  signOutIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#DC2626',
  },
});