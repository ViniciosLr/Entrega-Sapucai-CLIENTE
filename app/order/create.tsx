import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Modal,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import MapView, { PROVIDER_GOOGLE, Region } from 'react-native-maps';
import * as Location from 'expo-location';

import {
  Package,
  MapPin,
  DollarSign,
  ArrowLeft,
  Pizza,
  Utensils,
  FileText,
  ShoppingCart,
  Coffee,
  MoreHorizontal as MoreHorizontal,
  Smartphone,
  CreditCard,
  AlertTriangle,
  Store,
  Home,
} from 'lucide-react-native';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { reverseGeocode, geocodeAddress } from '@/lib/addressUtils';

// =====================
// Tipos
// =====================
interface Coordinates {
  latitude: number;
  longitude: number;
}

interface MerchandisePrice {
  id: string;
  merchandise_type: string;
  base_multiplier: number;
  additional_fee: number;
  description: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  code: string;
  icon_name: string;
}

interface SystemConfig {
  base_price: number;
  price_per_km: number;
  platform_fee: number;
  pricing_type: 'per_km' | 'fixed';
  rain_surcharge_percent: number;
  holiday_surcharge_percent: number;
  sunday_surcharge_percent: number;
  is_raining: boolean;
  is_holiday: boolean;
}

interface ClientDebt {
  id: string;
  amount: number;
  reason: string;
  is_paid: boolean;
  created_at: string;
}

const MERCHANDISE_TYPES = [
  { id: 'lanche', label: 'Lanche', icon: Coffee },
  { id: 'pizza', label: 'Pizza', icon: Pizza },
  { id: 'marmitex', label: 'Marmitex', icon: Utensils },
  { id: 'documento', label: 'Documento', icon: FileText },
  { id: 'mercado', label: 'Mercado', icon: ShoppingCart },
  { id: 'outro', label: 'Outro', icon: MoreHorizontal },
];

const DOCUMENT_RETURN_FEE = 6; // ✅ NOVO: taxa extra quando "devolução" estiver ativa

const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const MapPickerModal = ({
  visible,
  onClose,
  onConfirm,
  initialRegion,
  hasPermission,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (region: Region) => void;
  initialRegion: Region;
  hasPermission: boolean;
}) => {
  const [currentRegion, setCurrentRegion] = useState<Region>(initialRegion);

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View style={{ flex: 1, backgroundColor: '#fff' }}>
        <MapView
          provider={PROVIDER_GOOGLE}
          style={{ flex: 1 }}
          initialRegion={initialRegion}
          onRegionChangeComplete={(region) => setCurrentRegion(region)}
          showsUserLocation={hasPermission}
          showsMyLocationButton={hasPermission}
        />

        <View
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            marginLeft: -20,
            marginTop: -40,
            zIndex: 10,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <MapPin size={40} color="#DC2626" fill="#FEF2F2" />
          <View
            style={{
              width: 8,
              height: 8,
              backgroundColor: 'rgba(0,0,0,0.3)',
              borderRadius: 4,
              marginTop: -5,
            }}
          />
        </View>

        <View
          style={{
            position: 'absolute',
            top: 50,
            left: 20,
            right: 20,
            backgroundColor: 'rgba(255,255,255,0.95)',
            padding: 12,
            borderRadius: 8,
            alignItems: 'center',
            elevation: 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.2,
          }}
        >
          <Text style={{ fontWeight: '600', color: '#374151' }}>Mova o mapa para posicionar o local</Text>
        </View>

        <View
          style={{
            position: 'absolute',
            bottom: 40,
            left: 20,
            right: 20,
            flexDirection: 'row',
            gap: 12,
          }}
        >
          <TouchableOpacity
            onPress={onClose}
            style={{
              flex: 1,
              backgroundColor: '#FFF',
              padding: 16,
              borderRadius: 12,
              alignItems: 'center',
              elevation: 4,
              borderWidth: 1,
              borderColor: '#E5E7EB',
            }}
          >
            <Text style={{ fontWeight: 'bold', color: '#374151' }}>Cancelar</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => onConfirm(currentRegion)}
            style={{
              flex: 2,
              backgroundColor: '#2563EB',
              padding: 16,
              borderRadius: 12,
              alignItems: 'center',
              elevation: 4,
            }}
          >
            <Text style={{ fontWeight: 'bold', color: '#FFF' }}>Confirmar Local</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export default function CreateOrderScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [hasLocationPermission, setHasLocationPermission] = useState(false);

  const [selectedType, setSelectedType] = useState('');
  const [deliveryPrice, setDeliveryPrice] = useState(0);
  const [instructions, setInstructions] = useState('');
  const [distance, setDistance] = useState<number>(0);
  const [rawDistanceFee, setRawDistanceFee] = useState<number>(0);
  const [itemAdjustedFee, setItemAdjustedFee] = useState<number>(0);
  const [finalDeliveryFee, setFinalDeliveryFee] = useState<number>(0);

  // ✅ opção extra para Documento
  const [returnToPickupForDocument, setReturnToPickupForDocument] = useState(false);

  // Local do pagamento
  const [paymentLocation, setPaymentLocation] = useState<'pickup' | 'delivery' | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<string>('');

  const [pickupData, setPickupData] = useState({
    rua: '',
    numero: '',
    nome_local: '',
    bairro: '',
  });

  const [deliveryData, setDeliveryData] = useState({
    rua: '',
    numero: '',
    complemento: '',
  });

  const [deliveryBairro, setDeliveryBairro] = useState('');

  const [pickupCoords, setPickupCoords] = useState<Coordinates | null>(null);
  const [deliveryCoords, setDeliveryCoords] = useState<Coordinates | null>(null);

  const [systemConfig, setSystemConfig] = useState<SystemConfig | null>(null);

  const [merchandisePrices, setMerchandisePrices] = useState<MerchandisePrice[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const [isCalculatingDistance, setIsCalculatingDistance] = useState(false);

  const [showMapModal, setShowMapModal] = useState(false);
  const [mapTarget, setMapTarget] = useState<'pickup' | 'delivery' | null>(null);
  const [mapRegion, setMapRegion] = useState<Region>({
    latitude: -22.2514,
    longitude: -45.7037,
    latitudeDelta: 0.005,
    longitudeDelta: 0.005,
  });

  const [pendingDebts, setPendingDebts] = useState<ClientDebt[]>([]);
  const [totalDebtAmount, setTotalDebtAmount] = useState<number>(0);
  const [finalPriceWithDebt, setFinalPriceWithDebt] = useState<number>(0);

  // ✅ NOVO: taxa extra quando documento + devolução
  const documentReturnFee = selectedType === 'documento' && returnToPickupForDocument ? DOCUMENT_RETURN_FEE : 0;

  useEffect(() => {
    fetchInitialData();
    requestPermission();
  }, []);

  const requestPermission = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status === 'granted') setHasLocationPermission(true);
    } catch (err) {
      console.log(err);
    }
  };

  const fetchInitialData = async () => {
    try {
      await Promise.all([fetchMerchandisePrices(), fetchPaymentMethods(), fetchSystemConfig()]);
    } catch (error) {
      console.error('Erro ao buscar dados iniciais:', error);
      Alert.alert('Erro', 'Não foi possível carregar os dados necessários.');
    }
  };

  const fetchPendingDebts = async (customerId: string) => {
    try {
      const { data, error } = await supabase
        .from('client_debts')
        .select('*')
        .eq('customer_id', customerId)
        .eq('is_paid', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        setPendingDebts(data);
        const total = data.reduce((sum, debt) => sum + Number(debt.amount), 0);
        setTotalDebtAmount(total);
        return { hasDebts: true, debts: data, totalAmount: total };
      }

      return { hasDebts: false, debts: [], totalAmount: 0 };
    } catch (error) {
      console.error('Erro ao buscar débitos pendentes:', error);
      return { hasDebts: false, debts: [], totalAmount: 0 };
    }
  };

  const fetchMerchandisePrices = async () => {
    try {
      const { data, error } = await supabase.from('merchandise_prices').select('*').order('merchandise_type');
      if (error) throw error;
      setMerchandisePrices(data || []);
    } catch (error) {
      console.error('Erro ao buscar preços de mercadoria:', error);
    }
  };

  const fetchPaymentMethods = async () => {
    try {
      const { data, error } = await supabase.from('payment_methods').select('*').eq('is_active', true).order('name');
      if (error) throw error;
      setPaymentMethods(data || []);
    } catch (error) {
      console.error('Erro ao buscar formas de pagamento:', error);
    }
  };

  const fetchSystemConfig = async () => {
    try {
      const { data, error } = await supabase.from('system_config').select('*').single();
      if (error) throw error;
      setSystemConfig(data);
    } catch (error) {
      console.error('Erro ao buscar system_config:', error);
      Alert.alert('Aviso', 'Configuração de preço não encontrada. Usando valores padrão.');
      setSystemConfig({
        base_price: 10.0,
        price_per_km: 2.5,
        platform_fee: 1.0,
        pricing_type: 'per_km',
        rain_surcharge_percent: 0,
        holiday_surcharge_percent: 0,
        sunday_surcharge_percent: 0,
        is_raining: false,
        is_holiday: false,
      });
    }
  };

  useEffect(() => {
    if (pickupCoords && deliveryCoords && systemConfig) calculateDistanceAndFee();
  }, [pickupCoords, deliveryCoords, systemConfig]);

  useEffect(() => {
    calculateItemAdjustedFee();
  }, [rawDistanceFee, selectedType]);

  useEffect(() => {
    calculateFinalFeeWithSurcharges();
  }, [itemAdjustedFee, systemConfig]);

  // ✅ ALTERADO: preço final da corrida + taxa de devolução (documento)
  useEffect(() => {
    setDeliveryPrice(finalDeliveryFee + documentReturnFee);
  }, [finalDeliveryFee, documentReturnFee]);

  useEffect(() => {
    if (totalDebtAmount > 0) setFinalPriceWithDebt(deliveryPrice + totalDebtAmount);
    else setFinalPriceWithDebt(deliveryPrice);
  }, [deliveryPrice, totalDebtAmount]);

  const calculateDistanceAndFee = async () => {
    if (!pickupCoords || !deliveryCoords || !systemConfig) return;

    setIsCalculatingDistance(true);

    try {
      const dist = calculateDistance(
        pickupCoords.latitude,
        pickupCoords.longitude,
        deliveryCoords.latitude,
        deliveryCoords.longitude
      );

      setDistance(dist);

      let fee = 0;
      if (systemConfig.pricing_type === 'per_km') {
        const rawFee = dist * systemConfig.price_per_km;
        fee = Math.max(systemConfig.base_price, rawFee);
      } else {
        fee = systemConfig.base_price;
      }

      setRawDistanceFee(fee);
    } catch (error) {
      console.error('Erro ao calcular distância:', error);
    } finally {
      setIsCalculatingDistance(false);
    }
  };

  const calculateItemAdjustedFee = () => {
    let adjusted = rawDistanceFee;
    let multiplier = 1.0;
    let additionalFee = 0;

    if (selectedType) {
      const priceConfig = merchandisePrices.find((p) => p.merchandise_type === selectedType);
      if (priceConfig) {
        multiplier = priceConfig.base_multiplier;
        additionalFee = priceConfig.additional_fee;
      }
    }

    adjusted = adjusted * multiplier + additionalFee;
    setItemAdjustedFee(adjusted);
  };

  const calculateFinalFeeWithSurcharges = () => {
    if (!systemConfig) return;

    let fee = itemAdjustedFee;
    let multiplier = 1;

    const today = new Date();
    const isSunday = today.getDay() === 0;

    if (systemConfig.is_raining && systemConfig.rain_surcharge_percent > 0) {
      multiplier *= 1 + systemConfig.rain_surcharge_percent / 100;
    }
    if (systemConfig.is_holiday && systemConfig.holiday_surcharge_percent > 0) {
      multiplier *= 1 + systemConfig.holiday_surcharge_percent / 100;
    }
    if (isSunday && systemConfig.sunday_surcharge_percent > 0) {
      multiplier *= 1 + systemConfig.sunday_surcharge_percent / 100;
    }

    fee = fee * multiplier;
    setFinalDeliveryFee(fee);
  };

  const openMap = (target: 'pickup' | 'delivery') => {
    setMapTarget(target);
    setShowMapModal(true);
  };

  const handleMapConfirm = async (region: Region) => {
    setShowMapModal(false);
    setIsFetchingAddress(true);

    const coordinate = { latitude: region.latitude, longitude: region.longitude };

    try {
      if (mapTarget === 'pickup') setPickupCoords(coordinate);
      else setDeliveryCoords(coordinate);

      const geocodeResult = await reverseGeocode(coordinate.latitude, coordinate.longitude);

      if (geocodeResult && geocodeResult.status === 'OK') {
        const result = geocodeResult.results[0];
        const components = result.address_components;

        const getComponent = (type: string) =>
          components.find((c: any) => c.types.includes(type))?.long_name || '';

        const rua = getComponent('route');
        const numero = getComponent('street_number');
        const bairro =
          components.find((c: any) => c.types.includes('sublocality') || c.types.includes('neighborhood'))?.long_name ||
          '';

        if (mapTarget === 'pickup') {
          setPickupData((prev) => ({
            ...prev,
            rua: rua || prev.rua,
            numero: numero || prev.numero,
            bairro: bairro || prev.bairro,
          }));
        } else {
          setDeliveryData((prev) => ({
            ...prev,
            rua: rua || prev.rua,
            numero: numero || prev.numero,
          }));
          setDeliveryBairro(bairro);
        }
      } else {
        Alert.alert('Aviso', 'Endereço não identificado neste local.');
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Erro', 'Falha ao obter endereço.');
    } finally {
      setIsFetchingAddress(false);
      setMapTarget(null);
    }
  };

  const fetchNeighborhoodFromAddress = async (rua: string, numero: string, target: 'pickup' | 'delivery') => {
    if (!rua.trim() || !numero.trim()) return;

    setIsFetchingAddress(true);

    try {
      const address = `${rua}, ${numero}, Santa Rita do Sapucaí, MG, Brasil`;
      const geocodeResult = await geocodeAddress(address);

      if (geocodeResult && geocodeResult.status === 'OK') {
        const result = geocodeResult.results[0];
        const components = result.address_components;

        const location = result.geometry.location;
        if (location) {
          if (target === 'pickup') setPickupCoords({ latitude: location.lat, longitude: location.lng });
          else setDeliveryCoords({ latitude: location.lat, longitude: location.lng });
        }

        const neighborhoodComponent = components.find(
          (c: any) => c.types.includes('sublocality') || c.types.includes('neighborhood')
        );

        const bairro = neighborhoodComponent?.long_name || '';

        if (target === 'pickup') {
          setPickupData((prev) => ({ ...prev, bairro }));
        } else {
          setDeliveryBairro(bairro);
        }
      }
    } catch (error) {
      console.error('Erro ao buscar endereço:', error);
    } finally {
      setIsFetchingAddress(false);
    }
  };

  const validateForm = () => {
    if (!selectedType) {
      Alert.alert('Erro', 'Selecione o tipo de mercadoria');
      return false;
    }
    if (!pickupData.rua.trim() || !pickupData.numero.trim() || !pickupData.nome_local.trim() || !pickupData.bairro.trim()) {
      Alert.alert('Erro', 'Preencha todos os campos da retirada');
      return false;
    }
    if (!deliveryData.rua.trim() || !deliveryData.numero.trim()) {
      Alert.alert('Erro', 'Preencha rua e número da entrega');
      return false;
    }
    if (!pickupCoords || !deliveryCoords || distance <= 0) {
      Alert.alert('Erro', 'Defina locais válidos para retirada e entrega para calcular a distância e o preço');
      return false;
    }
    if (!paymentLocation) {
      Alert.alert('Erro', 'Selecione quando deseja pagar (retirada ou entrega)');
      return false;
    }
    if (!selectedPayment) {
      Alert.alert('Erro', 'Selecione a forma de pagamento');
      return false;
    }
    return true;
  };

  const showDebtConfirmationAlert = (totalDebt: number, finalPrice: number) => {
    return new Promise<boolean>((resolve) => {
      Alert.alert(
        '⚠️ Débitos Pendentes Encontrados',
        `Você possui R$ ${totalDebt.toFixed(2)} em débitos pendentes.\n\n` +
          `Valor do novo pedido: R$ ${deliveryPrice.toFixed(2)}\n` +
          `Total a pagar (incluindo débitos): R$ ${finalPrice.toFixed(2)}\n\n` +
          `Deseja prosseguir com o pagamento do débito junto com o novo pedido?`,
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Pagar Débitos e Criar Pedido', style: 'default', onPress: () => resolve(true) },
        ]
      );
    });
  };

  const confirmCallMotoboyAlert = () => {
    return new Promise<boolean>((resolve) => {
      Alert.alert(
        '⚠️ Atenção antes de chamar o motoboy',
        'Você está ciente que o pedido para retirada deve já estar pago.\n\n' +
          'O motoboy NÃO receberá o valor do item selecionado pelo cliente.\n\n' +
          'De preferência, solicite o motoboy quando seu pedido já estiver pronto para retirada.',
        [
          { text: 'Cancelar', style: 'cancel', onPress: () => resolve(false) },
          { text: 'Estou ciente, chamar', style: 'default', onPress: () => resolve(true) },
        ]
      );
    });
  };

  const handleCreateOrder = async () => {
    if (!validateForm()) return;

    const confirmed = await confirmCallMotoboyAlert();
    if (!confirmed) return;

    setLoading(true);

    try {
      const { data: clienteData, error: clienteError } = await supabase
        .from('clientes')
        .select('id')
        .eq('user_id', user?.id)
        .single();

      if (clienteError || !clienteData) throw new Error('Cliente não encontrado.');

      const debtInfo = await fetchPendingDebts(clienteData.id);

      if (debtInfo.hasDebts && debtInfo.totalAmount > 0) {
        setLoading(false);
        const shouldProceed = await showDebtConfirmationAlert(debtInfo.totalAmount, deliveryPrice + debtInfo.totalAmount);
        if (!shouldProceed) return;
        setLoading(true);
      }

      const pickupString = `${pickupData.rua}, ${pickupData.numero} - ${pickupData.nome_local} (${pickupData.bairro})`;
      const deliveryString = `${deliveryData.rua}, ${deliveryData.numero}${deliveryBairro ? ` - ${deliveryBairro}` : ''}${
        deliveryData.complemento ? ` - ${deliveryData.complemento}` : ''
      }`;

      // ✅ ALTERADO: total inclui débitos + taxa extra de devolução (já está dentro do deliveryPrice)
      const totalPrice = debtInfo.hasDebts ? deliveryPrice + debtInfo.totalAmount : deliveryPrice;

      let orderNotes = instructions;

      if (debtInfo.hasDebts) {
        orderNotes = `${instructions ? instructions + '\n\n' : ''}INCLUI PAGAMENTO DE DÉBITOS: R$ ${debtInfo.totalAmount.toFixed(
          2
        )}`;
      }

      orderNotes += `\nPAGAMENTO NA ${paymentLocation === 'pickup' ? 'RETIRADA' : 'ENTREGA'}`;

      if (selectedType === 'documento') {
        orderNotes += `\nDOCUMENTO: ${
          returnToPickupForDocument ? 'RETORNAR PARA DEVOLUÇÃO NO LOCAL DE RETIRADA' : 'SEM DEVOLUÇÃO (APENAS ENTREGA)'
        }`;

        // ✅ NOVO: deixa explícito no pedido (opcional, mas bom)
        if (returnToPickupForDocument) {
          orderNotes += `\nTAXA DEVOLUÇÃO DOCUMENTO: R$ ${DOCUMENT_RETURN_FEE.toFixed(2)}`;
        }
      }

      const pedidoData: any = {
        customer_id: clienteData.id,
        pickup_address: pickupString,
        delivery_address: deliveryString,
        merchandise_type: selectedType,
        price: totalPrice,
        platform_fee: systemConfig?.platform_fee ?? 1.0,
        distance_km: distance,
        status: 'criado',
        notes: orderNotes,
        pickup_bairro: pickupData.bairro,
        delivery_bairro: deliveryBairro,
        payment_method: selectedPayment,
        calculated_distance: true,
      };

      if (pickupCoords) {
        pedidoData.pickup_lat = pickupCoords.latitude;
        pedidoData.pickup_lng = pickupCoords.longitude;
      }

      if (deliveryCoords) {
        pedidoData.delivery_lat = deliveryCoords.latitude;
        pedidoData.delivery_lng = deliveryCoords.longitude;
      }

      const { data: pedido, error: orderError } = await supabase.from('pedidos').insert(pedidoData).select().single();

      if (orderError) {
        console.error('Erro ao criar pedido:', orderError);
        throw new Error(`Falha ao criar pedido: ${orderError.message}`);
      }

      // OBS: seu schema enviado não tem "paid_at" em client_debts.
      // Se você realmente tiver essa coluna no seu banco, ok.
      // Caso contrário, remova "paid_at" daqui.
      if (debtInfo.hasDebts && debtInfo.debts.length > 0) {
        const debtIds = debtInfo.debts.map((debt) => debt.id);

        const { error: updateDebtError } = await supabase
          .from('client_debts')
          .update({
            is_paid: true,
            // paid_at: new Date().toISOString(), // <- remova se não existir no banco
            order_id: pedido.id,
          })
          .in('id', debtIds);

        if (updateDebtError) console.error('Erro ao atualizar débitos:', updateDebtError);
      }

      if (pickupCoords && deliveryCoords) {
        await supabase.from('pedido_coordinates').insert({
          pedido_id: pedido.id,
          pickup_latitude: pickupCoords.latitude,
          pickup_longitude: pickupCoords.longitude,
          delivery_latitude: deliveryCoords.latitude,
          delivery_longitude: deliveryCoords.longitude,
        });
      }

      const successMessage = debtInfo.hasDebts
        ? `Pedido criado com sucesso!\n\nDébitos pendentes (R$ ${debtInfo.totalAmount.toFixed(2)}) foram adicionados ao valor total.`
        : 'Pedido criado com sucesso!';

      Alert.alert('✅ Sucesso!', successMessage, [
        { text: 'Ver Pedido', onPress: () => router.replace(`/order/${pedido.id}`) },
      ]);
    } catch (error: any) {
      console.error('Erro completo:', error);
      Alert.alert('Erro', error.message || 'Falha ao criar pedido.');
    } finally {
      setLoading(false);
    }
  };

  const getPaymentIcon = (methodCode: string) => {
    switch (methodCode) {
      case 'pix':
        return Smartphone;
      case 'debito':
        return CreditCard;
      case 'credito':
        return CreditCard;
      case 'dinheiro':
        return DollarSign;
      default:
        return DollarSign;
    }
  };

  const getActiveSurcharges = () => {
    if (!systemConfig) return [];
    const today = new Date();
    const isSunday = today.getDay() === 0;
    const surcharges: { name: string; percent: number }[] = [];

    if (systemConfig.is_raining && systemConfig.rain_surcharge_percent > 0) {
      surcharges.push({ name: 'Chuva', percent: systemConfig.rain_surcharge_percent });
    }
    if (systemConfig.is_holiday && systemConfig.holiday_surcharge_percent > 0) {
      surcharges.push({ name: 'Feriado', percent: systemConfig.holiday_surcharge_percent });
    }
    if (isSunday && systemConfig.sunday_surcharge_percent > 0) {
      surcharges.push({ name: 'Domingo', percent: systemConfig.sunday_surcharge_percent });
    }

    return surcharges;
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ArrowLeft size={24} color="#FFFFFF" strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Novo Pedido</Text>
      </View>

      <ScrollView style={styles.content} contentContainerStyle={styles.contentContainer} showsVerticalScrollIndicator={false}>
        {totalDebtAmount > 0 && (
          <View style={styles.debtAlertSection}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
              <AlertTriangle size={20} color="#DC2626" />
              <Text style={styles.debtAlertTitle}>Débitos Pendentes</Text>
            </View>
            <Text style={styles.debtAlertText}>
              Você possui <Text style={{ fontWeight: 'bold' }}>R$ {totalDebtAmount.toFixed(2)}</Text> em débitos pendentes.
              Este valor será adicionado ao total do novo pedido.
            </Text>

            {pendingDebts.length > 0 && (
              <View style={styles.debtList}>
                {pendingDebts.slice(0, 3).map((debt, index) => (
                  <View key={debt.id} style={styles.debtItem}>
                    <Text style={styles.debtReason}>
                      {index + 1}. {debt.reason || 'Débito pendente'}
                    </Text>
                    <Text style={styles.debtAmount}>R$ {Number(debt.amount).toFixed(2)}</Text>
                  </View>
                ))}
                {pendingDebts.length > 3 && <Text style={styles.debtMoreText}>+ {pendingDebts.length - 3} mais...</Text>}
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>O que vamos levar?</Text>
          <View style={styles.typeGrid}>
            {MERCHANDISE_TYPES.map((type) => {
              const IconComponent = type.icon;
              const isSelected = selectedType === type.id;
              const priceConfig = merchandisePrices.find((p) => p.merchandise_type === type.id);

              return (
                <TouchableOpacity
                  key={type.id}
                  style={[styles.typeCard, isSelected && styles.typeCardSelected]}
                  onPress={() => {
                    setSelectedType(type.id);
                    if (type.id !== 'documento') setReturnToPickupForDocument(false); // reset
                  }}
                >
                  <IconComponent size={24} color={isSelected ? '#FFFFFF' : '#6B7280'} />
                  <Text style={[styles.typeLabel, isSelected && styles.typeLabelSelected]}>{type.label}</Text>
                  {priceConfig && (
                    <Text style={[styles.typeSubtext, isSelected && styles.typeSubtextSelected]}>
                      +R$ {priceConfig.additional_fee.toFixed(2)}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ✅ Documento: opção devolução */}
        {selectedType === 'documento' && (
          <View style={[styles.section, { borderWidth: 1, borderColor: '#E5E7EB' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#374151' }}>Retornar para devolução?</Text>
                <Text style={{ fontSize: 13, color: '#6B7280', marginTop: 4, lineHeight: 18 }}>
                  Ative se o motoboy deve retornar ao local de retirada para devolução do documento.
                </Text>
              </View>

              <Switch value={returnToPickupForDocument} onValueChange={setReturnToPickupForDocument} />
            </View>

            {returnToPickupForDocument && (
              <View style={{ marginTop: 12, padding: 12, backgroundColor: '#FFFBEB', borderRadius: 10 }}>
                <Text style={{ fontSize: 12, color: '#92400E', lineHeight: 18 }}>
                  Taxa adicional de devolução: R$ {DOCUMENT_RETURN_FEE.toFixed(2)}
                </Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Onde buscar? (Retirada)</Text>
            <TouchableOpacity
              onPress={() => openMap('pickup')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#EFF6FF',
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#BFDBFE',
              }}
            >
              <MapPin size={14} color="#2563EB" />
              <Text style={{ color: '#2563EB', fontWeight: '600', marginLeft: 4, fontSize: 12 }}>Mapa</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 2, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>Rua *</Text>
              <TextInput
                style={styles.simpleInput}
                value={pickupData.rua}
                onChangeText={(t) => setPickupData({ ...pickupData, rua: t })}
                placeholder="Nome da rua"
                onBlur={() => fetchNeighborhoodFromAddress(pickupData.rua, pickupData.numero, 'pickup')}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Número *</Text>
              <TextInput
                style={styles.simpleInput}
                value={pickupData.numero}
                onChangeText={(t) => setPickupData({ ...pickupData, numero: t })}
                placeholder="123"
                keyboardType="numeric"
                onBlur={() => fetchNeighborhoodFromAddress(pickupData.rua, pickupData.numero, 'pickup')}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Bairro da Retirada *</Text>
            <View style={styles.autoFillContainer}>
              <Text style={[styles.autoFillText, !pickupData.bairro && { color: '#9CA3AF' }]}>
                {pickupData.bairro ? pickupData.bairro : 'Bairro será preenchido automaticamente'}
              </Text>
              {isFetchingAddress && <Text style={styles.helperText}>Buscando bairro...</Text>}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Nome do Local *</Text>
            <TextInput
              style={styles.simpleInput}
              value={pickupData.nome_local}
              onChangeText={(t) => setPickupData({ ...pickupData, nome_local: t })}
              placeholder="Ex: Minha Loja"
            />
          </View>
        </View>

        <View style={styles.section}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={[styles.sectionTitle, { marginBottom: 0 }]}>Onde entregar?</Text>
            <TouchableOpacity
              onPress={() => openMap('delivery')}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#EFF6FF',
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: '#BFDBFE',
              }}
            >
              <MapPin size={14} color="#2563EB" />
              <Text style={{ color: '#2563EB', fontWeight: '600', marginLeft: 4, fontSize: 12 }}>Mapa</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.row}>
            <View style={[styles.inputGroup, { flex: 2, marginRight: 8 }]}>
              <Text style={styles.inputLabel}>Rua *</Text>
              <TextInput
                style={styles.simpleInput}
                value={deliveryData.rua}
                onChangeText={(t) => setDeliveryData({ ...deliveryData, rua: t })}
                placeholder="Nome da rua"
                onBlur={() => fetchNeighborhoodFromAddress(deliveryData.rua, deliveryData.numero, 'delivery')}
              />
            </View>
            <View style={[styles.inputGroup, { flex: 1 }]}>
              <Text style={styles.inputLabel}>Número *</Text>
              <TextInput
                style={styles.simpleInput}
                value={deliveryData.numero}
                onChangeText={(t) => setDeliveryData({ ...deliveryData, numero: t })}
                placeholder="123"
                keyboardType="numeric"
                onBlur={() => fetchNeighborhoodFromAddress(deliveryData.rua, deliveryData.numero, 'delivery')}
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Bairro da Entrega</Text>
            <View style={styles.autoFillContainer}>
              <Text style={[styles.autoFillText, !deliveryBairro && { color: '#9CA3AF' }]}>
                {deliveryBairro || 'Bairro não identificado automaticamente'}
              </Text>
              {isFetchingAddress && <Text style={styles.helperText}>Buscando endereço...</Text>}
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Complemento</Text>
            <TextInput
              style={styles.simpleInput}
              value={deliveryData.complemento}
              onChangeText={(t) => setDeliveryData({ ...deliveryData, complemento: t })}
              placeholder="Apto, Casa 2..."
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quando pagar?</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity
              style={[styles.paymentLocationCard, paymentLocation === 'pickup' && styles.paymentLocationCardSelected]}
              onPress={() => {
                setPaymentLocation('pickup');
                setSelectedPayment('');
              }}
            >
              <Store size={32} color={paymentLocation === 'pickup' ? '#FFFFFF' : '#6B7280'} />
              <Text style={[styles.paymentLocationLabel, paymentLocation === 'pickup' && styles.paymentLocationLabelSelected]}>
                Pagar na Retirada
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.paymentLocationCard, paymentLocation === 'delivery' && styles.paymentLocationCardSelected]}
              onPress={() => {
                setPaymentLocation('delivery');
                setSelectedPayment('');
              }}
            >
              <Home size={32} color={paymentLocation === 'delivery' ? '#FFFFFF' : '#6B7280'} />
              <Text style={[styles.paymentLocationLabel, paymentLocation === 'delivery' && styles.paymentLocationLabelSelected]}>
                Pagar na Entrega
              </Text>
            </TouchableOpacity>
          </View>

          {paymentLocation && (
            <>
              <Text style={[styles.sectionTitle, { marginTop: 20 }]}>Forma de pagamento</Text>
              <View style={styles.paymentGrid}>
                {paymentMethods.map((method) => {
                  const IconComponent = getPaymentIcon(method.code);
                  const isSelected = selectedPayment === method.code;

                  return (
                    <TouchableOpacity
                      key={method.id}
                      style={[styles.paymentCard, isSelected && styles.paymentCardSelected]}
                      onPress={() => setSelectedPayment(method.code)}
                    >
                      <IconComponent size={20} color={isSelected ? '#FFFFFF' : '#6B7280'} />
                      <Text style={[styles.paymentLabel, isSelected && styles.paymentLabelSelected]}>{method.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.inputLabel}>Instruções para o Motoboy</Text>
          <TextInput
            style={[styles.simpleInput, { height: 80, textAlignVertical: 'top' }]}
            value={instructions}
            onChangeText={setInstructions}
            placeholder="Ex: Aguardar no portão, tocar o interfone..."
            multiline
            numberOfLines={3}
          />
        </View>

        {/* =======================
            RESUMO DO PEDIDO
            ✅ MODIFICAÇÃO 1:
            - REMOVIDO: "Taxa do item"
            - REMOVIDO: caixa de fórmula/informativos
        ======================= */}
        <View style={styles.priceSection}>
          <View style={styles.priceHeader}>
            <DollarSign size={24} color="#059669" strokeWidth={2} />
            <Text style={styles.priceTitle}>Resumo do Pedido</Text>
          </View>

          <View style={styles.priceBreakdown}>
            {rawDistanceFee > 0 && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Taxa base de entrega ({distance.toFixed(1)} km):</Text>
                <Text style={styles.priceValue}>R$ {rawDistanceFee.toFixed(2)}</Text>
              </View>
            )}

            {getActiveSurcharges().map((surcharge) => (
              <View key={surcharge.name} style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: '#DC2626' }]}>
                  Acréscimo {surcharge.name} (+{surcharge.percent}%):
                </Text>
                <Text style={[styles.priceValue, { color: '#DC2626' }]}>
                  +R$ {(finalDeliveryFee - itemAdjustedFee).toFixed(2)}
                </Text>
              </View>
            ))}

            {/* ✅ NOVO: mostra taxa devolução somente quando ativa */}
            {documentReturnFee > 0 && (
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: '#92400E' }]}>Taxa devolução (documento):</Text>
                <Text style={[styles.priceValue, { color: '#92400E', fontWeight: '700' }]}>
                  +R$ {documentReturnFee.toFixed(2)}
                </Text>
              </View>
            )}

            {distance > 0 && (
              <View style={styles.priceRow}>
                <Text style={styles.priceLabel}>Percurso / Tempo Estimado:</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={[styles.priceValue, { color: '#374151', fontSize: 13 }]}>
                    {distance.toFixed(1)} km • ~{Math.ceil(distance * 3)} min
                  </Text>
                </View>
              </View>
            )}

            {totalDebtAmount > 0 && (
              <View style={styles.priceRow}>
                <Text style={[styles.priceLabel, { color: '#DC2626' }]}>Débitos pendentes:</Text>
                <Text style={[styles.priceValue, { color: '#DC2626', fontWeight: '600' }]}>
                  + R$ {totalDebtAmount.toFixed(2)}
                </Text>
              </View>
            )}

            <View style={[styles.priceRow, { marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#BBF7D0' }]}>
              <Text style={[styles.priceLabel, { fontWeight: 'bold', fontSize: 16 }]}>
                {totalDebtAmount > 0 ? 'Total (com débitos):' : 'Total a Pagar:'}
              </Text>
              <Text
                style={[
                  styles.priceValue,
                  {
                    fontWeight: 'bold',
                    fontSize: 18,
                    color: totalDebtAmount > 0 ? '#DC2626' : '#059669',
                  },
                ]}
              >
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
                  totalDebtAmount > 0 ? finalPriceWithDebt : deliveryPrice
                )}
              </Text>
            </View>
          </View>

          {paymentLocation && selectedPayment && (
            <View style={styles.paymentMethodContainer}>
              <Text style={styles.paymentMethodText}>
                Pagamento: {paymentMethods.find((p) => p.code === selectedPayment)?.name} (na{' '}
                {paymentLocation === 'pickup' ? 'retirada' : 'entrega'})
              </Text>
            </View>
          )}
        </View>

        <TouchableOpacity
          style={[
            styles.confirmButton,
            (!selectedType || !pickupData.bairro || !paymentLocation || !selectedPayment || distance <= 0 || loading) &&
              styles.confirmButtonDisabled,
          ]}
          onPress={handleCreateOrder}
          disabled={!selectedType || !pickupData.bairro || !paymentLocation || !selectedPayment || distance <= 0 || loading}
        >
          {loading ? (
            <LoadingSpinner size="small" color="#FFFFFF" />
          ) : (
            <>
              <Package size={20} color="#FFFFFF" strokeWidth={2} />
              <Text style={styles.confirmButtonText}>
                {totalDebtAmount > 0 ? 'Pagar Débitos e Chamar Motoboy' : 'Chamar Motoboy'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>

      <MapPickerModal
        visible={showMapModal}
        onClose={() => setShowMapModal(false)}
        onConfirm={handleMapConfirm}
        initialRegion={mapRegion}
        hasPermission={hasLocationPermission}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2563EB',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  backButton: { marginRight: 16 },
  headerTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF' },
  content: { flex: 1 },
  contentContainer: { padding: 20 },

  debtAlertSection: {
    backgroundColor: '#FEF2F2',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  debtAlertTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#DC2626',
    marginLeft: 8,
  },
  debtAlertText: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
  },
  debtList: {
    marginTop: 12,
    backgroundColor: 'rgba(220, 38, 38, 0.05)',
    borderRadius: 8,
    padding: 12,
  },
  debtItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  debtReason: {
    fontSize: 13,
    color: '#4B5563',
    flex: 1,
  },
  debtAmount: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#DC2626',
    marginLeft: 8,
  },
  debtMoreText: {
    fontSize: 12,
    color: '#9CA3AF',
    fontStyle: 'italic',
    marginTop: 4,
  },

  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  sectionTitle: { fontSize: 18, fontWeight: '600', color: '#374151', marginBottom: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  typeCard: {
    flex: 1,
    minWidth: '30%',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  typeCardSelected: { borderColor: '#2563EB', backgroundColor: '#2563EB' },
  typeLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginTop: 8, textAlign: 'center' },
  typeLabelSelected: { color: '#FFFFFF' },
  typeSubtext: { fontSize: 10, color: '#9CA3AF', marginTop: 2 },
  typeSubtextSelected: { color: '#DBEAFE' },

  paymentLocationCard: {
    flex: 1,
    alignItems: 'center',
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  paymentLocationCardSelected: { borderColor: '#059669', backgroundColor: '#059669' },
  paymentLocationLabel: { fontSize: 14, fontWeight: '600', color: '#6B7280', marginTop: 8, textAlign: 'center' },
  paymentLocationLabelSelected: { color: '#FFFFFF' },

  paymentGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  paymentCard: {
    flex: 1,
    minWidth: '30%',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    backgroundColor: '#F9FAFB',
  },
  paymentCardSelected: { borderColor: '#059669', backgroundColor: '#059669' },
  paymentLabel: { fontSize: 12, fontWeight: '600', color: '#6B7280', marginTop: 8, textAlign: 'center' },
  paymentLabelSelected: { color: '#FFFFFF' },

  inputGroup: { marginBottom: 16 },
  inputLabel: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  simpleInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#374151',
    backgroundColor: '#F9FAFB',
  },
  autoFillContainer: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#F9FAFB',
  },
  autoFillText: { fontSize: 16, color: '#374151', fontWeight: '500' },
  helperText: { fontSize: 12, color: '#6B7280', marginTop: 4, fontStyle: 'italic' },

  priceSection: {
    backgroundColor: '#F0FDF4',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#BBF7D0',
  },
  priceHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, justifyContent: 'center' },
  priceTitle: { fontSize: 18, fontWeight: '600', color: '#059669', marginLeft: 8 },
  priceBreakdown: { marginBottom: 12 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  priceLabel: { fontSize: 14, color: '#374151' },
  priceValue: { fontSize: 14, color: '#059669', fontWeight: '500' },
  paymentMethodContainer: { alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#BBF7D0' },
  paymentMethodText: { fontSize: 14, fontWeight: '600', color: '#059669' },

  confirmButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#059669',
    paddingVertical: 16,
    borderRadius: 12,
    marginBottom: 40,
  },
  confirmButtonDisabled: { backgroundColor: '#9CA3AF' },
  confirmButtonText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', marginLeft: 8 },
});
