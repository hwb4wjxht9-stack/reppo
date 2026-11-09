// Turns a typed shopping list into items with name, quantity and unit.
// Works in the browser and on the server (no imports).
//
// Understands lines like:
//   25 kg rice          rice 25kg          rice - 25 kg
//   2 litre mustard oil   eggs 2 dozen     soap x3      3 x soap
//   ५ किलो चिनी          चामल २५ किलो       आधा किलो जिरा
//   cement 2 bora       PVC pipe ½ inch 10 pcs     sugar

export const UNITS = ["kg", "g", "litre", "ml", "pcs", "packet", "dozen", "bag", "bottle", "box", "meter", "ft", "roll", "bundle"] as const;
export type Unit = (typeof UNITS)[number];

export type ParsedItem = { name: string; quantity: number; unit: Unit };

// Words people write → our unit. Matched case-insensitively, whole word.
const UNIT_WORDS: Record<string, Unit> = {
  kg: "kg", kgs: "kg", kilo: "kg", kilos: "kg", kilogram: "kg", kilograms: "kg", kilogramme: "kg",
  "किलो": "kg", "केजी": "kg", "के.जी.": "kg", "किलोग्राम": "kg",
  g: "g", gm: "g", gms: "g", gram: "g", grams: "g", gr: "g", "ग्राम": "g",
  l: "litre", lt: "litre", ltr: "litre", ltrs: "litre", litre: "litre", litres: "litre", liter: "litre", liters: "litre",
  "लिटर": "litre", "लि.": "litre",
  ml: "ml", mls: "ml", "मिलि": "ml",
  pc: "pcs", pcs: "pcs", piece: "pcs", pieces: "pcs", nos: "pcs", no: "pcs", unit: "pcs", units: "pcs",
  "गोटा": "pcs", "वटा": "pcs", "ओटा": "pcs", "थान": "pcs", "पिस": "pcs",
  pkt: "packet", pkts: "packet", packet: "packet", packets: "packet", pack: "packet", packs: "packet", "प्याकेट": "packet",
  dozen: "dozen", dozens: "dozen", dz: "dozen", doz: "dozen", "दर्जन": "dozen",
  bag: "bag", bags: "bag", bora: "bag", boras: "bag", sack: "bag", sacks: "bag", "बोरा": "bag", "बोरी": "bag",
  bottle: "bottle", bottles: "bottle", btl: "bottle", "बोतल": "bottle",
  box: "box", boxes: "box", carton: "box", cartons: "box", "बट्टा": "box",
  m: "meter", meter: "meter", meters: "meter", metre: "meter", metres: "meter", mtr: "meter", mtrs: "meter", "मिटर": "meter",
  ft: "ft", feet: "ft", foot: "ft", "फिट": "ft",
  roll: "roll", rolls: "roll", "रोल": "roll",
  bundle: "bundle", bundles: "bundle", "मुठा": "bundle",
};

// Written-out numbers and fractions.
const NUMBER_WORDS: Record<string, number> = {
  half: 0.5, "आधा": 0.5, quarter: 0.25, "पाउ": 0.25,
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, twelve: 12, twenty: 20,
  "एक": 1, "दुई": 2, "तीन": 3, "चार": 4, "पाँच": 5, "पाच": 5, "छ": 6, "सात": 7, "आठ": 8, "नौ": 9, "दस": 10, "बाह्र": 12, "बीस": 20,
};

// When no unit is written, guess a sensible one from the item.
const DEFAULT_UNIT: [RegExp, Unit][] = [
  [/\b(rice|chamal|dal|daal|lentil|sugar|chini|flour|atta|maida|salt|nun|potato|aalu|alu|onion|pyaj|tomato|chiura|beaten rice|gram|chana|rajma|tea|chiya|coffee)\b|चामल|दाल|चिनी|पिठो|आटा|नुन|आलु|प्याज|गोलभेडा|चिउरा|चिया/i, "kg"],
  [/\b(oil|tel|ghee|milk|dudh)\b|तेल|घ्यू|दुध/i, "litre"],
  [/\b(eggs?|anda|banana|kera)\b|अण्डा|केरा/i, "dozen"],
  [/\b(cement)\b|सिमेन्ट/i, "bag"],
  [/\b(wire|cable)\b|तार/i, "meter"],
  [/\b(noodles?|wai ?wai|biscuits?|chips|masala|soap|shampoo)\b|चाउचाउ|बिस्कुट|साबुन/i, "packet"],
];

const DEVANAGARI_DIGITS = "०१२३४५६७८९";
const FRACTIONS: Record<string, string> = { "½": ".5", "¼": ".25", "¾": ".75" };

function normalizeDigits(s: string): string {
  return s
    .replace(/[०-९]/g, (d) => String(DEVANAGARI_DIGITS.indexOf(d)))
    .replace(/(\d+)\s*([½¼¾])/g, (_, whole: string, f: string) => whole + FRACTIONS[f]) // 1½ → 1.5
    .replace(/[½¼¾]/g, (f) => "0" + FRACTIONS[f]); // ½ → 0.5
}

/** "1/2" → 0.5, "1 1/2" → 1.5, "2.5" → 2.5, "1,000" → 1000, "half" → 0.5 */
function toNumber(raw: string): number | null {
  const s = raw.trim().toLowerCase();
  if (s in NUMBER_WORDS) return NUMBER_WORDS[s];
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return Number(frac[2]) ? Number(frac[1]) / Number(frac[2]) : null;
  const n = Number(s.replace(/,(?=\d{3}\b)/g, ""));
  return Number.isFinite(n) ? n : null;
}

const NUM = String.raw`(?:\d+\s+\d+\/\d+|\d+\/\d+|\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?|${Object.keys(NUMBER_WORDS).join("|")})`;
const UNIT = `(?:${Object.keys(UNIT_WORDS)
  .sort((a, b) => b.length - a.length)
  .map((u) => u.replace(/\./g, "\\."))
  .join("|")})`;
// "word boundary" that also works next to Devanagari letters.
const END = String.raw`(?=$|[\s,.;:)\-–])`;
const START = String.raw`(?:^|(?<=[\s(]))`;

const LEADING = new RegExp(String.raw`^(${NUM})\s*(${UNIT})?${END}\s*(?:x\s+|of\s+|का\s+|को\s+)?(.+)$`, "i");
const TRAILING = new RegExp(String.raw`^(.+?)\s*[-–:=,]?\s*${START}(?:x\s*)?(${NUM})\s*(${UNIT})?\.?$`, "i");
const TIMES_AFTER = /^(.+?)\s*[x×*]\s*(\d+(?:\.\d+)?)$/i; // soap x3
const TIMES_BEFORE = /^(\d+(?:\.\d+)?)\s*[x×*]\s*(.+)$/i; // 3x soap

function unitFor(word: string | undefined): Unit | null {
  return word ? (UNIT_WORDS[word.toLowerCase()] ?? null) : null;
}

export function guessUnit(name: string): Unit {
  for (const [re, unit] of DEFAULT_UNIT) if (re.test(name)) return unit;
  return "pcs";
}

function tidyName(s: string): string {
  return s
    .replace(/^[\s\-–:=,.]+|[\s\-–:=,]+$/g, "")
    .replace(/\s{2,}/g, " ")
    .slice(0, 80);
}

/** Parses one line. Returns null for blank lines. */
export function parseLine(input: string): ParsedItem | null {
  let line = normalizeDigits(input)
    .replace(/^\s*(?:[-*•·◦▪]|\d+[.)](?=\s)|\[\s?[x ]?\])\s*/i, "") // bullets, "1." numbering, checkboxes
    .trim();
  if (!line) return null;

  let m = line.match(TIMES_BEFORE);
  if (m && !unitFor(m[2].split(/\s+/)[0])) return { name: tidyName(m[2]), quantity: Number(m[1]), unit: guessUnit(m[2]) };
  m = line.match(TIMES_AFTER);
  if (m) return { name: tidyName(m[1]), quantity: Number(m[2]), unit: guessUnit(m[1]) };

  m = line.match(LEADING);
  if (m) {
    const qty = toNumber(m[1]);
    const name = tidyName(m[3]);
    if (qty && name) return { name, quantity: qty, unit: unitFor(m[2]) ?? guessUnit(name) };
  }

  m = line.match(TRAILING);
  if (m) {
    const qty = toNumber(m[2]);
    const name = tidyName(m[1]);
    const unit = unitFor(m[3]);
    // A bare trailing number with no unit is only a quantity when it's clearly
    // separated ("rice - 5", "soap: 3"), otherwise it's probably a size or model
    // ("Wai Wai 75", "pipe 20").
    const separated = /[-–:=,]\s*\S+\s*$/.test(line.slice(m[1].length));
    if (qty && name && (unit || separated)) return { name, quantity: qty, unit: unit ?? guessUnit(name) };
  }

  const name = tidyName(line);
  return name ? { name, quantity: 1, unit: guessUnit(name) } : null;
}

/**
 * Parses a whole list. Lines can also be separated by commas or semicolons.
 * The same item written twice with the same unit is combined.
 */
export function parseList(text: string, max = 100): ParsedItem[] {
  const pieces = text
    .split(/\r?\n|;|,(?!\d{3}\b)(?=\s*\D)/) // keep "1,000" together
    .map((p) => p.trim())
    .filter(Boolean);

  const out: ParsedItem[] = [];
  for (const piece of pieces) {
    const item = parseLine(piece);
    if (!item) continue;
    const same = out.find((o) => o.name.toLowerCase() === item.name.toLowerCase() && o.unit === item.unit);
    if (same) same.quantity = Math.round((same.quantity + item.quantity) * 1000) / 1000;
    else out.push(item);
    if (out.length >= max) break;
  }
  return out;
}

const HARDWARE = /\b(cement|pipe|pvc|gi|nails?|screws?|bolts?|nuts?|putty|paint|primer|wire|cable|tap|valve|elbow|socket|rod|sariya|sand|brick|tiles?|hinges?|locks?|bulbs?|switch|mcb|fevicol|glue|adhesive|drill|hammer|tape|plywood|sheet|tin|jasta|teflon|sealant|brush|roller)\b|सिमेन्ट|पाइप|किला|पेन्ट|तार|छड|इँटा|बालुवा/i;

/** Guesses whether a list is for a grocery or a hardware shop. */
export function guessCategory(items: { name: string }[]): "grocery" | "hardware" {
  const hw = items.filter((i) => HARDWARE.test(i.name)).length;
  return hw > items.length / 2 ? "hardware" : "grocery";
}
