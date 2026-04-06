import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Dimensions,
  Alert,
} from 'react-native';
import { 
  X, Send, User, Clock, AlertTriangle,
  MessageCircle as MessageCircleIcon 
} from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/hooks/useAuth';

interface ChatMessage {
  id: string;
  order_id: string;
  sender_id: string;
  message: string;
  created_at: string;
  sender_name?: string;
  isCurrentUser?: boolean;
  isMotoboy?: boolean;
}

interface ChatModalProps {
  visible: boolean;
  onClose: () => void;
  orderId: string;
  orderStatus: string;
  motoboyId?: string;
  customerId?: string;
}

export function ChatModal({ 
  visible, 
  onClose, 
  orderId, 
  orderStatus,
  motoboyId,
  customerId 
}: ChatModalProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [senderName, setSenderName] = useState<string>('Você');
  const [isMotoboyUser, setIsMotoboyUser] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (visible && orderId && user?.id) {
      fetchMessages();
      subscribeToMessages();
      fetchSenderInfo();
      
      // Focar no input quando o modal abrir
      setTimeout(() => {
        inputRef.current?.focus();
      }, 300);
    }
    
    return () => {
      // Limpar subscription quando o modal fechar
      if (subscription) {
        supabase.removeChannel(subscription);
      }
    };
  }, [visible, orderId, user?.id]);

  let subscription: any;

  const fetchSenderInfo = async () => {
    if (!user?.id) return;
    
    try {
      // Primeiro tenta buscar no cliente
      const { data: cliente } = await supabase
        .from('clientes')
        .select('name')
        .eq('user_id', user.id)
        .single();

      if (cliente) {
        setSenderName(cliente.name);
        setIsMotoboyUser(false);
      } else {
        // Tenta buscar no motoboy
        const { data: motoboy } = await supabase
          .from('motoboys')
          .select('name')
          .eq('user_id', user.id)
          .single();

        if (motoboy) {
          setSenderName(motoboy.name);
          setIsMotoboyUser(true);
        }
      }
    } catch (err) {
      console.log('Erro ao buscar info do usuário:', err);
    }
  };

  const fetchMessages = async () => {
    if (!orderId || !user?.id) return;
    
    setLoading(true);
    try {
      const { data: messagesData, error } = await supabase
        .from('order_chat_messages')
        .select('*')
        .eq('order_id', orderId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Adicionar informações dos remetentes
      const messagesWithSenders = await Promise.all(
        (messagesData || []).map(async (message) => {
          const isCurrentUser = message.sender_id === user.id;
          
          // Buscar nome do remetente e determinar se é motoboy
          let senderName = 'Usuário';
          let isMotoboy = false;
          
          try {
            if (message.sender_id) {
              // Primeiro tenta buscar no cliente
              const { data: cliente } = await supabase
                .from('clientes')
                .select('name')
                .eq('user_id', message.sender_id)
                .single();

              if (cliente) {
                senderName = cliente.name;
                isMotoboy = false;
              } else {
                // Tenta buscar no motoboy
                const { data: motoboy } = await supabase
                  .from('motoboys')
                  .select('name')
                  .eq('user_id', message.sender_id)
                  .single();

                if (motoboy) {
                  senderName = motoboy.name;
                  isMotoboy = true;
                }
              }
            }
          } catch (err) {
            console.log('Erro ao buscar info do remetente:', err);
          }

          return {
            ...message,
            sender_name: senderName,
            isCurrentUser,
            isMotoboy
          };
        })
      );

      setMessages(messagesWithSenders);
      
      // Scroll para o final após carregar mensagens
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 200);
      
    } catch (error) {
      console.error('Erro ao carregar mensagens:', error);
      Alert.alert('Erro', 'Não foi possível carregar as mensagens');
    } finally {
      setLoading(false);
    }
  };

  const subscribeToMessages = () => {
    subscription = supabase
      .channel(`order_chat_${orderId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'order_chat_messages',
          filter: `order_id=eq.${orderId}`
        },
        async (payload) => {
          console.log('Nova mensagem recebida via subscription:', payload);
          const newMsg = payload.new as ChatMessage;
          
          // Verificar se a mensagem já não está na lista (para evitar duplicação)
          const messageExists = messages.some(msg => msg.id === newMsg.id);
          if (messageExists) return;
          
          // Buscar nome do remetente e determinar se é motoboy
          let senderName = 'Usuário';
          let isMotoboy = false;
          
          try {
            if (newMsg.sender_id) {
              // Primeiro tenta buscar no cliente
              const { data: cliente } = await supabase
                .from('clientes')
                .select('name')
                .eq('user_id', newMsg.sender_id)
                .single();

              if (cliente) {
                senderName = cliente.name;
                isMotoboy = false;
              } else {
                // Tenta buscar no motoboy
                const { data: motoboy } = await supabase
                  .from('motoboys')
                  .select('name')
                  .eq('user_id', newMsg.sender_id)
                  .single();

                if (motoboy) {
                  senderName = motoboy.name;
                  isMotoboy = true;
                }
              }
            }
          } catch (err) {
            console.log('Erro ao buscar nome via subscription:', err);
          }

          const messageWithSender = {
            ...newMsg,
            sender_name: senderName,
            isCurrentUser: newMsg.sender_id === user?.id,
            isMotoboy
          };

          setMessages(prev => [...prev, messageWithSender]);
          
          // Scroll para a nova mensagem
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 100);
        }
      )
      .subscribe((status) => {
        console.log('Status da subscription:', status);
      });
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !user?.id || !orderId) return;
    
    const messageText = newMessage.trim();
    setNewMessage('');
    setSending(true);
    
    try {
      // Criar uma mensagem temporária localmente
      const tempMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        order_id: orderId,
        sender_id: user.id,
        message: messageText,
        created_at: new Date().toISOString(),
        sender_name: senderName,
        isCurrentUser: true,
        isMotoboy: isMotoboyUser
      };

      // Adicionar mensagem localmente imediatamente
      setMessages(prev => [...prev, tempMessage]);
      
      // Scroll para a nova mensagem
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 50);

      // Enviar para o banco de dados
      const { data, error } = await supabase
        .from('order_chat_messages')
        .insert({
          order_id: orderId,
          sender_id: user.id,
          message: messageText
        })
        .select()
        .single();

      if (error) throw error;

      // Atualizar a mensagem temporária com o ID real do banco
      if (data) {
        setMessages(prev => prev.map(msg => 
          msg.id === tempMessage.id 
            ? { 
                ...msg, 
                id: data.id, 
                created_at: data.created_at,
                isMotoboy: isMotoboyUser
              }
            : msg
        ));
      }

      // Refocar no input
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);

    } catch (error: any) {
      console.error('Erro ao enviar mensagem:', error);
      
      // Mostrar erro específico
      const errorMessage = error.message || 'Não foi possível enviar a mensagem';
      Alert.alert('Erro', errorMessage);
      
      // Remover a mensagem temporária se houve erro
      setMessages(prev => prev.filter(msg => !msg.id.startsWith('temp-')));
      
      // Restaurar a mensagem no input
      setNewMessage(messageText);
    } finally {
      setSending(false);
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  // Estatísticas do chat
  const chatStats = {
    totalMessages: messages.length,
    myMessages: messages.filter(msg => msg.isCurrentUser).length,
    motoboyMessages: messages.filter(msg => msg.isMotoboy && !msg.isCurrentUser).length,
    customerMessages: messages.filter(msg => !msg.isMotoboy && !msg.isCurrentUser).length
  };

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <MessageCircleIcon size={24} color="#2563EB" />
              <View>
                <Text style={styles.headerTitle}>Chat da Corrida</Text>
                <Text style={styles.headerSubtitle}>
                  {chatStats.totalMessages} mensagens • Você: {chatStats.myMessages} • {isMotoboyUser ? 'Cliente' : 'Motoboy'}: {isMotoboyUser ? chatStats.customerMessages : chatStats.motoboyMessages}
                </Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={onClose} 
              style={styles.closeButton}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <X size={24} color="#6B7280" />
            </TouchableOpacity>
          </View>

          {/* Status Info */}
          <View style={styles.statusInfo}>
            <AlertTriangle size={16} color="#EA580C" />
            <Text style={styles.statusText}>
              Este chat será fechado automaticamente quando a corrida for finalizada
            </Text>
          </View>

          {/* Messages Area */}
          <ScrollView 
            ref={scrollViewRef}
            style={styles.messagesContainer}
            contentContainerStyle={styles.messagesContent}
            showsVerticalScrollIndicator={true}
            keyboardShouldPersistTaps="handled"
          >
            {loading ? (
              <View style={styles.loadingContainer}>
                <Text style={styles.loadingText}>Carregando mensagens...</Text>
              </View>
            ) : messages.length === 0 ? (
              <View style={styles.emptyContainer}>
                <MessageCircleIcon size={48} color="#D1D5DB" />
                <Text style={styles.emptyText}>
                  Nenhuma mensagem ainda. Seja o primeiro a enviar!
                </Text>
              </View>
            ) : (
              messages.map((message) => (
                <View
                  key={message.id}
                  style={[
                    styles.messageBubble,
                    message.isCurrentUser 
                      ? styles.currentUserMessage 
                      : styles.otherUserMessage,
                    message.isMotoboy && styles.motoboyMessage
                  ]}
                >
                  <View style={styles.messageHeader}>
                    <View style={styles.senderInfo}>
                      <User size={12} color={
                        message.isCurrentUser ? '#2563EB' : 
                        message.isMotoboy ? '#059669' : '#6B7280'
                      } />
                      <Text style={[
                        styles.senderName,
                        message.isCurrentUser && styles.currentUserSender,
                        message.isMotoboy && !message.isCurrentUser && styles.motoboySender
                      ]}>
                        {message.isCurrentUser ? 'Você' : message.sender_name}
                        {message.isMotoboy && !message.isCurrentUser && ' 🏍️'}
                      </Text>
                    </View>
                    <Text style={[
                      styles.messageTime,
                      message.id.startsWith('temp-') && styles.sendingTime
                    ]}>
                      {message.id.startsWith('temp-') ? 'Enviando...' : formatTime(message.created_at)}
                    </Text>
                  </View>
                  <Text style={[
                    styles.messageText,
                    message.isCurrentUser && styles.currentUserMessageText
                  ]}>
                    {message.message}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>

          {/* Input Area */}
          {orderStatus !== 'finalizado' && orderStatus !== 'cancelado' && (
            <View style={styles.inputContainer}>
              <TextInput
                ref={inputRef}
                style={styles.input}
                value={newMessage}
                onChangeText={setNewMessage}
                placeholder="Digite sua mensagem..."
                placeholderTextColor="#9CA3AF"
                multiline
                maxLength={500}
                editable={!sending}
                onSubmitEditing={handleSendMessage}
                blurOnSubmit={false}
                returnKeyType="send"
                textAlignVertical="top"
                minHeight={Platform.OS === 'ios' ? 40 : 45}
                maxHeight={120}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!newMessage.trim() || sending) && styles.sendButtonDisabled
                ]}
                onPress={handleSendMessage}
                disabled={!newMessage.trim() || sending}
              >
                {sending ? (
                  <Text style={styles.sendButtonText}>...</Text>
                ) : (
                  <Send size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* Chat Closed Message */}
          {(orderStatus === 'finalizado' || orderStatus === 'cancelado') && (
            <View style={styles.chatClosedContainer}>
              <Clock size={24} color="#DC2626" />
              <Text style={styles.chatClosedText}>
                Este chat foi encerrado porque a corrida foi {
                  orderStatus === 'finalizado' ? 'finalizada' : 'cancelada'
                }
              </Text>
            </View>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const { height } = Dimensions.get('window');
const styles = StyleSheet.create({
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
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    backgroundColor: '#FFFFFF',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    flex: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 2,
  },
  headerSubtitle: {
    fontSize: 11,
    color: '#6B7280',
    fontWeight: '500',
  },
  closeButton: {
    padding: 4,
    marginTop: 2,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFBEB',
    padding: 12,
    marginHorizontal: 20,
    marginTop: 8,
    borderRadius: 8,
    gap: 8,
  },
  statusText: {
    flex: 1,
    fontSize: 12,
    color: '#92400E',
  },
  messagesContainer: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  messagesContent: {
    padding: 20,
    paddingBottom: 20,
    paddingTop: 10,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#6B7280',
    fontSize: 16,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    marginTop: 16,
    color: '#6B7280',
    fontSize: 16,
    textAlign: 'center',
    maxWidth: '80%',
  },
  messageBubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
  },
  currentUserMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#2563EB',
    borderBottomRightRadius: 4,
  },
  otherUserMessage: {
    alignSelf: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  motoboyMessage: {
    borderLeftWidth: 3,
    borderLeftColor: '#059669',
  },
  messageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  senderInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  senderName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#6B7280',
  },
  currentUserSender: {
    color: '#DBEAFE',
  },
  motoboySender: {
    color: '#059669',
  },
  messageTime: {
    fontSize: 10,
    color: '#9CA3AF',
    fontStyle: 'italic',
  },
  sendingTime: {
    color: '#2563EB',
    fontWeight: '500',
  },
  messageText: {
    fontSize: 15,
    color: '#374151',
    lineHeight: 22,
  },
  currentUserMessageText: {
    color: '#FFFFFF',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    gap: 8,
    minHeight: 60,
  },
  input: {
    flex: 1,
    backgroundColor: '#F3F4F6',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 12 : 10,
    paddingBottom: Platform.OS === 'ios' ? 12 : 10,
    fontSize: 15,
    color: '#374151',
    textAlignVertical: 'center',
    includeFontPadding: true,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#2563EB',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 4,
  },
  sendButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  chatClosedContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#FEF2F2',
    borderTopWidth: 1,
    borderTopColor: '#FECACA',
    gap: 8,
  },
  chatClosedText: {
    fontSize: 14,
    color: '#DC2626',
    fontWeight: '500',
    textAlign: 'center',
  },
});