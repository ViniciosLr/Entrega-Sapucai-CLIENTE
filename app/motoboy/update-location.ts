// app/motoboy/update-location.ts
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';

export async function updateMotoboyLocation(motoboyId: string) {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return;

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    await supabase
      .from('motoboy_locations')
      .insert({
        motoboy_id: motoboyId,
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
        heading: location.coords.heading,
        speed: location.coords.speed,
      });

    // Atualizar também na tabela motoboys
    await supabase
      .from('motoboys')
      .update({
        current_latitude: location.coords.latitude,
        current_longitude: location.coords.longitude,
        last_activity: new Date().toISOString(),
      })
      .eq('id', motoboyId);
  } catch (error) {
    console.error('Erro ao atualizar localização:', error);
  }
}