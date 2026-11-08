// All data in this file is FAKE. It exists so the prototype can be tapped
// through end to end. Later steps replace it with Supabase + real calls.

export type Category = "grocery" | "hardware";

export type Shop = {
  id: string;
  name: string;
  area: string;
  address: string;
  phone: string;
  category: Category;
  closes: string;
  /** Our own rating from past pickups. null = no pickups yet. */
  ourRating: number | null;
  pickups: number;
};

export type ListItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
};

export type Quote = {
  shopId: string;
  itemId: string;
  /** Price per unit the shop first asked. */
  askedPrice: number;
  /** Price per unit after the AI bargained. */
  finalPrice: number;
  available: boolean;
};

export const SHOPS: Shop[] = [
  {
    id: "s1",
    name: "Shrestha Kirana Pasal",
    area: "Baneshwor",
    address: "Old Baneshwor Chowk, near Shankhamul road",
    phone: "01-4xxxxxx",
    category: "grocery",
    closes: "8:30 PM",
    ourRating: 4.6,
    pickups: 12,
  },
  {
    id: "s2",
    name: "Maharjan General Store",
    area: "Kalimati",
    address: "Kalimati, opposite the vegetable market gate",
    phone: "01-4xxxxxx",
    category: "grocery",
    closes: "9:00 PM",
    ourRating: 4.1,
    pickups: 7,
  },
  {
    id: "s3",
    name: "Bhatbhateni Corner Mart",
    area: "Chabahil",
    address: "Chabahil Chowk, Ring Road side",
    phone: "01-4xxxxxx",
    category: "grocery",
    closes: "8:00 PM",
    ourRating: null,
    pickups: 0,
  },
  {
    id: "s4",
    name: "Thapa Suppliers",
    area: "Koteshwor",
    address: "Koteshwor, behind the petrol pump",
    phone: "01-5xxxxxx",
    category: "grocery",
    closes: "7:30 PM",
    ourRating: 3.8,
    pickups: 4,
  },
];

export const POPULAR_SEARCHES: { label: string; category: Category }[] = [
  { label: "Rice (Jeera Masino)", category: "grocery" },
  { label: "Mustard oil", category: "grocery" },
  { label: "Masoor dal", category: "grocery" },
  { label: "Sugar", category: "grocery" },
  { label: "PVC pipe ½ inch", category: "hardware" },
  { label: "Cement (OPC)", category: "hardware" },
  { label: "Wall putty", category: "hardware" },
  { label: "Screws & nails", category: "hardware" },
];

/** What the "photo of a list" turns into in the prototype. */
export const SAMPLE_LIST: ListItem[] = [
  { id: "i1", name: "Jeera Masino rice", quantity: 25, unit: "kg" },
  { id: "i2", name: "Mustard oil", quantity: 2, unit: "litre" },
  { id: "i3", name: "Masoor dal", quantity: 5, unit: "kg" },
  { id: "i4", name: "Sugar", quantity: 3, unit: "kg" },
  { id: "i5", name: "Tea (CTC)", quantity: 1, unit: "kg" },
];

/** Typical Kathmandu asking prices (Rs. per unit) used to fake quotes. */
const BASE_PRICE: Record<string, number> = {
  rice: 105,
  oil: 330,
  dal: 175,
  sugar: 115,
  tea: 560,
};

function baseFor(name: string): number {
  const n = name.toLowerCase();
  for (const key of Object.keys(BASE_PRICE)) {
    if (n.includes(key)) return BASE_PRICE[key];
  }
  return 150;
}

// Small deterministic "random" so the same list always gives the same quotes.
function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h;
}

export function fakeQuotes(items: ListItem[]): Quote[] {
  const quotes: Quote[] = [];
  for (const shop of SHOPS) {
    for (const item of items) {
      const h = hash(shop.id + item.name);
      const asked = Math.round(baseFor(item.name) * (0.95 + (h % 20) / 100));
      const discount = 0.03 + ((h >> 5) % 9) / 100; // 3–11% off after bargaining
      quotes.push({
        shopId: shop.id,
        itemId: item.id,
        askedPrice: asked,
        finalPrice: Math.round(asked * (1 - discount)),
        // Roughly 1 in 8 items is out of stock somewhere.
        available: (h >> 9) % 8 !== 0,
      });
    }
  }
  return quotes;
}

export const FEE = 50; // Rs. per order in the prototype

/** Fake call transcript. The AI always says it is an AI at the start. */
export function fakeTranscript(shop: Shop, items: ListItem[]): { who: "ai" | "shop"; ne: string; en: string }[] {
  const first = items[0];
  return [
    {
      who: "ai",
      ne: `नमस्ते, म एउटा AI सहायक हुँ। म एक ग्राहकको तर्फबाट फोन गर्दैछु।`,
      en: "Hello, I'm an AI assistant calling on behalf of a customer.",
    },
    { who: "shop", ne: "हजुर, भन्नुस्।", en: "Yes, go ahead." },
    {
      who: "ai",
      ne: `${first ? `${first.quantity} ${first.unit} ${first.name}` : "सामान"} को कति पर्छ?`,
      en: `How much for ${first ? `${first.quantity} ${first.unit} of ${first.name}` : "the items"}?`,
    },
    { who: "shop", ne: "किलोको १०८ पर्छ।", en: "It's 108 per kilo." },
    {
      who: "ai",
      ne: "धेरै लिँदैछु, अलिकति मिलाउन मिल्छ कि?",
      en: "I'm buying a lot — could you adjust it a little?",
    },
    { who: "shop", ne: "ल, १०२ मा दिन्छु।", en: "Okay, I'll give it at 102." },
    {
      who: "ai",
      ne: `धन्यवाद! पसल कति बजे बन्द हुन्छ?`,
      en: "Thank you! What time does the shop close?",
    },
    { who: "shop", ne: `${shop.closes} मा।`, en: `At ${shop.closes}.` },
  ];
}

export function rs(n: number): string {
  return "Rs. " + n.toLocaleString("en-IN");
}
