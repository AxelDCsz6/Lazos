import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
  StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import { api } from '../services/api';
import { InlineVideoPlayer } from './InlineVideoPlayer';

export interface LinkPreviewData {
  found: boolean;
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  siteName?: string | null;
  resolvedUrl?: string | null;
  embed?: { provider: string; videoId: string } | null;
}

// Cache en memoria por sesión (incluye negativos: null = sin preview,
// evita re-fetchear links que ya fallaron).
const previewCache = new Map<string, LinkPreviewData | null>();

const inFlight = new Map<string, Promise<LinkPreviewData | null>>();

async function fetchPreview(lazoId: string, url: string): Promise<LinkPreviewData | null> {
  if (previewCache.has(url)) { return previewCache.get(url) ?? null; }
  const existing = inFlight.get(url);
  if (existing) { return existing; }
  const p = (async () => {
    try {
      const { data } = await api.get(`/lazos/${lazoId}/link-preview`, {
        params: { url },
      });
      const preview: LinkPreviewData | null = data && data.found ? data : null;
      previewCache.set(url, preview);
      return preview;
    } catch {
      // Degradación silenciosa: no cachear el error de red para reintentar luego
      return null;
    } finally {
      inFlight.delete(url);
    }
  })();
  inFlight.set(url, p);
  return p;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

// Card de preview de link (OpenGraph) que se renderiza bajo el texto del
// mensaje cuando contiene una URL. Auto-fetch con cache por sesión.
// Si el preview trae embed (TikTok/YouTube), muestra botón de play que abre
// el reproductor interno (InlineVideoPlayer).
export function LinkPreviewCard({
  lazoId,
  url,
  mine,
  width,
}: {
  lazoId: string;
  url: string;
  mine: boolean;
  width: number;
}) {
  const [preview, setPreview] = useState<LinkPreviewData | null | undefined>(
    previewCache.has(url) ? previewCache.get(url) : undefined,
  );
  const [playerOpen, setPlayerOpen] = useState(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    if (preview === undefined) {
      fetchPreview(lazoId, url).then(p => {
        if (mountedRef.current) { setPreview(p); }
      });
    }
    return () => { mountedRef.current = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, lazoId]);

  if (preview === undefined) {
    return (
      <View style={[styles.card, styles.skeleton, { width }]}>
        <ActivityIndicator size="small" color="#B0A090" />
      </View>
    );
  }
  if (!preview) { return null; }

  const embed = preview.embed ?? null;
  const target = preview.resolvedUrl || url;

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.card, mine && styles.cardMine, { width }]}
        onPress={async () => {
          if (embed) {
            // Con embed disponible, el tap abre el reproductor interno
            setPlayerOpen(true);
            return;
          }
          try {
            await Linking.openURL(target);
          } catch { /* sin handler: silencioso */ }
        }}>
        {preview.imageUrl ? (
          <Image
            source={{ uri: preview.imageUrl }}
            style={styles.image}
            resizeMode="cover"
          />
        ) : null}
        <View style={styles.info}>
          {preview.title ? (
            <Text style={[styles.title, mine && styles.titleMine]} numberOfLines={2}>
              {preview.title}
            </Text>
          ) : null}
          {preview.siteName ? (
            <Text style={[styles.site, mine && styles.siteMine]} numberOfLines={1}>
              {preview.siteName}
            </Text>
          ) : (
            <Text style={[styles.site, mine && styles.siteMine]} numberOfLines={1}>
              {domainOf(target)}
            </Text>
          )}
        </View>
        {embed ? (
          <View style={styles.playBadge} pointerEvents="none">
            <Icon name="play-circle" size={30} color="#FFF" />
          </View>
        ) : null}
      </TouchableOpacity>
      {embed && (
        <InlineVideoPlayer
          visible={playerOpen}
          provider={embed.provider}
          videoId={embed.videoId}
          onClose={() => setPlayerOpen(false)}
        />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: 6,
    borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.06)',
    overflow: 'hidden',
  },
  cardMine: {
    backgroundColor: 'rgba(255,255,255,0.28)',
  },
  skeleton: {
    height: 64,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: 'rgba(0,0,0,0.08)',
  },
  info: {
    padding: 8,
  },
  title: {
    fontSize: 13,
    fontWeight: '600',
    color: '#3A2E1E',
  },
  titleMine: {
    color: '#FFFDF8',
  },
  site: {
    marginTop: 2,
    fontSize: 11,
    color: '#7A6A55',
  },
  siteMine: {
    color: 'rgba(255,253,248,0.75)',
  },
  playBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
});
