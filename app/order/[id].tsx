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
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import {
  ArrowLeft,
  MapPin,
  User,
  Clock,
  Package,
  MessageCircle,
  Phone,
  CircleCheck as CheckCircle,
  Circle as XCircle,
  Loader,
  TriangleAlert as AlertTriangle,
  Bike,
  DollarSign,
  Navigation,
  Map,
  BarChart,
  Shield,
  Timer,
  Send,
  X,
  Star,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner } from '@/components/LoadingSpinner';

interface OrderDetails {
  id: string;
  customer_id: string;
  motoboy_id?: string;
  merchandise_type: string;
  pickup_address: string;
  delivery_address: string;
  pickup_bairro: string;
  delivery_bairro: string;
  notes?: string;
  price: number;
  platform_fee: number;
  distance_km: number;
  status: 'criado' | 'aceito' | 'em_andamento' | 'finalizado' | 'cancelado';
  is_reserved?: boolean;
  created_at: string;
  updated_at: string;
  accepted_at?: string;
  picked_up_at?: string;
  completed_at?: string;
  cancelled_at?: string;
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

// Configuração de status
const STATUS_CONFIG = {
  criado: {
    label: 'Pedido Criado',
    color: '#6B7280',
    icon: Clock,
    description: 'Aguardando motoboy aceitar',
    step: 1,
  },
  aceito: {
    label: 'Pedido Aceito',
    color: '#2563EB',
    icon: User,
    description: 'Motoboy a caminho da retirada',
    step: 2,
  },
  em_andamento: {
    label: 'Em Entrega',
    color: '#EA580C',
    icon: Bike,
    description: 'Motoboy a caminho da entrega',
    step: 3,
  },
  finalizado: {
    label: 'Concluído',
    color: '#059669',
    icon: CheckCircle,
    description: 'Pedido entregue com sucesso',
    step: 4,
  },
  cancelado: {
    label: 'Cancelado',
    color: '#DC2626',
    icon: XCircle,
    description: 'Pedido foi cancelado',
    step: 0,
  },
};

const RESERVED_ORDER_DESCRIPTION =
  'Motoboy está a caminho de uma entrega muito próxima ao seu endereço, assim que ele terminar iremos te notificar.';

// Formatação de métodos de pagamento
const PAYMENT_METHODS = {
  pix: { label: 'Pix', color: '#32BB6F' },
  debito: { label: 'Cartão de Débito', color: '#2563EB' },
  credito: { label: 'Cartão de Crédito', color: '#9333EA' },
  dinheiro: { label: 'Dinheiro', color: '#059669' },
};

// Formatação de tipos de mercadoria
const MERCHANDISE_TYPES = {
  lanche: { label: 'Lanche', color: '#EA580C' },
  pizza: { label: 'Pizza', color: '#DC2626' },
  marmitex: { label: 'Marmitex', color: '#059669' },
  documento: { label: 'Documento', color: '#2563EB' },
  mercado: { label: 'Mercado', color: '#9333EA' },
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
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível enviar a avaliação.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={ratingStyles.container}>
        <View style={ratingStyles.content}>
          <Text style={ratingStyles.title}>Avaliar Motoboy</Text>
          <Text style={ratingStyles.subtitle}>Como foi a entrega com {motoboyName}?</Text>

          <View style={ratingStyles.optionsContainer}>
            <TouchableOpacity
              style={[ratingStyles.optionButton, rating === true && ratingStyles.optionSelected]}
              onPress={() => setRating(true)}
            >
              <Star
                size={32}
                color={rating === true ? '#059669' : '#D1D5DB'}
                fill={rating === true ? '#059669' : 'none'}
              />
              <View style={ratingStyles.optionTextContainer}>
                <Text style={ratingStyles.optionText}>Entrega Rápida</Text>
                <Text style={ratingStyles.optionDescription}>Entregou antes do esperado</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[ratingStyles.optionButton, rating === false && ratingStyles.optionSelected]}
              onPress={() => setRating(false)}
            >
              <Clock size={32} color={rating === false ? '#EA580C' : '#D1D5DB'} />
              <View style={ratingStyles.optionTextContainer}>
                <Text style={ratingStyles.optionText}>Entrega Normal</Text>
                <Text style={ratingStyles.optionDescription}>Entregou dentro do tempo esperado</Text>
              </View>
            </TouchableOpacity>
          </View>

          <View style={ratingStyles.buttonsContainer}>
            <TouchableOpacity
              style={[ratingStyles.button, ratingStyles.cancelButton]}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={ratingStyles.cancelButtonText}>Cancelar</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[ratingStyles.button, ratingStyles.submitButton]}
              onPress={handleSubmit}
              disabled={submitting || rating === null}
            >
              <Text style={ratingStyles.submitButtonText}>
                {submitting ? 'Enviando...' : 'Enviar Avaliação'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ========================================
// COMPONENTE CHAT MODAL (✅ corrigido: safe area + teclado)
// ========================================
function ChatModal({
  visible,
  onClose,
  orderId,
  orderStatus,
}: {
  visible: boolean;
  onClose: () => void;
  orderId: string;
  orderStatus: string;
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, orderId]);

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 150);
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

      const messagesWithSenders = await Promise.all(
        (messagesData || []).map(async (message: any) => {
          const isCurrentUser = message.sender_id === user?.id;

          let senderName = 'Usuário';
          try {
            if (message.sender_id) {
              const { data: cliente } = await supabase
                .from('clientes')
                .select('name')
                .eq('user_id', message.sender_id)
                .single();

              if (cliente) {
                senderName = cliente.name;
              } else {
                const { data: motoboy } = await supabase
                  .from('motoboys')
                  .select('name')
                  .eq('user_id', message.sender_id)
                  .single();

                if (motoboy) senderName = motoboy.name;
              }
            }
          } catch {
            // ignore
          }

          return { ...message, sender_name: senderName, isCurrentUser };
        })
      );

      setMessages(messagesWithSenders);
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
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
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_chat_messages',
          filter: `order_id=eq.${orderId}`,
        },
        async (payload) => {
          const newMsg = payload.new as ChatMessage;

          let senderName = 'Usuário';
          try {
            if (newMsg.sender_id) {
              const { data: cliente } = await supabase
                .from('clientes')
                .select('name')
                .eq('user_id', newMsg.sender_id)
                .single();

              if (cliente) {
                senderName = cliente.name;
              } else {
                const { data: motoboy } = await supabase
                  .from('motoboys')
                  .select('name')
                  .eq('user_id', newMsg.sender_id)
                  .single();

                if (motoboy) senderName = motoboy.name;
              }
            }
          } catch {
            // ignore
          }

          const messageWithSender = {
            ...newMsg,
            sender_name: senderName,
            isCurrentUser: newMsg.sender_id === user?.id,
          };

          setMessages((prev) => [...prev, messageWithSender]);
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
        message: newMessage.trim(),
      });

      if (error) throw error;
      setNewMessage('');
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      Alert.alert('Erro', 'Não foi possível enviar a mensagem');
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const inputSafePadding = insets.bottom + 10;

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={chatStyles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top : 0}
      >
        <View style={chatStyles.content}>
          <View style={chatStyles.header}>
            <View style={chatStyles.headerLeft}>
              <MessageCircle size={24} color="#2563EB" />
              <Text style={chatStyles.headerTitle}>Chat da Corrida</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={chatStyles.closeButton}>
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={chatStyles.statusInfo}>
            <AlertTriangle size={16} color="#EA580C" />
            <Text style={chatStyles.statusText}>
              Chat disponível apenas durante a corrida. Será fechado automaticamente ao finalizar.
            </Text>
          </View>

          <ScrollView
            ref={scrollRef}
            style={chatStyles.messagesContainer}
            contentContainerStyle={[
              chatStyles.messagesContent,
              { paddingBottom: (orderStatus !== 'finalizado' && orderStatus !== 'cancelado' ? 110 : 40) + inputSafePadding },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {loading ? (
              <View style={chatStyles.loadingContainer}>
                <Text style={chatStyles.loadingText}>Carregando mensagens...</Text>
              </View>
            ) : messages.length === 0 ? (
              <View style={chatStyles.emptyContainer}>
                <MessageCircle size={48} color="#D1D5DB" />
                <Text style={chatStyles.emptyText}>Nenhuma mensagem ainda. Seja o primeiro a enviar!</Text>
              </View>
            ) : (
              messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    chatStyles.messageBubble,
                    message.isCurrentUser ? chatStyles.currentUserMessage : chatStyles.otherUserMessage,
                  ]}
                >
                  <View style={chatStyles.messageHeader}>
                    <View style={chatStyles.senderInfo}>
                      <User size={12} color={message.isCurrentUser ? '#2563EB' : '#6B7280'} />
                      <Text style={[chatStyles.senderName, message.isCurrentUser && chatStyles.currentUserSender]}>
                        {message.sender_name}
                      </Text>
                    </View>
                    <Text style={chatStyles.messageTime}>{formatTime(message.created_at)}</Text>
                  </View>
                  <Text style={[chatStyles.messageText, message.isCurrentUser && chatStyles.currentUserMessageText]}>
                    {message.message}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>

          {orderStatus !== 'finalizado' && orderStatus !== 'cancelado' && (
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
                  (!newMessage.trim() || sending) && chatStyles.sendButtonDisabled,
                ]}
                onPress={handleSendMessage}
                disabled={!newMessage.trim() || sending}
              >
                <Send size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}

          {(orderStatus === 'finalizado' || orderStatus === 'cancelado') && (
            <View style={[chatStyles.chatClosedContainer, { paddingBottom: inputSafePadding }]}>
              <Clock size={24} color="#DC2626" />
              <Text style={chatStyles.chatClosedText}>
                Este chat foi encerrado porque a corrida foi {orderStatus === 'finalizado' ? 'finalizada' : 'cancelada'}
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

  const [showFullAddress, setShowFullAddress] = useState({ pickup: false, delivery: false });
  const [showChat, setShowChat] = useState(false);
  const [canShowChat, setCanShowChat] = useState(false);

  const [showRatingModal, setShowRatingModal] = useState(false);
  const [isRatingSubmitted, setIsRatingSubmitted] = useState(false);
  const [closingOrder, setClosingOrder] = useState(false);

  const calculateTimeSinceCreation = () => {
    if (!order?.created_at) return 0;
    const created = new Date(order.created_at).getTime();
    const now = Date.now();
    return Math.floor((now - created) / 1000);
  };

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
        .select(
          `
          *,
          motoboy:motoboys (
            name,
            phone,
            vehicle_type,
            license_plate,
            fast_deliveries,
            slow_deliveries,
            driver_photo_url
          )
        `
        )
        .eq('id', id)
        .eq('customer_id', cliente.id)
        .single();

      if (orderError) throw orderError;

      const { data: ratingData } = await supabase
        .from('motoboy_ratings')
        .select('*')
        .eq('order_id', id)
        .single();

      setOrder({
        ...(orderData as any),
        motoboy_rating: ratingData || undefined,
      });

      if (ratingData) setIsRatingSubmitted(true);
    } catch (error) {
      console.error('Erro ao buscar detalhes:', error);
      Alert.alert('Erro', 'Não foi possível carregar os detalhes');
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const checkChatAvailability = () => {
    if (!order) return;
    const isAvailable = order.status === 'aceito' || order.status === 'em_andamento';
    setCanShowChat(isAvailable);

    if ((order.status === 'finalizado' || order.status === 'cancelado') && showChat) {
      setShowChat(false);
    }
  };

  const finalizeOrder = async () => {
    if (!order) return;

    try {
      const { error } = await supabase
        .from('pedidos')
        .update({
          status: 'finalizado',
          completed_at: new Date().toISOString(),
        })
        .eq('id', order.id);

      if (error) throw error;

      setOrder((prev) =>
        prev
          ? {
              ...prev,
              status: 'finalizado',
              completed_at: new Date().toISOString(),
            }
          : null
      );
    } catch (error) {
      console.error('❌ Erro ao finalizar pedido:', error);
    }
  };

  const submitRating = async (isFast: boolean) => {
    if (!order?.motoboy_id || !order?.id) return;

    try {
      const { error: ratingError } = await supabase.from('motoboy_ratings').insert({
        order_id: order.id,
        motoboy_id: order.motoboy_id,
        is_fast: isFast,
      });

      if (ratingError) throw ratingError;

      setIsRatingSubmitted(true);

      await finalizeOrder();

      Alert.alert(
        '✅ Avaliação Enviada',
        `Obrigado por avaliar! ${isFast ? 'Entrega rápida registrada.' : 'Entrega normal registrada.'}`,
        [{ text: 'OK' }]
      );
    } catch (error) {
      console.error('❌ Erro completo ao enviar avaliação:', error);
      throw error;
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchOrderDetails();
    setRefreshing(false);
  };

  const handleCancelOrder = () => {
    if (!order) return;

    if (!['criado', 'aceito'].includes(order.status)) {
      Alert.alert('Não é possível cancelar', 'O motoboy já está com seu pedido. Contate o suporte.');
      return;
    }

    const timeSinceCreation = calculateTimeSinceCreation();
    const hasLateFee = order.status === 'aceito' && timeSinceCreation > 120;
    const lateFee = hasLateFee ? 5.0 : 0.0;

    const feeMessage = hasLateFee
      ? `\n\n⚠️ ATENÇÃO: O motoboy já aceitou sua corrida e já se passaram mais de 2 minutos.\n\n💰 Será cobrada uma taxa de R$ 5,00 na sua próxima corrida.`
      : order.status === 'aceito'
      ? `\n\nVocê pode cancelar sem taxa porque ainda não se passaram 2 minutos desde que o motoboy aceitou.`
      : '';

    Alert.alert('⚠️ Cancelar Pedido', `Tem certeza que deseja cancelar este pedido?${feeMessage}`, [
      { text: 'Não', style: 'cancel' },
      {
        text: 'Sim, cancelar',
        style: 'destructive',
        onPress: async () => {
          try {
            const { error: updateError } = await supabase
              .from('pedidos')
              .update({
                status: 'cancelado',
                cancelled_at: new Date().toISOString(),
                late_cancel_fee: lateFee,
                cancelled_by: 'customer',
                cancel_reason: 'Cancelado pelo cliente',
              })
              .eq('id', order.id);

            if (updateError) throw updateError;

            if (hasLateFee && order.customer_id) {
              await supabase.from('client_debts').insert({
                customer_id: order.customer_id,
                order_id: order.id,
                amount: 5.0,
                reason: 'Taxa de cancelamento tardio',
                is_paid: false,
              });
            }

            Alert.alert(
              'Pedido Cancelado',
              hasLateFee ? '💰 Uma taxa de R$ 5,00 será cobrada na próxima corrida.' : 'Pedido cancelado com sucesso, sem taxa.',
              [{ text: 'OK' }]
            );
          } catch (error) {
            console.error('❌ Erro ao cancelar:', error);
            Alert.alert('Erro', error instanceof Error ? error.message : 'Erro ao cancelar pedido');
          }
        },
      },
    ]);
  };

  const handleContactSupport = () => {
    router.push({ pathname: '/support', params: { pedidoId: order?.id } as any });
  };

  const handleOpenMap = (lat: number, lng: number, label: string) => {
    const url = Platform.OS === 'ios' ? `maps://?q=${label}&ll=${lat},${lng}` : `geo:${lat},${lng}?q=${label}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Erro', 'Não foi possível abrir o mapa');
    });
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '--:--';
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
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

  const formatAddress = (address: string, type: 'pickup' | 'delivery') => {
    const isExpanded = showFullAddress[type];
    if (isExpanded || address.length < 60) return address;
    return address.substring(0, 57) + '...';
  };

  const calculateMotoboyStats = () => {
    if (!order?.motoboy) return null;

    const totalDeliveries = (order.motoboy.fast_deliveries || 0) + (order.motoboy.slow_deliveries || 0);
    if (totalDeliveries === 0) return null;

    const fastPercentage = ((order.motoboy.fast_deliveries || 0) / totalDeliveries) * 100;

    return {
      total: totalDeliveries,
      fastPercentage: Math.round(fastPercentage),
      fastDeliveries: order.motoboy.fast_deliveries || 0,
      slowDeliveries: order.motoboy.slow_deliveries || 0,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (order) {
      checkChatAvailability();

      if (order.status === 'finalizado' && !order.motoboy_rating && !isRatingSubmitted && !closingOrder && order.motoboy) {
        setTimeout(() => {
          setShowRatingModal(true);
        }, 500);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Carregando detalhes do pedido...</Text>
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

  const isReservedOrder = !!order.is_reserved && order.status === 'criado';
  const displayStatus = isReservedOrder ? 'aceito' : order.status;

  const statusConfig = isReservedOrder
    ? {
        ...(STATUS_CONFIG as any).aceito,
        description: RESERVED_ORDER_DESCRIPTION,
      }
    : (STATUS_CONFIG as any)[order.status] || (STATUS_CONFIG as any).criado;

  const StatusIcon = statusConfig.icon;

  const paymentConfig =
    (PAYMENT_METHODS as any)[order.payment_method as keyof typeof PAYMENT_METHODS] || (PAYMENT_METHODS as any).pix;
  const merchandiseConfig =
    (MERCHANDISE_TYPES as any)[order.merchandise_type as keyof typeof MERCHANDISE_TYPES] || (MERCHANDISE_TYPES as any).outro;

  const motoboyStats = calculateMotoboyStats();
  const elapsedTime = calculateElapsedTime(order.created_at);

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#FFFFFF" strokeWidth={2} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Pedido #{order.id.slice(-8)}</Text>
          <Text style={styles.headerSubtitle}>{new Date(order.created_at).toLocaleDateString('pt-BR')}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={['#2563EB']} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusSection}>
          <View style={styles.statusHeader}>
            <View style={[styles.statusBadge, { backgroundColor: statusConfig.color + '15' }]}>
              <StatusIcon size={24} color={statusConfig.color} strokeWidth={2} />
              <Text style={[styles.statusLabel, { color: statusConfig.color }]}>{statusConfig.label}</Text>
            </View>
            <Text style={styles.statusDescription}>{statusConfig.description}</Text>
          </View>

          <View style={styles.timeline}>
            {(['criado', 'aceito', 'em_andamento', 'finalizado'] as const).map((status, index) => {
              const stepConfig = (STATUS_CONFIG as any)[status];
              const isActive = statusConfig.step >= stepConfig.step;
              const isCurrent = displayStatus === status;

              return (
                <View key={status} style={styles.timelineStep}>
                  <View
                    style={[
                      styles.timelineDot,
                      isActive && { backgroundColor: stepConfig.color },
                      isCurrent && styles.timelineDotCurrent,
                    ]}
                  >
                    {isActive && <CheckCircle size={12} color="#FFFFFF" />}
                  </View>
                  <Text
                    style={[
                      styles.timelineLabel,
                      isActive && { color: stepConfig.color, fontWeight: '600' },
                    ]}
                  >
                    {stepConfig.label}
                  </Text>
                  {index < 3 && (
                    <View style={[styles.timelineLine, isActive && { backgroundColor: stepConfig.color }]} />
                  )}
                </View>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <DollarSign size={20} color="#059669" /> Resumo Financeiro
          </Text>

          <View style={styles.priceGrid}>
            <View style={styles.priceCard}>
              <Text style={styles.priceCardLabel}>Valor Total</Text>
              <Text style={styles.priceValue}>R$ {order.price.toFixed(2)}</Text>
            </View>

            <View style={styles.priceCard}>
              <Text style={styles.priceCardLabel}>Método</Text>
              <Text style={styles.priceValue}>{paymentConfig.label}</Text>
            </View>
          </View>
        </View>

        {order.motoboy && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              <User size={20} color="#2563EB" /> Motoboy
            </Text>

            <View style={styles.motoboyCard}>
              {order.motoboy.driver_photo_url ? (
                <Image source={{ uri: order.motoboy.driver_photo_url }} style={styles.motoboyAvatar} />
              ) : (
                <View style={styles.motoboyAvatar}>
                  <User size={24} color="#FFFFFF" />
                </View>
              )}

              <View style={styles.motoboyInfo}>
                <Text style={styles.motoboyName}>{order.motoboy.name}</Text>

                {motoboyStats && (
                  <View style={styles.statsContainer}>
                    <View style={styles.statRow}>
                      <View style={styles.statItem}>
                        <Star size={16} color="#059669" />
                        <Text style={styles.statValue}>{motoboyStats.fastPercentage}%</Text>
                        <Text style={styles.statLabel}>Rápidas</Text>
                      </View>
                      <View style={styles.statDivider} />
                      <View style={styles.statItem}>
                        <Text style={styles.statValue}>{motoboyStats.total}</Text>
                        <Text style={styles.statLabel}>Total</Text>
                      </View>
                    </View>
                  </View>
                )}

                <View style={styles.motoboyDetails}>
                  <View style={styles.motoboyDetail}>
                    <Bike size={14} color="#6B7280" />
                    <Text style={styles.motoboyDetailText}>{order.motoboy.vehicle_type.toUpperCase()}</Text>
                  </View>
                  <View style={styles.motoboyDetail}>
                    <Shield size={14} color="#6B7280" />
                    <Text style={styles.motoboyDetailText}>Placa: {order.motoboy.license_plate}</Text>
                  </View>
                </View>

                {order.motoboy_rating && (
                  <View style={styles.currentRating}>
                    <View
                      style={[
                        styles.ratingBadge,
                        {
                          backgroundColor: order.motoboy_rating.is_fast ? '#05966915' : '#EA580C15',
                        },
                      ]}
                    >
                      {order.motoboy_rating.is_fast ? (
                        <>
                          <Star size={14} color="#059669" fill="#059669" />
                          <Text style={[styles.ratingText, { color: '#059669' }]}>Você avaliou: Entrega Rápida</Text>
                        </>
                      ) : (
                        <>
                          <Clock size={14} color="#EA580C" />
                          <Text style={[styles.ratingText, { color: '#EA580C' }]}>Você avaliou: Entrega Normal</Text>
                        </>
                      )}
                    </View>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <Map size={20} color="#EA580C" /> Trajeto
          </Text>

          <View style={styles.routeTimeline}>
            <View style={styles.routeStep}>
              <View style={[styles.routeDot, { backgroundColor: '#059669' }]} />
              <View style={styles.routeContent}>
                <Text style={styles.routeStepLabel}>RETIRADA</Text>
                <Text style={styles.routeStepTime}>{order.accepted_at ? formatDateTime(order.accepted_at) : '--:--'}</Text>
              </View>
            </View>

            <View style={styles.routeLine} />

            <View style={styles.routeStep}>
              <View
                style={[
                  styles.routeDot,
                  {
                    backgroundColor:
                      order.status === 'em_andamento' || order.status === 'finalizado' ? '#EA580C' : '#D1D5DB',
                  },
                ]}
              />
              <View style={styles.routeContent}>
                <Text style={styles.routeStepLabel}>EM TRÂNSITO</Text>
                <Text style={styles.routeStepTime}>{order.picked_up_at ? formatDateTime(order.picked_up_at) : '--:--'}</Text>
              </View>
            </View>

            <View style={styles.routeLine} />

            <View style={styles.routeStep}>
              <View
                style={[
                  styles.routeDot,
                  { backgroundColor: order.status === 'finalizado' ? '#DC2626' : '#D1D5DB' },
                ]}
              />
              <View style={styles.routeContent}>
                <Text style={styles.routeStepLabel}>ENTREGA</Text>
                <Text style={styles.routeStepTime}>{order.completed_at ? formatDateTime(order.completed_at) : '--:--'}</Text>
              </View>
            </View>
          </View>

          <View style={styles.addressesContainer}>
            <TouchableOpacity
              style={[styles.addressCard, displayStatus === 'aceito' && styles.addressCardHighlight]}
              onPress={() => handleOpenMap(order.pickup_lat, order.pickup_lng, 'Retirada')}
              onLongPress={() => setShowFullAddress((prev) => ({ ...prev, pickup: !prev.pickup }))}
            >
              <View style={[styles.addressIcon, { backgroundColor: '#05966915' }]}>
                <MapPin size={20} color="#059669" />
              </View>
              <View style={styles.addressInfo}>
                <View style={styles.addressHeader}>
                  <Text style={styles.addressLabel}>RETIRADA</Text>
                  {displayStatus === 'aceito' && (
                    <View style={styles.activeBadge}>
                      <Loader size={12} color="#2563EB" />
                      <Text style={styles.activeBadgeText}>A caminho</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.addressText}>{formatAddress(order.pickup_address, 'pickup')}</Text>
                {order.pickup_bairro && <Text style={styles.addressBairro}>{order.pickup_bairro}</Text>}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.addressCard, order.status === 'em_andamento' && styles.addressCardHighlight]}
              onPress={() => handleOpenMap(order.delivery_lat, order.delivery_lng, 'Entrega')}
              onLongPress={() => setShowFullAddress((prev) => ({ ...prev, delivery: !prev.delivery }))}
            >
              <View style={[styles.addressIcon, { backgroundColor: '#DC262615' }]}>
                <MapPin size={20} color="#DC2626" />
              </View>
              <View style={styles.addressInfo}>
                <View style={styles.addressHeader}>
                  <Text style={styles.addressLabel}>ENTREGA</Text>
                  {order.status === 'em_andamento' && (
                    <View style={styles.activeBadge}>
                      <Bike size={12} color="#EA580C" />
                      <Text style={styles.activeBadgeText}>Em entrega</Text>
                    </View>
                  )}
                </View>
                <Text style={styles.addressText}>{formatAddress(order.delivery_address, 'delivery')}</Text>
                {order.delivery_bairro && <Text style={styles.addressBairro}>{order.delivery_bairro}</Text>}
              </View>
            </TouchableOpacity>
          </View>

          {order.motoboy_id && (order.status === 'aceito' || order.status === 'em_andamento') && (
            <TouchableOpacity style={styles.trackButton} onPress={() => router.push(`/order/track/${order.id}`)}>
              <Map size={24} color="#FFFFFF" />
              <Text style={styles.trackButtonText}>Acompanhar no Mapa em Tempo Real</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            <BarChart size={20} color="#9333EA" /> Estatísticas
          </Text>

          <View style={styles.statsGrid}>
            <View style={styles.statCard}>
              <Timer size={24} color="#2563EB" />
              <Text style={styles.statValue}>{elapsedTime}</Text>
              <Text style={styles.statLabel}>Tempo Total</Text>
            </View>

            <View style={styles.statCard}>
              <Navigation size={24} color="#059669" />
              <Text style={styles.statValue}>{order.distance_km.toFixed(1)}km</Text>
              <Text style={styles.statLabel}>Distância</Text>
            </View>

            <View style={styles.statCard}>
              <Package size={24} color="#EA580C" />
              <Text style={styles.statValue}>{merchandiseConfig.label}</Text>
              <Text style={styles.statLabel}>Tipo</Text>
            </View>
          </View>
        </View>

        {order.notes && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📝 Instruções Especiais</Text>
            <View style={styles.notesCard}>
              <Text style={styles.notesText}>{order.notes}</Text>
            </View>
          </View>
        )}

        <View style={styles.actionsSection}>
          <TouchableOpacity style={styles.actionButton} onPress={handleContactSupport}>
            <MessageCircle size={20} color="#FFFFFF" />
            <Text style={styles.actionButtonText}>Falar com Suporte</Text>
          </TouchableOpacity>

          {!['finalizado', 'cancelado'].includes(order.status) && (
            <TouchableOpacity style={[styles.actionButton, styles.cancelActionButton]} onPress={handleCancelOrder}>
              <XCircle size={20} color="#FFFFFF" />
              <Text style={styles.actionButtonText}>Cancelar Pedido</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerText}>ID do Pedido: {order.id}</Text>
          <Text style={styles.footerText}>Última atualização: {formatDateTime(order.updated_at)}</Text>
        </View>
      </ScrollView>

      {canShowChat && (
        <TouchableOpacity
          style={[
            styles.chatBubble,
            { bottom: insets.bottom + 16 },
          ]}
          onPress={() => setShowChat(true)}
        >
          <MessageCircle size={24} color="#FFFFFF" />
          <View style={styles.chatBadge}>
            <Text style={styles.chatBadgeText}>Chat</Text>
          </View>
        </TouchableOpacity>
      )}

      <ChatModal visible={showChat} onClose={() => setShowChat(false)} orderId={id as string} orderStatus={order?.status || 'criado'} />

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
const { width, height } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  loadingText: {
    marginTop: 16,
    color: '#6B7280',
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 20,
  },
  errorText: {
    marginTop: 16,
    fontSize: 18,
    color: '#DC2626',
    fontWeight: '600',
  },
  backButtonError: {
    marginTop: 20,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#2563EB',
    borderRadius: 8,
  },
  backButtonErrorText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backButton: {
    marginRight: 16,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  headerSubtitle: {
    fontSize: 14,
    color: '#DBEAFE',
    marginTop: 4,
  },
  content: { flex: 1 },
  contentContainer: { padding: 20 },

  statusSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  statusHeader: { alignItems: 'center', marginBottom: 20 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginBottom: 12,
  },
  statusLabel: { fontSize: 16, fontWeight: '600', marginLeft: 8 },
  statusDescription: { fontSize: 14, color: '#6B7280', textAlign: 'center' },

  timeline: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  timelineStep: { alignItems: 'center', flex: 1 },
  timelineDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  timelineDotCurrent: {
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  timelineLabel: { fontSize: 11, color: '#9CA3AF', textAlign: 'center' },
  timelineLine: {
    position: 'absolute',
    top: 12,
    right: -((width - 120) / 6),
    width: (width - 120) / 3,
    height: 2,
    backgroundColor: '#E5E7EB',
    zIndex: -1,
  },

  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },

  priceGrid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  priceCard: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  priceCardLabel: { fontSize: 14, color: '#6B7280', marginBottom: 8 },
  priceValue: { fontSize: 24, fontWeight: 'bold', color: '#059669' },

  motoboyCard: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  motoboyAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  motoboyInfo: { flex: 1 },
  motoboyName: { fontSize: 18, fontWeight: '600', color: '#1F2937', marginBottom: 12 },

  statsContainer: { marginBottom: 12 },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 12,
  },
  statItem: { alignItems: 'center', flex: 1 },
  statDivider: { width: 1, height: 30, backgroundColor: '#E5E7EB' },
  statValue: { fontSize: 16, fontWeight: 'bold', color: '#059669', marginTop: 4 },
  statLabel: { fontSize: 11, color: '#6B7280', marginTop: 2 },

  motoboyDetails: { flexDirection: 'row', gap: 16, marginBottom: 12 },
  motoboyDetail: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  motoboyDetailText: { fontSize: 14, color: '#6B7280' },

  currentRating: { marginTop: 8 },
  ratingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 8,
    alignSelf: 'flex-start',
  },
  ratingText: { fontSize: 12, fontWeight: '500' },

  routeTimeline: { marginBottom: 20 },
  routeStep: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  routeDot: { width: 16, height: 16, borderRadius: 8, marginRight: 12 },
  routeContent: { flex: 1 },
  routeStepLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase', marginBottom: 2 },
  routeStepTime: { fontSize: 14, fontWeight: '500', color: '#374151' },
  routeLine: { width: 2, height: 20, backgroundColor: '#E5E7EB', marginLeft: 7, marginBottom: 8 },

  addressesContainer: { gap: 12 },
  addressCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  addressCardHighlight: {
    borderColor: '#2563EB',
    borderWidth: 2,
    backgroundColor: '#EFF6FF',
  },
  addressIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  addressInfo: { flex: 1 },
  addressHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  addressLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', textTransform: 'uppercase' },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  activeBadgeText: { fontSize: 10, fontWeight: '600', color: '#2563EB' },
  addressText: { fontSize: 16, fontWeight: '500', color: '#374151', marginBottom: 4, lineHeight: 22 },
  addressBairro: { fontSize: 14, color: '#6B7280' },

  trackButton: {
    marginTop: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 12,
  },
  trackButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '600' },

  statsGrid: { flexDirection: 'row', gap: 12 },
  statCard: { flex: 1, backgroundColor: '#F3F4F6', borderRadius: 12, padding: 16, alignItems: 'center' },

  notesCard: { backgroundColor: '#FFF7ED', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: '#FED7AA' },
  notesText: { fontSize: 16, color: '#374151', lineHeight: 24 },

  actionsSection: { gap: 12, marginBottom: 20 },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2563EB',
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  cancelActionButton: { backgroundColor: '#DC2626' },
  actionButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },

  chatBubble: {
    position: 'absolute',
    right: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#059669',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
  },
  chatBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
    backgroundColor: '#DC2626',
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  chatBadgeText: { color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' },

  footer: { alignItems: 'center', padding: 16 },
  footerText: { fontSize: 12, color: '#9CA3AF', textAlign: 'center', marginBottom: 4 },
});

const chatStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  content: {
    height: height * 0.7,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#1F2937' },
  closeButton: { padding: 4 },

  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: 12,
    marginHorizontal: 20,
    marginTop: 12,
    borderRadius: 8,
    gap: 8,
  },
  statusText: { flex: 1, fontSize: 12, color: '#92400E' },

  messagesContainer: { flex: 1, backgroundColor: '#F9FAFB' },
  messagesContent: { padding: 20, paddingBottom: 40 },

  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 40 },
  loadingText: { color: '#6B7280', fontSize: 16 },

  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingVertical: 60 },
  emptyText: { marginTop: 16, color: '#6B7280', fontSize: 16, textAlign: 'center', maxWidth: '80%' },

  messageBubble: { maxWidth: '80%', padding: 12, borderRadius: 12, marginBottom: 12 },
  currentUserMessage: { alignSelf: 'flex-end', backgroundColor: '#2563EB', borderBottomRightRadius: 4 },
  otherUserMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  messageHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  senderInfo: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  senderName: { fontSize: 10, fontWeight: '600', color: '#6B7280' },
  currentUserSender: { color: '#DBEAFE' },
  messageTime: { fontSize: 10, color: '#9CA3AF' },
  messageText: { fontSize: 14, color: '#374151', lineHeight: 20 },
  currentUserMessageText: { color: '#FFFFFF' },

  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
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
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: { backgroundColor: '#9CA3AF' },

  chatClosedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: '#FEF2F2',
    borderTopWidth: 1,
    borderTopColor: '#FECACA',
    gap: 8,
  },
  chatClosedText: { fontSize: 14, color: '#DC2626', fontWeight: '500', textAlign: 'center' },
});

const ratingStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
  },
  title: { fontSize: 22, fontWeight: 'bold', color: '#1F2937', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginBottom: 24 },

  optionsContainer: { width: '100%', gap: 12, marginBottom: 24 },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    gap: 12,
  },
  optionSelected: { borderColor: '#2563EB', backgroundColor: '#EFF6FF' },
  optionTextContainer: { flex: 1 },
  optionText: { fontSize: 16, fontWeight: '600', color: '#374151' },
  optionDescription: { fontSize: 12, color: '#6B7280', marginTop: 2 },

  buttonsContainer: { flexDirection: 'row', gap: 12, width: '100%' },
  button: { flex: 1, paddingVertical: 14, borderRadius: 12, alignItems: 'center' },
  cancelButton: { backgroundColor: '#F3F4F6' },
  cancelButtonText: { color: '#374151', fontWeight: '600' },
  submitButton: { backgroundColor: '#2563EB' },
  submitButtonText: { color: '#FFFFFF', fontWeight: '600' },
});