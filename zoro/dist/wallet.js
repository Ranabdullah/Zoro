// Shared account presentation rules. Only validated values become CSS variables.
const legacy = { green: "#2a5147", sand: "#e9dcc2", dark: "#333d3d" };
export const cardColours = [
  "#244f43",
  "#e9dcc2",
  "#263b5b",
  "#704057",
  "#c45c38",
  "#24282c",
  "#b9d7cc",
  "#d8d4ec",
];
export const cardPatterns = ["orbit", "weave", "contour", "solid"];
// Only locally re-encoded JPEG data can be rendered, never remote URLs or SVG.
export function safeCardImage(value) {
  return typeof value === "string" &&
    value.length <= 140000 &&
    /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
    ? value
    : "";
}
export function safeColour(value) {
  return /^#[\da-f]{6}$/i.test(value || "")
    ? value.toLowerCase()
    : legacy[value] || legacy.green;
}
export function luminance(hex) {
  const c = safeColour(hex)
    .slice(1)
    .match(/../g)
    .map((v) => parseInt(v, 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722;
}
export function contrast(a, b) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
export function cardAppearance(account) {
  const colour = safeColour(account.colour || account.color);
  const white = contrast(colour, "#ffffff");
  const dark = contrast(colour, "#111111");
  const ink =
    white >= dark && white >= 4.5
      ? "#ffffff"
      : dark >= 4.5
        ? "#111111"
        : "#000000";
  return {
    colour,
    ink,
    art: ink === "#ffffff" ? "#000000" : "#ffffff",
    pattern: cardPatterns.includes(account.pattern) ? account.pattern : "orbit",
  };
}
export function accountLocation(account) {
  if (account.region) return account.region;
  const country = {
    EUR: "Ireland / euro",
    NGN: "Nigeria",
    GHS: "Ghana",
    KES: "Kenya",
    ZAR: "South Africa",
    UGX: "Uganda",
    TZS: "Tanzania",
    RWF: "Rwanda",
    XOF: "West Africa",
    XAF: "Central Africa",
    EGP: "Egypt",
    MAD: "Morocco",
    GBP: "United Kingdom",
    USD: "US dollar",
  };
  return country[account.currency] || account.currency;
}
