// lib/addressUtils.ts
import { supabase } from './supabase';

// Lista de prefixos comuns que o Google manda mas que as vezes não estão no banco
const PREFIXOS_IGNORAR = [
  'bairro', 'jardim', 'parque', 'loteamento', 'residencial', 
  'vila', 'condominio', 'conjunto', 'lot.', 'res.', 'jd.'
];

export async function getOrCreateNeighborhood(bairroGoogle: string, cidade = 'Santa Rita do Sapucaí') {
  if (!bairroGoogle || !bairroGoogle.trim()) return null;

  console.log('🔍 Buscando bairro:', bairroGoogle); // DEBUG

  try {
    // 1. TENTATIVA EXATA (Otimista)
    // Tenta buscar exatamente como veio, apenas ignorando maiúsculas/minúsculas
    const { data: exato, error: err1 } = await supabase
      .from('neighborhoods')
      .select('*')
      .eq('city', cidade) // Usa seu índice (city, name)
      .ilike('name', bairroGoogle.trim())
      .maybeSingle();

    if (exato) {
      console.log('✅ Bairro encontrado (Exato):', exato.name);
      return exato;
    }

    // 2. TENTATIVA INTELIGENTE (Removendo prefixos)
    // Se o Google mandou "Bairro Nova Cidade", transformamos em "Nova Cidade"
    let nomeLimpo = bairroGoogle.toLowerCase();
    
    // Remove acentos para limpar melhor
    nomeLimpo = nomeLimpo.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Remove os prefixos da lista
    PREFIXOS_IGNORAR.forEach(prefixo => {
      if (nomeLimpo.startsWith(prefixo + ' ')) {
        nomeLimpo = nomeLimpo.replace(prefixo + ' ', '');
      }
    });

    nomeLimpo = nomeLimpo.trim();
    
    console.log('🔄 Tentando busca aproximada por:', nomeLimpo); // DEBUG

    // Busca no banco qualquer bairro que CONTENHA esse nome limpo
    const { data: aproximado, error: err2 } = await supabase
      .from('neighborhoods')
      .select('*')
      .eq('city', cidade)
      .ilike('name', `%${nomeLimpo}%`) // Ex: Busca '%Nova Cidade%'
      .limit(1)
      .maybeSingle();

    if (aproximado) {
      console.log('✅ Bairro encontrado (Aproximado):', aproximado.name);
      return aproximado;
    }

    console.warn('❌ Bairro não encontrado no banco:', bairroGoogle);
    return null;

  } catch (error) {
    console.error('🚨 Erro crítico ao buscar bairro:', error);
    return null;
  }
}

// --- MANTIVE AS OUTRAS FUNÇÕES IGUAIS, POIS ESTAVAM CORRETAS ---

export async function geocodeAddress(address: string) {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}&region=br&language=pt-BR`
    );
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Erro no geocoding:', error);
    return { status: 'ERROR', error_message: 'Falha na conexão com Google Maps' };
  }
}

export async function reverseGeocode(lat: number, lng: number) {
  try {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}&region=br&language=pt-BR`
    );
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Erro no reverse geocoding:', error);
    return { status: 'ERROR', error_message: 'Falha na conexão com Google Maps' };
  }
}

export function extractAddressComponents(geocodeResult: any) {
  if (!geocodeResult || geocodeResult.status !== 'OK' || !geocodeResult.results[0]) return null;
  
  const result = geocodeResult.results[0];
  const components = result.address_components;
  const getComponent = (type: string) => components.find((c: any) => c.types.includes(type))?.long_name || '';
  
  const bairro = components.find((c: any) => 
    c.types.includes('sublocality') || 
    c.types.includes('neighborhood') ||
    c.types.includes('sublocality_level_1')
  )?.long_name || '';

  return {
    rua: getComponent('route'),
    numero: getComponent('street_number'),
    bairro: bairro,
    cidade: getComponent('locality'),
    estado: getComponent('administrative_area_level_1'),
    cep: getComponent('postal_code'),
    fullAddress: result.formatted_address,
    coordinates: {
      lat: result.geometry.location.lat,
      lng: result.geometry.location.lng
    }
  };
}

export async function calculateDistance(coords1: { lat: number, lng: number }, coords2: { lat: number, lng: number }) {
  try {
    const R = 6371; 
    const dLat = (coords2.lat - coords1.lat) * Math.PI / 180;
    const dLon = (coords2.lng - coords1.lng) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(coords1.lat * Math.PI / 180) * Math.cos(coords2.lat * Math.PI / 180) * Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  } catch (error) {
    return 0;
  }
}