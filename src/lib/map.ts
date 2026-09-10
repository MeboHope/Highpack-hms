import { supabase } from '@/lib/supabase';

export type MapCoordinates = { latitude: number; longitude: number };

function validCoordinates(latitude: number, longitude: number): MapCoordinates | null {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) return null;
  return { latitude, longitude };
}

/**
 * Extracts coordinates from the common Google Maps share/link formats:
 * @lat,lng,zoom, q=lat,lng, query=lat,lng, /search/lat,lng and !3dlat!4dlng.
 */
export function extractCoordinatesFromMapUrl(mapUrl: string | null | undefined): MapCoordinates | null {
  if (!mapUrl) return null;
  const value = mapUrl.trim();
  if (!value) return null;

  const patterns = [
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/,
    /[?&](?:q|query|ll|center)=(-?\d+(?:\.\d+)?)[,%20]+(-?\d+(?:\.\d+)?)/i,
    /\/search\/(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/i,
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/i,
  ];

  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) {
      const coordinates = validCoordinates(Number(match[1]), Number(match[2]));
      if (coordinates) return coordinates;
    }
  }

  // Also accept a plain "latitude,longitude" value pasted into the map field.
  const plain = value.match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);
  return plain ? validCoordinates(Number(plain[1]), Number(plain[2])) : null;
}

export function buildGoogleMapsEmbedUrl(coordinates: MapCoordinates): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${coordinates.latitude},${coordinates.longitude}`)}&z=17&output=embed`;
}

export function buildGoogleMapsDirectionsUrl(coordinates: MapCoordinates): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${coordinates.latitude},${coordinates.longitude}`)}`;
}


/** Resolve Google Maps share/short URLs server-side when the URL itself does not expose coordinates. */
export async function resolveMapUrlCoordinates(mapUrl: string | null | undefined): Promise<MapCoordinates | null> {
  if (!mapUrl?.trim()) return null;
  const direct = extractCoordinatesFromMapUrl(mapUrl);
  if (direct) return direct;
  try {
    const { data, error } = await supabase.functions.invoke('resolve-map-url', { body: { map_url: mapUrl.trim() } });
    if (error) { console.warn('Map URL resolver error:', error.message); return null; }
    if (data?.latitude != null && data?.longitude != null) {
      return validCoordinates(Number(data.latitude), Number(data.longitude));
    }
  } catch (error) {
    console.warn('Map URL resolver unavailable:', error);
  }
  return null;
}
