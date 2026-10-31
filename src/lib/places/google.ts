import "server-only";

const BASE = "https://places.googleapis.com/v1";

export class PlacesError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "PlacesError";
    this.status = status;
  }
}

function apiKey(): string {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) throw new PlacesError(500, "GOOGLE_PLACES_API_KEY is not set");
  return key;
}

async function request(url: string, init: RequestInit & { headers: Record<string, string> }) {
  const key = apiKey();
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      headers: { ...init.headers, "X-Goog-Api-Key": key },
      cache: "no-store",
    });
  } catch {
    throw new PlacesError(502, "Places API request failed");
  }
  if (!res.ok) throw new PlacesError(res.status, `Places API error: ${res.status}`);
  return res.json();
}

function getDetails(placeId: string, fieldMask: string, sessionToken?: string) {
  const qs = sessionToken ? `?sessionToken=${encodeURIComponent(sessionToken)}` : "";
  return request(`${BASE}/places/${encodeURIComponent(placeId)}${qs}`, {
    method: "GET",
    headers: { "X-Goog-FieldMask": fieldMask },
  });
}

export async function autocomplete(
  input: string,
  sessionToken: string,
  bias?: { lat: number; lng: number },
): Promise<{ placeId: string; mainText: string; secondaryText: string }[]> {
  const body: Record<string, unknown> = {
    input,
    languageCode: "ja",
    regionCode: "jp",
    includedPrimaryTypes: ["restaurant", "bar", "cafe"],
  };
  if (sessionToken) body.sessionToken = sessionToken;
  if (bias) {
    body.locationBias = {
      circle: { center: { latitude: bias.lat, longitude: bias.lng }, radius: 5000 },
    };
  }
  const data = await request(`${BASE}/places:autocomplete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const out: { placeId: string; mainText: string; secondaryText: string }[] = [];
  for (const s of data.suggestions ?? []) {
    const p = s.placePrediction;
    if (!p?.placeId) continue;
    out.push({
      placeId: p.placeId,
      mainText: p.structuredFormat?.mainText?.text ?? p.text?.text ?? "",
      secondaryText: p.structuredFormat?.secondaryText?.text ?? "",
    });
  }
  return out;
}

export async function getPlaceBasics(
  placeId: string,
  sessionToken?: string,
): Promise<{ placeId: string; name: string; lat: number; lng: number }> {
  const d = await getDetails(placeId, "id,displayName,location", sessionToken);
  if (!d.location) throw new PlacesError(502, "Place has no location");
  return {
    placeId: d.id ?? placeId,
    name: d.displayName?.text ?? "",
    lat: d.location.latitude,
    lng: d.location.longitude,
  };
}

export async function getPlaceLocation(placeId: string): Promise<{ lat: number; lng: number }> {
  const d = await getDetails(placeId, "location");
  if (!d.location) throw new PlacesError(502, "Place has no location");
  return { lat: d.location.latitude, lng: d.location.longitude };
}

export async function getPlaceWebsite(placeId: string): Promise<string | null> {
  const d = await getDetails(placeId, "websiteUri");
  return d.websiteUri ?? null;
}
