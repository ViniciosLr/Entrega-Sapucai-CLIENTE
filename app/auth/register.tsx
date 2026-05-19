import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Image,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import {
  Mail,
  Lock,
  User,
  Phone,
  MapPin,
  Eye,
  EyeOff,
  Hash,
  Home,
} from 'lucide-react-native';
import { Picker } from '@react-native-picker/picker';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner } from '@/components/LoadingSpinner';

const AVAILABLE_CITIES = ['Santa Rita do Sapucaí'];

export default function RegisterScreen() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [loadingCities] = useState(false);
  const [cities] = useState<string[]>(AVAILABLE_CITIES);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    cpf: '',
    phone: '',
    city: 'Santa Rita do Sapucaí',
    street: '',
    houseNumber: '',
    password: '',
    confirmPassword: '',
  });

  const formatPhone = (text: string) => {
    const raw = text.replace(/\D/g, '').slice(0, 11);

    if (raw.length <= 2) return raw;
    if (raw.length <= 7) return raw.replace(/^(\d{2})(\d+)/, '($1) $2');
    return raw.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  };

  const formatCPF = (text: string) => {
    const raw = text.replace(/\D/g, '').slice(0, 11);

    if (raw.length <= 3) return raw;
    if (raw.length <= 6) return raw.replace(/(\d{3})(\d+)/, '$1.$2');
    if (raw.length <= 9) return raw.replace(/(\d{3})(\d{3})(\d+)/, '$1.$2.$3');
    return raw.replace(/(\d{3})(\d{3})(\d{3})(\d{1,2})$/, '$1.$2.$3-$4');
  };

  const handleRegister = async () => {
    if (loading) return;

    const {
      name,
      email,
      cpf,
      phone,
      city,
      street,
      houseNumber,
      password,
      confirmPassword,
    } = formData;

    if (
      !name.trim() ||
      !email.trim() ||
      !cpf.trim() ||
      !phone.trim() ||
      !city.trim() ||
      !street.trim() ||
      !houseNumber.trim() ||
      !password ||
      !confirmPassword
    ) {
      Alert.alert('Erro', 'Preencha todos os campos.');
      return;
    }

    const cleanedCpf = cpf.replace(/\D/g, '');
    const cleanedPhone = phone.replace(/\D/g, '');

    if (cleanedCpf.length !== 11) {
      Alert.alert('Erro', 'Digite um CPF válido com 11 dígitos.');
      return;
    }

    if (cleanedPhone.length < 10 || cleanedPhone.length > 11) {
      Alert.alert('Erro', 'Digite um telefone válido com DDD.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Erro', 'As senhas não coincidem.');
      return;
    }

    if (password.length < 6) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    try {
      setLoading(true);

      const fullAddress = `${street.trim()}, ${houseNumber.trim()}`;

      console.log('Iniciando cadastro...');
      console.log('CPF limpo:', cleanedCpf);
      console.log('Telefone limpo:', cleanedPhone);
      console.log('Cidade:', city);
      console.log('Endereço:', fullAddress);

      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            nome: name.trim(),
            telefone: cleanedPhone,
            cpf: cleanedCpf,
            cidade: city,
            address: fullAddress,
          },
        },
      });

      if (error) {
        // 🔴 VERIFICAÇÃO DE EMAIL JÁ EXISTENTE
        if (error.message?.toLowerCase().includes('user already registered') ||
            error.message?.toLowerCase().includes('already registered')) {
          Alert.alert('Erro no cadastro', 'Este email já está cadastrado. Faça login ou use outro email.');
          return;
        }
        throw error;
      }
      
      if (!data.user) throw new Error('Usuário não criado');

      console.log('Usuário auth criado:', data.user.id);

      const { data: existingClient, error: existingClientError } = await supabase
        .from('clientes')
        .select('id, user_id, cpf, city')
        .eq('user_id', data.user.id)
        .maybeSingle();

      if (existingClientError) throw existingClientError;

      console.log('Cliente existente:', existingClient);

      if (!existingClient) {
        const { error: rpcError } = await supabase.rpc('register_cliente_safe', {
          p_user_id: data.user.id,
          p_name: name.trim(),
          p_phone: cleanedPhone,
          p_address: fullAddress,
          p_cpf: cleanedCpf,
        });

        if (rpcError) {
          console.error('Erro na RPC:', rpcError);
          
          // 🔴 VERIFICAÇÃO DE CPF JÁ EXISTENTE
          if (rpcError.message?.toLowerCase().includes('cpf') || 
              rpcError.message?.toLowerCase().includes('duplicate')) {
            Alert.alert('Erro no cadastro', 'Este CPF já está cadastrado em nossa base.');
            return;
          }
          
          throw rpcError;
        }

        console.log('RPC executada com sucesso');
      }

      const { data: updatedClient, error: clientUpdateError } = await supabase
        .from('clientes')
        .update({
          name: name.trim(),
          phone: cleanedPhone,
          address: fullAddress,
          city: city.trim(),
          cpf: cleanedCpf,
        })
        .eq('user_id', data.user.id)
        .select();

      console.log('Cliente atualizado:', updatedClient);

      if (clientUpdateError) {
        console.error('Erro ao atualizar cliente:', clientUpdateError);
        
        // 🔴 VERIFICAÇÃO DE TELEFONE JÁ EXISTENTE
        if (clientUpdateError.message?.toLowerCase().includes('phone') || 
            clientUpdateError.message?.toLowerCase().includes('duplicate')) {
          Alert.alert('Erro no cadastro', 'Este telefone já está cadastrado em outra conta.');
          return;
        }
        
        throw clientUpdateError;
      }

      Alert.alert('Sucesso!', 'Conta criada com sucesso! 🎉', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (err: any) {
      console.error('Erro no cadastro:', err);

      // 🔴 TRATAMENTO DE ERROS DO SUPABASE
      if (err?.code === '23505') {
        const message = String(err?.message || '').toLowerCase();

        if (message.includes('clientes_cpf_unique') || message.includes('cpf')) {
          Alert.alert('CPF já cadastrado', 'Este CPF já está em uso. Verifique e tente novamente.');
          return;
        }
        
        if (message.includes('clientes_phone_unique') || message.includes('phone')) {
          Alert.alert('Telefone já cadastrado', 'Este número de telefone já está em uso. Use outro número.');
          return;
        }
        
        if (message.includes('email')) {
          Alert.alert('Email já cadastrado', 'Este email já está cadastrado. Faça login para continuar.');
          return;
        }

        Alert.alert(
          'Cadastro já existente',
          'Este usuário já possui cadastro. Tente fazer login.'
        );
        return;
      }

      // 🔴 MENSAGENS ESPECÍFICAS DE ERRO
      if (typeof err?.message === 'string') {
        const msg = err.message.toLowerCase();
        
        if (msg.includes('cpf já cadastrado')) {
          Alert.alert('CPF já cadastrado', 'Este CPF já está em uso.');
          return;
        }
        
        if (msg.includes('telefone já cadastrado') || msg.includes('phone already exists')) {
          Alert.alert('Telefone já cadastrado', 'Este telefone já está vinculado a outra conta.');
          return;
        }
        
        if (msg.includes('email já cadastrado') || msg.includes('email already')) {
          Alert.alert('Email já cadastrado', 'Este email já está em uso. Tente fazer login.');
          return;
        }
      }

      Alert.alert('Erro no cadastro', err?.message || 'Ocorreu um erro ao criar sua conta. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar 
        barStyle="dark-content" 
        backgroundColor="#FFF5F0"
        translucent={false}
      />
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Image
                source={require('@/assets/images/adaptive-icon.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.titleContainer}>
              <Text style={styles.logoWhite}>BORA</Text>
              <Text style={styles.logoYellow}>RANGAR</Text>
            </View>
            <Text style={styles.tagline}>
              Cadastre-se e peça seu prato favorito! 🍕
            </Text>
          </View>

          <View style={styles.form}>
            <Text style={styles.title}>Criar Conta</Text>
            <Text style={styles.subtitle}>Preencha seus dados para começar</Text>

            <Input
              label="Nome completo"
              icon={<User size={20} color="#FF6B35" strokeWidth={2} />}
              value={formData.name}
              placeholder="Ex: João Silva Santos"
              onChange={(v: string) => setFormData({ ...formData, name: v })}
            />

            <Input
              label="CPF"
              icon={<Hash size={20} color="#FF6B35" strokeWidth={2} />}
              value={formData.cpf}
              placeholder="000.000.000-00"
              keyboard="numeric"
              onChange={(v: string) =>
                setFormData({ ...formData, cpf: formatCPF(v) })
              }
            />

            <Input
              label="Email"
              icon={<Mail size={20} color="#FF6B35" strokeWidth={2} />}
              value={formData.email}
              placeholder="seu@email.com"
              keyboard="email-address"
              onChange={(v: string) => setFormData({ ...formData, email: v })}
            />

            <Input
              label="Telefone"
              icon={<Phone size={20} color="#FF6B35" strokeWidth={2} />}
              value={formData.phone}
              placeholder="(00) 00000-0000"
              keyboard="phone-pad"
              onChange={(v: string) =>
                setFormData({ ...formData, phone: formatPhone(v) })
              }
            />

            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Selecione sua cidade</Text>
              <View style={styles.pickerContainer}>
                {loadingCities ? (
                  <View style={styles.loadingCitiesBox}>
                    <Text style={styles.loadingText}>Carregando cidades...</Text>
                  </View>
                ) : (
                  <Picker
                    selectedValue={formData.city}
                    onValueChange={(value) =>
                      setFormData({ ...formData, city: value })
                    }
                    style={styles.picker}
                  >
                    {cities.map((city) => (
                      <Picker.Item key={city} label={city} value={city} />
                    ))}
                  </Picker>
                )}
              </View>
            </View>

            <View style={styles.row}>
              <Input
                label="Rua"
                icon={<MapPin size={20} color="#FF6B35" strokeWidth={2} />}
                value={formData.street}
                placeholder="Nome da rua"
                flex={2}
                onChange={(v: string) =>
                  setFormData({ ...formData, street: v })
                }
              />
              <Input
                label="Nº"
                icon={<Home size={20} color="#FF6B35" strokeWidth={2} />}
                value={formData.houseNumber}
                placeholder="123"
                keyboard="numeric"
                flex={1}
                onChange={(v: string) =>
                  setFormData({ ...formData, houseNumber: v })
                }
              />
            </View>

            <PasswordInput
              label="Senha"
              value={formData.password}
              placeholder="Mínimo 6 caracteres"
              visible={showPassword}
              toggle={() => setShowPassword(!showPassword)}
              onChange={(v: string) =>
                setFormData({ ...formData, password: v })
              }
            />

            <PasswordInput
              label="Confirmar senha"
              value={formData.confirmPassword}
              placeholder="Digite a senha novamente"
              visible={showConfirmPassword}
              toggle={() => setShowConfirmPassword(!showConfirmPassword)}
              onChange={(v: string) =>
                setFormData({ ...formData, confirmPassword: v })
              }
            />

            <TouchableOpacity
              style={[
                styles.registerButton,
                loading && styles.registerButtonDisabled,
              ]}
              onPress={handleRegister}
              disabled={loading}
            >
              {loading ? (
                <LoadingSpinner size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.registerButtonText}>Criar Conta</Text>
              )}
            </TouchableOpacity>

            <View style={styles.loginLink}>
              <Text style={styles.loginText}>Já tem conta? </Text>
              <Link href="/auth/login" style={styles.loginLinkText}>
                Entrar
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

type InputProps = {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  keyboard?: 'default' | 'numeric' | 'email-address' | 'phone-pad';
  flex?: number;
  placeholder?: string;
};

const Input = ({
  label,
  icon,
  value,
  onChange,
  keyboard = 'default',
  flex = 1,
  placeholder,
}: InputProps) => (
  <View style={[styles.inputGroup, { flex }]}>
    <Text style={styles.inputLabel}>{label}</Text>
    <View style={styles.inputContainer}>
      {icon}
      <TextInput
        style={styles.textInput}
        value={value}
        onChangeText={onChange}
        keyboardType={keyboard}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  </View>
);

type PasswordInputProps = {
  label: string;
  value: string;
  visible: boolean;
  toggle: () => void;
  onChange: (value: string) => void;
  placeholder?: string;
};

const PasswordInput = ({
  label,
  value,
  visible,
  toggle,
  onChange,
  placeholder,
}: PasswordInputProps) => (
  <View style={styles.inputGroup}>
    <Text style={styles.inputLabel}>{label}</Text>
    <View style={styles.inputContainer}>
      <Lock size={20} color="#FF6B35" strokeWidth={2} />
      <TextInput
        style={styles.textInput}
        secureTextEntry={!visible}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#94A3B8"
        autoCapitalize="none"
        autoCorrect={false}
      />
      <TouchableOpacity onPress={toggle} style={styles.eyeButton}>
        {visible ? (
          <EyeOff size={20} color="#FF6B35" strokeWidth={2} />
        ) : (
          <Eye size={20} color="#FF6B35" strokeWidth={2} />
        )}
      </TouchableOpacity>
    </View>
  </View>
);

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFF5F0',
  },
  container: {
    flex: 1,
    backgroundColor: '#FFF5F0',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logoContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
    borderWidth: 3,
    borderColor: '#FF6B35',
    padding: 8,
  },
  logoImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 8,
    marginBottom: 4,
  },
  logoWhite: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    textShadowColor: '#000000',
    textShadowOffset: { width: 2, height: 1 },
    textShadowRadius: 3,
    letterSpacing: 1,
  },
  logoYellow: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFD700',
    textShadowColor: '#FF6B35',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
    letterSpacing: 1,
    marginLeft: 6,
  },
  tagline: {
    fontSize: 14,
    color: '#64748B',
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 4,
  },
  form: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    padding: 28,
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#1E293B',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#64748B',
    marginBottom: 28,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1E293B',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFE0D4',
    borderRadius: 14,
    paddingHorizontal: 16,
    backgroundColor: '#FEFAF8',
  },
  textInput: {
    flex: 1,
    paddingVertical: 14,
    paddingLeft: 12,
    fontSize: 16,
    color: '#1E293B',
  },
  eyeButton: {
    padding: 4,
  },
  pickerContainer: {
    borderWidth: 2,
    borderColor: '#FFE0D4',
    borderRadius: 14,
    backgroundColor: '#FEFAF8',
    overflow: 'hidden',
  },
  picker: {
    color: '#1E293B',
  },
  loadingCitiesBox: {
    paddingHorizontal: 14,
    paddingVertical: 16,
  },
  loadingText: {
    color: '#64748B',
    fontSize: 14,
  },
  registerButton: {
    backgroundColor: '#FF6B35',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    marginBottom: 24,
    shadowColor: '#FF6B35',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  registerButtonDisabled: {
    backgroundColor: '#FFB8A0',
    shadowOpacity: 0.1,
  },
  registerButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 17,
    letterSpacing: 0.5,
  },
  loginLink: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    fontSize: 14,
    color: '#64748B',
  },
  loginLinkText: {
    fontSize: 14,
    color: '#FF6B35',
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
});