import { currencies, emptyState } from "./ledger.js";

export function validateBackup(input) {
  if (!input || typeof input !== "object")
    throw Error("Invalid wallet backup.");
  for (const key of ["accounts", "entries", "receipts", "debts"]) {
    if (!Array.isArray(input[key]) || input[key].length > 20000)
      throw Error("Invalid backup section.");
    const ids = new Set();
    for (const record of input[key]) {
      if (
        !record ||
        typeof record.id !== "string" ||
        !/^[\w-]{1,80}$/.test(record.id) ||
        ids.has(record.id)
      )
        throw Error("Invalid or duplicate record ID.");
      ids.add(record.id);
    }
  }
  const string = (value, max) =>
    typeof value === "string" && value.length <= max;
  const amount = (value) =>
    Number.isSafeInteger(value) && value >= 0 && value <= 1e15;
  const date = (value) =>
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value));
  const accounts = input.accounts.map((a) => {
    if (
      !string(a.name, 100) ||
      !string(a.provider, 100) ||
      !currencies.includes(a.currency) ||
      !amount(a.opening) ||
      !["Card", "Account", "Mobile money", "Cash"].includes(a.kind)
    )
      throw Error("Invalid account.");
    return {
      id: a.id,
      name: a.name,
      provider: a.provider,
      currency: a.currency,
      opening: a.opening,
      kind: a.kind,
      last4: /^\d{4}$/.test(a.last4) ? a.last4 : "",
      colour: a.colour || a.color,
      pattern: a.pattern,
    };
  });
  const accountIds = new Set(accounts.map((a) => a.id));
  const entries = input.entries.map((e) => {
    if (
      !accountIds.has(e.account) ||
      !amount(e.amount) ||
      !["expense", "income"].includes(e.kind) ||
      !date(e.date) ||
      !string(e.shop, 100) ||
      !string(e.note || "", 500) ||
      !string(e.category || "", 100)
    )
      throw Error("Invalid transaction.");
    return {
      id: e.id,
      account: e.account,
      amount: e.amount,
      kind: e.kind,
      date: e.date,
      shop: e.shop,
      note: e.note || "",
      category: e.category || "Other",
    };
  });
  const entryIds = new Set(entries.map((e) => e.id));
  const receipts = input.receipts.map((r) => {
    if (
      !string(r.shop, 100) ||
      !date(r.date) ||
      !string(r.note || "", 500) ||
      typeof r.image !== "string" ||
      !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(r.image) ||
      r.image.length > 2800000
    )
      throw Error("Invalid receipt image or metadata.");
    return {
      id: r.id,
      entry: entryIds.has(r.entry) ? r.entry : null,
      shop: r.shop,
      note: r.note || "",
      date: r.date,
      image: r.image,
    };
  });
  const debts = input.debts.map((d) => {
    if (
      !string(d.name, 100) ||
      !amount(d.amount) ||
      !currencies.includes(d.currency) ||
      !["I owe", "Owed to me"].includes(d.direction) ||
      !date(d.date) ||
      !string(d.note || "", 500)
    )
      throw Error("Invalid debt.");
    return {
      id: d.id,
      name: d.name,
      amount: d.amount,
      currency: d.currency,
      direction: d.direction,
      date: d.date,
      note: d.note || "",
      paid: d.paid === true,
    };
  });
  return {
    ...emptyState(),
    name: string(input.name, 100) ? input.name : "My",
    currency: currencies.includes(input.currency) ? input.currency : "EUR",
    accounts,
    entries,
    receipts,
    debts,
  };
}

export function removeData(state, section, id) {
  const next = structuredClone(state);
  if (section === "all")
    return { ...emptyState(), __revision: state.__revision };
  if (!["accounts", "entries", "receipts", "debts"].includes(section))
    throw Error("Unknown section.");
  next[section] = id ? next[section].filter((item) => item.id !== id) : [];
  if (section === "accounts") {
    const ids = new Set(next.accounts.map((a) => a.id));
    next.entries = next.entries.filter((e) => ids.has(e.account));
  }
  if (section === "accounts" || section === "entries") {
    const ids = new Set(next.entries.map((e) => e.id));
    // Retain receipt photos as unattached records for future reference.
    next.receipts = next.receipts.map((r) => ({
      ...r,
      entry: ids.has(r.entry) ? r.entry : null,
    }));
  }
  return next;
}
