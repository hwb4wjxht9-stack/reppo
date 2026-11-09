// Turns the ways people write Nepali phone numbers into the +977 format that
// phone services (like Vapi) need. Returns null if it doesn't look valid.
//
//   9841234567      → +9779841234567   (mobile)
//   01-4123456      → +97714123456     (Kathmandu landline)
//   +977 1 4123456  → +97714123456
export function normalizeNepalPhone(input: string): string | null {
  let d = input.replace(/[^\d+]/g, "");
  if (d.startsWith("+977")) d = d.slice(4);
  else if (d.startsWith("00977")) d = d.slice(5);
  else if (d.startsWith("977") && d.length > 10) d = d.slice(3);
  d = d.replace(/^\+/, "");

  // Mobile: 10 digits starting with 9 (97x / 98x / 96x).
  if (/^9[678]\d{8}$/.test(d)) return "+977" + d;
  // Landline written with trunk 0: 0 + area code + number, e.g. 014123456.
  if (/^0[1-9]\d{6,8}$/.test(d)) return "+977" + d.slice(1);
  // Landline without the 0: 1 4123456.
  if (/^[1-8]\d{6,8}$/.test(d)) return "+977" + d;
  return null;
}

export function formatNepalPhone(e164: string): string {
  const d = e164.replace(/^\+977/, "");
  if (/^9\d{9}$/.test(d)) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.startsWith("1")) return `01-${d.slice(1)}`;
  return "0" + d;
}
