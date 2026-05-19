// app/order/[id].tsx
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
  Linking,
  Dimensions,
  Platform,
  Modal,
  KeyboardAvoidingView,
  TextInput,
  Image,
  Animated,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Package,
  MessageCircle,
  CircleCheck as CheckCircle,
  Circle as XCircle,
  TriangleAlert as AlertTriangle,
  Bike,
  Navigation,
  Map,
  Shield,
  Send,
  Star,
  ChefHat,
  ShoppingBag,
  Home,
  Store,
  Timer,
  User,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface OrderDetails {
  id: string;
  customer_id: string;
  motoboy_id?: string;
  commerce_id?: string;
  merchandise_type: string;
  pickup_address: string;
  delivery_address: string;
  pickup_bairro: string;
  delivery_bairro: string;
  notes?: string;
  price: number;
  platform_fee: number;
  distance_km: number;
  status: 'criado' | 'aceito' | 'pronto' | 'aguardando_motoboy' | 'motoboy_a_caminho' | 'em_andamento' | 'finalizado' | 'cancelado';
  created_at: string;
  updated_at: string;
  accepted_at?: string;
  ready_at?: string;
  picked_up_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  motoboy_assigned_at?: string;
  payment_method: string;
  pickup_lat: number;
  pickup_lng: number;
  delivery_lat: number;
  delivery_lng: number;
  late_cancel_fee?: number;
  cancelled_by?: string;
  cancel_reason?: string;
  motoboy?: {
    name: string;
    phone: string;
    vehicle_type: string;
    license_plate: string;
    fast_deliveries?: number;
    slow_deliveries?: number;
    driver_photo_url?: string;
  };
  commerce?: {
    name: string;
    phone: string;
    image_url?: string;
  };
  motoboy_rating?: {
    id: string;
    is_fast: boolean;
  };
}

interface ChatMessage {
  id: string;
  order_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  sender_name?: string;
  isCurrentUser?: boolean;
}

// ========================================
// PIPELINE DE STATUS — CORRIGIDO COM TODOS OS STATUS
// ========================================
const DELIVERY_STEPS = [
  {
    key: 'criado',
    label: 'Pedido Enviado ao Comércio',
    sublabel: 'Aguardando o estabelecimento aceitar seu pedido',
    icon: Store,
    color: '#6B7280',
    statusCondition: (order: OrderDetails) => order.status === 'criado',
  },
  {
    key: 'em_preparo',
    label: 'Em Preparo',
    sublabel: 'O estabelecimento está preparando seu pedido',
    icon: ChefHat,
    color: '#F59E0B',
    statusCondition: (order: OrderDetails) => order.status === 'aceito',
  },
  {
    key: 'pronto',
    label: 'Pedido Pronto',
    sublabel: 'Seu pedido está pronto, aguardando motoboy',
    icon: ShoppingBag,
    color: '#8B5CF6',
    statusCondition: (order: OrderDetails) => order.status === 'pronto',
  },
  {
    key: 'aguardando_motoboy',
    label: 'Buscando Motoboy',
    sublabel: 'Procurando um entregador disponível...',
    icon: Bike,
    color: '#3B82F6',
    statusCondition: (order: OrderDetails) => order.status === 'aguardando_motoboy',
  },
  {
    key: 'motoboy_a_caminho',
    label: 'Motoboy a Caminho do Estabelecimento',
    sublabel: 'O entregador está indo buscar seu pedido',
    icon: Bike,
    color: '#2563EB',
    statusCondition: (order: OrderDetails) => 
      order.status === 'motoboy_a_caminho' && !order.picked_up_at,
  },
  {
    key: 'pedido_retirado',
    label: 'Pedido Retirado',
    sublabel: 'O entregador coletou seu pedido',
    icon: Package,
    color: '#10B981',
    statusCondition: (order: OrderDetails) =>
      order.status === 'em_andamento' && !!order.picked_up_at,
  },
  {
    key: 'deslocando_entrega',
    label: 'A Caminho da Sua Residência',
    sublabel: 'O entregador está indo até você',
    icon: Home,
    color: '#059669',
    statusCondition: (order: OrderDetails) =>
      order.status === 'em_andamento' && !!order.picked_up_at,
  },
  {
    key: 'entregue',
    label: 'Pedido Entregue!',
    sublabel: 'Aproveite seu pedido!',
    icon: CheckCircle,
    color: '#22C55E',
    statusCondition: (order: OrderDetails) => order.status === 'finalizado',
  },
];

// Função para determinar o step atual
const getCurrentStep = (order: OrderDetails): number => {
  if (order.status === 'cancelado') return -1;
  if (order.status === 'finalizado') return 7;
  if (order.status === 'em_andamento' && order.picked_up_at) return 6;
  if (order.status === 'em_andamento') return 5;
  if (order.status === 'motoboy_a_caminho') return 4;
  if (order.status === 'aguardando_motoboy') return 3;
  if (order.status === 'pronto') return 2;
  if (order.status === 'aceito') return 1;
  if (order.status === 'criado') return 0;
  return 0;
};

const calculateDeliveryEstimate = (distanceKm: number): string => {
  const estimatedMinutes = Math.ceil((distanceKm / 30) * 60);
  if (estimatedMinutes <= 1) return 'menos de 1 minuto';
  if (estimatedMinutes < 60) return `${estimatedMinutes} minutos`;
  const hours = Math.floor(estimatedMinutes / 60);
  const mins = estimatedMinutes % 60;
  return `${hours}h ${mins}min`;
};

// ========================================
// MÉTODOS DE PAGAMENTO — SUPORTE A PT‑BR E INGLÊS
// ========================================
const PAYMENT_METHODS: Record<string, { label: string; color: string }> = {
  pix: { label: 'Pix', color: '#32BB6F' },
  // Débito
  debito: { label: 'Cartão de Débito', color: '#2563EB' },
  debito_online: { label: 'Cartão de Débito', color: '#2563EB' },
  debito_cartao: { label: 'Cartão de Débito', color: '#2563EB' },
  debit: { label: 'Cartão de Débito', color: '#2563EB' },
  // Crédito
  credito: { label: 'Cartão de Crédito', color: '#9333EA' },
  credito_online: { label: 'Cartão de Crédito', color: '#9333EA' },
  credito_cartao: { label: 'Cartão de Crédito', color: '#9333EA' },
  credit: { label: 'Cartão de Crédito', color: '#9333EA' },
  // Dinheiro
  dinheiro: { label: 'Dinheiro', color: '#059669' },
  cash: { label: 'Dinheiro', color: '#059669' },
  money: { label: 'Dinheiro', color: '#059669' },
};

const MERCHANDISE_TYPES: Record<string, { label: string; color: string }> = {
  lanche: { label: 'Lanche', color: '#EA580C' },
  pizza: { label: 'Pizza', color: '#DC2626' },
  marmitex: { label: 'Marmitex', color: '#059669' },
  documento: { label: 'Documento', color: '#2563EB' },
  mercado: { label: 'Mercado', color: '#9333EA' },
  bebida: { label: 'Bebida', color: '#06B6D4' },
  outro: { label: 'Outro', color: '#6B7280' },
};

// ========================================
// COMPONENTE DE AVALIAÇÃO
// ========================================
function RatingModal({
  visible,
  onClose,
  onSubmit,
  motoboyName,
}: {
  visible: boolean;
  onClose: () => void;
  onSubmit: (isFast: boolean) => Promise<void>;
  motoboyName: string;
}) {
  const [rating, setRating] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === null) {
      Alert.alert('Avaliação', 'Por favor, selecione uma opção.');
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit(rating);
      onClose();
    } catch {
      Alert.alert('Erro', 'Não foi possível enviar a avaliação.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={ratingStyles.container}>
        <View style={ratingStyles.content}>
          <View style={ratingStyles.handle} />
          <Text style={ratingStyles.title}>Como foi a entrega?</Text>
          <Text style={ratingStyles.subtitle}>Avalie {motoboyName}</Text>

          <View style={ratingStyles.optionsContainer}>
            <TouchableOpacity
              style={[ratingStyles.optionButton, rating === true && ratingStyles.optionSelectedFast]}
              onPress={() => setRating(true)}
            >
              <View style={[ratingStyles.optionIcon, { backgroundColor: rating === true ? '#DCFCE7' : '#F3F4F6' }]}>
                <Star size={28} color={rating === true ? '#059669' : '#9CA3AF'} fill={rating === true ? '#059669' : 'none'} />
              </View>
              <View style={ratingStyles.optionTextContainer}>
                <Text style={[ratingStyles.optionText, rating === true && { color: '#059669' }]}>Entrega Rápida</Text>
                <Text style={ratingStyles.optionDescription}>Chegou antes do esperado</Text>
              </View>
              {rating === true && (
                <View style={ratingStyles.optionCheck}>
                  <CheckCircle size={20} color="#059669" />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[ratingStyles.optionButton, rating === false && ratingStyles.optionSelectedNormal]}
              onPress={() => setRating(false)}
            >
              <View style={[ratingStyles.optionIcon, { backgroundColor: rating === false ? '#FFF7ED' : '#F3F4F6' }]}>
                <Clock size={28} color={rating === false ? '#EA580C' : '#9CA3AF'} />
              </View>
              <View style={ratingStyles.optionTextContainer}>
                <Text style={[ratingStyles.optionText, rating === false && { color: '#EA580C' }]}>Entrega Normal</Text>
                <Text style={ratingStyles.optionDescription}>Dentro do tempo esperado</Text>
              </View>
              {rating === false && (
                <View style={ratingStyles.optionCheck}>
                  <CheckCircle size={20} color="#EA580C" />
                </View>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[ratingStyles.submitButton, rating === null && ratingStyles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={submitting || rating === null}
          >
            <Text style={ratingStyles.submitButtonText}>
              {submitting ? 'Enviando...' : 'Enviar Avaliação'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={ratingStyles.skipButton} onPress={onClose}>
            <Text style={ratingStyles.skipButtonText}>Agora não</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ========================================
// CHAT MODAL
// ========================================
function ChatModal({
  visible,
  onClose,
  orderId,
  orderStatus,
  chatTitle,
  targetType,
}: {
  visible: boolean;
  onClose: () => void;
  orderId: string;
  orderStatus: string;
  chatTitle?: string;
  targetType?: 'motoboy' | 'commerce' | 'support';
}) {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const subscriptionRef = useRef<any>(null);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (visible && orderId) {
      fetchMessages();
      subscribeToMessages();
    }
    return () => {
      if (subscriptionRef.current) {
        supabase.removeChannel(subscriptionRef.current);
        subscriptionRef.current = null;
      }
    };
  }, [visible, orderId]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 150);
    return () => clearTimeout(t);
  }, [messages.length, visible]);

  const fetchMessages = async () => {
    if (!orderId) return;
    setLoading(true);
    try {
      const { data: messagesData, error } = await supabase
        .from('order_chat_messages')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });
      if (error) throw error;

      const enriched = await Promise.all(
        (messagesData || []).map(async (msg: any) => {
          let senderName = 'Usuário';
          try {
            const { data: c } = await supabase.from('clientes').select('name').eq('user_id', msg.sender_id).single();
            if (c) senderName = c.name;
            else {
              const { data: m } = await supabase.from('motoboys').select('name').eq('user_id', msg.sender_id).single();
              if (m) senderName = m.name;
            }
          } catch {}
          return { ...msg, sender_name: senderName, isCurrentUser: msg.sender_id === user?.id };
        })
      );
      setMessages(enriched);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar as mensagens');
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    if (!orderId) return;
    if (subscriptionRef.current) {
      supabase.removeChannel(subscriptionRef.current);
      subscriptionRef.current = null;
    }
    subscriptionRef.current = supabase
      .channel(`order_chat_${orderId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'order_chat_messages', filter: `order_id=eq.${orderId}` },
        async (payload) => {
          const newMsg = payload.new as ChatMessage;
          let senderName = 'Usuário';
          try {
            const { data: c } = await supabase.from('clientes').select('name').eq('user_id', newMsg.sender_id).single();
            if (c) senderName = c.name;
            else {
              const { data: m } = await supabase.from('motoboys').select('name').eq('user_id', newMsg.sender_id).single();
              if (m) senderName = m.name;
            }
          } catch {}
          setMessages(prev => [...prev, { ...newMsg, sender_name: senderName, isCurrentUser: newMsg.sender_id === user?.id }]);
        }
      )
      .subscribe();
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user?.id || !orderId) return;
    setSending(true);
    try {
      const { error } = await supabase.from('order_chat_messages').insert({
        order_id: orderId,
        sender_id: user.id,
        sender_type: 'cliente',
        message: newMessage.trim(),
      });
      if (error) throw error;
      setNewMessage('');
    } catch {
      Alert.alert('Erro', 'Não foi possível enviar a mensagem');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (d: string) =>
    new Date(d).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const isClosedChat = orderStatus === 'finalizado' || orderStatus === 'cancelado';
  const inputSafePadding = insets.bottom + 10;

  const headerColor =
    targetType === 'commerce' ? '#8B5CF6' :
    targetType === 'support' ? '#EF4444' : '#2563EB';

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={chatStyles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <View style={chatStyles.content}>
          <View style={[chatStyles.header, { backgroundColor: headerColor }]}>
            <TouchableOpacity onPress={onClose} style={chatStyles.closeButton}>
              <ArrowLeft size={22} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={chatStyles.headerCenter}>
              <Text style={chatStyles.headerTitle}>{chatTitle || 'Chat da Corrida'}</Text>
              <View style={chatStyles.headerOnline}>
                <View style={chatStyles.onlineDot} />
                <Text style={chatStyles.headerSubtitle}>Online</Text>
              </View>
            </View>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            ref={scrollRef}
            style={chatStyles.messagesContainer}
            contentContainerStyle={[
              chatStyles.messagesContent,
              { paddingBottom: (!isClosedChat ? 110 : 40) + inputSafePadding },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {loading ? (
              <View style={chatStyles.emptyContainer}>
                <Text style={chatStyles.emptyText}>Carregando mensagens...</Text>
              </View>
            ) : messages.length === 0 ? (
              <View style={chatStyles.emptyContainer}>
                <MessageCircle size={40} color="#D1D5DB" />
                <Text style={chatStyles.emptyText}>Nenhuma mensagem ainda</Text>
                <Text style={chatStyles.emptySubtext}>Seja o primeiro a enviar!</Text>
              </View>
            ) : (
              messages.map((message) => (
                <View
                  key={message.id}
                  style={[chatStyles.messageWrapper, message.isCurrentUser && chatStyles.messageWrapperRight]}
                >
                  {!message.isCurrentUser && (
                    <View style={[chatStyles.avatarMini, { backgroundColor: headerColor + '20' }]}>
                      <Text style={[chatStyles.avatarMiniText, { color: headerColor }]}>
                        {(message.sender_name || 'U')[0].toUpperCase()}
                      </Text>
                    </View>
                  )}
                  <View
                    style={[
                      chatStyles.messageBubble,
                      message.isCurrentUser ? chatStyles.currentUserMessage : chatStyles.otherUserMessage,
                    ]}
                  >
                    {!message.isCurrentUser && (
                      <Text style={chatStyles.senderName}>{message.sender_name}</Text>
                    )}
                    <Text style={[chatStyles.messageText, message.isCurrentUser && chatStyles.currentUserMessageText]}>
                      {message.message}
                    </Text>
                    <Text style={[chatStyles.messageTime, message.isCurrentUser && { color: 'rgba(255,255,255,0.7)' }]}>
                      {formatTime(message.created_at)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          {!isClosedChat ? (
            <View style={[chatStyles.inputContainer, { paddingBottom: inputSafePadding }]}>
              <TextInput
                style={chatStyles.input}
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Digite sua mensagem..."
                placeholderTextColor="#9CA3AF"
                multiline
                maxLength={500}
                editable={!sending}
                textAlignVertical="top"
              />
              <TouchableOpacity
                style={[
                  chatStyles.sendButton,
                  { backgroundColor: headerColor },
                  (!newMessage.trim() || sending) && chatStyles.sendButtonDisabled,
                ]}
                onPress={handleSendMessage}
                disabled={!newMessage.trim() || sending}
              >
                <Send size={18} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ) : (
            <View style={[chatStyles.chatClosedContainer, { paddingBottom: inputSafePadding }]}>
              <Text style={chatStyles.chatClosedText}>
                Chat encerrado · Corrida {orderStatus === 'finalizado' ? 'finalizada' : 'cancelada'}
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ========================================
// COMPONENTE PRINCIPAL
// ========================================
export default function OrderDetailsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const insets = useSafeAreaInsets();
  const id = typeof params.id === 'string' ? params.id : params.id?.[0] || '';
  const { user } = useAuth();

  const [order, setOrder] = useState<OrderDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [showChat, setShowChat] = useState(false);
  const [chatConfig, setChatConfig] = useState<{
    title: string;
    targetType: 'motoboy' | 'commerce' | 'support';
  }>({ title: 'Chat da Corrida', targetType: 'motoboy' });

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [isRatingSubmitted, setIsRatingSubmitted] = useState(false);
  const [closingOrder, setClosingOrder] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const fetchOrderDetails = async () => {
    if (!id || !user) return;
    try {
      const { data: cliente } = await supabase
        .from('clientes')
        .select('id')
        .eq('user_id', user.id)
        .single();
      if (!cliente) throw new Error('Perfil não encontrado');

      const { data: orderData, error: orderError } = await supabase
        .from('pedidos')
        .select(`
          *,
          motoboy:motoboys (name, phone, vehicle_type, license_plate, fast_deliveries, slow_deliveries, driver_photo_url),
          commerce:commerces (name, phone, image_url)
        `)
        .eq('id', id)
        .eq('customer_id', cliente.id)
        .single();

      if (orderError) throw orderError;

      const { data: ratingData } = await supabase
        .from('motoboy_ratings')
        .select('*')
        .eq('order_id', id)
        .single();

      setOrder({ ...(orderData as any), motoboy_rating: ratingData || undefined });
      if (ratingData) setIsRatingSubmitted(true);
    } catch {
      Alert.alert('Erro', 'Não foi possível carregar os detalhes');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const finalizeOrder = async () => {
    if (!order) return;
    try {
      await supabase
        .from('pedidos')
        .update({ status: 'finalizado', completed_at: new Date().toISOString() })
        .eq('id', order.id);
      setOrder(prev =>
        prev ? { ...prev, status: 'finalizado', completed_at: new Date().toISOString() } : null
      );
    } catch {}
  };

  const submitRating = async (isFast: boolean) => {
    if (!order?.motoboy_id || !order?.id) return;
    const { error } = await supabase.from('motoboy_ratings').insert({
      order_id: order.id,
      motoboy_id: order.motoboy_id,
      is_fast: isFast,
    });
    if (error) throw error;
    setIsRatingSubmitted(true);
    await finalizeOrder();
    Alert.alert('✅ Obrigado!', isFast ? 'Entrega rápida registrada.' : 'Entrega normal registrada.');
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOrderDetails();
    setRefreshing(false);
  };

  const handleCancelOrder = () => {
    if (!order) return;

    if (!['aceito', 'criado'].includes(order.status)) {
      Alert.alert(
        'Não é possível cancelar',
        'Seu pedido já está em andamento. Entre em contato com o estabelecimento.'
      );
      return;
    }

    const timeSinceCreation = order?.created_at
      ? Math.floor((Date.now() - new Date(order.created_at).getTime()) / 1000)
      : 0;

    const canCancel = timeSinceCreation <= 300;

    if (!canCancel) {
      Alert.alert(
        'Prazo de cancelamento expirado',
        'Você só pode cancelar o pedido nos primeiros 5 minutos após a criação.\n\nEntre em contato com o estabelecimento diretamente pelo chat para solicitar o cancelamento.'
      );
      return;
    }

    Alert.alert('Cancelar Pedido', 'Tem certeza que deseja cancelar o pedido?', [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Sim, cancelar',
        style: 'destructive',
        onPress: async () => {
          try {
            await supabase
              .from('pedidos')
              .update({
                status: 'cancelado',
                cancelled_at: new Date().toISOString(),
                cancelled_by: 'customer',
                cancel_reason: 'Cancelado pelo cliente',
              })
              .eq('id', order.id);
            Alert.alert('Cancelado', 'Pedido cancelado com sucesso.');
          } catch {
            Alert.alert('Erro', 'Erro ao cancelar pedido');
          }
        },
      },
    ]);
  };

  const handleOpenMap = (lat: number, lng: number, label: string) => {
    const url =
      Platform.OS === 'ios'
        ? `maps://?q=${label}&ll=${lat},${lng}`
        : `geo:${lat},${lng}?q=${label}`;
    Linking.openURL(url).catch(() => Alert.alert('Erro', 'Não foi possível abrir o mapa'));
  };

  const openChat = (type: 'motoboy' | 'commerce' | 'support') => {
    const titles = {
      motoboy: 'Falar com o Motoboy',
      commerce: 'Falar com o Estabelecimento',
      support: 'Suporte',
    };
    setChatConfig({ title: titles[type], targetType: type });
    setShowChat(true);
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '--:--';
    return new Date(dateString).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
    });
  };

  const calculateElapsedTime = (startTime: string, endTime?: string) => {
    const start = new Date(startTime).getTime();
    const end = endTime ? new Date(endTime).getTime() : Date.now();
    const diff = end - start;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const calculateMotoboyStats = () => {
    if (!order?.motoboy) return null;
    const total = (order.motoboy.fast_deliveries || 0) + (order.motoboy.slow_deliveries || 0);
    if (total === 0) return null;
    return {
      total,
      fastPercentage: Math.round(((order.motoboy.fast_deliveries || 0) / total) * 100),
      fastDeliveries: order.motoboy.fast_deliveries || 0,
    };
  };

  useEffect(() => {
    fetchOrderDetails();
    const subscription = supabase
      .channel(`order_detail_${id}`)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'pedidos', filter: `id=eq.${id}` },
        () => fetchOrderDetails()
      )
      .subscribe();
    return () => {
      subscription.unsubscribe();
    };
  }, [id]);

  useEffect(() => {
    if (
      order?.status === 'finalizado' &&
      !order.motoboy_rating &&
      !isRatingSubmitted &&
      !closingOrder &&
      order.motoboy
    ) {
      setTimeout(() => setShowRatingModal(true), 500);
    }
  }, [order]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Carregando seu pedido...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.errorContainer}>
        <AlertTriangle size={48} color="#DC2626" />
        <Text style={styles.errorText}>Pedido não encontrado</Text>
        <TouchableOpacity style={styles.backButtonError} onPress={() => router.back()}>
          <Text style={styles.backButtonErrorText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const isCancelled = order.status === 'cancelado';
  const currentStep = getCurrentStep(order);
  const activeStep = currentStep >= 0 ? DELIVERY_STEPS[currentStep] : null;

  // --- CORREÇÃO DO MÉTODO DE PAGAMENTO (PT‑BR + INGLÊS) ---
  const normalizedPaymentMethod = (order.payment_method || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const paymentConfig =
    PAYMENT_METHODS[normalizedPaymentMethod] || {
      label: order.payment_method || 'Não informado',
      color: '#6B7280',
    };
  // ---------------------------------------------------------

  const merchandiseConfig = MERCHANDISE_TYPES[order.merchandise_type] || MERCHANDISE_TYPES.outro;
  const motoboyStats = calculateMotoboyStats();

  const canShowMotoboyChat =
    order.motoboy_id &&
    (order.status === 'motoboy_a_caminho' || order.status === 'em_andamento');
  const deliveryEstimate = calculateDeliveryEstimate(order.distance_km);
  const timeSinceCreation = order.created_at
    ? Math.floor((Date.now() - new Date(order.created_at).getTime()) / 1000)
    : 0;
  const canCancel = timeSinceCreation <= 300 && ['aceito', 'criado'].includes(order.status);
  const headerBg = isCancelled ? '#DC2626' : activeStep?.color || '#059669';

  return (
    <View style={styles.container}>
      {/* HEADER */}
      <View style={[styles.header, { paddingTop: insets.top + 12, backgroundColor: headerBg }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#FFFFFF" strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Acompanhar Pedido</Text>
          <Text style={styles.headerSubtitle}>#{order.id.slice(-8).toUpperCase()}</Text>
        </View>
        {(order.status === 'motoboy_a_caminho' || order.status === 'em_andamento') &&
          order.motoboy_id && (
            <TouchableOpacity
              style={styles.mapHeaderBtn}
              onPress={() => router.push(`/order/track/${order.id}`)}
            >
              <Map size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[styles.contentContainer, { paddingBottom: insets.bottom + 100 }]}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[headerBg]} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* CARD DE STATUS PRINCIPAL */}
        {!isCancelled ? (
          <View style={[styles.statusHeroCard, { borderLeftColor: activeStep?.color || '#059669' }]}>
            <View style={styles.statusHeroLeft}>
              {activeStep && (
                <Animated.View
                  style={[
                    styles.statusIconWrapper,
                    { backgroundColor: (activeStep?.color || '#059669') + '18' },
                    order.status !== 'finalizado' && { transform: [{ scale: pulseAnim }] },
                  ]}
                >
                  {React.createElement(activeStep.icon, {
                    size: 28,
                    color: activeStep.color,
                    strokeWidth: 2,
                  })}
                </Animated.View>
              )}
              <View style={styles.statusHeroText}>
                <Text style={[styles.statusHeroTitle, { color: activeStep?.color || '#059669' }]}>
                  {activeStep?.label || 'Processando pedido'}
                </Text>
                <Text style={styles.statusHeroDesc}>{activeStep?.sublabel}</Text>
                {order.status === 'em_andamento' && order.picked_up_at && (
                  <View style={styles.estimateContainer}>
                    <Timer size={14} color="#059669" />
                    <Text style={styles.estimateText}>
                      Estimativa de entrega: {deliveryEstimate}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        ) : (
          <View style={styles.cancelledCard}>
            <XCircle size={28} color="#DC2626" />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.cancelledTitle}>Pedido Cancelado</Text>
              {order.cancel_reason && (
                <Text style={styles.cancelledReason}>{order.cancel_reason}</Text>
              )}
            </View>
          </View>
        )}

        {/* PIPELINE DE PROGRESSO */}
        {!isCancelled && (
          <View style={styles.pipelineCard}>
            <Text style={styles.sectionLabel}>Progresso do Pedido</Text>
            <View style={styles.pipeline}>
              {DELIVERY_STEPS.map((step, index) => {
                const isCompleted = index < currentStep;
                const isCurrent = index === currentStep;
                const StepIcon = step.icon;

                // Oculta steps de "pedido retirado" e "a caminho" se não estiver em_andamento
                if (index === 5 && order.status !== 'em_andamento') return null;
                if (index === 6 && order.status !== 'em_andamento') return null;

                return (
                  <View key={step.key} style={styles.pipelineRow}>
                    <View style={styles.pipelineLeft}>
                      <View
                        style={[
                          styles.pipelineDot,
                          isCompleted && { backgroundColor: step.color, borderColor: step.color },
                          isCurrent && { backgroundColor: step.color, borderColor: step.color },
                          !isCompleted && !isCurrent && styles.pipelineDotFuture,
                        ]}
                      >
                        {isCompleted ? (
                          <CheckCircle size={12} color="#FFFFFF" />
                        ) : isCurrent ? (
                          <StepIcon size={12} color="#FFFFFF" />
                        ) : (
                          <View style={styles.pipelineDotInner} />
                        )}
                      </View>
                      {index < DELIVERY_STEPS.length - 1 && (
                        <View
                          style={[
                            styles.pipelineLine,
                            (isCompleted || isCurrent) && { backgroundColor: step.color },
                          ]}
                        />
                      )}
                    </View>
                    <View
                      style={[
                        styles.pipelineContent,
                        index < DELIVERY_STEPS.length - 1 && { paddingBottom: 16 },
                      ]}
                    >
                      <Text
                        style={[
                          styles.pipelineStepLabel,
                          isCurrent && { color: step.color, fontWeight: '700' },
                          isCompleted && { color: '#6B7280' },
                          !isCompleted && !isCurrent && { color: '#9CA3AF' },
                        ]}
                      >
                        {step.label}
                      </Text>
                      {isCurrent && (
                        <Text style={[styles.pipelineStepSublabel, { color: step.color + 'CC' }]}>
                          {step.sublabel}
                        </Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}

        {/* MOTOBOY CARD */}
        {order.motoboy && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Seu Entregador</Text>
            <View style={styles.motoboyRow}>
              <View style={styles.motoboyAvatarWrap}>
                {order.motoboy.driver_photo_url ? (
                  <Image
                    source={{ uri: order.motoboy.driver_photo_url }}
                    style={styles.motoboyAvatar}
                  />
                ) : (
                  <View style={[styles.motoboyAvatar, styles.motoboyAvatarFallback]}>
                    <Text style={styles.motoboyAvatarInitial}>
                      {order.motoboy.name[0].toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.motoboyOnlineBadge} />
              </View>

              <View style={styles.motoboyInfo}>
                <Text style={styles.motoboyName}>{order.motoboy.name}</Text>
                <View style={styles.motoboyMeta}>
                  <Bike size={13} color="#6B7280" />
                  <Text style={styles.motoboyMetaText}>
                    {order.motoboy.vehicle_type.toUpperCase()}
                  </Text>
                  <Text style={styles.dotSep}>·</Text>
                  <Shield size={13} color="#6B7280" />
                  <Text style={styles.motoboyMetaText}>{order.motoboy.license_plate}</Text>
                </View>

                {motoboyStats && (
                  <View style={styles.ratingRow}>
                    <Star size={13} color="#F59E0B" fill="#F59E0B" />
                    <Text style={styles.ratingText}>
                      {motoboyStats.fastPercentage}% entregas rápidas
                    </Text>
                    <Text style={styles.ratingTotal}>({motoboyStats.total} total)</Text>
                  </View>
                )}
              </View>

              {canShowMotoboyChat && (
                <TouchableOpacity style={styles.callBtn} onPress={() => openChat('motoboy')}>
                  <MessageCircle size={18} color="#2563EB" />
                </TouchableOpacity>
              )}
            </View>

            {order.motoboy_rating && (
              <View
                style={[
                  styles.ratingBadge,
                  { backgroundColor: order.motoboy_rating.is_fast ? '#DCFCE7' : '#FFF7ED' },
                ]}
              >
                {order.motoboy_rating.is_fast ? (
                  <Star size={14} color="#059669" fill="#059669" />
                ) : (
                  <Clock size={14} color="#EA580C" />
                )}
                <Text
                  style={[
                    styles.ratingBadgeText,
                    { color: order.motoboy_rating.is_fast ? '#059669' : '#EA580C' },
                  ]}
                >
                  Você avaliou: {order.motoboy_rating.is_fast ? 'Entrega Rápida' : 'Entrega Normal'}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* ENDEREÇOS */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Trajeto</Text>

          <TouchableOpacity
            style={styles.addressRow}
            onPress={() => handleOpenMap(order.pickup_lat, order.pickup_lng, 'Retirada')}
          >
            <View style={[styles.addressDot, { backgroundColor: '#10B981' }]} />
            <View style={styles.addressInfo}>
              <Text style={styles.addressType}>RETIRADA</Text>
              <Text style={styles.addressText} numberOfLines={2}>
                {order.pickup_address}
              </Text>
              {order.pickup_bairro && (
                <Text style={styles.addressBairro}>{order.pickup_bairro}</Text>
              )}
            </View>
            <Navigation size={16} color="#10B981" />
          </TouchableOpacity>

          <View style={styles.addressConnector}>
            <View style={[styles.addressConnectorLine, { left: 15 }]} />
            <View style={styles.distanceBadge}>
              <Text style={styles.distanceBadgeText}>{order.distance_km.toFixed(1)} km</Text>
            </View>
          </View>

          <TouchableOpacity
            style={styles.addressRow}
            onPress={() => handleOpenMap(order.delivery_lat, order.delivery_lng, 'Entrega')}
          >
            <View style={[styles.addressDot, { backgroundColor: '#EF4444' }]} />
            <View style={styles.addressInfo}>
              <Text style={styles.addressType}>ENTREGA</Text>
              <Text style={styles.addressText} numberOfLines={2}>
                {order.delivery_address}
              </Text>
              {order.delivery_bairro && (
                <Text style={styles.addressBairro}>{order.delivery_bairro}</Text>
              )}
            </View>
            <Navigation size={16} color="#EF4444" />
          </TouchableOpacity>

          {order.motoboy_id &&
            (order.status === 'motoboy_a_caminho' || order.status === 'em_andamento') && (
              <TouchableOpacity
                style={styles.trackMapBtn}
                onPress={() => router.push(`/order/track/${order.id}`)}
              >
                <Map size={18} color="#FFFFFF" />
                <Text style={styles.trackMapBtnText}>Ver no Mapa em Tempo Real</Text>
              </TouchableOpacity>
            )}
        </View>

        {/* RESUMO FINANCEIRO */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Resumo</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Valor total</Text>
            <Text style={styles.summaryValue}>R$ {order.price.toFixed(2)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Pagamento</Text>
            <View style={[styles.paymentBadge, { backgroundColor: paymentConfig.color + '15' }]}>
              <Text style={[styles.paymentBadgeText, { color: paymentConfig.color }]}>
                {paymentConfig.label}
              </Text>
            </View>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Distância</Text>
            <Text style={styles.summaryValue}>{order.distance_km.toFixed(1)} km</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryKey}>Tipo de mercadoria</Text>
            <Text style={styles.summaryValue}>{merchandiseConfig.label}</Text>
          </View>
          <View style={[styles.summaryRow, { borderBottomWidth: 0 }]}>
            <Text style={styles.summaryKey}>Tempo decorrido</Text>
            <Text style={styles.summaryValue}>{calculateElapsedTime(order.created_at)}</Text>
          </View>
        </View>

        {/* NOTAS */}
        {order.notes && (
          <View style={styles.card}>
            <Text style={styles.sectionLabel}>Instruções Especiais</Text>
            <View style={styles.notesBox}>
              <Text style={styles.notesText}>{order.notes}</Text>
            </View>
          </View>
        )}

        {/* TIMELINE DE HORÁRIOS */}
        <View style={styles.card}>
          <Text style={styles.sectionLabel}>Histórico de Horários</Text>
          {[
            { label: 'Pedido criado', time: order.created_at, icon: '📋' },
            { label: 'Pedido aceito pelo comércio', time: order.accepted_at, icon: '✅' },
            { label: 'Pedido pronto', time: order.ready_at, icon: '🍽️' },
            { label: 'Aguardando motoboy', time: order.status === 'aguardando_motoboy' ? new Date().toISOString() : undefined, icon: '🏍️' },
            { label: 'Motoboy aceitou', time: order.motoboy_assigned_at, icon: '🏍️' },
            { label: 'Pedido retirado', time: order.picked_up_at, icon: '📦' },
            { label: 'Pedido entregue', time: order.completed_at, icon: '🏠' },
            { label: 'Cancelado', time: order.cancelled_at, icon: '❌' },
          ]
            .filter(e => e.time)
            .map((entry, i) => (
              <View key={i} style={styles.timelineRow}>
                <Text style={styles.timelineIcon}>{entry.icon}</Text>
                <Text style={styles.timelineLabel}>{entry.label}</Text>
                <Text style={styles.timelineTime}>{formatDateTime(entry.time)}</Text>
              </View>
            ))}
        </View>

        {/* AÇÕES */}
        <View style={styles.actionsSection}>
          {canShowMotoboyChat && (
            <TouchableOpacity
              style={[styles.actionBtn, { backgroundColor: '#2563EB' }]}
              onPress={() => openChat('motoboy')}
            >
              <Bike size={18} color="#FFFFFF" />
              <Text style={styles.actionBtnText}>Falar com o Motoboy</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#7C3AED' }]}
            onPress={() => openChat('commerce')}
          >
            <Store size={18} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Falar com o Estabelecimento</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: '#374151' }]}
            onPress={() =>
              router.push({ pathname: '/support', params: { pedidoId: order?.id } as any })
            }
          >
            <MessageCircle size={18} color="#FFFFFF" />
            <Text style={styles.actionBtnText}>Falar com o Suporte</Text>
          </TouchableOpacity>

          {!['finalizado', 'cancelado'].includes(order.status) && (
            <TouchableOpacity
              style={[
                styles.actionBtn,
                canCancel ? styles.cancelBtn : styles.cancelBtnDisabled,
              ]}
              onPress={handleCancelOrder}
              disabled={!canCancel}
            >
              <XCircle size={18} color={canCancel ? '#DC2626' : '#9CA3AF'} />
              <Text style={[styles.actionBtnText, { color: canCancel ? '#DC2626' : '#9CA3AF' }]}>
                {canCancel ? 'Cancelar Pedido' : 'Cancelamento indisponível'}
              </Text>
            </TouchableOpacity>
          )}

          {!canCancel && !['finalizado', 'cancelado'].includes(order.status) && (
            <Text style={styles.cancelInfoText}>
              ⏰ Cancelamento disponível apenas nos primeiros 5 minutos
            </Text>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>ID: {order.id}</Text>
          <Text style={styles.footerText}>Atualizado em {formatDateTime(order.updated_at)}</Text>
        </View>
      </ScrollView>

      {/* CHAT MODAL */}
      <ChatModal
        visible={showChat}
        onClose={() => setShowChat(false)}
        orderId={id}
        orderStatus={order?.status || 'criado'}
        chatTitle={chatConfig.title}
        targetType={chatConfig.targetType}
      />

      {/* RATING MODAL */}
      {order.motoboy && !order.motoboy_rating && (
        <RatingModal
          visible={showRatingModal}
          onClose={() => setShowRatingModal(false)}
          onSubmit={submitRating}
          motoboyName={order.motoboy.name}
        />
      )}
    </View>
  );
}

// ========================================
// ESTILOS
// ========================================
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F3F4F6' },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: { marginTop: 16, color: '#6B7280', fontSize: 16 },
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { marginTop: 16, fontSize: 18, color: '#DC2626', fontWeight: '600' },
  backButtonError: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#2563EB',
    borderRadius: 12,
  },
  backButtonErrorText: { color: '#FFFFFF', fontWeight: '600' },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backButton: { marginRight: 16, padding: 4 },
  headerContent: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#FFFFFF' },
  headerSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.75)', marginTop: 2 },
  mapHeaderBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  content: { flex: 1 },
  contentContainer: { padding: 16, paddingTop: 12 },

  statusHeroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderLeftWidth: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  statusHeroLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  statusIconWrapper: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusHeroText: { flex: 1 },
  statusHeroTitle: { fontSize: 17, fontWeight: '700', marginBottom: 4 },
  statusHeroDesc: { fontSize: 13, color: '#6B7280', lineHeight: 18 },
  estimateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  estimateText: { fontSize: 12, fontWeight: '600', color: '#059669' },

  cancelledCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF2F2',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelledTitle: { fontSize: 16, fontWeight: '700', color: '#DC2626' },
  cancelledReason: { fontSize: 13, color: '#9CA3AF', marginTop: 4 },

  pipelineCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#9CA3AF',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 16,
  },

  pipeline: {},
  pipelineRow: { flexDirection: 'row', alignItems: 'flex-start' },
  pipelineLeft: { alignItems: 'center', width: 30, marginRight: 12 },
  pipelineDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pipelineDotFuture: { borderColor: '#E5E7EB', backgroundColor: '#F9FAFB' },
  pipelineDotInner: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#D1D5DB' },
  pipelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: '#E5E7EB',
    minHeight: 16,
    marginTop: 2,
  },
  pipelineContent: { flex: 1, paddingTop: 4 },
  pipelineStepLabel: { fontSize: 14, fontWeight: '500', color: '#374151' },
  pipelineStepSublabel: { fontSize: 12, marginTop: 2 },

  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },

  motoboyRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  motoboyAvatarWrap: { position: 'relative' },
  motoboyAvatar: { width: 54, height: 54, borderRadius: 27 },
  motoboyAvatarFallback: {
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  motoboyAvatarInitial: { fontSize: 22, fontWeight: '700', color: '#FFFFFF' },
  motoboyOnlineBadge: {
    position: 'absolute',
    bottom: 2,
    right: 2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#10B981',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  motoboyInfo: { flex: 1 },
  motoboyName: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 4 },
  motoboyMeta: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  motoboyMetaText: { fontSize: 12, color: '#6B7280' },
  dotSep: { color: '#D1D5DB', fontSize: 12 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { fontSize: 12, color: '#374151', fontWeight: '500' },
  ratingTotal: { fontSize: 12, color: '#9CA3AF' },
  callBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  ratingBadgeText: { fontSize: 13, fontWeight: '600' },

  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 4,
  },
  addressDot: { width: 14, height: 14, borderRadius: 7, marginTop: 3, flexShrink: 0 },
  addressInfo: { flex: 1 },
  addressType: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    marginBottom: 2,
  },
  addressText: { fontSize: 14, color: '#111827', fontWeight: '500', lineHeight: 20 },
  addressBairro: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  addressConnector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 6,
    marginVertical: 4,
  },
  addressConnectorLine: { width: 2, height: 20, backgroundColor: '#E5E7EB', marginRight: 10 },
  distanceBadge: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  distanceBadgeText: { fontSize: 11, color: '#6B7280', fontWeight: '600' },
  trackMapBtn: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#111827',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  trackMapBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },

  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  summaryKey: { fontSize: 14, color: '#6B7280' },
  summaryValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  paymentBadge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20 },
  paymentBadgeText: { fontSize: 13, fontWeight: '600' },

  notesBox: {
    backgroundColor: '#FFFBEB',
    borderRadius: 10,
    padding: 14,
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  notesText: { fontSize: 14, color: '#374151', lineHeight: 22 },

  timelineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  timelineIcon: { fontSize: 14, marginRight: 12, width: 30 },
  timelineLabel: { flex: 1, fontSize: 14, color: '#374151' },
  timelineTime: { fontSize: 13, color: '#6B7280', fontWeight: '500' },

  actionsSection: { gap: 10, marginBottom: 16 },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
    gap: 10,
  },
  cancelBtn: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  cancelBtnDisabled: {
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  actionBtnText: { fontSize: 15, fontWeight: '600', color: '#FFFFFF' },
  cancelInfoText: { textAlign: 'center', fontSize: 11, color: '#9CA3AF', marginTop: 4 },

  footer: { alignItems: 'center', paddingVertical: 8 },
  footerText: { fontSize: 11, color: '#9CA3AF', marginBottom: 4 },
});

const chatStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    height: Dimensions.get('window').height * 0.85,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: 18,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 16, fontWeight: '700', color: '#FFFFFF' },
  headerOnline: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  onlineDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#4ADE80' },
  headerSubtitle: { fontSize: 11, color: 'rgba(255,255,255,0.8)' },

  messagesContainer: { flex: 1, backgroundColor: '#F9FAFB' },
  messagesContent: { padding: 16 },

  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: { marginTop: 12, color: '#374151', fontSize: 16, fontWeight: '500' },
  emptySubtext: { marginTop: 4, color: '#9CA3AF', fontSize: 14 },

  messageWrapper: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 12,
  },
  messageWrapperRight: { flexDirection: 'row-reverse' },
  avatarMini: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  avatarMiniText: { fontSize: 12, fontWeight: '700' },

  messageBubble: { maxWidth: '75%', padding: 12, borderRadius: 16 },
  currentUserMessage: { backgroundColor: '#2563EB', borderBottomRightRadius: 4 },
  otherUserMessage: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  senderName: { fontSize: 11, fontWeight: '600', color: '#6B7280', marginBottom: 4 },
  messageText: { fontSize: 14, color: '#374151', lineHeight: 20 },
  currentUserMessageText: { color: '#FFFFFF' },
  messageTime: { fontSize: 10, color: '#9CA3AF', marginTop: 4, alignSelf: 'flex-end' },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 10,
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxHeight: 100,
    fontSize: 14,
    color: '#374151',
  },
  sendButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  sendButtonDisabled: { opacity: 0.4 },

  chatClosedContainer: {
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    backgroundColor: '#F3F4F6',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
  },
  chatClosedText: { fontSize: 13, color: '#9CA3AF', fontWeight: '500' },
});

const ratingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 36,
  },
  handle: {
    width: 36,
    height: 4,
    backgroundColor: '#D1D5DB',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: { fontSize: 15, color: '#6B7280', textAlign: 'center', marginBottom: 24 },

  optionsContainer: { gap: 12, marginBottom: 24 },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    gap: 14,
  },
  optionSelectedFast: { borderColor: '#059669', backgroundColor: '#F0FDF4' },
  optionSelectedNormal: { borderColor: '#EA580C', backgroundColor: '#FFF7ED' },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionTextContainer: { flex: 1 },
  optionText: { fontSize: 16, fontWeight: '600', color: '#111827' },
  optionDescription: { fontSize: 13, color: '#6B7280', marginTop: 2 },
  optionCheck: { width: 28, height: 28, justifyContent: 'center', alignItems: 'center' },

  submitButton: {
    backgroundColor: '#111827',
    paddingVertical: 16,
    borderRadius: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  submitButtonDisabled: { backgroundColor: '#D1D5DB' },
  submitButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  skipButton: { alignItems: 'center', paddingVertical: 8 },
  skipButtonText: { fontSize: 14, color: '#9CA3AF' },
});