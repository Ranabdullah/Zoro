import test from "node:test";
import assert from "node:assert/strict";
import {
  cardAppearance,
  contrast,
  safeColour,
  accountLocation,
  safeCardImage,
} from "../dist/wallet.js";
import { currencies } from "../dist/ledger.js";
import { currencyLabel } from "../dist/money-labels.js";
test("card backgrounds accept bounded JPEG data only, and every currency has a descriptive label", () => {
  assert.equal(
    safeCardImage("data:image/jpeg;base64,/9j/"),
    "data:image/jpeg;base64,/9j/",
  );
  for (const value of [
    "https://example.com/image.jpg",
    "data:image/svg+xml;base64,PHN2Zz4=",
    'data:image/jpeg;base64,\" onerror=alert(1)',
    "data:image/jpeg;base64," + "a".repeat(140001),
  ])
    assert.equal(safeCardImage(value), "");
  for (const code of currencies)
    assert.ok(
      currencyLabel(code).includes("(") && currencyLabel(code).endsWith(code),
    );
});
test("automatic card text meets 4.5:1 contrast across dark, pale and intermediate backgrounds", () => {
  for (let r = 0; r <= 255; r += 17)
    for (let g = 0; g <= 255; g += 17)
      for (let b = 0; b <= 255; b += 17) {
        const colour =
          "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");
        const look = cardAppearance({ colour });
        assert.ok(contrast(look.colour, look.ink) >= 4.5, colour);
      }
});
test("untrusted colour and pattern values cannot inject CSS", () => {
  const look = cardAppearance({
    colour: "red; background:url(https://example.com)",
    pattern: '" onclick="alert(1)',
  });
  assert.equal(look.colour, "#2a5147");
  assert.equal(look.pattern, "orbit");
  assert.equal(safeColour("#AABBCC"), "#aabbcc");
});
test("existing sample cards retain their colours and locations", () => {
  assert.equal(cardAppearance({ color: "sand" }).colour, "#e9dcc2");
  assert.equal(accountLocation({ currency: "KES" }), "Kenya");
  assert.equal(accountLocation({ currency: "EUR" }), "Ireland / euro");
});
