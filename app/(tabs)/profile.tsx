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
      });
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
      Alert.alert('Erro', 'Não foi possível carregar as estatísticas');
    } finally {
      setLoadingStats(false);
    }
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
          <LoadingSpinner size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Carregando perfil...</Text>
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
        <LinearGradient
          colors={['#1E40AF', '#2563EB', '#3B82F6']}
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
                    colors={['#3B82F6', '#2563EB']}
                    style={styles.cameraIcon}
                  >
                    <Camera size={14} color="#FFFFFF" strokeWidth={2.5} />
                  </LinearGradient>
                </View>
              )}
            </TouchableOpacity>

            <View style={styles.headerInfo}>
              <Text style={styles.headerTitle}>{profile?.name || 'Usuário'}</Text>
              <Text style={styles.headerSubtitle}>{user?.email}</Text>

              <View style={styles.accountTypeBadge}>
                <View style={styles.accountTypeIcon}>
                  {formData.account_type === 'pf' ? (
                    <User size={12} color="#FFFFFF" />
                  ) : (
                    <Building size={12} color="#FFFFFF" />
                  )}
                </View>
                <Text style={styles.accountTypeText}>
                  {formData.account_type === 'pf' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                </Text>
              </View>
            </View>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <View>
                <Text style={styles.sectionTitle}>Estatísticas</Text>
                <Text style={styles.sectionSubtitle}>Histórico de pedidos</Text>
              </View>
            </View>

            {stats && (
              <>
                <View style={styles.statsGrid}>
                  <View style={styles.statCard}>
                    <LinearGradient
                      colors={['#10B981', '#059669']}
                      style={styles.statCardGradient}
                    >
                      <ShoppingBag size={24} color="#FFFFFF" />
                    </LinearGradient>
                    <Text style={styles.statValue}>{stats.total_orders}</Text>
                    <Text style={styles.statLabel}>Total de Pedidos</Text>
                  </View>

                  <View style={styles.statCard}>
                    <LinearGradient
                      colors={['#3B82F6', '#2563EB']}
                      style={styles.statCardGradient}
                    >
                      <CheckCircle size={24} color="#FFFFFF" />
                    </LinearGradient>
                    <Text style={styles.statValue}>{stats.completed_orders}</Text>
                    <Text style={styles.statLabel}>Concluídos</Text>
                  </View>

                  <View style={styles.statCard}>
                    <LinearGradient
                      colors={['#EF4444', '#DC2626']}
                      style={styles.statCardGradient}
                    >
                      <XCircle size={24} color="#FFFFFF" />
                    </LinearGradient>
                    <Text style={styles.statValue}>{stats.cancelled_orders}</Text>
                    <Text style={styles.statLabel}>Cancelados</Text>
                  </View>

                  <View style={styles.statCard}>
                    <LinearGradient
                      colors={['#8B5CF6', '#7C3AED']}
                      style={styles.statCardGradient}
                    >
                      <Percent size={24} color="#FFFFFF" />
                    </LinearGradient>
                    <Text style={styles.statValue}>{successRate}%</Text>
                    <Text style={styles.statLabel}>Taxa de Sucesso</Text>
                  </View>
                </View>

                <View style={styles.additionalStats}>
                  <View style={styles.additionalStatRowSingle}>
                    <View style={styles.additionalStatItemSingle}>
                      <DollarSign size={20} color="#059669" />
                      <View style={styles.additionalStatText}>
                        <Text style={styles.additionalStatLabel}>Total Gasto</Text>
                        <Text style={styles.additionalStatValue}>
                          R$ {stats.total_spent.toFixed(2)}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.additionalStatRow}>
                    <View style={styles.additionalStatItem}>
                      <Package size={20} color="#EA580C" />
                      <View style={styles.additionalStatText}>
                        <Text style={styles.additionalStatLabel}>Pedido Preferido</Text>
                        <Text style={styles.additionalStatValue}>
                          {stats.favorite_merchandise}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.additionalStatItem}>
                      <MapPin size={20} color="#9333EA" />
                      <View style={styles.additionalStatText}>
                        <Text style={styles.additionalStatLabel}>Bairro Mais Frequente</Text>
                        <Text style={styles.additionalStatValue}>
                          {stats.most_frequent_bairro}
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.additionalStatRowSingle}>
                    <View style={styles.additionalStatItemSingle}>
                      <Calendar size={20} color="#DC2626" />
                      <View style={styles.additionalStatText}>
                        <Text style={styles.additionalStatLabel}>Último Pedido</Text>
                        <Text style={styles.additionalStatValue}>
                          {stats.last_order_date}
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>
              </>
            )}
          </View>

          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Informações Pessoais</Text>

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
                    <Edit3 size={16} color="#2563EB" strokeWidth={2.5} />
                    <Text style={styles.editButtonText}>Editar</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Tipo de Conta</Text>
              {editing ? (
                <TouchableOpacity
                  style={styles.accountTypeToggle}
                  onPress={toggleAccountType}
                  activeOpacity={0.8}
                >
                  <LinearGradient
                    colors={
                      formData.account_type === 'pf'
                        ? ['#2563EB', '#1D4ED8']
                        : ['#059669', '#047857']
                    }
                    style={styles.accountTypeToggleButton}
                  >
                    <View style={styles.accountTypeToggleIcon}>
                      {formData.account_type === 'pf' ? (
                        <User size={20} color="#FFFFFF" />
                      ) : (
                        <Building size={20} color="#FFFFFF" />
                      )}
                    </View>
                    <Text style={styles.accountTypeToggleText}>
                      {formData.account_type === 'pf' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                    </Text>
                  </LinearGradient>
                </TouchableOpacity>
              ) : (
                <View style={styles.infoCard}>
                  <View style={styles.iconCircle}>
                    {formData.account_type === 'pf' ? (
                      <User size={18} color="#2563EB" />
                    ) : (
                      <Building size={18} color="#059669" />
                    )}
                  </View>
                  <Text style={styles.infoText}>
                    {formData.account_type === 'pf' ? 'Pessoa Física' : 'Pessoa Jurídica'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Nome completo</Text>
              {editing ? (
                <View style={styles.textInputWrapper}>
                  <View style={styles.iconCircle}>
                    <UserIcon size={18} color="#2563EB" strokeWidth={2} />
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
                    <UserIcon size={18} color="#2563EB" strokeWidth={2} />
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
                      <CreditCard size={18} color="#2563EB" strokeWidth={2} />
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
                      <CreditCard size={18} color="#2563EB" strokeWidth={2} />
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
                    <Phone size={18} color="#2563EB" strokeWidth={2} />
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
                    <Phone size={18} color="#2563EB" strokeWidth={2} />
                  </View>
                  <Text style={styles.infoText}>
                    {formatPhone(profile?.phone) || 'Não informado'}
                  </Text>
                </View>
              )}
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Cidade</Text>
              <View style={styles.infoCard}>
                <View style={styles.iconCircle}>
                  <MapPin size={18} color="#2563EB" strokeWidth={2} />
                </View>
                <Text style={styles.infoText}>
                  {profile?.city || 'Não informada'}
                </Text>
              </View>
            </View>

            {editing && (
              <TouchableOpacity
                style={styles.saveButtonWrapper}
                onPress={handleSave}
                activeOpacity={0.8}
                disabled={saving}
              >
                <LinearGradient
                  colors={['#059669', '#10B981', '#34D399']}
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

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Configurações</Text>

            <TouchableOpacity
              style={styles.menuItem}
              onPress={handlePrivacyPolicy}
              activeOpacity={0.7}
            >
              <View style={styles.menuIconCircle}>
                <Shield size={20} color="#64748B" strokeWidth={2} />
              </View>
              <Text style={styles.menuItemText}>Privacidade e Segurança</Text>
            </TouchableOpacity>
          </View>

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

          <View style={styles.footer}>
            <Text style={styles.footerText}>
              ID do Usuário: {user?.id?.substring(0, 8)}...
            </Text>
            <Text style={styles.footerText}>
              Desde: {new Date(profile?.created_at || Date.now()).toLocaleDateString('pt-BR')}
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#2563EB',
  },
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#64748B',
    fontWeight: '500',
  },
  headerGradient: {
    paddingTop: 34,
    paddingBottom: 20,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    shadowColor: '#1E40AF',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 12,
    elevation: 6,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarImage: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  avatarPlaceholder: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    borderRadius: 14,
    shadowColor: '#3B82F6',
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
    fontSize: 22,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
    letterSpacing: -0.3,
    textAlign: 'center',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#DBEAFE',
    fontWeight: '400',
    marginBottom: 10,
  },
  accountTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 18,
    gap: 6,
  },
  accountTypeIcon: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountTypeText: {
    fontSize: 11,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  content: {
    padding: 20,
    paddingTop: 20,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
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
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1E293B',
    letterSpacing: -0.3,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#64748B',
    marginTop: 4,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    gap: 6,
  },
  editButtonActive: {
    backgroundColor: '#FEF2F2',
  },
  editButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563EB',
  },
  editButtonTextCancel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#EF4444',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    width: '48%',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 12,
  },
  statCardGradient: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
  },
  additionalStats: {
    marginTop: 16,
  },
  additionalStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  additionalStatRowSingle: {
    marginBottom: 16,
  },
  additionalStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flex: 1,
    marginHorizontal: 4,
    gap: 12,
  },
  additionalStatItemSingle: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  additionalStatText: {
    flex: 1,
  },
  additionalStatLabel: {
    fontSize: 12,
    color: '#64748B',
    marginBottom: 4,
  },
  additionalStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E293B',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 10,
    letterSpacing: 0.2,
  },
  textInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3B82F6',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    backgroundColor: '#F8FAFC',
    gap: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: '#1E293B',
    paddingVertical: 10,
  },
  infoCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoText: {
    fontSize: 16,
    color: '#1E293B',
    flex: 1,
    fontWeight: '500',
  },
  accountTypeToggle: {
    marginBottom: 20,
  },
  accountTypeToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  accountTypeToggleIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  accountTypeToggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    flex: 1,
  },
  saveButtonWrapper: {
    marginTop: 12,
    borderRadius: 12,
    shadowColor: '#059669',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 10,
  },
  saveButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    gap: 14,
  },
  menuIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuItemText: {
    fontSize: 16,
    color: '#1E293B',
    fontWeight: '500',
    flex: 1,
  },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 12,
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FECACA',
  },
  signOutIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FEE2E2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  signOutText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#DC2626',
    letterSpacing: 0.1,
  },
  footer: {
    alignItems: 'center',
    padding: 20,
    marginTop: 8,
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 4,
  },
});