// services/payment.service.ts
import { supabase } from '@/lib/supabase';

const PAYMENT_FUNCTION_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-payment`;

// =========== INTERFACES ===========
export interface UserCard {
  id: string;
  user_id: string;
  customer_id?: string;
  card_name: string;
  card_type: 'credit' | 'debit';
  brand: string;
  last_digits: string;
  masked_number?: string;
  expiration_month: string;
  expiration_year: string;
  holder_name: string;
  payment_token?: string;
  gateway?: string;
  is_default: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateCardPayload {
  user_id: string;
  card_name: string;
  card_type: 'credit' | 'debit';
  brand: string;
  number: string;
  holder_name: string;
  expiration_month: string;
  expiration_year: string;
  cvv: string;
  is_default: boolean;
}

export interface PaymentRequest {
  orderId?: string;
  amount: number;
  paymentMethod: 'pix' | 'credit_card' | 'debit_card';
  cardToken?: string;
  cardBrand?: string;
  installments?: number;
  payerEmail?: string;
  payerName?: string;
  payerCpf?: string;
}

export interface PaymentResponse {
  success: boolean;
  payment_id?: string;
  status?: string;
  status_detail?: string | null;
  external_reference?: string;
  date_created?: string;
  date_approved?: string | null;
  pix?: {
    qr_code: string;
    qr_code_base64: string;
    ticket_url: string;
  };
  pix_expiration?: string | null;
  card?: {
    last_four_digits: string;
    brand: string;
    installments: number;
    payment_method_id: string;
  };
  error?: string;
  details?: any;
  code?: string;
}

export const paymentService = {

  async getUserCards(userId: string): Promise<UserCard[]> {
    try {
      const { data, error } = await supabase
        .from('user_cards')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('is_default', { ascending: false });

      if (error) {
        console.error('Erro ao buscar cartões:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Erro ao buscar cartões:', error);
      return [];
    }
  },

  async addCard(payload: CreateCardPayload): Promise<UserCard | null> {
    try {
      let expirationMonth = parseInt(payload.expiration_month);
      let expirationYear = parseInt(payload.expiration_year);

      if (expirationYear < 100) {
        expirationYear += 2000;
      }

      const tokenResult = await this.tokenizeCard({
        cardNumber: payload.number,
        cardholderName: payload.holder_name,
        expirationMonth,
        expirationYear,
        securityCode: payload.cvv,
      });

      if (!tokenResult) throw new Error('Falha ao validar cartão');

      const { data, error } = await supabase
        .from('user_cards')
        .insert({
          user_id: payload.user_id,
          card_name: payload.card_name,
          card_type: payload.card_type,
          brand: payload.brand,
          last_digits: tokenResult.lastFourDigits,
          masked_number: `**** **** **** ${tokenResult.lastFourDigits}`,
          expiration_month: String(expirationMonth).padStart(2, '0'),
          expiration_year: String(expirationYear),
          holder_name: payload.holder_name,
          payment_token: tokenResult.token,
          gateway: 'mercadopago',
          is_default: payload.is_default,
          is_active: true,
        })
        .select()
        .single();

      if (error) throw error;

      return data;
    } catch (error) {
      console.error('Erro ao adicionar cartão:', error);
      return null;
    }
  },

  async deleteCard(cardId: string): Promise<boolean> {
    const { error } = await supabase
      .from('user_cards')
      .update({ is_active: false })
      .eq('id', cardId);

    return !error;
  },

  async setDefaultCard(cardId: string, userId: string): Promise<boolean> {
    await supabase
      .from('user_cards')
      .update({ is_default: false })
      .eq('user_id', userId);

    const { error } = await supabase
      .from('user_cards')
      .update({ is_default: true })
      .eq('id', cardId);

    return !error;
  },

  async getDefaultCard(userId: string): Promise<UserCard | null> {
    const { data } = await supabase
      .from('user_cards')
      .select('*')
      .eq('user_id', userId)
      .eq('is_default', true)
      .eq('is_active', true)
      .single();

    return data || null;
  },

  async tokenizeCard(cardData: {
    cardNumber: string;
    cardholderName: string;
    expirationMonth: number;
    expirationYear: number;
    securityCode: string;
  }): Promise<{ token: string; lastFourDigits: string } | null> {
    try {
      const response = await fetch(PAYMENT_FUNCTION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'tokenize_card',
          card_number: cardData.cardNumber.replace(/\s/g, ''),
          cardholder_name: cardData.cardholderName,
          expiration_month: cardData.expirationMonth,
          expiration_year: cardData.expirationYear,
          security_code: cardData.securityCode,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        console.error('❌ Tokenização falhou:', data);
        return null;
      }

      return {
        token: data.token,
        lastFourDigits: data.last_four_digits,
      };
    } catch (error) {
      console.error('❌ Erro tokenização:', error);
      return null;
    }
  },

  async processPayment(paymentData: PaymentRequest, token: string): Promise<PaymentResponse> {
    try {

      // 🔥 SEM ALTERAR PIX (INTACTO)
      const safePaymentData = {
        ...paymentData,

        // 🔥 CORREÇÃO PRINCIPAL DO ERRO
        payment_method_id:
          paymentData.paymentMethod === 'pix'
            ? 'pix'
            : paymentData.cardBrand || undefined,

        // 🔥 GARANTE QUE NÃO ENVIA CPF NULL ERRADO
        payerCpf: paymentData.payerCpf ?? null,
      };

      console.log('💳 Enviando pagamento...');
      console.log('📦 DATA:', safePaymentData);

      const response = await fetch(PAYMENT_FUNCTION_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(safePaymentData),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        console.error('❌ Pagamento falhou:', data);
        return {
          success: false,
          error: data.error || 'Erro ao processar pagamento',
          details: data,
          code: data.code || 'UNKNOWN_ERROR',
        };
      }

      return data;

    } catch (error: any) {
      console.error('❌ Erro conexão:', error);
      return {
        success: false,
        error: error.message,
        code: 'CONNECTION_ERROR',
      };
    }
  },

  async verifyPaymentStatus(paymentId: string, token: string) {
    try {
      const response = await fetch(
        `${PAYMENT_FUNCTION_URL}?payment_id=${paymentId}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      const data = await response.json();
      return data.success ? data : null;

    } catch (error) {
      console.error('❌ Erro status:', error);
      return null;
    }
  },
};