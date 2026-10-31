/** 「Googleマップで開く」用の URL。Maps URLs は API 課金がかからない。 */
export function googleMapsUrl(shop: {
  name: string;
  lat: number;
  lng: number;
  placeId: string | null;
}): string {
  const base = "https://www.google.com/maps/search/?api=1";
  if (shop.placeId) {
    return `${base}&query=${encodeURIComponent(shop.name)}&query_place_id=${encodeURIComponent(shop.placeId)}`;
  }
  return `${base}&query=${shop.lat},${shop.lng}`;
}
