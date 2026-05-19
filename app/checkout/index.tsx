// app/checkout/index.tsx — VERSÃO COM CUPOM INTEGRADO E SAFEAREAVIEW CORRIGIDO
import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Animated,
  Image,
  TextInput,
  SafeAreaView,
  StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';
import MapView, { PROVIDER_GOOGLE, Region, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { paymentService } from '@/services/payment.service';
import { couponService, CouponValidationResult } from '@/services/coupon.service';

// ─── Tipos (mantidos do original) ──────────────────────────────────────────
interface Coordinates { latitude: number; longitude: number; }
interface Address {
  street: string; number: string; neighborhood: string;
  complement?: string; city: string; reference?: string; coords?: Coordinates;
}
interface PaymentMethod {
  id: string; name: string; code: string; icon: string;
  is_online?: boolean; requires_card_machine?: boolean;
}
interface SavedCard {
  id: string; card_name: string; last_digits: string; brand: string;
  masked_number?: string; card_type: 'credit' | 'debit';
  is_default: boolean; payment_token?: string;
}
interface SystemConfig {
  base_price: number; price_per_km: number; platform_fee: number;
  pricing_type: 'per_km' | 'fixed'; rain_surcharge_percent: number;
  holiday_surcharge_percent: number; sunday_surcharge_percent: number;
  is_raining: boolean; is_holiday: boolean;
}

// ─── Helpers (mantidos do original) ────────────────────────────────────────
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};
const formatPrice = (price: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(price);
const getPaymentIcon = (code: string): any => {
  const icons: Record<string, string> = {
    pix: 'qr-code-outline', credit_card: 'card-outline', debit_card: 'card-outline',
    credit_card_online: 'card-outline', debit_card_online: 'card-outline',
    dinheiro: 'cash-outline', cash: 'cash-outline',
  };
  return icons[code] || 'card-outline';
};
const getCardBrandColor = (brand: string): string => {
  const colors: Record<string, string> = {
    visa: '#1A1F71', mastercard: '#EB001B', amex: '#2E77BC',
    elo: '#00A4E0', hipercard: '#B3131B', diners: '#0079BE',
    discover: '#FF6000', outro: '#666',
  };
  return colors[brand] || '#666';
};

// ─── MapPickerModal (inalterado) ────────────────────────────────────────────
const MapPickerModal = ({
  visible, onClose, onConfirm, initialRegion, hasPermission, title,
}: {
  visible: boolean; onClose: () => void; onConfirm: (region: Region) => void;
  initialRegion: Region; hasPermission: boolean; title: string;
}) => {
  const [currentRegion, setCurrentRegion] = useState<Region>(initialRegion);
  const [isDragging, setIsDragging] = useState(false);
  const [detectedAddress, setDetectedAddress] = useState<string>('');
  const [isLoadingAddress, setIsLoadingAddress] = useState(false);
  const pinScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible || isDragging) return;
    const fetchAddress = async () => {
      setIsLoadingAddress(true);
      try {
        const addresses = await Location.reverseGeocodeAsync({
          latitude: currentRegion.latitude, longitude: currentRegion.longitude
        });
        if (addresses?.[0]) {
          const addr = addresses[0];
          setDetectedAddress(`${addr.street || ''}, ${addr.streetNumber || 's/n'} - ${addr.district || addr.subregion || ''}`);
        }
      } catch { } finally { setIsLoadingAddress(false); }
    };
    fetchAddress();
  }, [currentRegion, isDragging, visible]);

  const handleRegionChangeComplete = (region: Region) => {
    setCurrentRegion(region); setIsDragging(false);
    Animated.spring(pinScale, { toValue: 1, useNativeDriver: true }).start();
  };
  const handleRegionChange = () => {
    setIsDragging(true);
    Animated.spring(pinScale, { toValue: 1.25, useNativeDriver: true }).start();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <View style={mapStyles.modalHeader}>
          <TouchableOpacity onPress={onClose} style={mapStyles.modalCloseBtn}>
            <Ionicons name="close" size={22} color="#374151" />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: 'center' }}>
            <Text style={mapStyles.modalTitle}>{title}</Text>
            <Text style={mapStyles.modalSubtitle}>Mova o mapa para ajustar o pino</Text>
          </View>
          <View style={{ width: 40 }} />
        </View>
        <View style={{ flex: 1 }}>
          <MapView
            provider={PROVIDER_GOOGLE} style={{ flex: 1 }} initialRegion={initialRegion}
            onRegionChange={handleRegionChange} onRegionChangeComplete={handleRegionChangeComplete}
            showsUserLocation={hasPermission} showsMyLocationButton={hasPermission}
          />
          <View style={mapStyles.pinContainer} pointerEvents="none">
            <Animated.View style={{ transform: [{ scale: pinScale }] }}>
              <Ionicons name="location" size={44} color="#FF6B6B" />
            </Animated.View>
          </View>
          <View style={mapStyles.addressPreviewContainer}>
            {isLoadingAddress ? (
              <ActivityIndicator size="small" color="#FF6B6B" />
            ) : (
              <>
                <Ionicons name="location-outline" size={18} color="#FF6B6B" />
                <Text style={mapStyles.addressPreviewText} numberOfLines={2}>
                  {detectedAddress || 'Movendo mapa...'}
                </Text>
              </>
            )}
          </View>
        </View>
        <View style={mapStyles.modalFooter}>
          <TouchableOpacity onPress={onClose} style={mapStyles.cancelBtn}>
            <Text style={mapStyles.cancelBtnText}>Cancelar</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => onConfirm(currentRegion)} style={mapStyles.confirmBtn}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={mapStyles.confirmBtnText}>Confirmar este Local</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const mapStyles = StyleSheet.create({
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', paddingTop: 56,
    paddingBottom: 14, paddingHorizontal: 16, backgroundColor: '#fff',
    borderBottomWidth: 1, borderBottomColor: '#F0F0F0',
  },
  modalCloseBtn: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F3F4F6', borderRadius: 20 },
  modalTitle: { fontSize: 16, fontWeight: '700', color: '#111827' },
  modalSubtitle: { fontSize: 12, color: '#6B7280', marginTop: 2 },
  pinContainer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center' },
  addressPreviewContainer: {
    position: 'absolute', bottom: 100, left: 16, right: 16,
    backgroundColor: 'rgba(0,0,0,0.85)', paddingHorizontal: 16, paddingVertical: 12,
    borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 10, zIndex: 10,
  },
  addressPreviewText: { color: '#FFF', fontSize: 13, flex: 1, fontWeight: '500' },
  modalFooter: { flexDirection: 'row', padding: 16, gap: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  cancelBtn: { flex: 1, paddingVertical: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E5E7EB', alignItems: 'center', backgroundColor: '#F9FAFB' },
  cancelBtnText: { fontWeight: '600', color: '#374151', fontSize: 15 },
  confirmBtn: { flex: 2, flexDirection: 'row', paddingVertical: 14, borderRadius: 12, backgroundColor: '#FF6B6B', alignItems: 'center', justifyContent: 'center', gap: 8 },
  confirmBtnText: { fontWeight: '700', color: '#fff', fontSize: 15 },
});

// ─── Tela Principal ──────────────────────────────────────────────────────────
type ServiceType = 'delivery' | 'pickup';

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, cliente, loading: authLoading } = useAuth();
  const { cartItems, getCartTotal, clearCart } = useCart();

  // Redirect se não logado
  useEffect(() => {
    if (!authLoading && !user && !cliente && cartItems.length > 0) {
      router.replace({ pathname: '/auth/login', params: { returnTo: '/checkout' } });
    }
  }, [user, cliente, authLoading, cartItems.length]);

  // ─── Estados originais ──────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);
  const [serviceType, setServiceType] = useState<ServiceType>('delivery');
  const [deliveryAddress, setDeliveryAddress] = useState<Address>({
    street: '', number: '', neighborhood: '', complement: '', city: 'Santa Rita do Sapucaí', reference: '',
  });
  const [deliveryCoords, setDeliveryCoords] = useState<Coordinates | null>(null);
  const [commerceCoords, setCommerceCoords] = useState<Coordinates | null>(null);
  const [addressConfirmed, setAddressConfirmed] = useState(false);
  const [showMapModal, setShowMapModal] = useState(false);
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: -22.2514, longitude: -45.7037, latitudeDelta: 0.008, longitudeDelta: 0.008,
  });
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPayment, setSelectedPayment] = useState<string>('');
  const [savedCards, setSavedCards] = useState<SavedCard[]>([]);
  const [selectedCard, setSelectedCard] = useState<string>('');
  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);
  const [distance, setDistance] = useState<number>(0);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showPaymentProcessing, setShowPaymentProcessing] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'approved' | 'rejected'>('idle');
  const [paymentAnimation] = useState(new Animated.Value(0));

  // 🎟️ CUPOM — estados
  const [couponCode, setCouponCode] = useState('');
  const [couponResult, setCouponResult] = useState<CouponValidationResult | null>(null);
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');

  const cartTotal = getCartTotal();
  const commerceId = cartItems[0]?.commerce_id;
  const isOnlinePayment = selectedPayment?.includes('_online');
  const isPixPayment = selectedPayment === 'pix';

  // 🎟️ CUPOM — calcular desconto
  const couponDiscount = couponResult?.valid
    ? (couponResult.free_delivery
      ? deliveryFee
      : (couponResult.discount_applied ?? 0))
    : 0;

  const deliveryFeeAfterCoupon = couponResult?.valid && couponResult.free_delivery
    ? 0
    : (serviceType === 'delivery' ? deliveryFee : 0);

  const finalTotal = Math.max(0,
    cartTotal + (serviceType === 'delivery' ? deliveryFee : 0) - couponDiscount
  );

  // ─── useEffects ─────────────────────────────────────────────
  useEffect(() => {
    requestLocationPermission();
    fetchSystemConfig();
    fetchCommerceCoords();
    fetchSavedAddress();
    loadSavedCards();
  }, []);

  useEffect(() => {
    if (commerceId) fetchPaymentMethodsByCommerce();
  }, [commerceId]);

  useEffect(() => {
    if (deliveryCoords && commerceCoords && systemConfig && serviceType === 'delivery') {
      recalculateFee();
    } else if (serviceType === 'pickup') {
      setDeliveryFee(0); setDistance(0);
    }
  }, [deliveryCoords, commerceCoords, systemConfig, serviceType]);

  // 🎟️ CUPOM — revalidar quando a taxa de entrega muda (frete grátis)
  useEffect(() => {
    if (couponResult?.valid && couponCode) {
      handleValidateCoupon();
    }
  }, [deliveryFee]);

  // ─── Funções originais (inalteradas) ────────────────────────
  const requestLocationPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') {
        setHasLocationPermission(true);
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setMapRegion({ latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 });
      }
    } catch (err) { console.log('Permissão de localização:', err); }
  };

  const fetchCommerceCoords = async () => {
    if (!commerceId) return;
    try {
      const { data } = await supabase.from('commerces').select('latitude, longitude, address').eq('id', commerceId).single();
      if (data?.latitude && data?.longitude) setCommerceCoords({ latitude: data.latitude, longitude: data.longitude });
    } catch (err) { console.log('Coords do comércio:', err); }
  };

  const fetchSavedAddress = async () => {
    if (!user) return;
    try {
      const { data: clienteData, error } = await supabase.from('clientes').select('address,last_delivery_lat,last_delivery_lng,last_delivery_street,last_delivery_number,last_delivery_neighborhood,last_delivery_city').eq('user_id', user.id).single();
      if (error) throw error;
      if (clienteData?.last_delivery_lat && clienteData?.last_delivery_lng) {
        setDeliveryCoords({ latitude: clienteData.last_delivery_lat, longitude: clienteData.last_delivery_lng });
        setDeliveryAddress({ street: clienteData.last_delivery_street || '', number: clienteData.last_delivery_number || '', neighborhood: clienteData.last_delivery_neighborhood || '', city: clienteData.last_delivery_city || 'Santa Rita do Sapucaí' });
        setAddressConfirmed(true); return;
      }
      if (clienteData?.address?.trim()) {
        const parts = clienteData.address.split(',');
        setDeliveryAddress({ street: parts[0]?.trim() || '', number: parts[1]?.split('-')[0]?.trim() || '', neighborhood: parts[1]?.split('-')[1]?.trim() || '', city: 'Santa Rita do Sapucaí' });
        setAddressConfirmed(true);
      }
    } catch (err) { console.log('Erro ao buscar endereço salvo:', err); }
  };

  const getAddressFromCoords = async (latitude: number, longitude: number): Promise<Address | null> => {
    try {
      const addresses = await Location.reverseGeocodeAsync({ latitude, longitude });
      if (addresses?.[0]) {
        const addr = addresses[0];
        return { street: addr.street || addr.name || 'Rua não identificada', number: addr.streetNumber || 's/n', neighborhood: addr.district || addr.subregion || 'Centro', city: addr.city || addr.region || 'Santa Rita do Sapucaí', coords: { latitude, longitude } };
      }
    } catch { }
    return null;
  };

  const saveAddressToClientProfile = async (address: Address, coords: Coordinates) => {
    if (!user) return false;
    try {
      const { error } = await supabase.from('clientes').update({ last_delivery_lat: coords.latitude, last_delivery_lng: coords.longitude, last_delivery_street: address.street, last_delivery_number: address.number, last_delivery_neighborhood: address.neighborhood, last_delivery_city: address.city, address: `${address.street}, ${address.number} - ${address.neighborhood}, ${address.city}` }).eq('user_id', user.id);
      if (error) { console.error('Erro ao salvar endereço:', error); return false; }
      return true;
    } catch { return false; }
  };

  const handleMapConfirm = async (region: Region) => {
    setShowMapModal(false); setIsCalculating(true);
    try {
      const address = await getAddressFromCoords(region.latitude, region.longitude);
      if (!address) { Alert.alert('Erro', 'Não foi possível identificar o endereço. Tente novamente.'); return; }
      setDeliveryAddress(address);
      setDeliveryCoords({ latitude: region.latitude, longitude: region.longitude });
      setAddressConfirmed(true);
      await saveAddressToClientProfile(address, { latitude: region.latitude, longitude: region.longitude });
    } catch { Alert.alert('Erro', 'Ocorreu um erro ao salvar o endereço.'); }
    finally { setIsCalculating(false); }
  };

  const openMapForDelivery = () => {
    if (deliveryCoords) {
      setMapRegion({ latitude: deliveryCoords.latitude, longitude: deliveryCoords.longitude, latitudeDelta: 0.006, longitudeDelta: 0.006 });
    } else if (hasLocationPermission) {
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(loc => {
        setMapRegion({ latitude: loc.coords.latitude, longitude: loc.coords.longitude, latitudeDelta: 0.008, longitudeDelta: 0.008 });
      }).catch(console.error);
    }
    setShowMapModal(true);
  };

  const fetchPaymentMethodsByCommerce = async () => {
    if (!commerceId) return;
    try {
      const { data, error } = await supabase.from('commerce_payment_config').select('is_active,requires_card_machine,payment_method_code,payment_methods!inner(id,name,code,icon_name)').eq('commerce_id', commerceId).eq('is_active', true);
      if (error) throw error;
      if (data?.length) {
        const activeMethods: PaymentMethod[] = data.map(item => ({ id: item.payment_methods.id, name: item.payment_methods.name, code: item.payment_methods.code, icon: item.payment_methods.icon_name || getPaymentIcon(item.payment_methods.code), is_online: item.payment_methods.code?.includes('_online'), requires_card_machine: item.requires_card_machine }));
        setPaymentMethods(activeMethods);
        if (activeMethods.length && !selectedPayment) setSelectedPayment(activeMethods[0].code);
      } else {
        setPaymentMethods([{ id: '1', name: 'Pix', code: 'pix', icon: 'qr-code-outline' }, { id: '2', name: 'Dinheiro', code: 'dinheiro', icon: 'cash-outline' }]);
        if (!selectedPayment) setSelectedPayment('pix');
      }
    } catch {
      setPaymentMethods([{ id: '1', name: 'Pix', code: 'pix', icon: 'qr-code-outline' }, { id: '2', name: 'Dinheiro', code: 'dinheiro', icon: 'cash-outline' }]);
      if (!selectedPayment) setSelectedPayment('pix');
    }
  };

  const loadSavedCards = async () => {
    if (!user?.id) return;
    try {
      const cards = await paymentService.getUserCards(user.id);
      setSavedCards(cards.map(c => ({ id: c.id, card_name: c.card_name, last_digits: c.last_digits, brand: c.brand, masked_number: c.masked_number, card_type: c.card_type, is_default: c.is_default, payment_token: c.payment_token })));
      const defaultCard = cards.find(c => c.is_default);
      if (defaultCard) setSelectedCard(defaultCard.id);
    } catch { }
  };

  const fetchSystemConfig = async () => {
    try {
      const { data, error } = await supabase.from('system_config').select('*').single();
      if (error) throw error;
      setSystemConfig(data);
    } catch {
      setSystemConfig({ base_price: 5.0, price_per_km: 2.5, platform_fee: 1.0, pricing_type: 'per_km', rain_surcharge_percent: 0, holiday_surcharge_percent: 0, sunday_surcharge_percent: 0, is_raining: false, is_holiday: false });
    }
  };

  const recalculateFee = () => {
    if (!deliveryCoords || !commerceCoords || !systemConfig) return;
    setIsCalculating(true);
    try {
      const dist = calculateDistance(commerceCoords.latitude, commerceCoords.longitude, deliveryCoords.latitude, deliveryCoords.longitude);
      setDistance(dist);
      let fee = systemConfig.pricing_type === 'per_km'
        ? Math.max(systemConfig.base_price, dist * systemConfig.price_per_km)
        : systemConfig.base_price;
      const isSunday = new Date().getDay() === 0;
      let multiplier = 1;
      if (systemConfig.is_raining) multiplier *= 1 + systemConfig.rain_surcharge_percent / 100;
      if (systemConfig.is_holiday) multiplier *= 1 + systemConfig.holiday_surcharge_percent / 100;
      if (isSunday) multiplier *= 1 + systemConfig.sunday_surcharge_percent / 100;
      setDeliveryFee(fee * multiplier);
    } finally { setIsCalculating(false); }
  };

  // 🎟️ CUPOM — validar cupom
  const handleValidateCoupon = async () => {
    if (!couponCode.trim()) return;
    if (!cliente) { Alert.alert('Erro', 'Faça login para usar cupons.'); return; }
    if (!commerceId) { Alert.alert('Erro', 'Nenhum comércio selecionado.'); return; }

    setIsValidatingCoupon(true);
    setCouponError('');

    const orderTotalForValidation = cartTotal + (serviceType === 'delivery' ? deliveryFee : 0);

    const result = await couponService.validateCoupon(
      couponCode,
      cliente.id,
      commerceId,
      orderTotalForValidation,
    );

    setIsValidatingCoupon(false);

    if (result.valid) {
      setCouponResult(result);
      setCouponError('');
    } else {
      setCouponResult(null);
      setCouponError(result.error || 'Cupom inválido.');
    }
  };

  // 🎟️ CUPOM — remover cupom
  const handleRemoveCoupon = () => {
    setCouponResult(null);
    setCouponCode('');
    setCouponError('');
  };

  // ─── Criar pedido (atualizado para salvar cupom) ────────────
  const buildOrderPayload = (formattedAddress: string, productItems: any[], commerce: any) => ({
    customer_id: cliente!.id,
    commerce_id: commerceId,
    pickup_address: commerce?.address || 'Estabelecimento',
    delivery_address: formattedAddress,
    product_items: productItems,
    total_amount: finalTotal,
    price: finalTotal,
    platform_fee: systemConfig?.platform_fee ?? 1.0,
    distance_km: distance,
    payment_method: selectedPayment,
    payment_status: 'pending',
    status: 'criado',
    service_type: serviceType,
    // 🎟️ CUPOM
    ...(couponResult?.valid && {
      coupon_id: couponResult.coupon_id,
      coupon_code: couponResult.code,
      discount_applied: couponDiscount,
    }),
    ...(deliveryCoords && {
      delivery_lat: deliveryCoords.latitude,
      delivery_lng: deliveryCoords.longitude,
    }),
  });

  // 🎟️ CUPOM — aplicar uso após criar pedido
  const applyOrderCoupon = async (orderId: string) => {
    if (!couponResult?.valid || !couponResult.coupon_id || !cliente) return;
    const orderTotalBefore = cartTotal + (serviceType === 'delivery' ? deliveryFee : 0);
    await couponService.applyCouponUsage(
      couponResult.coupon_id,
      cliente.id,
      orderId,
      couponDiscount,
      orderTotalBefore,
      finalTotal,
    );
  };

  const handleConfirmOrder = async () => {
    if (!user || !cliente) {
      Alert.alert('Login Necessário', 'Por favor, faça login para finalizar a compra.');
      router.push({ pathname: '/auth/login', params: { returnTo: '/checkout' } });
      return;
    }
    if (serviceType === 'delivery' && (!addressConfirmed || !deliveryAddress.street)) {
      Alert.alert('Endereço incompleto', 'Confirme o endereço de entrega no mapa.'); return;
    }
    if (!selectedPayment) { Alert.alert('Pagamento', 'Selecione uma forma de pagamento.'); return; }
    if (isOnlinePayment && !selectedCard) { Alert.alert('Cartão', 'Selecione um cartão para pagamento online.'); return; }
    if (cartItems.length === 0) { Alert.alert('Carrinho vazio', 'Adicione itens antes de finalizar.'); return; }

    if (isPixPayment || isOnlinePayment) await processMercadoPagoPayment();
    else await createOrderDirect();
  };

  const processMercadoPagoPayment = async () => {
    if (!user || !cliente) { Alert.alert('Erro', 'Usuário não autenticado'); return; }
    if (!isPixPayment) { setShowPaymentProcessing(true); setPaymentStatus('processing'); startPaymentAnimation(); }

    try {
      let cardToken, cardBrand;
      if (isOnlinePayment && selectedCard) {
        const card = savedCards.find(c => c.id === selectedCard);
        cardToken = card?.payment_token;
        cardBrand = card?.brand;
        if (!cardToken) throw new Error('Token do cartão não encontrado. Recadastre o cartão.');
      }

      const token = (await supabase.auth.getSession()).data.session?.access_token;
      if (!token) throw new Error('Sessão expirada');

      const roundedAmount = Math.round(finalTotal * 100) / 100;
      const paymentRequest = { amount: roundedAmount, paymentMethod: isPixPayment ? 'pix' as const : 'credit_card' as const, cardToken, cardBrand, installments: 1, payerEmail: user.email || '', payerName: cliente.name || '', payerCpf: cliente.cpf || '' };

      const result = await paymentService.processPayment(paymentRequest, token);

      if (!result.success) {
        if (isPixPayment) { Alert.alert('Erro', result.error || 'Erro ao gerar pagamento PIX'); return; }
        else { setPaymentStatus('rejected'); setTimeout(() => { setShowPaymentProcessing(false); Alert.alert('Pagamento Recusado', result.error); }, 2000); }
        return;
      }

      const formattedAddress = serviceType === 'delivery'
        ? `${deliveryAddress.street}, ${deliveryAddress.number} - ${deliveryAddress.neighborhood}`
        : 'Retirada no local';

      const productItems = cartItems.map(item => ({ product_id: item.product_id, name: item.name, quantity: item.quantity, price: item.price, total: item.total_price, image_url: item.image_url }));
      const { data: commerce } = await supabase.from('commerces').select('address').eq('id', commerceId).single();

      let paymentDetails: any = { method: selectedPayment, mp_payment_id: result.payment_id, status: result.status };
      if (isPixPayment && 'pix' in result) { paymentDetails.pix_qr_code = result.pix?.qr_code; paymentDetails.pix_ticket_url = result.pix?.ticket_url; }
      if (isOnlinePayment && 'card' in result) { paymentDetails.card_last_digits = result.card?.last_four_digits; paymentDetails.card_brand = result.card?.brand; }

      const { data: order, error: orderError } = await supabase.from('pedidos')
        .insert({
          ...buildOrderPayload(formattedAddress, productItems, commerce),
          payment_details: paymentDetails,
          payment_status: result.status === 'approved' ? 'approved' : 'pending',
          status: result.status === 'approved' ? 'confirmado' : 'criado',
        })
        .select().single();

      if (orderError) throw new Error('Erro ao criar pedido');

      // 🎟️ CUPOM — registrar uso
      await applyOrderCoupon(order.id);

      if (isPixPayment && 'pix' in result) {
        router.push({ pathname: '/payment/pix-status', params: { pixData: JSON.stringify(result.pix), paymentId: result.payment_id, orderId: order.id, amount: formatPrice(finalTotal) } });
      } else if (!isPixPayment) {
        setPaymentStatus('approved');
        setTimeout(async () => { setShowPaymentProcessing(false); await clearCart(); router.replace(`/order/${order.id}`); }, 2000);
      }
    } catch (error: any) {
      if (isPixPayment) Alert.alert('Erro', error.message || 'Erro ao gerar pagamento PIX');
      else { setPaymentStatus('rejected'); setTimeout(() => { setShowPaymentProcessing(false); Alert.alert('Erro', error.message || 'Erro ao processar pagamento'); }, 2000); }
    }
  };

  const createOrderDirect = async () => {
    setLoading(true);
    try {
      if (!cliente) throw new Error('Cliente não encontrado');
      const formattedAddress = serviceType === 'delivery'
        ? `${deliveryAddress.street}, ${deliveryAddress.number} - ${deliveryAddress.neighborhood}`
        : 'Retirada no local';
      const productItems = cartItems.map(item => ({ product_id: item.product_id, name: item.name, quantity: item.quantity, price: item.price, total: item.total_price, image_url: item.image_url }));
      const { data: commerce } = await supabase.from('commerces').select('address').eq('id', commerceId).single();

      const { data: order, error: orderError } = await supabase.from('pedidos')
        .insert({ ...buildOrderPayload(formattedAddress, productItems, commerce), payment_details: { method: selectedPayment } })
        .select().single();

      if (orderError) throw orderError;

      // 🎟️ CUPOM — registrar uso
      await applyOrderCoupon(order.id);

      await clearCart();
      Alert.alert('✅ Pedido Confirmado!', `Pedido #${order.id.slice(-8)}\nTotal: ${formatPrice(finalTotal)}${couponDiscount > 0 ? `\nDesconto: -${formatPrice(couponDiscount)}` : ''}`, [{ text: 'Acompanhar', onPress: () => router.replace(`/order/${order.id}`) }]);
    } catch (err: any) {
      Alert.alert('Erro', 'Não foi possível finalizar o pedido.');
    } finally { setLoading(false); }
  };

  const startPaymentAnimation = () => {
    Animated.loop(Animated.sequence([
      Animated.timing(paymentAnimation, { toValue: 1, duration: 1000, useNativeDriver: true }),
      Animated.timing(paymentAnimation, { toValue: 0, duration: 1000, useNativeDriver: true }),
    ])).start();
  };

  const canConfirm =
    (serviceType === 'delivery' ? addressConfirmed && !!deliveryAddress.street : true) &&
    !!selectedPayment && (isOnlinePayment ? !!selectedCard : true) && cartItems.length > 0;

  if (authLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle="light-content" backgroundColor="#FF6B6B" />
      <SafeAreaView style={styles.safeContainer}>
        <KeyboardAvoidingView 
          style={styles.container} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <LinearGradient colors={['#FF6B6B', '#FF8E53']} style={styles.header}>
            <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
              <Ionicons name="arrow-back" size={24} color="#FFF" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Finalizar Pedido</Text>
            <View style={{ width: 40 }} />
          </LinearGradient>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            {/* Tipo de Serviço */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🏍️ Como deseja receber?</Text>
              <View style={styles.serviceTypeRow}>
                <TouchableOpacity style={[styles.serviceCard, serviceType === 'delivery' && styles.serviceCardSelected]} onPress={() => setServiceType('delivery')}>
                  <Ionicons name="bicycle-outline" size={28} color={serviceType === 'delivery' ? '#FFF' : '#FF6B6B'} />
                  <Text style={[styles.serviceLabel, serviceType === 'delivery' && styles.serviceLabelSelected]}>Entrega</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.serviceCard, serviceType === 'pickup' && styles.serviceCardSelected]} onPress={() => setServiceType('pickup')}>
                  <Ionicons name="storefront-outline" size={28} color={serviceType === 'pickup' ? '#FFF' : '#FF6B6B'} />
                  <Text style={[styles.serviceLabel, serviceType === 'pickup' && styles.serviceLabelSelected]}>Retirada</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Endereço */}
            {serviceType === 'delivery' && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>📍 Endereço de Entrega</Text>
                {!addressConfirmed ? (
                  <TouchableOpacity style={styles.mapPickerButton} onPress={openMapForDelivery}>
                    <Ionicons name="map-outline" size={28} color="#FF6B6B" />
                    <View style={{ flex: 1, marginLeft: 12 }}>
                      <Text style={styles.mapPickerTitle}>Selecionar no mapa</Text>
                      <Text style={styles.mapPickerSubtitle}>Toque para marcar seu endereço</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#CCC" />
                  </TouchableOpacity>
                ) : (
                  <View style={styles.confirmedAddressCard}>
                    <View style={styles.confirmedAddressHeader}>
                      <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
                      <Text style={styles.confirmedBadgeText}>Local confirmado</Text>
                      <TouchableOpacity onPress={openMapForDelivery}>
                        <Text style={styles.changeText}>Alterar</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.confirmedStreet}>{deliveryAddress.street}, {deliveryAddress.number}</Text>
                    <Text style={styles.confirmedNeighborhood}>{deliveryAddress.neighborhood} - {deliveryAddress.city}</Text>
                    {deliveryCoords && (
                      <View style={styles.miniMapContainer}>
                        <MapView provider={PROVIDER_GOOGLE} style={styles.miniMap} region={{ latitude: deliveryCoords.latitude, longitude: deliveryCoords.longitude, latitudeDelta: 0.003, longitudeDelta: 0.003 }} scrollEnabled={false} zoomEnabled={false}>
                          <Marker coordinate={deliveryCoords}><Ionicons name="location" size={30} color="#FF6B6B" /></Marker>
                        </MapView>
                      </View>
                    )}
                    {distance > 0 && (
                      <View style={styles.distanceBadge}>
                        {isCalculating ? <ActivityIndicator size="small" color="#FF6B6B" /> : (
                          <>
                            <Ionicons name="navigate-outline" size={14} color="#FF6B6B" />
                            <Text style={styles.distanceText}>{distance.toFixed(1)} km · Taxa: {formatPrice(deliveryFee)}</Text>
                          </>
                        )}
                      </View>
                    )}
                  </View>
                )}
              </View>
            )}

            {/* 🎟️ CUPOM — Seção de cupom */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🎟️ Cupom de Desconto</Text>

              {couponResult?.valid ? (
                <View style={styles.couponAppliedCard}>
                  <View style={styles.couponAppliedTop}>
                    <View style={styles.couponAppliedIcon}>
                      <Ionicons name="ticket-outline" size={22} color="#059669" />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.couponAppliedCode}>{couponResult.code}</Text>
                      <Text style={styles.couponAppliedDescription}>{couponResult.description || 'Cupom aplicado com sucesso!'}</Text>
                    </View>
                    <TouchableOpacity onPress={handleRemoveCoupon} style={styles.couponRemoveBtn}>
                      <Ionicons name="close-circle" size={22} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.couponSavingsBadge}>
                    <Ionicons name="checkmark-circle" size={14} color="#059669" />
                    <Text style={styles.couponSavingsText}>
                      {couponResult.free_delivery
                        ? `Frete grátis! Economia de ${formatPrice(deliveryFee)}`
                        : `Você economizou ${formatPrice(couponDiscount)}!`}
                    </Text>
                  </View>
                </View>
              ) : (
                <View>
                  <View style={styles.couponInputRow}>
                    <View style={[styles.couponInputWrapper, couponError ? styles.couponInputError : null]}>
                      <Ionicons name="ticket-outline" size={18} color={couponError ? '#EF4444' : '#9CA3AF'} style={{ marginLeft: 12 }} />
                      <TextInput
                        style={styles.couponInput}
                        placeholder="CÓDIGO DO CUPOM"
                        placeholderTextColor="#9CA3AF"
                        value={couponCode}
                        onChangeText={text => { setCouponCode(text.toUpperCase()); setCouponError(''); }}
                        autoCapitalize="characters"
                        returnKeyType="done"
                        onSubmitEditing={handleValidateCoupon}
                      />
                      {couponCode.length > 0 && (
                        <TouchableOpacity onPress={() => { setCouponCode(''); setCouponError(''); }}>
                          <Ionicons name="close-circle" size={18} color="#9CA3AF" style={{ marginRight: 8 }} />
                        </TouchableOpacity>
                      )}
                    </View>
                    <TouchableOpacity
                      style={[styles.couponApplyBtn, (!couponCode.trim() || isValidatingCoupon) && styles.couponApplyBtnDisabled]}
                      onPress={handleValidateCoupon}
                      disabled={!couponCode.trim() || isValidatingCoupon}
                    >
                      {isValidatingCoupon
                        ? <ActivityIndicator size="small" color="#FFF" />
                        : <Text style={styles.couponApplyBtnText}>Aplicar</Text>}
                    </TouchableOpacity>
                  </View>
                  {couponError ? (
                    <View style={styles.couponErrorRow}>
                      <Ionicons name="alert-circle-outline" size={14} color="#EF4444" />
                      <Text style={styles.couponErrorText}>{couponError}</Text>
                    </View>
                  ) : null}
                </View>
              )}
            </View>

            {/* Resumo do Pedido */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🛒 Itens do Pedido</Text>
              {cartItems.map(item => (
                <View key={item.id} style={styles.cartItem}>
                  <Text style={styles.cartItemName}>{item.name} x{item.quantity}</Text>
                  <Text style={styles.cartItemPrice}>{formatPrice(item.total_price)}</Text>
                </View>
              ))}
              <View style={styles.divider} />
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Subtotal</Text>
                <Text style={styles.summaryValue}>{formatPrice(cartTotal)}</Text>
              </View>
              {serviceType === 'delivery' && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Taxa de entrega</Text>
                  {couponResult?.valid && couponResult.free_delivery ? (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={[styles.summaryValue, styles.strikeThrough]}>{formatPrice(deliveryFee)}</Text>
                      <Text style={styles.freeDeliveryTag}>GRÁTIS</Text>
                    </View>
                  ) : (
                    <Text style={styles.summaryValue}>{distance > 0 ? formatPrice(deliveryFee) : 'Calculando...'}</Text>
                  )}
                </View>
              )}
              {couponResult?.valid && !couponResult.free_delivery && couponDiscount > 0 && (
                <View style={styles.summaryRow}>
                  <Text style={[styles.summaryLabel, styles.discountLabel]}>
                    🎟️ Desconto ({couponResult.code})
                  </Text>
                  <Text style={styles.discountValue}>-{formatPrice(couponDiscount)}</Text>
                </View>
              )}
              <View style={[styles.summaryRow, styles.totalRow]}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>{formatPrice(finalTotal)}</Text>
              </View>
            </View>

            {/* Forma de Pagamento */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>💳 Forma de Pagamento</Text>
              {paymentMethods.length === 0 ? (
                <ActivityIndicator size="small" color="#FF6B6B" style={{ marginVertical: 20 }} />
              ) : (
                <View style={styles.paymentGrid}>
                  {paymentMethods.map(method => (
                    <TouchableOpacity key={method.id} style={[styles.paymentCard, selectedPayment === method.code && styles.paymentCardSelected]} onPress={() => { setSelectedPayment(method.code); setSelectedCard(''); }}>
                      <Ionicons name={getPaymentIcon(method.code)} size={20} color={selectedPayment === method.code ? '#FFF' : '#666'} />
                      <Text style={[styles.paymentText, selectedPayment === method.code && styles.paymentTextSelected]}>{method.name}</Text>
                      {method.is_online && <View style={styles.onlineBadge}><Text style={styles.onlineBadgeText}>Online</Text></View>}
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {isOnlinePayment && (
                <View style={styles.cardSection}>
                  <Text style={styles.cardSectionTitle}>Selecionar Cartão Salvo</Text>
                  {savedCards.length === 0 ? (
                    <View style={styles.noCardsContainer}>
                      <Ionicons name="card-outline" size={24} color="#999" />
                      <Text style={styles.noCardsText}>Nenhum cartão cadastrado</Text>
                      <TouchableOpacity onPress={() => router.push('/payments')}><Text style={styles.addCardLink}>Cadastrar cartão</Text></TouchableOpacity>
                    </View>
                  ) : savedCards.map(card => (
                    <TouchableOpacity key={card.id} style={[styles.cardOption, selectedCard === card.id && styles.cardOptionSelected]} onPress={() => setSelectedCard(card.id)}>
                      <View style={[styles.cardBrandIndicator, { backgroundColor: getCardBrandColor(card.brand) }]}><Ionicons name="card-outline" size={16} color="#FFF" /></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.cardOptionName}>{card.card_name}</Text>
                        <Text style={styles.cardOptionNumber}>{card.masked_number || `**** ${card.last_digits}`}</Text>
                      </View>
                      <Text style={styles.cardType}>{card.card_type === 'credit' ? 'Crédito' : 'Débito'}</Text>
                      <Ionicons name={selectedCard === card.id ? 'radio-button-on' : 'radio-button-off'} size={22} color={selectedCard === card.id ? '#FF6B6B' : '#CCC'} />
                    </TouchableOpacity>
                  ))}
                </View>
              )}
              {isPixPayment && (
                <View style={styles.pixInfo}>
                  <Ionicons name="qr-code-outline" size={20} color="#059669" />
                  <Text style={styles.pixInfoText}>Você será redirecionado para a página de pagamento PIX</Text>
                </View>
              )}
            </View>

            {/* Botão Finalizar */}
            <TouchableOpacity style={[styles.finishButton, !canConfirm && styles.disabledButton]} onPress={handleConfirmOrder} disabled={loading || !canConfirm}>
              {loading ? <ActivityIndicator size="small" color="#FFF" /> : (
                <>
                  <Ionicons name="checkmark-circle-outline" size={22} color="#FFF" />
                  <Text style={styles.finishButtonText}>Confirmar Pedido</Text>
                  <Text style={styles.finishButtonPrice}>{formatPrice(finalTotal)}</Text>
                </>
              )}
            </TouchableOpacity>
            <View style={{ height: 40 }} />
          </ScrollView>

          {/* Modal Mapa */}
          <MapPickerModal visible={showMapModal} onClose={() => setShowMapModal(false)} onConfirm={handleMapConfirm} initialRegion={mapRegion} hasPermission={hasLocationPermission} title="Local de Entrega" />

          {/* Modal Processamento */}
          <Modal visible={showPaymentProcessing} transparent animationType="fade">
            <View style={styles.paymentOverlay}>
              <View style={styles.paymentModal}>
                {paymentStatus === 'processing' && (<><ActivityIndicator size="large" color="#FF6B6B" /><Text style={styles.paymentTitle}>Processando Pagamento</Text><Text style={styles.paymentSubtitle}>Aguarde enquanto validamos seu pagamento...</Text></>)}
                {paymentStatus === 'approved' && (<><Ionicons name="checkmark-circle" size={80} color="#22C55E" /><Text style={[styles.paymentTitle, { color: '#22C55E' }]}>Pagamento Aprovado!</Text><Text style={styles.paymentSubtitle}>Seu pedido foi confirmado com sucesso</Text></>)}
                {paymentStatus === 'rejected' && (<><Ionicons name="close-circle" size={80} color="#EF4444" /><Text style={[styles.paymentTitle, { color: '#EF4444' }]}>Pagamento Recusado</Text><Text style={styles.paymentSubtitle}>Não foi possível processar seu pagamento</Text><TouchableOpacity style={styles.tryAgainBtn} onPress={() => setShowPaymentProcessing(false)}><Text style={styles.tryAgainText}>Tentar Novamente</Text></TouchableOpacity></>)}
              </View>
            </View>
          </Modal>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </>
  );
}

const styles = StyleSheet.create({
  safeContainer: { flex: 1, backgroundColor: '#F8F9FA' },
  container: { flex: 1, backgroundColor: '#F8F9FA' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8F9FA' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16 },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFF' },
  content: { flex: 1, padding: 16 },
  section: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: '#333', marginBottom: 14 },
  serviceTypeRow: { flexDirection: 'row', gap: 12 },
  serviceCard: { flex: 1, alignItems: 'center', paddingVertical: 18, borderRadius: 14, borderWidth: 2, borderColor: '#FFD6D6', backgroundColor: '#FFF5F5', gap: 6 },
  serviceCardSelected: { borderColor: '#FF6B6B', backgroundColor: '#FF6B6B' },
  serviceLabel: { fontSize: 14, fontWeight: '700', color: '#FF6B6B' },
  serviceLabelSelected: { color: '#FFF' },
  mapPickerButton: { flexDirection: 'row', alignItems: 'center', padding: 16, borderRadius: 14, borderWidth: 2, borderColor: '#FFD6D6', borderStyle: 'dashed', backgroundColor: '#FFF5F5' },
  mapPickerTitle: { fontSize: 15, fontWeight: '700', color: '#333' },
  mapPickerSubtitle: { fontSize: 12, color: '#999', marginTop: 3 },
  confirmedAddressCard: { borderRadius: 14, borderWidth: 1, borderColor: '#DCF5E8', backgroundColor: '#F0FDF4', padding: 14, gap: 8 },
  confirmedAddressHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  confirmedBadgeText: { fontSize: 13, color: '#22C55E', fontWeight: '600', flex: 1, marginLeft: 6 },
  changeText: { fontSize: 13, color: '#FF6B6B', fontWeight: '600' },
  confirmedStreet: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
  confirmedNeighborhood: { fontSize: 13, color: '#6B7280' },
  miniMapContainer: { borderRadius: 12, overflow: 'hidden', height: 120, marginTop: 6 },
  miniMap: { flex: 1 },
  distanceBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#FFF5F5', borderRadius: 10, borderWidth: 1, borderColor: '#FFD6D6' },
  distanceText: { fontSize: 13, color: '#FF6B6B', fontWeight: '500' },
  couponInputRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  couponInputWrapper: { flex: 1, flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E5E7EB', borderRadius: 12, backgroundColor: '#F9FAFB', height: 48 },
  couponInputError: { borderColor: '#FCA5A5', backgroundColor: '#FFF5F5' },
  couponInput: { flex: 1, paddingHorizontal: 10, fontSize: 14, fontWeight: '700', color: '#1F2937', letterSpacing: 1 },
  couponApplyBtn: { backgroundColor: '#FF6B6B', borderRadius: 12, height: 48, paddingHorizontal: 18, justifyContent: 'center', alignItems: 'center' },
  couponApplyBtnDisabled: { backgroundColor: '#D1D5DB' },
  couponApplyBtnText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  couponErrorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  couponErrorText: { fontSize: 13, color: '#EF4444', flex: 1 },
  couponAppliedCard: { borderRadius: 12, borderWidth: 1.5, borderColor: '#6EE7B7', backgroundColor: '#ECFDF5', padding: 14, gap: 10 },
  couponAppliedTop: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  couponAppliedIcon: { width: 40, height: 40, backgroundColor: '#D1FAE5', borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  couponAppliedCode: { fontSize: 15, fontWeight: '800', color: '#065F46', letterSpacing: 1 },
  couponAppliedDescription: { fontSize: 12, color: '#059669', marginTop: 2 },
  couponRemoveBtn: { padding: 4 },
  couponSavingsBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#D1FAE5', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6 },
  couponSavingsText: { fontSize: 13, color: '#059669', fontWeight: '600' },
  cartItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  cartItemName: { fontSize: 14, color: '#333', flex: 1 },
  cartItemPrice: { fontSize: 14, fontWeight: '600', color: '#22C55E' },
  divider: { height: 1, backgroundColor: '#F0F0F0', marginVertical: 12 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  summaryLabel: { fontSize: 14, color: '#666' },
  summaryValue: { fontSize: 14, fontWeight: '500', color: '#333' },
  totalRow: { marginTop: 8, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  totalLabel: { fontSize: 16, fontWeight: '700', color: '#333' },
  totalValue: { fontSize: 18, fontWeight: '700', color: '#FF6B6B' },
  strikeThrough: { textDecorationLine: 'line-through', color: '#9CA3AF' },
  freeDeliveryTag: { fontSize: 11, fontWeight: '800', color: '#059669', backgroundColor: '#D1FAE5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  discountLabel: { color: '#059669', fontWeight: '600' },
  discountValue: { fontSize: 14, fontWeight: '700', color: '#059669' },
  paymentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  paymentCard: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 13, borderRadius: 12, borderWidth: 1.5, borderColor: '#E5E7EB', backgroundColor: '#F9FAFB', minWidth: '45%', flex: 1 },
  paymentCardSelected: { backgroundColor: '#FF6B6B', borderColor: '#FF6B6B' },
  paymentText: { fontSize: 13, color: '#666', fontWeight: '600', flex: 1 },
  paymentTextSelected: { color: '#FFF' },
  onlineBadge: { backgroundColor: '#10B981', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  onlineBadgeText: { fontSize: 9, color: '#FFF', fontWeight: '700' },
  cardSection: { marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#F0F0F0' },
  cardSectionTitle: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 12 },
  noCardsContainer: { alignItems: 'center', paddingVertical: 20, gap: 8 },
  noCardsText: { fontSize: 14, color: '#999' },
  addCardLink: { fontSize: 14, color: '#FF6B6B', fontWeight: '600' },
  cardOption: { flexDirection: 'row', alignItems: 'center', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', marginBottom: 8, gap: 10, backgroundColor: '#F9FAFB' },
  cardOptionSelected: { borderColor: '#FF6B6B', backgroundColor: '#FFF5F5' },
  cardBrandIndicator: { width: 32, height: 32, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  cardOptionName: { fontSize: 14, fontWeight: '500', color: '#333' },
  cardOptionNumber: { fontSize: 12, color: '#888' },
  cardType: { fontSize: 11, color: '#666', fontWeight: '500' },
  pixInfo: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, padding: 12, backgroundColor: '#ECFDF5', borderRadius: 10 },
  pixInfoText: { fontSize: 12, color: '#059669', flex: 1 },
  finishButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FF6B6B', paddingHorizontal: 20, paddingVertical: 17, borderRadius: 14, marginBottom: 8, gap: 10, shadowColor: '#FF6B6B', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6 },
  disabledButton: { backgroundColor: '#D1D5DB', shadowOpacity: 0 },
  finishButtonText: { flex: 1, fontSize: 16, fontWeight: '700', color: '#FFF', marginLeft: 6 },
  finishButtonPrice: { fontSize: 17, fontWeight: '700', color: '#FFF' },
  paymentOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' },
  paymentModal: { backgroundColor: '#FFF', borderRadius: 24, padding: 40, alignItems: 'center', width: '85%' },
  paymentTitle: { fontSize: 20, fontWeight: '700', color: '#333', marginTop: 20, textAlign: 'center' },
  paymentSubtitle: { fontSize: 14, color: '#666', marginTop: 8, textAlign: 'center' },
  tryAgainBtn: { marginTop: 24, paddingHorizontal: 32, paddingVertical: 12, backgroundColor: '#FF6B6B', borderRadius: 12 },
  tryAgainText: { color: '#FFF', fontWeight: '600', fontSize: 16 },
});