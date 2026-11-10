// Reads a shop's map location from what people usually paste:
//   27.7172, 85.3240
//   https://www.google.com/maps/place/.../@27.7172,85.3240,17z/...
//   https://maps.google.com/?q=27.7172,85.3240
//   ...!3d27.7172!4d85.3240...
// Returns { lat, lng }, null for an empty input, or an error message.

export type LatLng = { lat: number; lng: number };

// Nepal's bounding box, with a little margin.
const NEPAL = { minLat: 26.2, maxLat: 30.6, minLng: 79.9, maxLng: 88.4 };

export function parseLocation(input: string): LatLng | null | { error: string } {
  const text = input.trim();
  if (!text) return null;

  if (/goo\.gl|maps\.app/i.test(text)) {
    return {
      error:
        "Short Google Maps links can't be read. In Google Maps, press and hold on the shop until a red pin appears, then copy the numbers shown (like 27.7172, 85.3240).",
    };
  }

  const patterns = [
    /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, // place data (most precise)
    /@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/, // map centre in the URL
    /[?&](?:q|query|ll|destination)=(-?\d+(?:\.\d+)?)(?:,|%2C)\s*(-?\d+(?:\.\d+)?)/i,
    /^(-?\d+(?:\.\d+)?)\s*[,\s]\s*(-?\d+(?:\.\d+)?)$/, // plain "lat, lng"
  ];
  for (const re of patterns) {
    const m = text.match(re);
    if (!m) continue;
    const lat = Number(m[1]);
    const lng = Number(m[2]);
    if (lat >= NEPAL.minLat && lat <= NEPAL.maxLat && lng >= NEPAL.minLng && lng <= NEPAL.maxLng) {
      return { lat: Math.round(lat * 1e6) / 1e6, lng: Math.round(lng * 1e6) / 1e6 };
    }
    // Swapped by mistake (85.3, 27.7)?
    if (lng >= NEPAL.minLat && lng <= NEPAL.maxLat && lat >= NEPAL.minLng && lat <= NEPAL.maxLng) {
      return { lat: Math.round(lng * 1e6) / 1e6, lng: Math.round(lat * 1e6) / 1e6 };
    }
    return { error: "That location isn't in Nepal. Check the numbers (Kathmandu is about 27.7, 85.3)." };
  }
  return { error: "Couldn't read a location. Paste coordinates like 27.7172, 85.3240 or a full Google Maps link." };
}

export function formatLocation(lat: number | null, lng: number | null): string {
  return lat != null && lng != null ? `${lat}, ${lng}` : "";
}

export function mapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}
