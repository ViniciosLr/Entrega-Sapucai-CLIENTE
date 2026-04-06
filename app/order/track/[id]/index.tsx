import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
 StyleSheet,
  ActivityIndicator,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, Navigation, Package, MapPin } from 'lucide-react-native';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import MapViewDirections from 'react-native-maps-directions';
import { supabase } from '@/lib/supabase';
import { PartnerCarousel } from '@/components/PartnerCarousel'; // ajuste o caminho se necessário

const GOOGLE_MAPS_APIKEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

type Order = {
  id: string;
  status: 'criado' | 'aceito' | 'em_andamento' | 'finalizado' | 'cancelado';
  pickup_address: string;
  delivery_address: string;
  motoboy_id?: string;
  pickup_lat?: number | null;
  pickup_lng?: number | null;
  delivery_lat?: number | null;
  delivery_lng?: number | null;
};

const SANTA_RITA_COORDS = {
  latitude: -22.2536,
  longitude: -45.7058,
  latitudeDelta: 0.03,
  longitudeDelta: 0.03,
};

export default function TrackOrderScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const mapRef = useRef<MapView>(null);

  const [order, setOrder] = useState<Order | null>(null);
  const [motoboyLocation, setMotoboyLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [pickupCoords, setPickupCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [deliveryCoords, setDeliveryCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [loading, setLoading] = useState(true);

  const geocodeAddress = async (
    address: string
  ): Promise<{ latitude: number; longitude: number } | null> => {
    try {
      const fullAddress = `${address}, Santa Rita do Sapucaí, MG, Brasil`;
      const encoded = encodeURIComponent(fullAddress);

      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encoded}&key=${GOOGLE_MAPS_APIKEY}`
      );
      const data = await response.json();

      if (data.status === 'OK' && data.results.length > 0) {
        const loc = data.results[0].geometry.location;
        return { latitude: loc.lat, longitude: loc.lng };
      }

      return null;
    } catch (error) {
      console.error('Erro ao geocodificar:', error);
      return null;
    }
  };

  useEffect(() => {
    if (!id) return;

    const fetchOrder = async () => {
      const { data, error } = await supabase
        .from('pedidos')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !data) {
        Alert.alert('Erro', 'Pedido não encontrado');
        router.back();
        return;
      }

      setOrder(data);

      if (data.pickup_lat && data.pickup_lng) {
        setPickupCoords({
          latitude: data.pickup_lat,
          longitude: data.pickup_lng,
        });
      } else {
        const coords = await geocodeAddress(data.pickup_address);
        if (coords) setPickupCoords(coords);
      }

      if (data.delivery_lat && data.delivery_lng) {
        setDeliveryCoords({
          latitude: data.delivery_lat,
          longitude: data.delivery_lng,
        });
      } else {
        const coords = await geocodeAddress(data.delivery_address);
        if (coords) setDeliveryCoords(coords);
      }

      setLoading(false);
    };

    fetchOrder();

    const orderSubscription = supabase
      .channel(`order-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pedidos',
          filter: `id=eq.${id}`,
        },
        (payload) => {
          setOrder(payload.new as Order);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(orderSubscription);
    };
  }, [id]);

  useEffect(() => {
    if (!order?.motoboy_id) {
      setMotoboyLocation(null);
      return;
    }

    const fetchCurrentLocation = async () => {
      const { data } = await supabase
        .from('motoboys')
        .select('current_latitude, current_longitude')
        .eq('id', order.motoboy_id)
        .single();

      if (data?.current_latitude && data?.current_longitude) {
        setMotoboyLocation({
          latitude: data.current_latitude,
          longitude: data.current_longitude,
        });
      }
    };

    fetchCurrentLocation();

    const channel = supabase
      .channel(`motoboy-location-${order.motoboy_id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'motoboys',
          filter: `id=eq.${order.motoboy_id}`,
        },
        (payload) => {
          const newLat = payload.new.current_latitude;
          const newLng = payload.new.current_longitude;

          if (newLat && newLng) {
            setMotoboyLocation({
              latitude: newLat,
              longitude: newLng,
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [order?.motoboy_id]);

  useEffect(() => {
    if (!mapRef.current || !motoboyLocation || (!pickupCoords && !deliveryCoords)) return;

    let coordinates: { latitude: number; longitude: number }[] = [];

    if (order?.status === 'aceito' && pickupCoords) {
      coordinates = [motoboyLocation, pickupCoords];
    } else if (order?.status === 'em_andamento' && deliveryCoords) {
      coordinates = [motoboyLocation, deliveryCoords];
    } else if (pickupCoords && deliveryCoords) {
      coordinates = [pickupCoords, deliveryCoords];
    }

    if (coordinates.length >= 2) {
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 100, right: 100, bottom: 260, left: 100 },
        animated: true,
      });
    }
  }, [motoboyLocation, pickupCoords, deliveryCoords, order?.status]);

  const centerOnMotoboy = () => {
    if (motoboyLocation && mapRef.current) {
      mapRef.current.animateToRegion(
        {
          ...motoboyLocation,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        },
        500
      );
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2563EB" />
        <Text style={styles.loadingText}>Carregando acompanhamento...</Text>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Pedido não encontrado</Text>
      </View>
    );
  }

  const showMotoboy =
    motoboyLocation && (order.status === 'aceito' || order.status === 'em_andamento');

  const statusText =
    order.status === 'criado'
      ? '⏳ Aguardando motoboy...'
      : order.status === 'aceito'
      ? '🚚 Motoboy indo buscar o pedido'
      : order.status === 'em_andamento'
      ? '📦 Motoboy indo entregar'
      : order.status === 'finalizado'
      ? '✅ Pedido entregue!'
      : 'Pedido cancelado';

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <ArrowLeft size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>
          Acompanhando Pedido #{order.id.slice(-8)}
        </Text>
      </View>

      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={SANTA_RITA_COORDS}
      >
        {showMotoboy && motoboyLocation && (
          <Marker coordinate={motoboyLocation}>
            <View style={styles.motoboyMarker}>
              <Navigation size={24} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {pickupCoords && (
          <Marker coordinate={pickupCoords} title="Retirada">
            <View style={styles.pickupMarker}>
              <Package size={20} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {deliveryCoords && (
          <Marker coordinate={deliveryCoords} title="Entrega">
            <View style={styles.deliveryMarker}>
              <MapPin size={20} color="#FFFFFF" />
            </View>
          </Marker>
        )}

        {showMotoboy && order.status === 'aceito' && pickupCoords && (
          <MapViewDirections
            origin={motoboyLocation}
            destination={pickupCoords}
            apikey={GOOGLE_MAPS_APIKEY}
            strokeWidth={5}
            strokeColor="#F44336"
            optimizeWaypoints={true}
            onReady={(result) => {
              mapRef.current?.fitToCoordinates(result.coordinates, {
                edgePadding: { top: 100, right: 100, bottom: 260, left: 100 },
                animated: true,
              });
            }}
          />
        )}

        {showMotoboy && order.status === 'em_andamento' && deliveryCoords && (
          <MapViewDirections
            origin={motoboyLocation}
            destination={deliveryCoords}
            apikey={GOOGLE_MAPS_APIKEY}
            strokeWidth={5}
            strokeColor="#2196F3"
            optimizeWaypoints={true}
            onReady={(result) => {
              mapRef.current?.fitToCoordinates(result.coordinates, {
                edgePadding: { top: 100, right: 100, bottom: 260, left: 100 },
                animated: true,
              });
            }}
          />
        )}
      </MapView>

      {showMotoboy && (
        <TouchableOpacity style={styles.centerButton} onPress={centerOnMotoboy}>
          <Navigation size={24} color="#2563EB" />
        </TouchableOpacity>
      )}

      <View style={styles.statusPill}>
        <Text style={styles.statusText}>{statusText}</Text>
      </View>

      {showMotoboy && (
        <View style={styles.routeInfoContainer}>
          <Text style={styles.routeInfoText}>
            {order.status === 'aceito'
              ? `🔴 Indo buscar: ${order.pickup_address.split(' - ')[0]}`
              : `🔵 Indo entregar: ${order.delivery_address.split(' - ')[0]}`}
          </Text>
        </View>
      )}

      <View style={styles.carouselContainer} pointerEvents="box-none">
        <PartnerCarousel />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F5F5F5' },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#374151',
  },

  header: {
    position: 'absolute',
    top: 50,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(37, 99, 235, 0.9)',
    padding: 12,
    borderRadius: 12,
    zIndex: 100,
    elevation: 5,
  },

  backButton: {
    marginRight: 12,
  },

  headerTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#FFFFFF',
    flex: 1,
  },

  map: {
    ...StyleSheet.absoluteFillObject,
  },

  centerButton: {
    position: 'absolute',
    top: 140,
    right: 20,
    backgroundColor: 'white',
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    zIndex: 100,
  },

  motoboyMarker: {
    backgroundColor: '#4CAF50',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 6,
  },

  pickupMarker: {
    backgroundColor: '#F44336',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 6,
  },

  deliveryMarker: {
    backgroundColor: '#2196F3',
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 6,
  },

  statusPill: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    elevation: 5,
    zIndex: 90,
    maxWidth: '80%',
  },

  statusText: {
    fontSize: 15,
    color: '#333',
    fontWeight: '600',
    textAlign: 'center',
  },

  routeInfoContainer: {
    position: 'absolute',
    bottom: 145,
    alignSelf: 'center',
    width: '90%',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 16,
    elevation: 8,
    alignItems: 'center',
    zIndex: 90,
  },

  routeInfoText: {
    fontWeight: 'bold',
    fontSize: 15,
    color: '#333',
    textAlign: 'center',
  },

  carouselContainer: {
    position: 'absolute',
    bottom: 8,
    left: 0,
    right: 0,
    zIndex: 95,
  },
});