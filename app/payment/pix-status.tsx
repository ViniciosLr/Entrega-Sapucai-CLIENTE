// app/payment/pix-status.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
  Share,
  Animated,
  Platform,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import QRCode from 'react-native-qrcode-svg';
import { supabase } from '@/lib/supabase';
import { paymentService } from '@/services/payment.service';
import { useCart } from '@/contexts/CartContext'; // 🔥 IMPORTADO

interface PixData {
  qr_code: string;
  qr_code_base64?: string;
  ticket_url?: string;
  expires_at?: string;
}

export default function PixStatusScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const { clearCart } = useCart(); // 🔥 HOOK PARA LIMPAR CARRINHO
  
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [paymentId, setPaymentId] = useState<string>('');
  const [orderId, setOrderId] = useState<string>('');
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | 'expired'>('pending');
  const [timeLeft, setTimeLeft] = useState<number>(1800);
  const [isLoading, setIsLoading] = useState(true);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  
  const spinValue = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Animações
  useEffect(() => {
    Animated.loop(
      Animated.timing(spinValue, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Carregar dados do PIX dos parâmetros
  useEffect(() => {
    if (hasLoaded) return;
    
    console.log('🔄 useEffect de carregamento - iniciando');
    
    if (!params.pixData) {
      console.error('❌ pixData não encontrado nos parâmetros!');
      setError('Dados de pagamento não encontrados');
      setIsLoading(false);
      setHasLoaded(true);
      return;
    }
    
    if (!params.paymentId) {
      console.error('❌ paymentId não encontrado nos parâmetros!');
      setError('ID do pagamento não encontrado');
      setIsLoading(false);
      setHasLoaded(true);
      return;
    }
    
    if (!params.orderId) {
      console.error('❌ orderId não encontrado nos parâmetros!');
      setError('ID do pedido não encontrado');
      setIsLoading(false);
      setHasLoaded(true);
      return;
    }
    
    try {
      console.log('📦 Tentando parsear pixData');
      const parsedPixData = JSON.parse(params.pixData as string);
      console.log('✅ pixData parseado:', { 
        hasQrCode: !!parsedPixData.qr_code,
        qrCodeLength: parsedPixData.qr_code?.length,
      });
      
      setPixData(parsedPixData);
      setPaymentId(params.paymentId as string);
      setOrderId(params.orderId as string);
      
      if (parsedPixData.expires_at) {
        const expiryDate = new Date(parsedPixData.expires_at);
        const now = new Date();
        const diff = Math.floor((expiryDate.getTime() - now.getTime()) / 1000);
        if (diff > 0) setTimeLeft(diff);
      }
      
      setError(null);
    } catch (error) {
      console.error('❌ Erro ao carregar dados PIX:', error);
      setError('Erro ao processar dados de pagamento');
      Alert.alert('Erro', 'Dados de pagamento inválidos');
      router.back();
    } finally {
      setIsLoading(false);
      setHasLoaded(true);
    }
  }, [params, hasLoaded]);

  // Timer de expiração
  useEffect(() => {
    if (status !== 'pending' || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          setStatus('expired');
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [status, timeLeft]);

  // 🔥 Verificar status do pagamento COM LIMPEZA DO CARRINHO
  useEffect(() => {
    if (status !== 'pending' || !paymentId) return;

    let isMounted = true;
    let interval: NodeJS.Timeout | null = null;

    const checkPaymentStatus = async () => {
      try {
        const session = await supabase.auth.getSession();
        const token = session.data.session?.access_token;
        
        if (!token) {
          console.log('⚠️ Sem token, tentando novamente...');
          return;
        }

        console.log(`🔍 Verificando pagamento:`, paymentId);
        
        const result = await paymentService.verifyPaymentStatus(paymentId, token);
        
        if (!isMounted) return;
        
        console.log(`📡 Resultado verificação:`, result);
        
        if (result?.status === 'approved') {
          console.log('✅ Pagamento aprovado!');
          setStatus('approved');
          
          // 🔥 ATUALIZA O PEDIDO NO BANCO
          await supabase
            .from('pedidos')
            .update({ 
              payment_status: 'approved',
              status: 'confirmado'
            })
            .eq('id', orderId);
          
          // 🔥 LIMPA O CARRINHO
          await clearCart();
          console.log('🗑️ Carrinho limpo com sucesso!');
          
          setTimeout(() => {
            router.replace(`/order/${orderId}`);
          }, 3000);
        } else if (result?.status === 'rejected') {
          console.log('❌ Pagamento rejeitado');
          setStatus('rejected');
        } else {
          console.log(`⏳ Pagamento pendente: ${result?.status || 'unknown'}`);
        }
      } catch (error) {
        console.error('❌ Erro ao verificar status:', error);
      }
    };

    const timeout = setTimeout(checkPaymentStatus, 3000);
    interval = setInterval(checkPaymentStatus, 8000);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [paymentId, orderId, status, clearCart]); // 🔥 Adicionado clearCart nas dependências

  const copyPixCode = async () => {
    if (pixData?.qr_code) {
      await Clipboard.setStringAsync(pixData.qr_code);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3000);
    }
  };

  const sharePixCode = async () => {
    if (pixData?.qr_code) {
      try {
        await Share.share({
          message: `Pagamento PIX - Código:\n${pixData.qr_code}\n\nValor: ${params.amount || ''}`,
          title: 'Código PIX para pagamento',
        });
      } catch (error) {
        console.error('Erro ao compartilhar:', error);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (error) {
    return (
      <View style={styles.loadingContainer}>
        <Ionicons name="alert-circle" size={60} color="#EF4444" />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
          <Text style={styles.retryButtonText}>Voltar</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const renderStatusContent = () => {
    switch (status) {
      case 'approved':
        return (
          <View style={styles.statusApprovedContainer}>
            <Animated.View style={[styles.checkmarkCircle, { transform: [{ scale: pulseAnim }] }]}>
              <Ionicons name="checkmark" size={60} color="#FFF" />
            </Animated.View>
            <Text style={styles.statusTitle}>Pagamento Confirmado! ✅</Text>
            <Text style={styles.statusText}>
              Seu pagamento foi aprovado com sucesso. Redirecionando para o acompanhamento do pedido...
            </Text>
            <ActivityIndicator size="large" color="#22C55E" style={{ marginTop: 20 }} />
          </View>
        );

      case 'rejected':
        return (
          <View style={styles.statusRejectedContainer}>
            <View style={styles.errorCircle}>
              <Ionicons name="close" size={60} color="#FFF" />
            </View>
            <Text style={styles.statusTitle}>Pagamento Recusado ❌</Text>
            <Text style={styles.statusText}>
              Não foi possível confirmar seu pagamento. Você pode tentar novamente ou escolher outra forma de pagamento.
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
              <Text style={styles.retryButtonText}>Tentar novamente</Text>
            </TouchableOpacity>
          </View>
        );

      case 'expired':
        return (
          <View style={styles.statusExpiredContainer}>
            <View style={styles.warningCircle}>
              <Ionicons name="time-outline" size={60} color="#FFF" />
            </View>
            <Text style={styles.statusTitle}>Pagamento Expirado ⏰</Text>
            <Text style={styles.statusText}>
              O prazo para pagamento expirou. Por favor, realize um novo pedido.
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => router.back()}>
              <Text style={styles.retryButtonText}>Voltar para o checkout</Text>
            </TouchableOpacity>
          </View>
        );

      default:
        return (
          <>
            <View style={styles.timerContainer}>
              <Ionicons name="time-outline" size={24} color={timeLeft < 300 ? '#EF4444' : '#FF6B6B'} />
              <Text style={[styles.timerText, timeLeft < 300 && { color: '#EF4444' }]}>
                Expira em: {formatTime(timeLeft)}
              </Text>
            </View>

            {pixData?.qr_code ? (
              <View style={styles.qrContainer}>
                <QRCode
                  value={pixData.qr_code}
                  size={250}
                  color="#000000"
                  backgroundColor="#FFFFFF"
                />
              </View>
            ) : (
              <View style={styles.qrPlaceholder}>
                <ActivityIndicator size="large" color="#FF6B6B" />
                <Text style={styles.qrPlaceholderText}>Carregando QR Code...</Text>
              </View>
            )}

            <View style={styles.pixCodeContainer}>
              <Text style={styles.pixCodeLabel}>📋 Código PIX Copia e Cola</Text>
              <View style={styles.pixCodeBox}>
                <Text style={styles.pixCode} numberOfLines={4}>
                  {pixData?.qr_code || 'Carregando...'}
                </Text>
              </View>
              
              <View style={styles.actionButtons}>
                <TouchableOpacity style={[styles.actionButton, styles.copyButton]} onPress={copyPixCode}>
                  <Ionicons name="copy-outline" size={22} color="#FFF" />
                  <Text style={styles.actionButtonText}>
                    {isCopied ? 'Copiado!' : 'Copiar código'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity style={[styles.actionButton, styles.shareButton]} onPress={sharePixCode}>
                  <Ionicons name="share-outline" size={22} color="#FFF" />
                  <Text style={styles.actionButtonText}>Compartilhar</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.instructionsContainer}>
              <Text style={styles.instructionsTitle}>📌 Como pagar:</Text>
              <View style={styles.instructionItem}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>1</Text>
                </View>
                <Text style={styles.instructionText}>Abra o aplicativo do seu banco ou carteira digital</Text>
              </View>
              <View style={styles.instructionItem}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>2</Text>
                </View>
                <Text style={styles.instructionText}>Escolha a opção "Pagar com PIX" ou "Leitor de QR Code"</Text>
              </View>
              <View style={styles.instructionItem}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>3</Text>
                </View>
                <Text style={styles.instructionText}>Escaneie o QR Code acima ou cole o código</Text>
              </View>
              <View style={styles.instructionItem}>
                <View style={styles.instructionNumber}>
                  <Text style={styles.instructionNumberText}>4</Text>
                </View>
                <Text style={styles.instructionText}>Confirme os dados e finalize o pagamento</Text>
              </View>
            </View>

            <View style={styles.waitingContainer}>
              <ActivityIndicator size="small" color="#FF6B6B" />
              <Text style={styles.waitingText}>Aguardando confirmação do pagamento...</Text>
            </View>
          </>
        );
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
        <Text style={styles.loadingText}>Preparando pagamento...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient colors={['#FF6B6B', '#FF8E53']} style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Pagamento via PIX</Text>
        <View style={{ width: 40 }} />
      </LinearGradient>

      <ScrollView 
        style={styles.content} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.contentContainer}
      >
        {renderStatusContent()}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA', padding: 20 },
  loadingText: { marginTop: 16, fontSize: 16, color: '#666' },
  errorText: { marginTop: 16, fontSize: 16, color: '#EF4444', textAlign: 'center', marginBottom: 20 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingBottom: 16 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF' },
  content: { flex: 1 },
  contentContainer: { padding: 20, paddingBottom: 40 },
  timerContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFF', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 30, alignSelf: 'center', marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  timerText: { fontSize: 16, fontWeight: 'bold', color: '#FF6B6B' },
  qrContainer: { backgroundColor: '#FFF', padding: 24, borderRadius: 24, alignItems: 'center', marginBottom: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 8, elevation: 4 },
  qrPlaceholder: { backgroundColor: '#FFF', padding: 40, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 24, minHeight: 300 },
  qrPlaceholderText: { marginTop: 16, fontSize: 14, color: '#999' },
  pixCodeContainer: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  pixCodeLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 12 },
  pixCodeBox: { backgroundColor: '#F9FAFB', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 16 },
  pixCode: { fontSize: 12, color: '#333', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', lineHeight: 18 },
  actionButtons: { flexDirection: 'row', gap: 12 },
  actionButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: 12 },
  copyButton: { backgroundColor: '#FF6B6B' },
  shareButton: { backgroundColor: '#10B981' },
  actionButtonText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  instructionsContainer: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 20 },
  instructionsTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 16 },
  instructionItem: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  instructionNumber: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FF6B6B', justifyContent: 'center', alignItems: 'center' },
  instructionNumberText: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  instructionText: { flex: 1, fontSize: 14, color: '#666', lineHeight: 20 },
  waitingContainer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingVertical: 16 },
  waitingText: { fontSize: 14, color: '#666' },
  statusApprovedContainer: { alignItems: 'center', paddingVertical: 40 },
  statusRejectedContainer: { alignItems: 'center', paddingVertical: 40 },
  statusExpiredContainer: { alignItems: 'center', paddingVertical: 40 },
  checkmarkCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#22C55E', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  errorCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#EF4444', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  warningCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F59E0B', justifyContent: 'center', alignItems: 'center', marginBottom: 24 },
  statusTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 12, textAlign: 'center' },
  statusText: { fontSize: 16, color: '#666', textAlign: 'center', marginBottom: 24, lineHeight: 24 },
  retryButton: { backgroundColor: '#FF6B6B', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 12 },
  retryButtonText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
});