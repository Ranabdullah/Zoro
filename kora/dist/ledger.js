export const currencies = [
  "GBP",
  "EUR",
  "USD",
  "NGN",
  "GHS",
  "KES",
  "ZAR",
  "UGX",
  "TZS",
  "XOF",
  "XAF",
  "RWF",
  "EGP",
  "MAD",
];
export const emptyState = () => ({
  name: "My",
  currency: "EUR",
  accounts: [],
  entries: [],
  receipts: [],
  debts: [],
});
export function minor(value, currency = "GBP") {
  const digits = new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).resolvedOptions().maximumFractionDigits;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || number > 1e10)
    throw Error("Enter a valid positive amount.");
  const scale = 10 ** digits;
  if (Math.abs(number * scale - Math.round(number * scale)) > 0.00001)
    throw Error(`Use at most ${digits} decimal places for ${currency}.`);
  return Math.round(number * scale);
}
export function balance(state, id) {
  const a = state.accounts.find((a) => a.id === id);
  if (!a) return 0;
  return state.entries
    .filter((e) => e.account === id)
    .reduce(
      (sum, e) => sum + (e.kind === "income" ? e.amount : -e.amount),
      a.opening,
    );
}
export function format(amount, currency = "GBP") {
  const digits = new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).resolvedOptions().maximumFractionDigits;
  return new Intl.NumberFormat("en-GB", {
    style: "currency",
    currency,
    maximumFractionDigits: digits,
  }).format(amount / 10 ** digits);
}
export function toEuro(amount, currency, rates) {
  if (currency === "EUR") return amount;
  const rate = rates[currency]?.rate;
  if (!Number.isFinite(rate) || rate <= 0) return null;
  const digits = new Intl.NumberFormat("en", {
    style: "currency",
    currency,
  }).resolvedOptions().maximumFractionDigits;
  return (amount / 10 ** digits / rate) * 100;
}
export function addEntry(state, entry) {
  if (!state.accounts.some((a) => a.id === entry.account))
    throw Error("Choose an account first.");
  if (!Number.isSafeInteger(entry.amount) || entry.amount <= 0)
    throw Error("Enter an amount greater than zero.");
  if (!["expense", "income"].includes(entry.kind))
    throw Error("Invalid transaction type.");
  return { ...state, entries: [entry, ...state.entries] };
}
