import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Image,
  Linking,
  Pressable,
  Text,
  View
} from 'react-native';
import { supabase } from '@/lib/supabase';

type Banner = {
  id: string;
  title: string;
  image_url: string;
  target_url: string;
  is_active: boolean;
  sort_order: number;
  start_at: string | null;
  end_at: string | null;
};

const { width } = Dimensions.get('window');
const CARD_H = 80;
const INTERVAL_MS = 4500;

function isInWindow(b: Banner) {
  const now = Date.now();
  const startOk = !b.start_at || new Date(b.start_at).getTime() <= now;
  const endOk = !b.end_at || new Date(b.end_at).getTime() >= now;
  return startOk && endOk;
}

export const PartnerCarousel: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const listRef = useRef<FlatList<Banner>>(null);

  // ✅ índice interno só pro auto-scroll (sem mostrar nada pro usuário)
  const indexRef = useRef(0);

  const active = useMemo(
    () => banners.filter(b => b.is_active && isInWindow(b)),
    [banners]
  );

  useEffect(() => {
    let mounted = true;

    const fetchBanners = async () => {
      const { data, error } = await supabase
        .from('partner_banners')
        .select('id,title,image_url,target_url,is_active,sort_order,start_at,end_at')
        .order('sort_order', { ascending: true })
        .limit(20);

      if (!mounted) return;

      if (error) {
        console.log('Erro ao buscar banners:', error.message);
        setBanners([]);
        return;
      }

      setBanners((data || []) as Banner[]);
    };

    fetchBanners();
    return () => {
      mounted = false;
    };
  }, []);

  // ✅ Auto-scroll (usuário não controla)
  useEffect(() => {
    if (active.length <= 1) return;

    indexRef.current = 0;

    const t = setInterval(() => {
      const next = (indexRef.current + 1) % active.length;
      indexRef.current = next;

      try {
        listRef.current?.scrollToIndex({ index: next, animated: true });
      } catch {
        // Ignora erro de medida do FlatList, caso aconteça
      }
    }, INTERVAL_MS);

    return () => clearInterval(t);
  }, [active.length]);

  const openLink = async (url: string) => {
    try {
      const can = await Linking.canOpenURL(url);
      if (!can) {
        console.log('Link inválido:', url);
        return;
      }
      await Linking.openURL(url);
    } catch (e) {
      console.log('Erro abrindo link:', e);
    }
  };

  if (active.length === 0) return null;

  return (
    <View style={{ marginBottom: 0 }}>
      <FlatList
        ref={listRef}
        data={active}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        scrollEnabled={false} // ✅ BLOQUEIA swipe do usuário
        showsHorizontalScrollIndicator={false}
        snapToAlignment="center"
        decelerationRate="fast"
        getItemLayout={(_, index) => ({
          length: width,
          offset: width * index,
          index
        })}
        renderItem={({ item }) => (
          <View style={{ width }}>
            {/* ✅ Centralizado / mais estreito */}
            <View style={{ width: '92%', alignSelf: 'center' }}>
              <Pressable
                onPress={() => openLink(item.target_url)}
                style={{
                  borderRadius: 16,
                  overflow: 'hidden',
                  backgroundColor: '#fff',
                  borderWidth: 1,
                  borderColor: '#e2e8f0'
                }}
              >
                <Image
                  source={{ uri: item.image_url }}
                  style={{ width: '100%', height: CARD_H }}
                  resizeMode="cover"
                />

                {/* ✅ Só o título (sem "toque para abrir") */}
                <View style={{ padding: 8 }}>
                  <Text style={{ fontWeight: '700', color: '#0f172a' }}>
                    {item.title}
                  </Text>
                </View>
              </Pressable>
            </View>
          </View>
        )}
      />
    </View>
  );
};