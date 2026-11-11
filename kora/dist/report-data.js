export function reportRows(state, filters = {}) {
  if (filters.from && filters.to && filters.from > filters.to)
    throw Error("The end date must be after the start date.");
  const accounts = new Map(state.accounts.map(account => [account.id, account]));
  return state.entries.filter(entry =>
    (!filters.from || entry.date >= filters.from) &&
    (!filters.to || entry.date <= filters.to) &&
    (!filters.account || entry.account === filters.account) &&
    (filters.scope !== "receipts" || (entry.kind === "expense" && state.receipts.some(receipt => receipt.entry === entry.id)))
  ).map(entry => {
    const account = accounts.get(entry.account);
    if (!account) throw Error("A transaction has no matching account.");
    const receipts = state.receipts.filter(receipt => receipt.entry === entry.id);
    return {
      date: entry.date, shop: entry.shop, account: account.name,
      currency: account.currency, amount: entry.amount, kind: entry.kind,
      category: entry.category || "", note: entry.note || "",
      receiptCount: receipts.length, reference: entry.id,
    };
  }).sort((a, b) => a.date.localeCompare(b.date));
}
export function reportTotals(rows) {
  const totals = new Map();
  for (const row of rows) {
    const total = totals.get(row.currency) || {currency: row.currency, income: 0, expenses: 0, receiptedExpenses: 0};
    if (row.kind === "income") total.income += row.amount;
    else {
      total.expenses += row.amount;
      if (row.receiptCount) total.receiptedExpenses += row.amount;
    }
    totals.set(row.currency, total);
  }
  return [...totals.values()];
}
export function major(amount, currency) {
  const digits = new Intl.NumberFormat("en", {style: "currency", currency}).resolvedOptions().maximumFractionDigits;
  return amount / 10 ** digits;
}
