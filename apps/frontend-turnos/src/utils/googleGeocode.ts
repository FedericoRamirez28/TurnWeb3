export type AddressResult = {
  calle?: string;
  numero?: string;
  localidad?: string;
  partido?: string;
  provincia?: string;
  codigoPostal?: string;
  lat?: number;
  lng?: number;
};

export async function geocodeAddress(
  domicilio: string,
  localidad: string,
  provincia?: string
): Promise<AddressResult | null> {
  const key = import.meta.env.VITE_GOOGLE_MAPS_KEY;
  if (!key) {
    console.error('Falta VITE_GOOGLE_MAPS_KEY en tu .env.local');
    return null;
  }

  const parts: string[] = [domicilio, localidad];
  if (provincia && provincia.trim()) {
    parts.push(provincia);
  }
  parts.push('Argentina');

  const full = parts.join(', ').replace(/\s+/g, ' ').trim();

  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
    full
  )}&key=${key}&language=es`;

  console.log('[Geocode] URL:', url);

  const res = await fetch(url);
  console.log('[Geocode] HTTP status:', res.status, res.statusText);

  if (!res.ok) {
    console.error('Error HTTP al llamar a Geocoding:', res.status);
    return null;
  }

  const data = await res.json();
  console.log('[Geocode] Respuesta JSON completa:', data);

  if (data.status !== 'OK') {
    console.error(
      '[Geocode] status no OK:',
      data.status,
      data.error_message || ''
    );
    return null;
  }

  if (!data.results || data.results.length === 0) {
    console.warn('[Geocode] Sin resultados en data.results');
    return null;
  }

  const r = data.results[0];
  const out: AddressResult = {
    lat: r.geometry?.location?.lat,
    lng: r.geometry?.location?.lng,
  };

  for (const comp of r.address_components as Array<{
    long_name: string;
    types: string[];
  }>) {
    if (comp.types.includes('route')) out.calle = comp.long_name;
    if (comp.types.includes('street_number')) out.numero = comp.long_name;
    if (comp.types.includes('locality')) out.localidad = comp.long_name;
    if (comp.types.includes('administrative_area_level_2'))
      out.partido = comp.long_name;
    if (comp.types.includes('administrative_area_level_1'))
      out.provincia = comp.long_name;
    if (comp.types.includes('postal_code'))
      out.codigoPostal = comp.long_name;
  }

  console.log('[Geocode] Resultado normalizado:', out);

  return out;
}
