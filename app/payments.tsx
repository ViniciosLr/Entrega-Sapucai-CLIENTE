// app/payments.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ScrollView,
  Alert,
  ActivityIndicator,
  Dimensions,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { HeaderMenu } from '@/components/HeaderMenu';
import { paymentService } from '@/services/payment.service';

const { width } = Dimensions.get('window');

// Tipagens - "outro" removido permanentemente
type CardBrand = 'visa' | 'mastercard' | 'amex' | 'elo' | 'hipercard' | 'diners' | 'discover';
type CardType = 'credit' | 'debit';

interface VirtualCard {
  id: string;
  user_id: string;
  card_name: string;
  last_digits: string;
  brand: CardBrand;
  type: CardType;
  is_default: boolean;
  token?: string;
  created_at: string;
  masked_number?: string;
}

interface CardFormData {
  cardNumber: string;
  holderName: string;
  expiryDate: string;
  cvv: string;
  nickname: string;
  cardType: CardType;
  isDefault: boolean;
}

const BRAND_ICONS: Record<CardBrand, string> = {
  visa: 'card-outline',
  mastercard: 'card-outline',
  amex: 'card-outline',
  elo: 'card-outline',
  hipercard: 'card-outline',
  diners: 'card-outline',
  discover: 'card-outline',
};

const BRAND_COLORS: Record<CardBrand, string> = {
  visa: '#1A1F71',
  mastercard: '#EB001B',
  amex: '#2E77BC',
  elo: '#00A4E0',
  hipercard: '#B3131B',
  diners: '#0079BE',
  discover: '#FF6000',
};

// 🔥 NUNCA retorna "outro" – fallback sempre "visa"
const detectCardBrand = (number: string): CardBrand => {
  const cleaned = number.replace(/\D/g, '');
  
  if (/^4/.test(cleaned)) return 'visa';
  if (/^5[1-5]/.test(cleaned)) return 'mastercard';
  if (/^3[47]/.test(cleaned)) return 'amex';
  
  // Regex ELO abrangente
  if (/^(4011|4312|4389|4514|4576|5041|5067|5090|6277|6362|6363|6368|6370|6376|6377|6379|6389|6390|6500|6504|6505|6506|6507|6508|6509|6515|6516|6517|6518|6519|6520|6521|6522|6523|6524|6525|6526|6527|6528|6529|6530|6531|6532|6533|6534|6550|6551|6552|6553|6554|6555|6556)/.test(cleaned)) return 'elo';
  
  return 'visa'; // fallback seguro
};

const formatCardNumber = (text: string): string => {
  const cleaned = text.replace(/\D/g, '').slice(0, 16);
  return cleaned.replace(/(\d{4})(?=\d)/g, '$1 ');
};

const formatExpiryDate = (text: string): string => {
  const cleaned = text.replace(/\D/g, '').slice(0, 4);
  if (cleaned.length >= 3) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
  return cleaned;
};

export default function PaymentsScreen() {
  const { user } = useAuth();
  const [savedCards, setSavedCards] = useState<VirtualCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<CardFormData>({
    cardNumber: '',
    holderName: '',
    expiryDate: '',
    cvv: '',
    nickname: '',
    cardType: 'credit',
    isDefault: false,
  });

  const detectedBrand = detectCardBrand(form.cardNumber);

  const fetchCards = async () => {
    setLoading(true);
    try {
      if (!user?.id) {
        setSavedCards([]);
        return;
      }
      const cards = await paymentService.getUserCards(user.id);
      setSavedCards(cards.map(card => ({
        id: card.id,
        user_id: card.user_id,
        card_name: card.card_name,
        last_digits: card.last_digits,
        brand: card.brand as CardBrand,
        type: card.card_type,
        is_default: card.is_default,
        masked_number: card.masked_number,
        created_at: card.created_at,
      })));
    } catch (error) {
      console.error('Erro ao carregar cartões:', error);
      Alert.alert('Erro', 'Não foi possível carregar seus cartões.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCards();
  }, [user?.id]);

  // Valida apenas dados do cartão – CPF será validado pelo backend
  const validateForm = (): boolean => {
    const cleanedNumber = form.cardNumber.replace(/\D/g, '');
    if (cleanedNumber.length < 13 || cleanedNumber.length > 16) {
      Alert.alert('Atenção', 'Número do cartão inválido.');
      return false;
    }
    if (!form.holderName.trim()) {
      Alert.alert('Atenção', 'Informe o nome impresso no cartão.');
      return false;
    }
    if (form.expiryDate.length !== 5) {
      Alert.alert('Atenção', 'Data de validade incompleta.');
      return false;
    }
    const [month] = form.expiryDate.split('/');
    if (parseInt(month) > 12 || parseInt(month) < 1) {
      Alert.alert('Atenção', 'Mês de validade inválido.');
      return false;
    }
    if (form.cvv.length < 3) {
      Alert.alert('Atenção', 'CVV incompleto.');
      return false;
    }
    return true;
  };

  const handleSaveCard = async () => {
    if (!validateForm() || !user?.id) return;
    setIsSaving(true);

    try {
      const newCard = await paymentService.addCard({
        user_id: user.id,
        card_name: form.nickname.trim() || `Cartão ${form.cardType === 'credit' ? 'Crédito' : 'Débito'}`,
        card_type: form.cardType,
        brand: detectedBrand, // nunca será "outro"
        number: form.cardNumber.replace(/\D/g, ''),
        holder_name: form.holderName.trim(),
        expiration_month: form.expiryDate.split('/')[0],
        expiration_year: form.expiryDate.split('/')[1],
        cvv: form.cvv,
        is_default: form.isDefault,
      });

      setSavedCards(prev => [...prev, {
        id: newCard.id,
        user_id: newCard.user_id,
        card_name: newCard.card_name,
        last_digits: newCard.last_digits,
        brand: newCard.brand as CardBrand,
        type: newCard.card_type,
        is_default: newCard.is_default,
        masked_number: newCard.masked_number,
        created_at: newCard.created_at,
      }]);

      setModalVisible(false);
      resetForm();
      Alert.alert('Sucesso', 'Cartão armazenado com segurança!');
    } catch (error: any) {
      console.error('Erro ao salvar cartão:', error);
      // Tratamento específico para erro de CPF ou bandeira vindo do backend
      const msg = error.message || '';
      if (msg.includes('CPF') || msg.includes('identification') || msg.includes('bin_not_found')) {
        Alert.alert(
          'CPF inválido ou não cadastrado',
          'Para usar cartões, é necessário ter um CPF válido cadastrado no seu perfil. Acesse "Meu Perfil" e atualize seus dados.'
        );
      } else if (msg.includes('brand') || msg.includes('Payment Method')) {
        Alert.alert('Bandeira não suportada', 'A bandeira do seu cartão não é aceita. Use Visa, Mastercard, Amex ou Elo.');
      } else {
        Alert.alert('Erro', msg || 'Não foi possível salvar o cartão. Verifique os dados e tente novamente.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleRemoveCard = (cardId: string) => {
    Alert.alert(
      'Remover Cartão',
      'Tem certeza que deseja excluir este cartão?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Remover', 
          style: 'destructive',
          onPress: async () => {
            try {
              await paymentService.deleteCard(cardId);
              setSavedCards(prev => prev.filter(c => c.id !== cardId));
              Alert.alert('Removido', 'Cartão excluído com sucesso.');
            } catch (error) {
              console.error('Erro ao remover cartão:', error);
              Alert.alert('Erro', 'Falha ao remover o cartão.');
            }
          }
        }
      ]
    );
  };

  const resetForm = () => {
    setForm({
      cardNumber: '',
      holderName: '',
      expiryDate: '',
      cvv: '',
      nickname: '',
      cardType: 'credit',
      isDefault: false,
    });
  };

  const renderSavedCards = () => {
    if (loading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FF6B6B" />
          <Text style={styles.loadingText}>Carregando seus cartões...</Text>
        </View>
      );
    }

    if (savedCards.length === 0) {
      return (
        <View style={styles.emptyState}>
          <Ionicons name="card-outline" size={64} color="#CCC" />
          <Text style={styles.emptyTitle}>Nenhum cartão salvo</Text>
          <Text style={styles.emptyDescription}>
            Adicione um cartão de crédito ou débito para agilizar seus pagamentos.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.cardList}>
        {savedCards.map(card => (
          <View key={card.id} style={styles.cardContainer}>
            <View style={[styles.cardBadge, { backgroundColor: BRAND_COLORS[card.brand] || '#666' }]}>
              <View style={styles.cardIconRow}>
                <Ionicons name={BRAND_ICONS[card.brand]} size={20} color="#FFF" />
                <Text style={styles.cardTypeLabel}>
                  {card.type === 'credit' ? 'Crédito' : 'Débito'}
                </Text>
              </View>
              <Text style={styles.cardNumber}>{card.masked_number || `**** ${card.last_digits}`}</Text>
              <Text style={styles.cardName}>{card.card_name}</Text>
              {card.is_default && (
                <View style={styles.defaultBadge}>
                  <Ionicons name="star" size={12} color="#FFD700" />
                  <Text style={styles.defaultText}>Principal</Text>
                </View>
              )}
            </View>
            <TouchableOpacity 
              style={styles.removeCardButton}
              onPress={() => handleRemoveCard(card.id)}
            >
              <Ionicons name="trash-outline" size={18} color="#DC2626" />
            </TouchableOpacity>
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#FF6B6B" />
      
      <View style={styles.header}>
        <HeaderMenu />
        <Text style={styles.headerTitle}>Formas de Pagamento</Text>
        <View style={styles.spacer} />
      </View>

      <ScrollView 
        style={styles.content} 
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.sectionTitle}>Seus Cartões</Text>
        <Text style={styles.sectionSubtitle}>
          Cartões salvos para pagamentos rápidos e seguros
        </Text>

        {renderSavedCards()}

        <TouchableOpacity 
          style={styles.addCardButton}
          onPress={() => setModalVisible(true)}
          activeOpacity={0.8}
        >
          <Ionicons name="add-circle-outline" size={24} color="#FFF" />
          <Text style={styles.addCardText}>Adicionar Novo Cartão</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Modal de Cadastro - igual ao original, sem CPF extra */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => {
          setModalVisible(false);
          resetForm();
        }}
      >
        <View style={styles.modalContainer}>
          <SafeAreaView style={styles.modalSafeArea}>
            <View style={styles.modalHeader}>
              <TouchableOpacity 
                onPress={() => {
                  setModalVisible(false);
                  resetForm();
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Ionicons name="close" size={28} color="#333" />
              </TouchableOpacity>
              <Text style={styles.modalTitle}>Novo Cartão</Text>
              <View style={styles.spacer} />
            </View>

            <ScrollView 
              style={styles.modalContent} 
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.inputLabel}>Tipo de Cartão</Text>
              <View style={styles.typeSelector}>
                <TouchableOpacity
                  style={[styles.typeOption, form.cardType === 'credit' && styles.typeOptionActive]}
                  onPress={() => setForm({ ...form, cardType: 'credit' })}
                >
                  <Ionicons name="card" size={18} color={form.cardType === 'credit' ? '#FFF' : '#666'} />
                  <Text style={[styles.typeText, form.cardType === 'credit' && styles.typeTextActive]}>Crédito</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeOption, form.cardType === 'debit' && styles.typeOptionActive]}
                  onPress={() => setForm({ ...form, cardType: 'debit' })}
                >
                  <Ionicons name="cash" size={18} color={form.cardType === 'debit' ? '#FFF' : '#666'} />
                  <Text style={[styles.typeText, form.cardType === 'debit' && styles.typeTextActive]}>Débito</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.inputLabel}>Número do Cartão</Text>
              <View style={styles.cardNumberInputRow}>
                <TextInput
                  style={styles.input}
                  placeholder="1234 5678 9012 3456"
                  keyboardType="numeric"
                  maxLength={19}
                  value={formatCardNumber(form.cardNumber)}
                  onChangeText={text => setForm({ ...form, cardNumber: text })}
                  placeholderTextColor="#999"
                />
                {form.cardNumber.replace(/\D/g, '').length > 0 && (
                  <View style={[styles.brandIcon, { backgroundColor: BRAND_COLORS[detectedBrand] }]}>
                    <Ionicons name={BRAND_ICONS[detectedBrand]} size={18} color="#FFF" />
                  </View>
                )}
              </View>

              <Text style={styles.inputLabel}>Nome do Titular</Text>
              <TextInput
                style={styles.input}
                placeholder="Como está impresso no cartão"
                value={form.holderName}
                onChangeText={text => setForm({ ...form, holderName: text })}
                autoCapitalize="words"
                placeholderTextColor="#999"
              />

              <View style={styles.row}>
                <View style={styles.flex1}>
                  <Text style={styles.inputLabel}>Validade</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="MM/AA"
                    keyboardType="numeric"
                    maxLength={5}
                    value={formatExpiryDate(form.expiryDate)}
                    onChangeText={text => setForm({ ...form, expiryDate: text })}
                    placeholderTextColor="#999"
                  />
                </View>
                <View style={styles.flex1}>
                  <Text style={styles.inputLabel}>CVV</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="123"
                    keyboardType="numeric"
                    maxLength={4}
                    secureTextEntry
                    value={form.cvv}
                    onChangeText={text => setForm({ ...form, cvv: text })}
                    placeholderTextColor="#999"
                  />
                </View>
              </View>

              <Text style={styles.inputLabel}>Apelido (opcional)</Text>
              <TextInput
                style={styles.input}
                placeholder="Ex: Cartão da empresa"
                value={form.nickname}
                onChangeText={text => setForm({ ...form, nickname: text })}
                placeholderTextColor="#999"
              />

              <TouchableOpacity 
                style={styles.defaultCheckRow}
                onPress={() => setForm({ ...form, isDefault: !form.isDefault })}
              >
                <Ionicons name={form.isDefault ? 'checkbox' : 'square-outline'} size={22} color={form.isDefault ? '#FF6B6B' : '#999'} />
                <Text style={styles.defaultCheckText}>Definir como cartão principal</Text>
              </TouchableOpacity>

              <TouchableOpacity 
                style={[styles.saveButton, isSaving && styles.disabledButton]} 
                onPress={handleSaveCard}
                disabled={isSaving}
                activeOpacity={0.8}
              >
                {isSaving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="lock-closed" size={18} color="#FFF" />
                    <Text style={styles.saveButtonText}>Salvar Cartão com Segurança</Text>
                  </>
                )}
              </TouchableOpacity>

              <Text style={styles.securityNote}>
                Seus dados são criptografados e armazenados de forma segura. Nenhum dado sensível trafega sem proteção.
              </Text>
            </ScrollView>
          </SafeAreaView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9F9F9' },
  header: {
    backgroundColor: '#FF6B6B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFF' },
  spacer: { width: 36 },
  content: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  contentContainer: { paddingBottom: 30 },
  sectionTitle: { fontSize: 22, fontWeight: 'bold', color: '#333', marginBottom: 4 },
  sectionSubtitle: { fontSize: 14, color: '#888', marginBottom: 20 },
  centered: { alignItems: 'center', marginTop: 60 },
  loadingText: { marginTop: 12, color: '#888', fontSize: 14 },
  emptyState: { alignItems: 'center', marginTop: 40 },
  emptyTitle: { fontSize: 18, fontWeight: '600', color: '#555', marginTop: 16 },
  emptyDescription: { fontSize: 14, color: '#888', textAlign: 'center', marginTop: 8, paddingHorizontal: 20 },
  cardList: { gap: 16 },
  cardContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardBadge: { flex: 1, borderRadius: 12, padding: 16, justifyContent: 'space-between' },
  cardIconRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 12 },
  cardTypeLabel: { color: '#FFF', fontSize: 13, fontWeight: '500' },
  cardNumber: { color: '#FFF', fontSize: 18, fontWeight: '600', letterSpacing: 2, marginBottom: 8 },
  cardName: { color: 'rgba(255,255,255,0.9)', fontSize: 13 },
  defaultBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 10 },
  defaultText: { color: '#FFD700', fontSize: 11, fontWeight: '600' },
  removeCardButton: { padding: 8 },
  addCardButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FF6B6B',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 30,
    gap: 8,
  },
  addCardText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  modalContainer: { flex: 1, backgroundColor: '#FFF' },
  modalSafeArea: { flex: 1, backgroundColor: '#FFF' },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  modalTitle: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  modalContent: { flex: 1, paddingHorizontal: 20, paddingTop: 20 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#555', marginBottom: 6, marginTop: 14 },
  input: {
    backgroundColor: '#F9F9F9',
    borderRadius: 8,
    padding: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    color: '#333',
  },
  cardNumberInputRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandIcon: { width: 40, height: 28, borderRadius: 6, justifyContent: 'center', alignItems: 'center' },
  row: { flexDirection: 'row', gap: 12 },
  flex1: { flex: 1 },
  typeSelector: { flexDirection: 'row', gap: 10 },
  typeOption: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E5E5',
    gap: 6,
  },
  typeOptionActive: { backgroundColor: '#FF6B6B', borderColor: '#FF6B6B' },
  typeText: { fontSize: 14, color: '#666' },
  typeTextActive: { color: '#FFF', fontWeight: '600' },
  defaultCheckRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 24 },
  defaultCheckText: { fontSize: 15, color: '#333' },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#4CAF50',
    borderRadius: 12,
    paddingVertical: 16,
    marginTop: 30,
    gap: 8,
  },
  disabledButton: { opacity: 0.6 },
  saveButtonText: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  securityNote: {
    textAlign: 'center',
    fontSize: 12,
    color: '#AAA',
    marginTop: 20,
    marginBottom: 40,
    paddingHorizontal: 20,
    lineHeight: 18,
  },
});