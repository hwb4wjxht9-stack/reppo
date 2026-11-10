// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { guessCategory, parseLine, parseList } from "../lib/parseList.ts";
import { parseLocation } from "../lib/location.ts";
import { formatNepalPhone, normalizeNepalPhone } from "../lib/phone.ts";

const cases: [string, string, number, string][] = [
  // input, name, quantity, unit
  ["25 kg rice", "rice", 25, "kg"],
  ["25kg rice", "rice", 25, "kg"],
  ["rice 25kg", "rice", 25, "kg"],
  ["rice - 25 kg", "rice", 25, "kg"],
  ["Rice: 25 kilo", "Rice", 25, "kg"],
  ["2 litre mustard oil", "mustard oil", 2, "litre"],
  ["mustard oil 2 ltr", "mustard oil", 2, "litre"],
  ["500g jeera", "jeera", 500, "g"],
  ["eggs 2 dozen", "eggs", 2, "dozen"],
  ["1/2 kg tea", "tea", 0.5, "kg"],
  ["half kg tea", "tea", 0.5, "kg"],
  ["1 1/2 kg sugar", "sugar", 1.5, "kg"],
  ["½ kg ghee", "ghee", 0.5, "kg"],
  ["1½ kg sugar", "sugar", 1.5, "kg"],
  ["soap x3", "soap", 3, "packet"],
  ["3 x soap", "soap", 3, "packet"],
  ["3 soap", "soap", 3, "packet"],
  ["- 5 kg masoor dal", "masoor dal", 5, "kg"],
  ["1. 5 kg masoor dal", "masoor dal", 5, "kg"],
  ["sugar", "sugar", 1, "kg"],
  ["mustard oil", "mustard oil", 1, "litre"],
  ["eggs", "eggs", 1, "dozen"],
  ["Wai Wai noodles", "Wai Wai noodles", 1, "packet"],
  ["rice - 5", "rice", 5, "kg"],
  // Nepali
  ["५ किलो चिनी", "चिनी", 5, "kg"],
  ["चामल २५ किलो", "चामल", 25, "kg"],
  ["आधा किलो जिरा", "जिरा", 0.5, "kg"],
  ["२ लिटर तेल", "तेल", 2, "litre"],
  ["दुई दर्जन अण्डा", "अण्डा", 2, "dozen"],
  ["चिनी", "चिनी", 1, "kg"],
  // hardware
  ["cement 2 bora", "cement", 2, "bag"],
  ["10 bags cement", "cement", 10, "bag"],
  ["PVC pipe ½ inch 10 pcs", "PVC pipe 0.5 inch", 10, "pcs"],
  ["PVC pipe 1/2 inch", "PVC pipe 1/2 inch", 1, "pcs"],
  ["wire 2.5mm 50 m", "wire 2.5mm", 50, "meter"],
  ["2 kg nails 3 inch", "nails 3 inch", 2, "kg"],
  ["wall putty 20 kg", "wall putty", 20, "kg"],
  ["screws 1,000 pcs", "screws", 1000, "pcs"],
];

for (const [input, name, quantity, unit] of cases) {
  test(`parses “${input}”`, () => {
    assert.deepEqual(parseLine(input), { name, quantity, unit });
  });
}

test("blank lines are skipped", () => {
  assert.equal(parseLine("   "), null);
  assert.deepEqual(parseList("\n\n  \n"), []);
});

test("commas and semicolons split items, but 1,000 stays one number", () => {
  assert.deepEqual(
    parseList("rice 5kg, sugar 2 kg; 1,000 pcs screws").map((i) => [i.name, i.quantity, i.unit]),
    [
      ["rice", 5, "kg"],
      ["sugar", 2, "kg"],
      ["screws", 1000, "pcs"],
    ],
  );
});

test("the same item twice is combined", () => {
  assert.deepEqual(parseList("rice 5 kg\nRice 2 kg\nrice 1 bag"), [
    { name: "rice", quantity: 7, unit: "kg" },
    { name: "rice", quantity: 1, unit: "bag" },
  ]);
});

test("lists are capped", () => {
  assert.equal(parseList(Array.from({ length: 150 }, (_, i) => `item ${i}`).join("\n")).length, 100);
});

test("category guess", () => {
  assert.equal(guessCategory(parseList("rice 5 kg\nsugar 2 kg")), "grocery");
  assert.equal(guessCategory(parseList("cement 2 bora\nPVC pipe 10 pcs\nputty 20 kg")), "hardware");
});

test("locations", () => {
  assert.deepEqual(parseLocation("27.7172, 85.3240"), { lat: 27.7172, lng: 85.324 });
  assert.deepEqual(parseLocation("85.3240, 27.7172"), { lat: 27.7172, lng: 85.324 });
  assert.deepEqual(parseLocation("https://www.google.com/maps/place/X/@27.70,85.30,17z/data=!3d27.7213!4d85.3714"), {
    lat: 27.7213,
    lng: 85.3714,
  });
  assert.deepEqual(parseLocation("https://maps.google.com/?q=27.71,85.32"), { lat: 27.71, lng: 85.32 });
  assert.equal(parseLocation(""), null);
  assert.ok("error" in (parseLocation("51.5, -0.12") as object));
  assert.ok("error" in (parseLocation("https://maps.app.goo.gl/xyz") as object));
});

test("phones", () => {
  assert.equal(normalizeNepalPhone("984-141-9910"), "+9779841419910");
  assert.equal(normalizeNepalPhone("01-4123456"), "+97714123456");
  assert.equal(normalizeNepalPhone("12345"), null);
  assert.equal(normalizeNepalPhone(formatNepalPhone("+9779841419910")), "+9779841419910");
});
