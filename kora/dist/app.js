import * as cloud from "./cloud.js";
import {
  cardAppearance,
  cardColours,
  cardPatterns,
  accountLocation,
} from "./wallet.js";
import {
  currencies,
  emptyState,
  minor,
  balance,
  format,
  addEntry,
  toEuro,
} from "./ledger.js";
const $ = (s) => document.querySelector(s),
  esc = (v) =>
    String(v ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const demoKey = "kora-demo-v1";
let page = "Home",
  state,
  person = null,
  fx = {},
  fxStatus = "Loading rates…",
  busy = false,
  formType = "",
  editingAccount = null,
  selectedAccount = null,
  urls = [];
function demo() {
  const day = today();
  return {
    name: "My",
    currency: "EUR",
    accounts: [
      {
        id: "a",
        name: "Everyday",
        provider: "Irish euro account",
        currency: "EUR",
        opening: 324000,
        last4: "4829",
        kind: "Card",
        color: "green",
      },
      {
        id: "b",
        name: "Back home",
        provider: "Nigerian bank account",
        currency: "NGN",
        opening: 185000000,
        last4: "9062",
        kind: "Account",
        color: "sand",
      },
      {
        id: "c",
        name: "Mobile money",
        provider: "Kenyan mobile wallet",
        currency: "KES",
        opening: 8650000,
        last4: "",
        kind: "Mobile money",
        color: "dark",
      },
    ],
    entries: [
      {
        id: "1",
        shop: "Lidl",
        amount: 4865,
        account: "a",
        kind: "expense",
        category: "Groceries",
        date: day,
        note: "Weekly groceries",
      },
      {
        id: "2",
        shop: "Coffee on the way",
        amount: 420,
        account: "a",
        kind: "expense",
        category: "Food & drink",
        date: day,
        note: "",
      },
      {
        id: "3",
        shop: "Dublin Bus",
        amount: 240,
        account: "a",
        kind: "expense",
        category: "Transport",
        date: day,
        note: "",
      },
      {
        id: "4",
        shop: "Monthly pay",
        amount: 245000,
        account: "a",
        kind: "income",
        category: "Income",
        date: day,
        note: "",
      },
    ],
    receipts: [],
    debts: [
      {
        id: "d",
        name: "Family loan",
        amount: 15000,
        currency: "EUR",
        direction: "I owe",
        date: day,
        note: "Sample entry",
        paid: false,
      },
    ],
  };
}
function toast(t) {
  $("#toast").textContent = t;
  $("#toast").style.display = "block";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => ($("#toast").style.display = "none"), 4000);
}
function cash(n, c = "EUR") {
  return `<span class="money">${esc(format(n, c))}</span>`;
}
function euro(n, c) {
  return toEuro(n, c, fx);
}
function estimated(n, c) {
  const v = euro(n, c);
  return v === null
    ? "Euro estimate unavailable"
    : `≈ ${format(Math.round(v), "EUR")} · ${fx[c]?.date || today()}`;
}
function total(items) {
  let n = 0,
    missing = 0;
  for (const item of items) {
    const v = euro(item.amount, item.currency);
    if (v === null) missing++;
    else n += v;
  }
  return { n: Math.round(n), missing };
}
async function rates() {
  try {
    const response = await fetch(
      "https://api.frankfurter.dev/v2/rates?base=EUR&quotes=" +
        currencies.filter((c) => c !== "EUR").join(","),
      {
        signal: AbortSignal.timeout(10000),
        credentials: "omit",
        referrerPolicy: "no-referrer",
      },
    );
    if (!response.ok) throw Error();
    const rows = await response.json();
    if (!Array.isArray(rows)) throw Error();
    fx = {};
    for (const r of rows) {
      const quote = String(r.quote).toUpperCase();
      if (
        currencies.includes(quote) &&
        Number(r.rate) > 0 &&
        /^\d{4}-\d{2}-\d{2}$/.test(r.date)
      )
        fx[quote] = { rate: Number(r.rate), date: r.date };
    }
    fxStatus = "Latest available reference rates";
  } catch {
    fxStatus = "Rates unavailable · euro totals may be incomplete";
  }
  if (state) render();
}
function heading(title, sub, buttons = "") {
  return `<div class="page-heading"><div><div class="eyebrow">A LITTLE CLARITY, EVERY DAY</div><h1>${title}</h1><p class="subtitle">${sub}</p></div><div class="actions">${buttons}</div></div>`;
}
const expenseButton =
  '<button class="primary" data-action="expense">＋ Add expense</button>';
function card(
  a,
  { interactive = true, index = 0, amount = balance(state, a.id) } = {},
) {
  const look = cardAppearance(a);
  const tag = interactive ? "button" : "div";
  return `<${tag} class="bank-card wallet-card pattern-${look.pattern}" style="--card-bg:${look.colour};--card-ink:${look.ink};--card-art:${look.art};--card-index:${index}" ${interactive ? `data-account="${esc(a.id)}" aria-label="Open ${esc(a.name)} account details"` : ""}>
    <span class="card-art" aria-hidden="true"></span>
    <span class="card-top"><b>${esc(a.name)}</b><span class="currency-badge">${esc(a.currency)}</span></span>
    <span class="card-provider">${esc(a.provider)}<span>${esc(accountLocation(a))}</span></span>
    <span class="card-bottom"><span><span class="card-label">Available balance</span><strong>${cash(amount, a.currency)}</strong></span><span class="card-kind">${esc(a.kind)}</span></span>
    <span class="card-tail"><span>${a.currency !== "EUR" ? `<span class="money">${esc(estimated(amount, a.currency))}</span>` : "YOUR EVERYDAY MONEY"}</span><span aria-hidden="true">◔</span></span>
  </${tag}>`;
}
function wallet() {
  if (!state.accounts.length)
    return '<section class="wallet-empty panel"><div class="wallet-empty-icon">▣</div><h2>Your wallet starts here.</h2><p>Add your euro account, money back home, or a cash pocket.</p><button class="primary" data-action="account">＋ Add your first account</button></section>';
  const visible = state.accounts.slice(0, 3).reverse();
  return `<section class="wallet-board"><div class="wallet-display"><div class="wallet-display-heading"><span>THE EVERYDAY WALLET</span><span>${state.accounts.length} accounts</span></div><div class="wallet-stack" style="--stack-count:${visible.length}">${visible.map((a, index) => card(a, { index })).join("")}<div class="wallet-pocket"><span>kora<span class="pocket-dot">.</span></span><small>ALL YOUR WORLDS, TOGETHER</small></div></div><p class="wallet-hint">Tap a card to take a closer look <span>↗</span></p></div><div class="wallet-accounts"><div class="wallet-list-heading"><h3>In your wallet</h3><span>Local balances</span></div>${state.accounts
    .map((a) => {
      const look = cardAppearance(a);
      return `<button class="account-row" data-account="${esc(a.id)}"><span class="account-marker" style="--marker:${look.colour};--marker-ink:${look.ink}">${a.kind === "Mobile money" ? "▯" : a.kind === "Cash" ? "◇" : "▣"}</span><span class="account-name"><b>${esc(a.name)}</b><small>${esc(accountLocation(a))} · ${esc(a.kind)}</small></span><span class="account-money"><b>${cash(balance(state, a.id), a.currency)}</b><small>${a.currency === "EUR" ? "Euro account" : `<span class="money">${esc(estimated(balance(state, a.id), a.currency).split(" · ")[0])}</span>`}</small></span><span class="row-chevron">›</span></button>`;
    })
    .join(
      "",
    )}<button class="add-wallet-account" data-action="account">＋ Add a card, account or cash</button></div></section>`;
}
function accountDetails(id, animate = true) {
  const a = state.accounts.find((a) => a.id === id);
  if (!a) return;
  selectedAccount = id;
  const entries = state.entries.filter((e) => e.account === id);
  const spent = entries
    .filter((e) => e.kind === "expense")
    .reduce((n, e) => n + e.amount, 0);
  const received = entries
    .filter((e) => e.kind === "income")
    .reduce((n, e) => n + e.amount, 0);
  const receipts = state.receipts.filter((r) =>
    entries.some((e) => e.id === r.entry),
  );
  $("#account-dialog-title").textContent = a.name;
  $("#account-detail").innerHTML =
    `<div class="account-detail-top"><div class="account-hero ${animate ? "card-pop" : ""}">${card(a, { interactive: false })}</div><div class="account-facts"><div class="private-label">◈ ${cloud.configured ? "Only in your signed-in account" : "Local sample preview"}</div><dl><div><dt>Provider</dt><dd>${esc(a.provider)}</dd></div><div><dt>Location</dt><dd>${esc(accountLocation(a))}</dd></div><div><dt>Account type</dt><dd>${esc(a.kind)}</dd></div><div><dt>Card ending</dt><dd id="card-ending">${a.last4 ? '<button class="link" data-reveal-ending>Reveal last 4 digits</button>' : "Not added"}</dd></div></dl></div></div><div class="account-actions"><button class="primary" data-account-expense="${esc(id)}">＋ Add expense</button><button class="secondary" data-account-income="${esc(id)}">＋ Money in</button><button class="secondary" data-edit-account="${esc(id)}">✎ Edit card</button></div><div class="account-stat-grid"><div><small>Starting balance</small><b>${cash(a.opening, a.currency)}</b></div><div><small>Total spent</small><b>${cash(spent, a.currency)}</b></div><div><small>Total received</small><b>${cash(received, a.currency)}</b></div></div><div class="section-heading"><h2>Activity on this account</h2><span class="pill">${entries.length} entries</span></div><div class="account-history">${txRows(entries)}</div>${receipts.length ? `<div class="section-heading"><h2>Receipts for this account</h2></div><div class="account-receipts">${receipts.map((r) => `<button class="secondary" data-view-receipt="${esc(r.id)}">▤ ${esc(r.shop)} · ${esc(r.date)}</button>`).join("")}</div>` : ""}<p class="detail-note">Manually tracked. Recording a purchase changes this balance; it does not move money or connect to your bank.</p>`;
  if (!$("#account-dialog").open) $("#account-dialog").showModal();
}
function txRows(entries) {
  return (
    entries
      .map((e) => {
        const a = state.accounts.find((a) => a.id === e.account);
        return `<div class="transaction"><span class="tx-icon">${e.kind === "income" ? "↙" : e.category === "Groceries" ? "▦" : e.category === "Transport" ? "↗" : "⌁"}</span><div class="tx-text"><b>${esc(e.shop)}</b><span class="tag">${esc(e.category)}</span><small>${esc(a?.name)} · ${esc(e.date)}${e.note ? " · " + esc(e.note) : ""}</small></div><div class="tx-amount ${e.kind === "income" ? "positive" : ""}">${e.kind === "income" ? "+" : "−"}${cash(e.amount, a?.currency)}<small>${esc(a?.currency)}</small></div>${page === "Activity" ? `<button class="icon-btn" data-delete-entry="${esc(e.id)}" aria-label="Delete ${esc(e.shop)}">×</button>` : ""}</div>`;
      })
      .join("") || '<div class="empty">Your expenses will appear here.</div>'
  );
}
function home() {
  const net = total(
    state.accounts.map((a) => ({
      amount: balance(state, a.id),
      currency: a.currency,
    })),
  );
  const month = state.entries.filter((e) =>
    e.date.startsWith(today().slice(0, 7)),
  );
  const sum = (kind) =>
    total(
      month
        .filter((e) => e.kind === kind)
        .map((e) => ({
          amount: e.amount,
          currency: state.accounts.find((a) => a.id === e.account).currency,
        })),
    );
  const spent = sum("expense"),
    income = sum("income");
  const cats = {};
  for (const e of month.filter((e) => e.kind === "expense")) {
    const a = state.accounts.find((a) => a.id === e.account),
      v = euro(e.amount, a.currency);
    if (v !== null) cats[e.category] = (cats[e.category] || 0) + v;
  }
  const colors = [
    "#315e4e",
    "#a4ba85",
    "#ddcba5",
    "#eef0e7",
    "#b7c8bf",
    "#bc9b81",
  ];
  let pos = 0;
  const gradient = Object.values(cats)
    .map((n, i) => {
      const start = pos;
      pos += (n / (spent.n || 1)) * 100;
      return `${colors[i % colors.length]} ${start}% ${pos}%`;
    })
    .join(",");
  return (
    heading(
      "Your money. Together.",
      "A clear view of life in Ireland and back home.",
      expenseButton,
    ) +
    `<div class="summary-grid"><div class="summary main-summary"><div class="summary-label">Total money · estimated in euro</div><div class="amount">${cash(net.n)}</div><div class="summary-foot"><span class="positive">${state.accounts.length} accounts</span> &nbsp; · &nbsp; ${net.missing ? "Some rates missing — partial total" : "Across your world, in one place"}</div></div><div class="summary"><span class="summary-icon">↗</span><div class="summary-label">Spent this month</div><div class="amount">${cash(spent.n)}</div><div class="summary-foot">${spent.missing ? "Partial estimate · missing rates" : "Euro estimate · recorded expenses"}</div></div><div class="summary"><span class="summary-icon">↙</span><div class="summary-label">Money in this month</div><div class="amount">${cash(income.n)}</div><div class="summary-foot">${income.missing ? "Partial estimate · missing rates" : "Euro estimate · recorded income"}</div></div></div><div class="section-heading"><div><h2>Your accounts</h2><p>A familiar place for every part of your money.</p></div><button class="link" data-action="account">＋ Add account</button></div>${wallet()}<div class="rate-note">${esc(fxStatus)} · <button class="link" data-action="rates">Refresh rates ↻</button></div><div class="columns"><section class="panel"><div class="section-heading"><h2>Recent activity</h2><button class="link" data-go="Activity">See all ↗</button></div>${txRows(state.entries.slice(0, 4))}</section><section class="panel"><div class="section-heading"><h2>Where it went</h2><span class="pill">This month</span></div><div class="chart-wrap"><div class="donut" style="background:${gradient ? "conic-gradient(" + gradient + ")" : "#eef0e7"}"><div class="donut-center"><small>Total spent · est.</small>${cash(spent.n)}</div></div><div class="legend">${
      Object.entries(cats)
        .slice(0, 6)
        .map(
          ([c, n], i) =>
            `<div class="legend-row"><span class="dot" style="background:${colors[i]}"></span>${esc(c)}<b>${spent.n ? Math.round((n / spent.n) * 100) : 0}%</b></div>`,
        )
        .join("") ||
      '<span class="subtitle">Add an expense to see your breakdown.</span>'
    }</div></div><div class="insight">✧ &nbsp; Small entries. A clearer picture.<br>Keep track as you go, one purchase at a time.</div></section></div><div class="receipt-banner"><span class="receipt-art">▤</span><div><h3>A receipt today. Peace of mind later.</h3><p>Snap it, add a note, and keep it all together.</p></div><button data-action="receipt">＋ Add receipt</button></div>`
  );
}
function render() {
  if (!state) return;
  $("#crumb").textContent = page;
  $("#privacy").hidden = false;
  document.querySelector("nav").innerHTML = [
    ["Home", "⌂"],
    ["Accounts", "▣"],
    ["Activity", "⇄"],
    ["Receipts", "▤"],
    ["Debts", "◷"],
    ["Settings", "⚙"],
  ]
    .map(
      ([p, i]) =>
        `<button data-page="${p}" class="${page === p ? "active" : ""}"><span>${i}</span><span class="nav-label">${p}</span></button>`,
    )
    .join("");
  $(".demo").textContent = cloud.configured
    ? "● Private account"
    : "● Preview · sample data";
  let html = "";
  if (page === "Home") html = home();
  if (page === "Accounts")
    html =
      heading(
        "Your accounts",
        "Cards, bank accounts, mobile money and cash.",
        '<button class="primary" data-action="account">＋ Add account</button>',
      ) +
      `${wallet()}<p class="rate-note">${esc(fxStatus)}. Euro values are estimates, not bank quotes.</p><div class="panel"><h2>Simple, manual tracking</h2><p class="subtitle" style="margin-top:12px;line-height:1.8">Add your current balance once. Record what you spend or receive, and Kora does the maths. No bank login or full card number needed.</p><button class="secondary" data-action="income" style="margin-top:18px">＋ Add money received</button></div>`;
  if (page === "Activity")
    html =
      heading(
        "Every little detail.",
        "Your purchases and money received, in one place.",
        `<button class="secondary" data-action="income">＋ Money in</button>${expenseButton}`,
      ) +
      `<input class="search" id="search" placeholder="Find a shop or note…" aria-label="Search transactions"><div class="panel full-list" id="transactions">${txRows(state.entries)}</div>`;
  if (page === "Receipts")
    html =
      heading(
        "Less paper. More peace.",
        "Your receipt photos and notes, easy to find.",
        '<button class="primary" data-action="receipt">＋ Add receipt</button>',
      ) +
      `<div class="receipt-grid">${state.receipts.map((r) => `<article class="receipt-tile"><img data-receipt="${esc(r.id)}" alt="Receipt for ${esc(r.shop)}"><div><h2>${esc(r.shop)}</h2><p>${esc(r.note || "No note added")}</p><small>${esc(r.date)}</small><button class="link" data-view-receipt="${esc(r.id)}">Open photo ↗</button><button class="link" data-delete-receipt="${esc(r.id)}">Delete</button></div></article>`).join("") || '<div class="panel empty">No receipts yet. Take a photo or choose one from your phone.</div>'}</div>`;
  if (page === "Debts")
    html =
      heading(
        "Keep things clear.",
        "Money you owe, and money owed to you.",
        '<button class="primary" data-action="debt">＋ Add debt</button>',
      ) +
      state.debts
        .map(
          (d) =>
            `<div class="debt-row"><span class="tx-icon">${d.paid ? "✓" : "⇄"}</span><div><h3>${esc(d.name)}</h3><small>${esc(d.direction)} · ${d.paid ? "Settled" : esc(d.date)}${d.note ? " · " + esc(d.note) : ""}</small></div><strong>${cash(d.amount, d.currency)}</strong><button class="secondary" data-settle="${esc(d.id)}">${d.paid ? "Reopen" : "Mark settled"}</button></div>`,
        )
        .join("") +
      '<p class="notice">Debt reminders are separate from account balances. Record the actual payment as an expense or money received.</p>';
  if (page === "Settings")
    html =
      heading("Make yourself at home.", "A few simple preferences.") +
      `<div class="panel settings-box"><h2>Your personal space</h2><p>${cloud.configured ? "Signed in as " + esc(person?.email) + ". Records save online and refresh across your devices." : "This is a local design preview. Sample records save only in this browser. Google login and online storage need the one-time setup in HANDOVER.md."}</p><button class="secondary" data-action="refresh">Refresh my records</button> <button class="secondary" data-action="export">Download my records</button>${cloud.configured ? ' <button class="secondary" data-action="logout">Sign out</button>' : ""}<hr><h2>Private by design</h2><p>Use account nicknames and optional last four digits only. Never enter your PIN, CVV, password, or full card number. Receipts can contain personal information: check them before uploading.</p><h2>Exchange rates</h2><p>Euro amounts use the latest available Frankfurter reference rates. Rates can be delayed; each foreign account shows its rate date. These are estimates, excluding fees. Original balances never change with exchange rates.</p><h2>Need to correct a purchase?</h2><p>Delete it from Activity and add it again. Your account balance updates automatically.</p></div>`;
  $("#content").innerHTML = html;
  if (page === "Receipts") loadReceiptImages();
}
function field(label, name, type = "text", extra = "") {
  return `<label for="f-${name}">${label}</label><input id="f-${name}" name="${name}" type="${type}" ${extra}>`;
}
function options(list, selected) {
  return list
    .map(
      (v) => `<option ${v === selected ? "selected" : ""}>${esc(v)}</option>`,
    )
    .join("");
}
function accountSelect() {
  return `<label for="f-account">Paid from / received into</label><select id="f-account" name="account">${state.accounts.map((a) => `<option value="${esc(a.id)}">${esc(a.name)} · ${esc(a.currency)}</option>`).join("")}</select>`;
}
const photoField = () =>
  '<label for="f-photo">Receipt photo (optional)</label><input id="f-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment"><small>Take a photo on your phone, or choose an image. Maximum 10 MB.</small>';
function appearanceFields(account) {
  const look = cardAppearance(account || {});
  return `<fieldset class="appearance-fields"><legend>Make it yours</legend><div id="card-preview" class="account-hero"></div><label for="f-colour">Card colour</label><div class="colour-controls"><input type="color" name="colour" id="f-colour" value="${look.colour}"><div class="colour-swatches">${cardColours.map((c) => `<button type="button" data-colour="${c}" class="colour-swatch" style="background:${c}" aria-label="Use colour ${c}"></button>`).join("")}</div></div><label for="f-pattern">Background design</label><select id="f-pattern" name="pattern">${cardPatterns.map((p) => `<option value="${p}" ${look.pattern === p ? "selected" : ""}>${{ orbit: "Soft circles", weave: "Woven lines", contour: "Contour lines", solid: "Plain colour" }[p]}</option>`).join("")}</select><small>Text colour adjusts automatically for readability.</small></fieldset>`;
}
function updateCardPreview() {
  const preview = $("#card-preview");
  if (!preview) return;
  const existing = state.accounts.find((a) => a.id === editingAccount);
  const draft = {
    ...existing,
    id: existing?.id || "preview",
    name: $("#f-name").value.trim() || "Your account",
    provider: $("#f-provider").value.trim() || "Bank or provider",
    kind: $("#f-kind").value,
    currency: $("#f-currency").value,
    colour: $("#f-colour").value,
    pattern: $("#f-pattern").value,
  };
  let amount = existing ? balance(state, existing.id) : 0;
  if (!existing) {
    try {
      amount = minor($("#f-opening").value || 0, draft.currency);
    } catch {}
  }
  preview.innerHTML = card(draft, { interactive: false, amount });
}
function openForm(type, account) {
  formType = type;
  editingAccount = type === "edit-account" ? account : null;
  $("#form").reset();
  $("#form-error").textContent = "";
  let title = "",
    fields = "";
  if (type === "expense" || type === "income") {
    if (!state.accounts.length) {
      toast("Add your first account, then record a payment.");
      return openForm("account");
    }
    title = type === "expense" ? "Add an expense" : "Add money received";
    fields =
      field(
        type === "expense" ? "Shop or place" : "From whom?",
        "shop",
        "text",
        'required maxlength="100" placeholder="e.g. Lidl"',
      ) +
      field(
        "Amount · in the selected account’s currency",
        "amount",
        "number",
        'required min="0.01" step="any" inputmode="decimal" placeholder="0.00"',
      ) +
      accountSelect() +
      `<details class="optional"><summary>Add a receipt or more details</summary><label for="f-category">Category</label><select id="f-category" name="category">${options(type === "income" ? ["Income"] : ["Groceries", "Food & drink", "Transport", "Shopping", "Bills", "Other"], "Other")}</select>` +
      field("Date", "date", "date", `required value="${today()}"`) +
      photoField() +
      field("Note (optional)", "note", "text", 'maxlength="500"') +
      "</details>";
  }
  if (type === "account" || type === "edit-account") {
    title = type === "edit-account" ? "Make this card yours" : "Add an account";
    fields =
      field(
        "What would you like to call it?",
        "name",
        "text",
        'required maxlength="40" placeholder="e.g. My Irish card, Back home"',
      ) +
      `<label for="f-kind">Account type</label><select id="f-kind" name="kind">${options(["Card", "Account", "Mobile money", "Cash"])}</select>` +
      field(
        "Bank or provider",
        "provider",
        "text",
        'required maxlength="60" list="providers" placeholder="Choose or type any provider"',
      ) +
      '<datalist id="providers">' +
      [
        "AIB",
        "Bank of Ireland",
        "Permanent TSB",
        "Revolut",
        "Credit Union",
        "Access Bank",
        "Ecobank",
        "UBA",
        "GTBank",
        "Zenith Bank",
        "KCB",
        "Equity Bank",
        "Standard Bank",
        "Absa",
        "FNB",
        "Capitec",
        "M-Pesa",
        "MTN MoMo",
        "Airtel Money",
        "Orange Money",
        "Wave",
        "Cash",
      ]
        .map((p) => `<option value="${p}">`)
        .join("") +
      "</datalist>" +
      `<label for="f-currency">Currency</label><select id="f-currency" name="currency">${options(currencies, "EUR")}</select>` +
      field(
        "Current balance",
        "opening",
        "number",
        'required min="0" step="any" inputmode="decimal" placeholder="0.00"',
      ) +
      field(
        "Last 4 card digits (optional)",
        "last4",
        "text",
        'pattern="[0-9]{4}" maxlength="4" inputmode="numeric" placeholder="1234"',
      ) +
      appearanceFields(state.accounts.find((a) => a.id === editingAccount)) +
      '<p class="notice">Provider names are labels, not connected services. Never enter a full card number, account number, PIN or CVV.</p>';
  }
  if (type === "receipt") {
    title = "Save a receipt";
    fields =
      field(
        "Shop or title",
        "shop",
        "text",
        'required maxlength="100" placeholder="e.g. Tesco"',
      ) +
      photoField()
        .replace("photo (optional)", "photo")
        .replace('name="photo"', 'name="photo" required') +
      field("Date", "date", "date", `required value="${today()}"`) +
      field("Note (optional)", "note", "text", 'maxlength="500"') +
      '<p class="notice">This saves the photo only. To update a balance, use Add expense.</p>';
  }
  if (type === "debt") {
    title = "Add a debt";
    fields =
      field(
        "Person or description",
        "name",
        "text",
        'required maxlength="100"',
      ) +
      '<label for="f-direction">Who owes whom?</label><select id="f-direction" name="direction">' +
      options(["I owe", "Owed to me"]) +
      "</select>" +
      field("Amount", "amount", "number", 'required min="0.01" step="any"') +
      '<label for="f-currency">Currency</label><select id="f-currency" name="currency">' +
      options(currencies, "EUR") +
      "</select>" +
      field("Due date", "date", "date", `required value="${today()}"`) +
      field("Note (optional)", "note", "text", 'maxlength="500"');
  }
  $("#modal-title").textContent = title;
  $("#fields").innerHTML = fields;
  $("#form .submit").textContent = "Save";
  $("#form .submit").hidden = false;
  if (type === "edit-account") {
    const a = state.accounts.find((a) => a.id === editingAccount);
    for (const key of ["name", "provider", "kind", "currency", "last4"])
      $("#f-" + key).value = a[key] || "";
    $("#f-opening").value =
      a.opening /
      10 **
        new Intl.NumberFormat("en", {
          style: "currency",
          currency: a.currency,
        }).resolvedOptions().maximumFractionDigits;
    $("#f-opening").disabled = true;
    $("#f-currency").disabled = true;
    document.querySelector('label[for="f-opening"]').textContent =
      "Starting balance (unchanged)";
  }
  $("#modal").classList.toggle(
    "appearance-modal",
    type === "account" || type === "edit-account",
  );
  $("#modal").showModal();
  if (type === "account" || type === "edit-account") updateCardPreview();
  if (account && $("#f-account")) $("#f-account").value = account;
}
async function commit(next) {
  if (cloud.configured) next.__revision = await cloud.save(next);
  else {
    try {
      localStorage.setItem(demoKey, JSON.stringify(next));
    } catch {
      throw Error(
        "Browser storage is full. Remove an old receipt and try again.",
      );
    }
  }
  state = next;
  render();
}
async function photo(file) {
  if (file.size > 10 * 1024 * 1024)
    throw Error("Choose an image smaller than 10 MB.");
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw Error("Choose a JPG, PNG or WebP image.");
  const bitmap = await createImageBitmap(file),
    ratio = Math.min(1, 1400 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * ratio);
  canvas.height = Math.round(bitmap.height * ratio);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.8),
  );
  if (!blob || blob.size > 2 * 1024 * 1024)
    throw Error("Image is too large. Try a smaller photo.");
  if (cloud.configured) return { path: await cloud.upload(blob) };
  return { image: canvas.toDataURL("image/jpeg", 0.8) };
}
$("#form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (busy) return;
  busy = true;
  $("#form .submit").disabled = true;
  $("#form-error").textContent = "";
  let uploaded;
  try {
    const data = new FormData(event.target),
      v = Object.fromEntries(data),
      id = crypto.randomUUID();
    let next = structuredClone(state);
    for (const key of ["name", "provider", "shop"])
      if (typeof v[key] === "string" && !v[key].trim())
        throw Error("Please fill in the name or shop.");
    if (formType === "expense" || formType === "income") {
      const a = state.accounts.find((a) => a.id === v.account);
      next = addEntry(next, {
        id,
        shop: v.shop.trim(),
        amount: minor(v.amount, a.currency),
        account: v.account,
        kind: formType,
        category: v.category,
        date: v.date,
        note: v.note.trim(),
      });
    }
    if (formType === "account") {
      next.accounts.push({
        id,
        name: v.name.trim(),
        provider: v.provider.trim(),
        kind: v.kind,
        currency: v.currency,
        opening: minor(v.opening, v.currency),
        last4: v.last4,
        colour: cardAppearance({ colour: v.colour }).colour,
        pattern: cardPatterns.includes(v.pattern) ? v.pattern : "orbit",
      });
    }
    if (formType === "edit-account") {
      next.accounts = next.accounts.map((a) =>
        a.id === editingAccount
          ? {
              ...a,
              name: v.name.trim(),
              provider: v.provider.trim(),
              kind: v.kind,
              last4: v.last4,
              colour: cardAppearance({ colour: v.colour }).colour,
              pattern: cardPatterns.includes(v.pattern) ? v.pattern : "orbit",
            }
          : a,
      );
    }
    if (formType === "debt") {
      const amount = minor(v.amount, v.currency);
      if (!amount) throw Error("Enter an amount greater than zero.");
      next.debts.unshift({
        id,
        name: v.name.trim(),
        amount,
        currency: v.currency,
        direction: v.direction,
        date: v.date,
        note: v.note.trim(),
        paid: false,
      });
    }
    if (v.photo?.size) {
      uploaded = await photo(v.photo);
      next.receipts.unshift({
        id: crypto.randomUUID(),
        entry: formType === "receipt" ? null : id,
        shop: v.shop.trim(),
        note: v.note.trim(),
        date: v.date,
        ...uploaded,
      });
    }
    await commit(next);
    $("#modal").close();
    if (formType === "edit-account") accountDetails(editingAccount);
    toast(
      formType === "expense"
        ? "Expense saved. Your balance is updated."
        : "Saved.",
    );
  } catch (error) {
    if (uploaded?.path) await cloud.removeFile(uploaded.path);
    if (error.message.includes("Another device")) {
      try {
        await refresh();
        error.message =
          "Another device saved changes. We loaded them and kept your form. Review your entry, then press Save again.";
      } catch {}
    }
    $("#form-error").textContent = error.message;
  } finally {
    busy = false;
    $("#form .submit").disabled = false;
  }
});
async function loadReceiptImages() {
  for (const url of urls) URL.revokeObjectURL(url);
  urls = [];
  for (const r of state.receipts) {
    const el = document.querySelector(`[data-receipt="${CSS.escape(r.id)}"]`);
    if (!el) continue;
    try {
      const url = cloud.configured ? await cloud.receiptUrl(r.path) : r.image;
      if (cloud.configured) urls.push(url);
      if (el.isConnected) el.src = url;
    } catch {
      el.alt = "Unable to load receipt";
    }
  }
}
async function refresh() {
  if (cloud.configured) {
    const signedInId = person?.id;
    if (!signedInId) return;
    const loaded = (await cloud.load()) || { ...emptyState(), __revision: 0 };
    if (person?.id !== signedInId) return;
    if (!state || (loaded.__revision || 0) >= (state.__revision || 0))
      state = loaded;
    state.currency = "EUR";
  }
  render();
}
document.addEventListener("click", async (event) => {
  const b = event.target.closest("button");
  if (!b || busy) return;
  try {
    if (b.dataset.page || b.dataset.go) {
      page = b.dataset.page || b.dataset.go;
      render();
      return;
    }
    if (b.dataset.account) {
      accountDetails(b.dataset.account);
      return;
    }
    if (b.hasAttribute("data-close-account")) {
      $("#account-dialog").close();
      return;
    }
    if (b.hasAttribute("data-reveal-ending")) {
      const a = state.accounts.find((a) => a.id === selectedAccount);
      $("#card-ending").textContent = a?.last4
        ? "•••• " + a.last4
        : "Not added";
      return;
    }
    if (
      b.dataset.accountExpense ||
      b.dataset.accountIncome ||
      b.dataset.editAccount
    ) {
      $("#account-dialog").close();
      openForm(
        b.dataset.editAccount
          ? "edit-account"
          : b.dataset.accountIncome
            ? "income"
            : "expense",
        b.dataset.editAccount ||
          b.dataset.accountIncome ||
          b.dataset.accountExpense,
      );
      return;
    }
    if (b.dataset.colour) {
      $("#f-colour").value = b.dataset.colour;
      updateCardPreview();
      return;
    }
    if (b.dataset.deleteEntry) {
      if (
        !confirm(
          "Delete this entry? Its effect on the balance will be reversed.",
        )
      )
        return;
      await commit({
        ...state,
        entries: state.entries.filter((e) => e.id !== b.dataset.deleteEntry),
      });
      toast("Entry deleted. Balance updated.");
      return;
    }
    if (b.dataset.settle) {
      await commit({
        ...state,
        debts: state.debts.map((d) =>
          d.id === b.dataset.settle ? { ...d, paid: !d.paid } : d,
        ),
      });
      return;
    }
    if (b.dataset.deleteReceipt) {
      if (!confirm("Delete this receipt photo?")) return;
      const r = state.receipts.find((r) => r.id === b.dataset.deleteReceipt);
      await commit({
        ...state,
        receipts: state.receipts.filter((x) => x.id !== r.id),
      });
      if (r.path) await cloud.removeFile(r.path);
      return;
    }
    if (b.dataset.viewReceipt) {
      $("#account-dialog").close();
      const r = state.receipts.find((r) => r.id === b.dataset.viewReceipt);
      const url = cloud.configured ? await cloud.receiptUrl(r.path) : r.image;
      if (cloud.configured) urls.push(url);
      $("#modal-title").textContent = r.shop;
      $("#fields").innerHTML =
        `<img src="${esc(url)}" alt="Receipt" style="width:100%">`;
      $("#form-error").textContent = "";
      $("#form .submit").hidden = true;
      $("#modal").showModal();
      return;
    }
    const action = b.dataset.action;
    if (["expense", "income", "account", "receipt", "debt"].includes(action))
      openForm(action);
    if (action === "settings") {
      page = "Settings";
      render();
    }
    if (action === "rates") {
      await rates();
      toast(
        fxStatus.startsWith("Rates unavailable")
          ? "Exchange rates are unavailable. Try again later."
          : "Exchange rates refreshed.",
      );
    }
    if (action === "refresh") {
      await refresh();
      toast("Your records are up to date.");
    }
    if (action === "export") {
      const blob = new Blob([JSON.stringify(state, null, 2)], {
          type: "application/json",
        }),
        url = URL.createObjectURL(blob),
        a = document.createElement("a");
      a.href = url;
      a.download = `kora-records-${today()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast(
        "Downloaded records. Keep this private. Receipt photos are not included in online exports.",
      );
    }
    if (action === "logout") {
      $("#account-dialog").close();
      $("#account-detail").innerHTML = "";
      state = null;
      person = null;
      for (const url of urls) URL.revokeObjectURL(url);
      urls = [];
      loginScreen();
      await cloud.logout();
    }
  } catch (error) {
    toast(error.message);
  }
});
$("#close").onclick = () => {
  if (!busy) $("#modal").close();
};
$("#modal").addEventListener("cancel", (event) => {
  if (busy) event.preventDefault();
});
$("#privacy").onclick = () => {
  const hidden = document.body.classList.toggle("hidden-balances");
  $("#privacy").setAttribute(
    "aria-label",
    hidden ? "Show balances" : "Hide balances",
  );
};
document.addEventListener("input", (e) => {
  if (
    e.target.closest("#form") &&
    (formType === "account" || formType === "edit-account")
  )
    updateCardPreview();
  if (e.target.id === "search") {
    const q = e.target.value.toLowerCase();
    $("#transactions").innerHTML = txRows(
      state.entries.filter((t) =>
        (t.shop + " " + t.note).toLowerCase().includes(q),
      ),
    );
  }
});
function loginScreen(registering = false) {
  document.querySelector("nav").innerHTML = "";
  $("#privacy").hidden = true;
  $(".demo").textContent = "● Private money space";
  const title = registering ? "Create your Kora account" : "Sign in to Kora";
  const passwordOptions = registering
    ? 'required minlength="12" maxlength="72" autocomplete="new-password"'
    : 'required autocomplete="current-password"';
  $("#content").innerHTML =
    '<div class="login-wrap"><h1>Your private wallet</h1><div class="panel login-panel"><h2>' + title +
    '</h2><p>Use your invited email address.</p><form id="login-form">' +
    field("Email address", "email", "email", 'required autocomplete="username"') +
    field("Password", "password", "password", passwordOptions) +
    (registering ? '<small>Use at least 12 characters.</small>' : '') +
    '<p id="login-error" role="alert"></p><p id="login-status" role="status"></p><button class="primary submit">' +
    (registering ? 'Create account' : 'Sign in') +
    '</button></form><button id="auth-mode" class="secondary" type="button">' +
    (registering ? 'Back to sign in' : 'Create an account') + '</button></div></div>';
  $("#auth-mode").onclick = () => loginScreen(!registering);
  $("#login-form").onsubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const button = form.querySelector("button");
    const mode = $("#auth-mode");
    button.disabled = mode.disabled = true;
    $("#login-error").textContent = "";
    $("#login-status").textContent = "";
    try {
      const data = new FormData(form);
      const email = data.get("email").trim();
      const password = data.get("password");
      if (registering) {
        if (new TextEncoder().encode(password).length > 72)
          throw Error("Use a shorter password and try again.");
        await cloud.register(email, password);
        form.reset();
        $("#login-status").textContent =
          "Check your email for a confirmation link. After confirming, return here to sign in.";
      } else {
        person = await cloud.login(email, password);
        await openAuthenticatedWallet();
      }
    } catch (error) {
      $("#login-error").textContent = error.message;
    } finally {
      button.disabled = mode.disabled = false;
    }
  };
}
async function openAuthenticatedWallet() {
  const factor = await cloud.secondFactor();
  if (!factor) return refresh();
  $("#content").innerHTML =
    '<div class="login-wrap"><h1>Your private wallet</h1><div class="panel login-panel">' +
    (factor.secret
      ? '<h2>Set up your authenticator</h2><p>Add a time-based account named Kora in your authenticator app. Enter this setup key there, then enter the six-digit code below.</p><p><code>' + esc(factor.secret) + '</code></p>'
      : '<h2>Verify your sign-in</h2><p>Enter the six-digit code from your authenticator app.</p>') +
    '<form id="mfa-form">' +
    field("Authenticator code", "code", "text", 'required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6"') +
    '<p id="mfa-error" role="alert"></p><button class="primary submit">Verify</button></form>' +
    '<button type="button" class="secondary" data-action="logout">Sign out</button></div></div>';
  $("#mfa-form").onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector("button");
    submit.disabled = true;
    try {
      await cloud.verifyFactor(factor.id, new FormData(form).get("code"));
      await refresh();
    } catch (error) {
      $("#mfa-error").textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  };
}
async function init() {
  if (cloud.configured) {
    try {
      person = await cloud.session();
      if (person) await openAuthenticatedWallet();
      else loginScreen();
    } catch (error) {
      state = null;
      loginScreen();
      $("#login-error").textContent =
        error.message || "Could not load your account. Sign in again.";
    }
  } else {
    try {
      state = JSON.parse(localStorage.getItem(demoKey)) || demo();
    } catch {
      state = demo();
    }
    render();
  }
  rates();
}
document.addEventListener("visibilitychange", () => {
  if (
    !document.hidden &&
    cloud.configured &&
    state &&
    !$("#modal").open &&
    !$("#account-dialog").open &&
    !busy
  )
    refresh().catch(() => toast("Could not refresh. Check your connection."));
});
setInterval(() => {
  if (
    cloud.configured &&
    state &&
    !document.hidden &&
    !$("#modal").open &&
    !$("#account-dialog").open &&
    !busy
  )
    refresh().catch(() => {});
}, 30000);
init();
