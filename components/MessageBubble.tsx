import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
// Certifique-se que o caminho do hook esteja correto
import { SupportMessage } from '@/hooks/useSupport';

interface MessageBubbleProps {
  message: SupportMessage;
  isCurrentUser: boolean;
}

export function MessageBubble({ message, isCurrentUser }: MessageBubbleProps) {
  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <View style={[
      styles.container,
      isCurrentUser ? styles.currentUserContainer : styles.otherUserContainer
    ]}>
      <View style={[
        styles.bubble,
        isCurrentUser ? styles.currentUserBubble : styles.otherUserBubble
      ]}>
        <Text style={[
          styles.messageText,
          isCurrentUser ? styles.currentUserText : styles.otherUserText
        ]}>
          {/* CORREÇÃO AQUI: Mudamos de .conteudo para .mensagem */}
          {message.mensagem}
        </Text>
        <Text style={[
          styles.timeText,
          isCurrentUser ? styles.currentUserTime : styles.otherUserTime
        ]}>
          {formatTime(message.created_at)}
        </Text>
      </View>
      {!isCurrentUser && (
        <Text style={styles.senderLabel}>Suporte</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    maxWidth: '80%',
  },
  currentUserContainer: {
    alignSelf: 'flex-end',
  },
  otherUserContainer: {
    alignSelf: 'flex-start',
  },
  bubble: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 18,
    minHeight: 40,
  },
  currentUserBubble: {
    backgroundColor: '#EA580C', // Ajustei para Laranja (sua cor tema) ou mantenha #2563EB se preferir azul
    borderBottomRightRadius: 4,
  },
  otherUserBubble: {
    backgroundColor: '#F3F4F6',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
    marginBottom: 4,
  },
  currentUserText: {
    color: '#FFFFFF',
  },
  otherUserText: {
    color: '#374151',
  },
  timeText: {
    fontSize: 12,
    alignSelf: 'flex-end',
  },
  currentUserTime: {
    color: '#FED7AA', // Ajustado para combinar com laranja, ou use #BFDBFE para azul
  },
  otherUserTime: {
    color: '#9CA3AF',
  },
  senderLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginTop: 4,
    marginLeft: 4,
  },
});