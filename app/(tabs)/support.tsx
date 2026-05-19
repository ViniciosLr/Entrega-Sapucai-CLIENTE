import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { 
  Send, 
  MessageCircle, 
  CheckCircle, 
  PlusCircle,
  Clock,
  History,
  ChevronDown,
  ChevronUp,
  Sparkles
} from 'lucide-react-native';
import { useLocalSearchParams } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useSupport } from '@/hooks/useSupport';
import { MessageBubble } from '@/components/MessageBubble';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { LinearGradient } from 'expo-linear-gradient';

export default function SupportScreen() {
  const { pedidoId } = useLocalSearchParams();
  const { user } = useAuth();
   
  const { 
    messages, 
    sendMessage, 
    loading, 
    ticketStatus, 
    createTicket
  } = useSupport();

  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  
  const scrollViewRef = useRef<ScrollView>(null);

  // --- Ações ---

  const handleCreateTicket = async () => {
    setSending(true);
    try {
      await createTicket(pedidoId as string);
      setShowHistory(false);
    } catch (error) {
      Alert.alert('Erro', 'Não foi possível abrir o chamado.');
    } finally {
      setSending(false);
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || sending) return;

    setSending(true);
    try {
      await sendMessage(messageText.trim(), pedidoId as string);
      setMessageText('');
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      Alert.alert('Aviso', 'Se este é um chamado antigo, talvez seja necessário criar um novo para enviar mensagens.');
    } finally {
      setSending(false);
    }
  };

  useEffect(() => {
    setTimeout(() => {
      if (messages.length > 0) {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }
    }, 100);
  }, [messages, ticketStatus, showHistory]);

  // --- Renderização ---

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingSpinner size="large" />
        <Text style={styles.loadingText}>Verificando chamados...</Text>
      </View>
    );
  }

  // Tela Inicial
  if (!ticketStatus && !loading) {
    return (
      <View style={styles.container}>
        <View style={styles.centerContent}>
          <View style={styles.emptyIconWrapper}>
            <MessageCircle size={56} color="#EA580C" strokeWidth={1.5} />
          </View>
          <Text style={styles.stateTitle}>Precisa de ajuda?</Text>
          <Text style={styles.stateSubtitle}>
            Abra um chamado para falar com nosso suporte técnico e resolver qualquer dúvida.
          </Text>
           
          <TouchableOpacity 
            style={styles.actionButtonWrapper}
            onPress={handleCreateTicket}
            disabled={sending}
            activeOpacity={0.8}>
            <LinearGradient
              colors={['#EA580C', '#F97316', '#FB923C']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.actionButton}>
              {sending ? (
                <LoadingSpinner size="small" color="#FFF" />
              ) : (
                <>
                  <View style={styles.buttonIconCircle}>
                    <PlusCircle size={20} color="#FFFFFF" strokeWidth={2.5} />
                  </View>
                  <Text style={styles.actionButtonText}>Abrir Novo Chamado</Text>
                  <Sparkles size={18} color="#FFFFFF" strokeWidth={2} />
                </>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  // TELA DO CHAT
  return (
    <View style={styles.container}>
      <KeyboardAvoidingView 
        style={{ flex: 1 }} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}>
        
        {/* Status do Suporte - Header Simplificado */}
        <View style={styles.statusHeader}>
          <View style={styles.statusHeaderContent}>
            <MessageCircle size={20} color="#EA580C" strokeWidth={2} />
            <Text style={styles.statusHeaderTitle}>Suporte</Text>
            {ticketStatus && (
              <View style={[
                styles.statusBadge,
                ticketStatus === 'ativo' && styles.statusBadgeActive,
                ticketStatus === 'pendente' && styles.statusBadgePending,
                ticketStatus === 'resolvido' && styles.statusBadgeResolved
              ]}>
                <Text style={styles.statusBadgeText}>
                  {ticketStatus === 'pendente' ? 'Pendente' : 
                   ticketStatus === 'ativo' ? 'Ativo' : 
                   'Resolvido'}
                </Text>
              </View>
            )}
          </View>
        </View>

        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled" 
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}>
          
          {/* BLOCO DO STATUS RESOLVIDO */}
          {ticketStatus === 'resolvido' && (
            <View style={styles.statusCardSuccess}>
              <View style={styles.successIconCircle}>
                <CheckCircle size={32} color="#10B981" strokeWidth={2} />
              </View>
              <Text style={styles.statusCardTitle}>Problema Resolvido</Text>
              <Text style={styles.statusCardText}>
                Este chamado foi marcado como concluído com sucesso.
              </Text>

              {/* Botão de Histórico */}
              <TouchableOpacity 
                style={styles.historyButton}
                onPress={() => setShowHistory(!showHistory)}
                activeOpacity={0.7}>
                <History size={18} color="#059669" strokeWidth={2} />
                <Text style={styles.historyButtonText}>
                  {showHistory ? 'Ocultar Conversa' : 'Ver Histórico da Conversa'}
                </Text>
                {showHistory ? 
                  <ChevronUp size={16} color="#059669" strokeWidth={2}/> : 
                  <ChevronDown size={16} color="#059669" strokeWidth={2}/>
                }
              </TouchableOpacity>

              {/* Botão de Novo Chamado */}
              <TouchableOpacity 
                style={styles.newTicketButtonWrapper}
                onPress={handleCreateTicket}
                activeOpacity={0.8}>
                <LinearGradient
                  colors={['#10B981', '#34D399', '#6EE7B7']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.newTicketButton}>
                  <PlusCircle size={20} color="#FFF" strokeWidth={2.5} />
                  <Text style={styles.newTicketButtonText}>Abrir Novo Chamado</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          )}

          {(ticketStatus !== 'resolvido' || showHistory) && (
             messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isCurrentUser={message.user_id === user?.id}
              />
            ))
          )}
          
          {ticketStatus === 'resolvido' && !showHistory && (
             <View style={{ height: 20 }} />
          )}

        </ScrollView>
        
        {/* Se estiver PENDENTE */}
        {ticketStatus === 'pendente' && (
          <View style={styles.pendingContainer}>
            <View style={styles.pendingIconCircle}>
              <Clock size={24} color="#EA580C" strokeWidth={2} />
            </View>
            <Text style={styles.pendingTitle}>Aguardando Atendente</Text>
            <Text style={styles.pendingText}>
              Um de nossos atendentes irá aprovar seu chamado em breve. 
              Você poderá enviar mensagens assim que o chat for ativado.
            </Text>
          </View>
        )}

        {/* Se estiver ATIVO */}
        {ticketStatus === 'ativo' && (
          <View style={styles.inputContainer}>
            <TextInput
              style={styles.messageInput}
              value={messageText}
              onChangeText={setMessageText}
              placeholder="Digite sua mensagem..."
              placeholderTextColor="#9CA3AF"
              multiline
              maxLength={500}
            />
            <TouchableOpacity
              style={[
                styles.sendButtonWrapper,
                (!messageText.trim() || sending) && styles.sendButtonDisabled
              ]}
              onPress={handleSendMessage}
              disabled={!messageText.trim() || sending}
              activeOpacity={0.8}>
              <LinearGradient
                colors={messageText.trim() && !sending ? ['#EA580C', '#F97316'] : ['#9CA3AF', '#9CA3AF']}
                style={styles.sendButton}>
                {sending ? (
                  <LoadingSpinner size="small" color="#FFFFFF" />
                ) : (
                  <Send size={20} color="#FFFFFF" strokeWidth={2.5} />
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
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
  // Status Header simplificado
  statusHeader: {
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingBottom: 12,
    paddingHorizontal: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  statusHeaderContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusHeaderTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1E293B',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  statusBadgeActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderColor: '#10B981',
  },
  statusBadgePending: {
    backgroundColor: 'rgba(251, 191, 36, 0.1)',
    borderColor: '#FBBF24',
  },
  statusBadgeResolved: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    borderColor: '#94A3B8',
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1E293B',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FFF7ED',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 32,
    borderWidth: 2,
    borderColor: '#FFEDD5',
  },
  stateTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 12,
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  stateSubtitle: {
    fontSize: 16,
    color: '#64748B',
    textAlign: 'center',
    marginBottom: 36,
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  actionButtonWrapper: {
    width: '100%',
    borderRadius: 16,
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  actionButton: {
    flexDirection: 'row',
    paddingHorizontal: 24,
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  buttonIconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  statusCardSuccess: {
    backgroundColor: '#F0FDF4',
    padding: 28,
    borderRadius: 20,
    alignItems: 'center',
    marginVertical: 20,
    borderWidth: 2,
    borderColor: '#86EFAC',
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#D1FAE5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusCardTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#065F46',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  statusCardText: {
    fontSize: 15,
    color: '#047857',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  historyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    backgroundColor: '#D1FAE5',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: '#6EE7B7',
    gap: 8,
  },
  historyButtonText: {
    color: '#059669',
    fontWeight: '600',
    fontSize: 15,
  },
  newTicketButtonWrapper: {
    width: '100%',
    borderRadius: 12,
    shadowColor: '#10B981',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  newTicketButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 10,
  },
  newTicketButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 20,
    paddingBottom: 24,
  },
  pendingContainer: {
    padding: 28,
    backgroundColor: '#FFF7ED',
    borderTopWidth: 2,
    borderTopColor: '#FED7AA',
    alignItems: 'center',
    paddingBottom: Platform.OS === 'ios' ? 40 : 28,
  },
  pendingIconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFEDD5',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#FED7AA',
  },
  pendingTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#9A3412',
    marginBottom: 8,
    letterSpacing: -0.2,
  },
  pendingText: {
    fontSize: 15,
    color: '#C2410C',
    textAlign: 'center',
    lineHeight: 22,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    gap: 12,
  },
  messageInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1E293B',
    maxHeight: 100,
    backgroundColor: '#F8FAFC',
  },
  sendButtonWrapper: {
    borderRadius: 24,
    shadowColor: '#EA580C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    shadowOpacity: 0,
    elevation: 0,
  },
});