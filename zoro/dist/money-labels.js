export const incomeSources = [
  "Job / salary",
  "Freelance",
  "Business",
  "Pension",
  "Benefits",
  "Rental income",
  "Gift",
  "Refund",
  "Interest",
  "Transfer from savings",
  "Other income",
];
const labels = {
  EUR: ["Euro", "€"],
  GBP: ["British pound", "£"],
  USD: ["US dollar", "$"],
  NGN: ["Nigerian naira", "₦"],
  GHS: ["Ghanaian cedi", "GH₵"],
  KES: ["Kenyan shilling", "KSh"],
  ZAR: ["South African rand", "R"],
  UGX: ["Ugandan shilling", "USh"],
  TZS: ["Tanzanian shilling", "TSh"],
  XOF: ["West African CFA franc", "CFA"],
  XAF: ["Central African CFA franc", "FCFA"],
  RWF: ["Rwandan franc", "RF"],
  EGP: ["Egyptian pound", "E£"],
  MAD: ["Moroccan dirham", "DH"],
};
export function currencyLabel(code) {
  const label = labels[code];
  return label ? `${label[0]} (${label[1]}) · ${code}` : code;
}
