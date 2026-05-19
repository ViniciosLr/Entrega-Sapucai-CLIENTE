// services/coupon.service.ts
import { supabase } from '@/lib/supabase';

export interface CouponValidationResult {
  valid: boolean;
  error?: string;
  coupon_id?: string;
  code?: string;
  description?: string;
  discount_type?: 'percentage' | 'fixed' | 'free_delivery';
  discount_value?: number;
  discount_applied?: number;
  final_total?: number;
  free_delivery?: boolean;
}

export interface CreateCouponPayload {
  code: string;
  description?: string;
  type: 'global' | 'store';
  commerce_id?: string;
  discount_type: 'percentage' | 'fixed' | 'free_delivery';
  discount_value: number;
  min_order_value?: number;
  max_discount_value?: number;
  max_uses?: number;
  max_uses_per_user?: number;
  starts_at?: string;
  expires_at?: string;
  is_active?: boolean;
}

export const couponService = {
  /**
   * Valida um cupom antes de aplicar (chama a função SQL)
   */
  async validateCoupon(
    code: string,
    customerId: string,
    commerceId: string,
    orderTotal: number
  ): Promise<CouponValidationResult> {
    try {
      const { data, error } = await supabase.rpc('validate_coupon', {
        p_code: code,
        p_customer_id: customerId,
        p_commerce_id: commerceId,
        p_order_total: orderTotal,
      });

      if (error) throw error;
      return data as CouponValidationResult;
    } catch (err: any) {
      console.error('Erro ao validar cupom:', err);
      return { valid: false, error: 'Erro ao validar cupom. Tente novamente.' };
    }
  },

  /**
   * Registra o uso do cupom APÓS o pedido ser criado
   */
  async applyCouponUsage(
    couponId: string,
    customerId: string,
    orderId: string,
    discountApplied: number,
    orderTotalBefore: number,
    orderTotalAfter: number
  ): Promise<boolean> {
    try {
      const { error } = await supabase.rpc('apply_coupon_usage', {
        p_coupon_id: couponId,
        p_customer_id: customerId,
        p_order_id: orderId,
        p_discount_applied: discountApplied,
        p_order_total_before: orderTotalBefore,
        p_order_total_after: orderTotalAfter,
      });

      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Erro ao registrar uso de cupom:', err);
      return false;
    }
  },

  /**
   * Lista cupons de um comércio (para tela de gestão)
   */
  async getCommerceCoupons(commerceId: string) {
    const { data, error } = await supabase
      .from('discount_coupons')
      .select('*')
      .eq('commerce_id', commerceId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  /**
   * Lista todos os cupons (admin)
   */
  async getAllCoupons() {
    const { data, error } = await supabase
      .from('discount_coupons')
      .select(`
        *,
        commerces (name)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  /**
   * Cria um novo cupom
   */
  async createCoupon(payload: CreateCouponPayload, createdBy: string, createdByRole: 'admin' | 'commerce') {
    const { data, error } = await supabase
      .from('discount_coupons')
      .insert({
        ...payload,
        code: payload.code.toUpperCase().trim(),
        created_by: createdBy,
        created_by_role: createdByRole,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Atualiza um cupom
   */
  async updateCoupon(id: string, updates: Partial<CreateCouponPayload>) {
    const { data, error } = await supabase
      .from('discount_coupons')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Ativa / desativa cupom
   */
  async toggleCoupon(id: string, isActive: boolean) {
    const { error } = await supabase
      .from('discount_coupons')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Remove um cupom (soft delete via is_active)
   */
  async deleteCoupon(id: string) {
    const { error } = await supabase
      .from('discount_coupons')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  /**
   * Histórico de uso de um cupom específico
   */
  async getCouponUsages(couponId: string) {
    const { data, error } = await supabase
      .from('coupon_usages')
      .select(`
        *,
        clientes (name, phone),
        pedidos (id, total_amount, created_at)
      `)
      .eq('coupon_id', couponId)
      .order('used_at', { ascending: false });

    if (error) throw error;
    return data ?? [];
  },

  /**
   * Gera código aleatório de cupom
   */
  generateCode(prefix = ''): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    const random = Array.from({ length: 6 }, () =>
      chars[Math.floor(Math.random() * chars.length)]
    ).join('');
    return prefix ? `${prefix.toUpperCase()}${random}` : random;
  },
};