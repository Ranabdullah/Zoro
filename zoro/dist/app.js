import {
  initializeSecurityUI,
  checkLocalLock,
  showLocalSecurity,
  lockScreen,
} from "./security-ui.js";
import { incomeSources, currencyLabel } from "./money-labels.js";
import { reportRows } from "./report-data.js";
import { validateBackup, removeData } from "./data-management.js";
import * as cloud from "./cloud.js";
import {
  safeCardImage,
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
let onlineWallet = false;
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
  const image = safeCardImage(a.cardImage);
  if (image) {
    look.ink = "#ffffff";
    look.art = "#000000";
  }
  const tag = interactive ? "button" : "div";
  return `<${tag} class="bank-card wallet-card ${image ? "has-card-image" : ""} pattern-${look.pattern}" style="--card-bg:${look.colour};--card-ink:${look.ink};--card-art:${look.art};--card-index:${index}" ${interactive ? `data-account="${esc(a.id)}" aria-label="Open ${esc(a.name)} account details"` : ""}>
    ${image ? `<img class="card-custom-image" src="${image}" alt=""><span class="card-image-shade" aria-hidden="true"></span>` : '<span class="card-art" aria-hidden="true"></span>'}
    <span class="card-top"><b>${esc(a.name)}</b><span class="currency-badge">${esc(a.currency)}</span></span>
    <span class="card-provider">${esc(a.provider)}<span>${esc(accountLocation(a))}</span></span>
    <span class="card-bottom"><span><span class="card-label">Available · ${esc(currencyLabel(a.currency))}</span><strong>${cash(amount, a.currency)}</strong></span><span class="card-kind">${esc(a.kind)}</span></span>
    <span class="card-tail"><span>${a.currency !== "EUR" ? `<span class="money">${esc(estimated(amount, a.currency))}</span>` : "YOUR EVERYDAY MONEY"}</span><span aria-hidden="true">◔</span></span>
  </${tag}>`;
}
function wallet() {
  if (!state.accounts.length)
    return '<section class="wallet-empty panel"><div class="wallet-empty-icon">▣</div><h2>Your wallet starts here.</h2><p>Add your euro account, money back home, or a cash pocket.</p><button class="primary" data-action="account">＋ Add your first account</button><button class="secondary" data-action="help">Show me the tutorial</button></section>';
  const visible = state.accounts.slice(0, 3).reverse();
  return `<section class="wallet-board"><div class="wallet-display"><div class="wallet-display-heading"><span>THE EVERYDAY WALLET</span><span>${state.accounts.length} accounts</span></div><div class="wallet-stack" style="--stack-count:${visible.length}">${visible.map((a, index) => card(a, { index })).join("")}<div class="wallet-pocket"><span>zoro<span class="pocket-dot">.</span></span><small>ALL YOUR WORLDS, TOGETHER</small></div></div><p class="wallet-hint">Tap a card to take a closer look <span>↗</span></p></div><div class="wallet-accounts"><div class="wallet-list-heading"><h3>In your wallet</h3><span>Local balances</span></div>${state.accounts
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
    `<div class="account-detail-top"><div class="account-hero ${animate ? "card-pop" : ""}">${card(a, { interactive: false })}</div><div class="account-facts"><div class="private-label">◈ ${onlineWallet ? "Only in your signed-in account" : "Local sample preview"}</div><dl><div><dt>Provider</dt><dd>${esc(a.provider)}</dd></div><div><dt>Location</dt><dd>${esc(accountLocation(a))}</dd></div><div><dt>Currency</dt><dd>${esc(currencyLabel(a.currency))}</dd></div><div><dt>Account type</dt><dd>${esc(a.kind)}</dd></div><div><dt>Card ending</dt><dd id="card-ending">${a.last4 ? '<button class="link" data-reveal-ending>Reveal last 4 digits</button>' : "Not added"}</dd></div></dl></div></div><div class="account-actions"><button class="primary" data-account-expense="${esc(id)}">＋ Add expense</button><button class="secondary" data-account-income="${esc(id)}">＋ Money in</button><button class="secondary" data-edit-account="${esc(id)}">✎ Edit card</button><button class="secondary" data-remove-account="${esc(id)}">Remove account</button></div><div class="account-stat-grid"><div><small>Starting balance</small><b>${cash(a.opening, a.currency)}</b></div><div><small>Total spent</small><b>${cash(spent, a.currency)}</b></div><div><small>Total received</small><b>${cash(received, a.currency)}</b></div></div><div class="section-heading"><h2>Activity on this account</h2><span class="pill">${entries.length} entries</span></div><div class="account-history">${txRows(entries)}</div>${receipts.length ? `<div class="section-heading"><h2>Receipts for this account</h2></div><div class="account-receipts">${receipts.map((r) => `<button class="secondary" data-view-receipt="${esc(r.id)}">▤ ${esc(r.shop)} · ${esc(r.date)}</button>`).join("")}</div>` : ""}<p class="detail-note">Manually tracked. Recording a purchase changes this balance; it does not move money or connect to your bank.</p>`;
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
const previewTips = {
  Home: "Compare the sample balances, income and spending. Try adding a pretend expense.",
  Accounts: "Open a sample card to see its balance, transactions and currency.",
  Activity: "Browse the sample transactions or search for a shop.",
  Receipts:
    "Try adding a sample photo and note to see how receipts are stored.",
  Debts:
    "See what you owe and what is owed to you. Try marking a sample debt as paid.",
  Settings:
    "Open Help to revisit the walkthrough or try hiding balances with the eye button.",
};
const previewTabs = [...document.querySelectorAll(".preview-tabs [role=tab]")];
const tourSteps = [
  {
    page: "Home",
    title: "Welcome to Zoro",
    description:
      "Track money across accounts and currencies, record spending, and keep receipts and debts in one place. This sample wallet lets you try it all before creating an account.",
  },
  {
    page: "Home",
    title: "See where your money stands",
    description:
      "Overview brings your balances, monthly spending and income together.",
    controls: [
      ["Add expense", "Record a purchase against the account you used."],
      ["Add account", "Add a card, bank account or cash balance."],
    ],
  },
  {
    page: "Accounts",
    title: "Manage your accounts",
    description:
      "Keep accounts in their own currencies and see estimated euro totals.",
    controls: [
      ["Open a card", "See its balance and transactions, or edit the card."],
      ["Add money received", "Record income against an account."],
    ],
  },
  {
    page: "Activity",
    title: "Review your transactions",
    description: "Find the money you recorded coming in and going out.",
    controls: [
      ["Search", "Find entries by shop or note."],
      ["Delete", "Remove a mistaken entry and update the account balance."],
    ],
  },
  {
    page: "Receipts",
    title: "Keep your receipts together",
    description: "Save a picture and a note for a purchase.",
    controls: [["Add receipt", "Choose a photo or use your phone camera."]],
  },
  {
    page: "Debts",
    title: "Track what is owed",
    description: "Keep track of money you owe and money others owe you.",
    controls: [
      ["Add debt", "Record who owes what."],
      ["Mark settled", "Mark a debt as paid."],
    ],
  },
  {
    page: "Settings",
    title: "Make Zoro yours",
    description:
      "You can try the sample wallet freely. When you’re ready, create an account to start with your own empty wallet.",
    controls: [
      ["Settings → Help", "Find this guide again."],
      [
        "Create an account",
        "Set up a private wallet with your email and authenticator.",
      ],
    ],
  },
];
let tourIndex = 0;
const tourDialog = $("#wallet-tour");
function showTourStep(index) {
  tourIndex = index;
  const step = tourSteps[index];
  page = step.page;
  render();
  $("#tour-progress").textContent = `Step ${index + 1} of ${tourSteps.length}`;
  $("#tour-title").textContent = step.title;
  $("#tour-description").textContent =
    onlineWallet && index === 0
      ? "Your wallet starts empty. Add accounts, record spending and income, and keep receipts in one place. Skip or replay this guide whenever you like."
      : onlineWallet && index === tourSteps.length - 1
        ? "Find help, reports, backups, security and optional cloud connection settings here."
        : step.description;
  $("#tour-controls").innerHTML = (
    onlineWallet && index === tourSteps.length - 1
      ? [
          ["Help", "Replay this guide."],
          ["Data management", "Download a full backup, import or remove data."],
          [
            "Cloud connection",
            "Keep using Zoro cloud or connect your own project.",
          ],
        ]
      : step.controls || []
  )
    .map(
      ([label, tip]) => `<div><dt>${esc(label)}</dt><dd>${esc(tip)}</dd></div>`,
    )
    .join("");
  const back = tourDialog.querySelector('[data-action="previous-tour"]');
  back.hidden = index === 0;
  const next = tourDialog.querySelector('[data-action="next-tour"]');
  next.textContent = index === tourSteps.length - 1 ? "Finish tour" : "Next";
  if (!tourDialog.open) tourDialog.showModal();
  next.focus({ preventScroll: true });
  if (index > 0)
    $("#content").scrollIntoView({ block: "start", behavior: "instant" });
  else window.scrollTo({ top: 0, behavior: "instant" });
}
tourDialog.addEventListener("close", () => {
  if (!onlineWallet && state) {
    page = "Home";
    render();
    window.scrollTo({ top: 0, behavior: "instant" });
    $('[data-action="start-tour"]').focus({ preventScroll: true });
  }
});
$(".preview-tabs").addEventListener("keydown", (event) => {
  const index = previewTabs.indexOf(event.target);
  if (index < 0) return;
  const positions = {
    ArrowLeft: index - 1,
    ArrowRight: index + 1,
    Home: 0,
    End: previewTabs.length - 1,
  };
  if (!Object.hasOwn(positions, event.key)) return;
  event.preventDefault();
  const next =
    previewTabs[
      (positions[event.key] + previewTabs.length) % previewTabs.length
    ];
  next.click();
  next.focus();
});
function render() {
  if (!state) return;
  $("#preview-auth").hidden = onlineWallet || !cloud.configured;
  $("#preview-banner").hidden = onlineWallet;
  const content = $("#content");
  if (onlineWallet) {
    content.removeAttribute("role");
    content.removeAttribute("aria-labelledby");
  } else {
    for (const tab of previewTabs) {
      const selected = tab.dataset.page === page;
      tab.setAttribute("aria-selected", String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected) content.setAttribute("aria-labelledby", tab.id);
    }
    content.setAttribute("role", "tabpanel");
    $("#preview-tip").textContent = previewTips[page] || "";
  }
  $("#crumb").textContent = page;
  $("#privacy").hidden = false;
  document.querySelector("nav").innerHTML = [
    ["Home", "⌂"],
    ["Accounts", "▣"],
    ["Activity", "⇄"],
    ["Receipts", "▤"],
    ["Debts", "◷"],
    ["Reports", "▤"],
    ["Settings", "⚙"],
  ]
    .map(
      ([p, i]) =>
        `<button data-page="${p}" class="${page === p ? "active" : ""}"><span>${i}</span><span class="nav-label">${p}</span></button>`,
    )
    .join("");
  $(".demo").textContent = onlineWallet
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
      `${wallet()}<p class="rate-note">${esc(fxStatus)}. Euro values are estimates, not bank quotes.</p><div class="panel"><h2>Simple, manual tracking</h2><p class="subtitle" style="margin-top:12px;line-height:1.8">Add your current balance once. Record what you spend or receive, and Zoro does the maths. No bank login or full card number needed.</p><button class="secondary" data-action="income" style="margin-top:18px">＋ Add money received</button></div>`;
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
            `<div class="debt-row"><span class="tx-icon">${d.paid ? "✓" : "⇄"}</span><div><h3>${esc(d.name)}</h3><small>${esc(d.direction)} · ${d.paid ? "Settled" : esc(d.date)}${d.note ? " · " + esc(d.note) : ""}</small></div><strong>${cash(d.amount, d.currency)}</strong><button class="secondary" data-settle="${esc(d.id)}">${d.paid ? "Reopen" : "Mark settled"}</button><button class="link" data-remove-debt="${esc(d.id)}">Delete</button></div>`,
        )
        .join("") +
      '<p class="notice">Debt reminders are separate from account balances. Record the actual payment as an expense or money received.</p>';
  if (page === "Settings")
    html =
      heading("Make yourself at home.", "A few simple preferences.") +
      `<div class="panel settings-box"><h2>Your personal space</h2><p>${onlineWallet ? "Signed in as " + esc(person?.email || person?.phone) + ". Records save online and refresh across your devices." : "This is a local design preview. Sample changes last until you reload. Create an account to start with an empty wallet."}</p><button class="secondary" data-action="refresh">Refresh my records</button> <button class="secondary" data-action="export">Download my records</button>${onlineWallet ? ' <button class="secondary" data-action="logout">Sign out</button>' : ""}<hr><h2>Cloud connection</h2><p>${onlineWallet ? (cloud.usingOwnBackend() ? "Connected to your own Supabase project: " + esc(cloud.backendHost()) : "Connected automatically to Zoro cloud.") : "Zoro cloud connects automatically after sign-in. You can also use a project you own."}</p><button class="secondary" data-action="backend-settings">Cloud connection settings</button><hr><h2>Data management</h2><button class="secondary" data-action="data-management">Backup, import or remove data</button><hr><h2>Reports</h2><button class="secondary" data-go="Reports">Excel and PDF reports</button><hr><h2>Excel online</h2><button class="secondary" data-action="excel-settings">Connect an online Excel workbook</button><hr><h2>Help</h2><button class="secondary" data-action="help">Open wallet tutorial</button>${onlineWallet ? '<hr><h2>Account security</h2><p>New browser sessions require verified sign-in and an authenticator code.</p><button class="secondary" data-action="password">Change password</button> <button class="secondary" data-action="sessions">Signed-in browsers</button> <button class="secondary" data-action="local-security">PIN and device screen lock</button> <button class="secondary" data-action="device-security">New-browser approval</button> <button class="secondary" data-action="recovery-codes">Authenticator recovery codes</button>' : ""}<hr><h2>Private by design</h2><p>Use account nicknames and optional last four digits only. Never enter your PIN, CVV, password, or full card number. Receipts can contain personal information: check them before uploading.</p><h2>Exchange rates</h2><p>Euro amounts use the latest available Frankfurter reference rates. Rates can be delayed; each foreign account shows its rate date. These are estimates, excluding fees. Original balances never change with exchange rates.</p><h2>Need to correct a purchase?</h2><p>Delete it from Activity and add it again. Your account balance updates automatically.</p></div>`;
  if (page === "Reports")
    html =
      heading(
        "Financial reports",
        "Download your recorded amounts as Excel or PDF.",
      ) +
      '<form id="report-form" class="panel"><div class="report-filters">' +
      field("From date", "from", "date") +
      field("To date", "to", "date") +
      '<label for="report-account">Account</label><select name="account" id="report-account"><option value="">All accounts</option>' +
      state.accounts
        .map(
          (a) =>
            '<option value="' +
            esc(a.id) +
            '">' +
            esc(a.name) +
            " · " +
            esc(a.currency) +
            "</option>",
        )
        .join("") +
      '</select><label for="report-scope">Include</label><select name="scope" id="report-scope"><option value="all">All transactions</option><option value="receipts">Expenses with receipts</option></select></div>' +
      "<p>Reports use recorded transaction amounts and original currencies. Receipt photos and unattached photos are excluded.</p>" +
      '<div class="actions"><button class="primary" type="submit" name="format" value="xlsx">Download Excel</button><button class="secondary" type="submit" name="format" value="pdf">Download PDF</button></div><p id="report-error" role="alert"></p></form>';
  $("#content").innerHTML = html;
  if (page === "Receipts") loadReceiptImages();
}
document.addEventListener("submit", async (event) => {
  if (event.target.id !== "report-form") return;
  event.preventDefault();
  const form = event.target;
  const filters = Object.fromEntries(new FormData(form));
  const format = event.submitter?.value || "xlsx";
  const buttons = [...form.querySelectorAll("button")];
  buttons.forEach((button) => (button.disabled = true));
  try {
    const rows = reportRows(state, filters);
    if (!rows.length)
      throw Error(
        "No matching transactions. Add an expense with its receipt or change the filters.",
      );
    const period =
      (filters.from || "All dates") + " to " + (filters.to || "present");
    const label =
      period + " | Generated " + new Date().toISOString().slice(0, 10);
    const reports = await import("./reports.js");
    const data =
      format === "pdf"
        ? await reports.pdfReport(rows, label)
        : await reports.excelReport(rows, label);
    const blob = new Blob([data], {
      type:
        format === "pdf"
          ? "application/pdf"
          : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download =
      "Zoro-" +
      (filters.scope === "receipts"
        ? "Receipted-Expenses"
        : "Financial-Report") +
      "-" +
      (filters.from || "All-Dates") +
      "-to-" +
      (filters.to || today()) +
      "." +
      format;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } catch (error) {
    $("#report-error").textContent = error.message;
  } finally {
    buttons.forEach((button) => (button.disabled = false));
  }
});
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
function currencyOptions(selected = "EUR") {
  return currencies
    .map(
      (c) =>
        `<option value="${c}" ${c === selected ? "selected" : ""}>${esc(currencyLabel(c))}</option>`,
    )
    .join("");
}
function accountSelect() {
  return `<label for="f-account">Paid from / received into</label><select id="f-account" name="account">${state.accounts.map((a) => `<option value="${esc(a.id)}">${esc(a.name)} · ${esc(currencyLabel(a.currency))}</option>`).join("")}</select>`;
}
const photoField = () =>
  '<label for="f-photo">Receipt photo (optional)</label><input id="f-photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" capture="environment"><small>Take a photo on your phone, or choose an image. Maximum 10 MB.</small>';
let draftCardImage = "";
function appearanceFields(account) {
  const look = cardAppearance(account || {});
  return `<fieldset class="appearance-fields"><legend>Make it yours</legend><div id="card-preview" class="account-hero"></div><label for="f-colour">Card colour</label><div class="colour-controls"><input type="color" name="colour" id="f-colour" value="${look.colour}"><div class="colour-swatches">${cardColours.map((c) => `<button type="button" data-colour="${c}" class="colour-swatch" style="background:${c}" aria-label="Use colour ${c}"></button>`).join("")}</div></div><label for="f-pattern">Background design</label><select id="f-pattern" name="pattern">${cardPatterns.map((p) => `<option value="${p}" ${look.pattern === p ? "selected" : ""}>${{ orbit: "Soft circles", weave: "Woven lines", contour: "Contour lines", solid: "Plain colour" }[p]}</option>`).join("")}</select><label for="f-card-image">Your own card background (optional)</label><input id="f-card-image" type="file" accept="image/jpeg,image/png,image/webp"><small>Choose a JPG, PNG or WebP up to 10 MB. Saved privately with your account. Images are cropped to fit.</small><button type="button" class="secondary" data-action="remove-card-image">Remove custom image</button><small>Text stays readable over your image.</small></fieldset>`;
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
    cardImage: draftCardImage,
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
  draftCardImage = safeCardImage(
    state.accounts.find((a) => a.id === editingAccount)?.cardImage,
  );
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
      (type === "income"
        ? `<label for="f-income-source">Income source</label><select id="f-income-source" name="incomeSource">${options(incomeSources, "Job / salary")}</select>`
        : "") +
      field(
        type === "expense"
          ? "Shop or place"
          : "Employer, person or description (optional)",
        "shop",
        "text",
        type === "expense"
          ? 'required maxlength="100" placeholder="e.g. Lidl"'
          : 'maxlength="100" placeholder="e.g. Monthly salary or employer name"',
      ) +
      field(
        "Amount · in the selected account’s currency",
        "amount",
        "number",
        'required min="0.01" step="any" inputmode="decimal" placeholder="0.00"',
      ) +
      accountSelect() +
      `<details class="optional"><summary>Add a receipt or more details</summary>${type === "expense" ? `<label for="f-category">Category</label><select id="f-category" name="category">${options(["Groceries", "Food & drink", "Transport", "Shopping", "Bills", "Other"], "Other")}</select>` : ""}` +
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
      `<label for="f-currency">Currency</label><select id="f-currency" name="currency">${currencyOptions("EUR")}</select>` +
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
      currencyOptions("EUR") +
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
  if (onlineWallet) next.__revision = await cloud.save(next);
  else {
    // Preview changes stay in memory and are discarded on reload.
  }
  state = next;
  render();
  scheduleExcelSync();
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
  if (onlineWallet) return { path: await cloud.upload(blob) };
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
      if (
        typeof v[key] === "string" &&
        !v[key].trim() &&
        !(formType === "income" && key === "shop")
      )
        throw Error("Please fill in the name or shop.");
    if (formType === "expense" || formType === "income") {
      const a = state.accounts.find((a) => a.id === v.account);
      next = addEntry(next, {
        id,
        shop: v.shop.trim() || v.incomeSource,
        amount: minor(v.amount, a.currency),
        account: v.account,
        kind: formType,
        category: formType === "income" ? v.incomeSource : v.category,
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
        cardImage: draftCardImage,
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
              cardImage: draftCardImage,
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
      const url = onlineWallet ? await cloud.receiptUrl(r.path) : r.image;
      if (onlineWallet) urls.push(url);
      if (el.isConnected) el.src = url;
    } catch {
      el.alt = "Unable to load receipt";
    }
  }
}
function settingsDialog(title, html) {
  $("#settings-dialog-title").textContent = title;
  $("#settings-dialog-content").innerHTML = html;
  if (!$("#settings-dialog").open) $("#settings-dialog").showModal();
}
function downloadFile(data, name, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
function blobDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(Error("Could not read receipt image."));
    reader.readAsDataURL(blob);
  });
}
async function backupWallet() {
  const copy = structuredClone(state);
  delete copy.__revision;
  for (const receipt of copy.receipts) {
    if (onlineWallet)
      receipt.image = await blobDataUrl(await cloud.receiptBlob(receipt.path));
    delete receipt.path;
  }
  const reports = await import("./reports.js");
  const data = await reports.backupExcel(copy);
  if (onlineWallet)
    localStorage.setItem(
      "zoro-backup-prepared:" + cloud.backendHost() + ":" + person.id,
      new Date().toISOString(),
    );
  downloadFile(
    data,
    "Zoro-Full-Wallet-Backup-" + today() + ".xlsx",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}
let pendingRemoval = null;
function askRemove(section, id) {
  pendingRemoval = { section, id, revision: state.__revision };
  const label = id
    ? "this record"
    : section === "identity"
      ? "your account permanently"
      : section === "all"
        ? "all wallet data"
        : "all " + section;
  settingsDialog(
    "Remove " + label,
    "<p>Download a full Excel backup before removing " +
      esc(label) +
      ". You can restore it later from Settings → Data management.</p>" +
      (section === "accounts"
        ? "<p>Account removal also removes its transactions. Receipt photos remain in Receipts.</p>"
        : "") +
      (section === "identity" && cloud.usingOwnBackend()
        ? "<p>This deletes the sign-in and wallet in your own project and disconnects it. Your separate Zoro cloud identity and any old Zoro cloud records remain. To delete those too, return to Zoro cloud and delete that account separately.</p>"
        : "") +
      '<button class="primary" data-action="backup-then-remove">Download backup, then review deletion</button>' +
      '<button class="secondary" data-action="review-remove">Review without backup</button>' +
      '<p id="data-error" role="alert"></p>',
  );
}
async function reviewRemoval(withBackup) {
  if (!pendingRemoval) return;
  busy = true;
  try {
    if (withBackup) await backupWallet();
    const label = pendingRemoval.id
      ? "this record"
      : pendingRemoval.section === "identity"
        ? "your sign-in account and ALL wallet data permanently"
        : pendingRemoval.section === "all"
          ? "ALL wallet data"
          : "all " + pendingRemoval.section;
    settingsDialog(
      "Confirm removal",
      "<p>" +
        esc(
          withBackup
            ? "Wait for the backup download to finish and keep it safe. "
            : "",
        ) +
        "Type DELETE to remove " +
        esc(label) +
        ".</p>" +
        '<label for="delete-confirm">Confirmation</label><input id="delete-confirm" autocomplete="off" placeholder="DELETE">' +
        '<button class="primary submit" data-action="confirm-remove">Delete selected data</button><p id="data-error" role="alert"></p>',
    );
  } catch (error) {
    $("#data-error").textContent = error.message;
  } finally {
    busy = false;
  }
}
async function confirmRemoval() {
  if ($("#delete-confirm").value !== "DELETE" || !pendingRemoval) return;
  busy = true;
  try {
    if (pendingRemoval.revision !== state.__revision)
      throw Error(
        "Your wallet changed. Close this dialog and review deletion again.",
      );
    const next = removeData(
      state,
      pendingRemoval.section === "identity" ? "all" : pendingRemoval.section,
      pendingRemoval.id,
    );
    const retained = new Set(next.receipts.map((r) => r.id));
    const files = state.receipts
      .filter((r) => !retained.has(r.id) && r.path)
      .map((r) => r.path);
    if (pendingRemoval.section === "identity") {
      await cloud.deleteOwnAccount();
      pendingRemoval = null;
      person = null;
      state = null;
      onlineWallet = false;
      $("#settings-dialog").close();
      showDemo();
      toast("Account and wallet deleted.");
      return;
    }
    await commit(next);
    for (const path of files) await cloud.removeFile(path);
    pendingRemoval = null;
    $("#settings-dialog").close();
    $("#account-dialog").close();
    toast("Selected data removed.");
  } catch (error) {
    $("#data-error").textContent = error.message;
  } finally {
    busy = false;
  }
}
const backupReminded = new Set();
function remindBackup() {
  if (!onlineWallet || !state.accounts.length) return;
  const key = cloud.backendHost() + ":" + person.id,
    last = Date.parse(
      localStorage.getItem("zoro-backup-prepared:" + key) || "",
    );
  if (
    !backupReminded.has(key) &&
    (!Number.isFinite(last) || Date.now() - last > 7 * 86400000)
  ) {
    backupReminded.add(key);
    toast(
      "Keep a separate backup: Settings → Data management → Full Excel backup. Online saving alone is not a backup.",
    );
  }
}
function showRecoveryCodes() {
  settingsDialog(
    "Authenticator recovery codes",
    '<p>Recovery codes let you reset a lost authenticator after signing in with your first factor. Each code is used once. Keep them offline in a password manager or a printed private copy, separate from your device. Generating new codes invalidates all old codes.</p><button class="primary" id="generate-recovery-codes">Generate new recovery codes</button><p id="recovery-codes-error" role="alert"></p>',
  );
  $("#generate-recovery-codes").onclick = async (e) => {
    const button = e.currentTarget;
    button.disabled = true;
    try {
      const codes = await cloud.recoveryCodes();
      if (!Array.isArray(codes) || codes.some((c) => !/^[a-f0-9]{32}$/.test(c)))
        throw Error("Unexpected recovery-code response.");
      settingsDialog(
        "Save your recovery codes",
        "<p>These will not be shown again. Store them privately. Do not upload them to GitHub or send them to support.</p><pre>" +
          esc(codes.join("\n")) +
          '</pre><button class="primary" id="download-recovery-codes">Download private text file</button>',
      );
      $("#download-recovery-codes").onclick = () =>
        downloadFile(
          "Zoro authenticator recovery codes\nKeep private. Each code works once.\n\n" +
            codes.join("\n"),
          "Zoro-Recovery-Codes.txt",
          "text/plain",
        );
    } catch (error) {
      $("#recovery-codes-error").textContent = error.message;
      button.disabled = false;
    }
  };
}
function showAuthenticatorRecovery() {
  settingsDialog(
    "Recover lost authenticator",
    '<p>You must be signed in with your email/password, Google or SMS first. Enter one of your saved recovery codes. This resets all authenticator factors and approved-browser choices, invalidates remaining recovery codes and revokes sessions. You must sign in again and register a new authenticator. Without a saved code, contact the project owner for an identity-verified recovery; do not share passwords.</p><form id="recover-auth-form"><label for="recover-auth-code">One-time recovery code</label><input id="recover-auth-code" name="code" type="password" required autocomplete="off" pattern="[a-fA-F0-9]{32}" maxlength="32"><button class="primary submit">Use code and reset security</button><p id="recover-auth-error" role="alert"></p></form>',
  );
  $("#recover-auth-form").onsubmit = async (e) => {
    e.preventDefault();
    const button = e.currentTarget.querySelector("button");
    button.disabled = true;
    try {
      await cloud.recoverAccount(new FormData(e.currentTarget).get("code"));
      person = null;
      state = null;
      onlineWallet = false;
      $("#settings-dialog").close();
      loginScreen();
      toast("Security reset. Sign in and enroll a new authenticator.");
    } catch (error) {
      $("#recover-auth-error").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
}
let excelModule = null,
  excelAuto = false,
  excelTimer = null;
async function syncExcelNow() {
  if (!onlineWallet || !excelModule?.connected())
    throw Error("Sign in and connect Microsoft first.");
  const identity = cloud.backendHost() + ":" + person.id,
    copy = structuredClone(state),
    reports = await import("./reports.js");
  const buffer = await reports.excelReport(
    reportRows(copy),
    "All recorded transactions | Updated " + new Date().toISOString(),
  );
  if (!onlineWallet || identity !== cloud.backendHost() + ":" + person.id)
    throw Error("Wallet changed. Reconnect Excel.");
  await excelModule.sync(buffer);
}
function scheduleExcelSync() {
  if (!excelAuto || !excelModule?.connected()) return;
  clearTimeout(excelTimer);
  excelTimer = setTimeout(
    () =>
      syncExcelNow()
        .then(() => toast("Online Excel workbook updated."))
        .catch((error) => {
          excelAuto = false;
          toast(error.message);
        }),
    3000,
  );
}
async function showExcelSettings() {
  if (!onlineWallet)
    return toast("Sign into your own wallet before connecting Microsoft.");
  excelModule ||= await import("./excel-sync.js");
  settingsDialog(
    "Online Excel workbook",
    `<p>Connect your Microsoft account to create a private OneDrive workbook. Zoro sends all recorded transactions and report graphs, without receipt images. This is a one-way report: app updates replace the workbook contents. Manual edits there do not change Zoro and can be overwritten.</p><p>No workbook is shared publicly by Zoro. Your Microsoft administrator or existing sharing settings may still apply.</p>${excelModule.configured ? '<button class="primary" id="excel-connect">Connect Microsoft and send my report</button>' : "<p>The owner must configure MICROSOFT_CLIENT_ID in Cloudflare and the Microsoft SPA callback before this option is available.</p>"}${excelModule.connected() ? '<button class="secondary" id="excel-sync-now">Update workbook now</button><label><input id="excel-auto" type="checkbox" ' + (excelAuto ? "checked" : "") + '> Update after changes while this browser is connected</label><button class="secondary" id="excel-disconnect">Disconnect Microsoft</button>' : ""}<p id="excel-error" role="status"></p>`,
  );
  if ($("#excel-connect"))
    $("#excel-connect").onclick = async (e) => {
      e.currentTarget.disabled = true;
      try {
        const identity = cloud.backendHost() + ":" + person.id;
        await excelModule.connect(identity);
        await syncExcelNow();
        await showExcelSettings();
        toast("Private Excel workbook created in your OneDrive.");
      } catch (error) {
        $("#excel-error").textContent = error.message;
      } finally {
        if ($("#excel-connect")) $("#excel-connect").disabled = false;
      }
    };
  if (excelModule.connected()) {
    $("#excel-sync-now").onclick = async (e) => {
      e.currentTarget.disabled = true;
      try {
        await syncExcelNow();
        $("#excel-error").textContent = "Workbook updated.";
      } catch (error) {
        $("#excel-error").textContent = error.message;
      } finally {
        if ($("#excel-sync-now")) $("#excel-sync-now").disabled = false;
      }
    };
    $("#excel-auto").onchange = (e) => {
      excelAuto = e.target.checked;
    };
    $("#excel-disconnect").onclick = () => {
      excelAuto = false;
      clearTimeout(excelTimer);
      excelModule.disconnect();
      showExcelSettings();
    };
  }
}
function showBackendSettings() {
  settingsDialog(
    "Cloud connection",
    `<p><strong>Zoro cloud connects automatically when you sign in.</strong> No Supabase account or key is needed for everyday use.</p>
    <details><summary>Use a Supabase project I own</summary><ol>
    <li>Create a dedicated project at <a href="https://supabase.com/dashboard" target="_blank" rel="noopener noreferrer">Supabase</a>.</li>
    <li><a href="setup.sql" download="Zoro-Backend-Setup.sql">Download Zoro setup SQL</a> and run it once in the new project's SQL Editor. Use a new, empty project.</li>
    <li>Enable email confirmation, TOTP and your email sender. Set the Site URL and allowed redirect to <code>${esc(location.origin)}/</code>.</li>
    <li>Download a <button class="link" data-action="backup-wallet">full Excel backup</button> before switching. Connect below, create or sign into your project login, then restore the backup in Settings.</li></ol>
    <p>Your project choice is remembered with your Zoro ID after verified sign-in there. Other devices first sign into Zoro, then your own project. Passwords and authenticator secrets are never copied between projects. Existing data stays in the previous project until you remove it.</p>
    ${onlineWallet && !cloud.usingOwnBackend() ? `<form id="backend-form"><label for="backend-url">Project URL</label><input id="backend-url" name="url" type="url" required placeholder="https://yourproject.supabase.co"><label for="backend-key">Publishable key</label><input id="backend-key" name="key" required autocomplete="off" placeholder="sb_publishable_…"><p>Only public connection details belong here. Never enter a database password or secret/service-role key.</p><button class="primary submit">Continue to my project sign-in</button></form>` : "<p>Sign into Zoro cloud to connect a different project.</p>"}
    </details>${cloud.usingOwnBackend() ? '<p>This wallet uses your own backend. Returning to Zoro cloud leaves these records in your project and clears the remembered link.</p><button class="secondary" data-action="default-backend">Return to Zoro cloud</button>' : ""}<p id="data-error" role="alert"></p>`,
  );
}
document.addEventListener("submit", async (event) => {
  if (event.target.id !== "backend-form") return;
  event.preventDefault();
  if (busy) return;
  busy = true;
  try {
    const values = new FormData(event.target);
    person = await cloud.activateBackend(
      { url: values.get("url"), key: values.get("key") },
      true,
    );
    state = null;
    onlineWallet = false;
    $("#settings-dialog").close();
    if (person) await openAuthenticatedWallet();
    else loginScreen();
  } catch (error) {
    const el = $("#data-error");
    if (el) el.textContent = error.message;
    else toast(error.message);
  } finally {
    busy = false;
  }
});
function showDataManagement() {
  settingsDialog(
    "Data management",
    "<h3>Back up your wallet</h3><p>A full Excel backup includes accounts, transactions, debts and receipt images. Keep the downloaded file private.</p>" +
      '<button class="primary" data-action="backup-wallet">Download full Excel backup</button>' +
      '<h3>Import Excel</h3><form id="import-form"><label for="import-kind">Import type</label><select id="import-kind" name="kind"><option value="backup">Restore a full Zoro backup</option><option value="report">Merge a Zoro transaction report</option></select>' +
      '<label for="import-file">Excel file (.xlsx, up to 25 MB)</label><input id="import-file" name="file" type="file" accept=".xlsx" required>' +
      "<p>Restoring a backup replaces the current wallet. Reports merge new transaction references. New report accounts start at zero. Report imports exclude receipt photos.</p>" +
      '<button class="secondary submit">Review Excel import</button></form>' +
      '<h3>Remove data</h3><label for="delete-section">Section</label><select id="delete-section"><option value="entries">Activity / transactions</option><option value="accounts">Accounts and their transactions</option><option value="receipts">Receipt images and notes</option><option value="debts">Debts</option><option value="all">All wallet data</option>' +
      (onlineWallet
        ? '<option value="identity">Delete my sign-in account and all wallet data</option>'
        : "") +
      "</select>" +
      '<button class="secondary submit" data-action="remove-section">Review deletion</button><p>All wallet data clears your records across devices. Your sign-in account remains available.</p><p id="data-error" role="alert"></p>',
  );
}
let pendingImport = null;
document.addEventListener("submit", async (event) => {
  if (event.target.id !== "import-form") return;
  event.preventDefault();
  if (busy) return;
  busy = true;
  try {
    const values = new FormData(event.target),
      file = values.get("file");
    if (!file || !file.size || file.size > 25 * 1024 * 1024)
      throw Error("Choose an Excel file smaller than 25 MB.");
    const reports = await import("./reports.js"),
      buffer = await file.arrayBuffer();
    if (values.get("kind") === "backup") {
      const restored = validateBackup(await reports.readBackup(buffer));
      pendingImport = {
        state: restored,
        restore: true,
        revision: state.__revision,
      };
    } else {
      const imported = await reports.importTransactions(buffer, state);
      validateBackup({ ...imported.state, receipts: [] });
      pendingImport = {
        state: imported.state,
        restore: false,
        added: imported.added,
        revision: state.__revision,
      };
    }
    settingsDialog(
      "Confirm Excel import",
      "<p>" +
        esc(
          pendingImport.restore
            ? "This replaces your current wallet with " +
                pendingImport.state.accounts.length +
                " accounts and " +
                pendingImport.state.entries.length +
                " transactions."
            : "This adds " +
                pendingImport.added +
                " new transactions. Existing transaction references are skipped.",
        ) +
        '</p><button class="primary" data-action="backup-import">Back up current wallet, then import</button><button class="secondary" data-action="confirm-import">Import without backup</button><p id="data-error" role="alert"></p>',
    );
  } catch (error) {
    $("#data-error").textContent = error.message;
  } finally {
    busy = false;
  }
});
async function completeImport(withBackup) {
  if (!pendingImport) return;
  busy = true;
  const uploaded = [];
  try {
    if (pendingImport.revision !== state.__revision)
      throw Error(
        "Your wallet changed. Close this dialog and import the file again.",
      );
    if (withBackup) await backupWallet();
    const next = structuredClone(pendingImport.state);
    if (pendingImport.restore && onlineWallet) {
      for (const receipt of next.receipts) {
        const binary = atob(receipt.image.split(",")[1]);
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        const path = await cloud.upload(
          new Blob([bytes], { type: "image/jpeg" }),
        );
        uploaded.push(path);
        receipt.path = path;
        delete receipt.image;
      }
    }
    const oldPaths = pendingImport.restore
      ? state.receipts.filter((r) => r.path).map((r) => r.path)
      : [];
    next.__revision = state.__revision;
    await commit(next);
    // Save succeeds before old receipt objects are cleaned up.
    pendingImport = null;
    for (const path of oldPaths) await cloud.removeFile(path);
    $("#settings-dialog").close();
    toast("Excel import completed.");
  } catch (error) {
    if (pendingImport)
      for (const path of uploaded) await cloud.removeFile(path).catch(() => {});
    $("#data-error").textContent = error.message;
  } finally {
    busy = false;
  }
}
function showTutorial() {
  $("#settings-dialog").close();
  showTourStep(0);
}
function showPasswordForm() {
  settingsDialog(
    "Change password",
    '<form id="password-form">' +
      field(
        "Current password",
        "current-password",
        "password",
        'required autocomplete="current-password"',
      ) +
      field(
        "New password",
        "new-password",
        "password",
        'required minlength="12" maxlength="72" autocomplete="new-password"',
      ) +
      field(
        "Confirm new password",
        "confirm-password",
        "password",
        'required autocomplete="new-password"',
      ) +
      '<p role="alert" id="password-error"></p><button class="primary submit">Save password</button></form>',
  );
  $("#password-form").onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector("button");
    const values = new FormData(form);
    const password = values.get("new-password");
    submit.disabled = true;
    try {
      if (password !== values.get("confirm-password"))
        throw Error("The new passwords do not match.");
      if (new TextEncoder().encode(password).length > 72)
        throw Error("Choose a shorter password.");
      await cloud.changePassword(values.get("current-password"), password);
      form.reset();
      $("#settings-dialog").close();
      toast("Password changed.");
    } catch (error) {
      $("#password-error").textContent = error.message;
    } finally {
      submit.disabled = false;
    }
  };
}
function browserLabel(agent = "") {
  const platform =
    agent.match(/iPhone|iPad|Android|Windows|Macintosh|Linux/i)?.[0] ||
    "Unknown device";
  const browser = /Edg\//.test(agent)
    ? "Edge"
    : /Firefox|FxiOS/.test(agent)
      ? "Firefox"
      : /Chrome|CriOS/.test(agent)
        ? "Chrome"
        : /Safari/.test(agent)
          ? "Safari"
          : "Browser";
  return browser + " · " + platform;
}
let newestOtherSession = null;
const noticedDeviceRequests = new Set();
async function checkNewSignIns(userId) {
  const sessions = await cloud.signedInSessions();
  try {
    const info = await cloud.devices();
    for (const d of info.devices.filter((d) => d.status === "pending")) {
      if (!noticedDeviceRequests.has(d.id)) {
        noticedDeviceRequests.add(d.id);
        toast(
          "New sign-in approval requested from " +
            browserLabel(d.label) +
            " · " +
            d.location +
            ". Review in Settings → New-browser approval.",
        );
      }
    }
  } catch {}
  if (person?.id !== userId || !state) return;
  const newest = sessions.find((item) => !item.is_current);
  const timestamp = newest ? Date.parse(newest.started_at) : 0;
  if (newest && newestOtherSession !== null && timestamp > newestOtherSession)
    toast(
      "New sign-in on " +
        browserLabel(newest.browser_agent || "") +
        ". Review it in Settings → Signed-in browsers.",
    );
  newestOtherSession = Math.max(newestOtherSession || 0, timestamp);
}
async function showSessions() {
  const sessions = await cloud.signedInSessions();
  const rows = sessions
    .map(
      (item) =>
        "<li><strong>" +
        esc(browserLabel(item.browser_agent || "")) +
        (item.is_current ? " (this browser)" : "") +
        "</strong><br>Signed in " +
        esc(new Date(item.started_at).toLocaleString()) +
        "</li>",
    )
    .join("");
  settingsDialog(
    "Signed-in browsers",
    "<ul>" +
      rows +
      "</ul>" +
      "<p>Review browsers that completed authenticator verification.</p>" +
      '<button class="secondary" data-action="logout-others">Sign out all other browsers</button>',
  );
}
async function refresh(authenticated = onlineWallet) {
  if (authenticated) {
    const signedInId = person?.id;
    if (!signedInId) return;
    const record = await cloud.load();
    const loaded = record || { ...emptyState(), __revision: 0 };
    if (person?.id !== signedInId) return;
    if (!state || (loaded.__revision || 0) >= (state.__revision || 0))
      state = loaded;
    state.currency = "EUR";
    onlineWallet = true;
    render();
    checkLocalLock();
    remindBackup();
    checkNewSignIns(signedInId).catch(() => {});
    const tutorialKey = "zoro-tutorial:" + signedInId;
    if (!record && !localStorage.getItem(tutorialKey)) {
      localStorage.setItem(tutorialKey, "seen");
      toast(
        "Your wallet starts empty. Open Settings → Help whenever you want a tutorial.",
      );
    }
    return;
  }
  render();
}
document.addEventListener("click", async (event) => {
  const b = event.target.closest("button");
  if (!b || busy) return;
  try {
    if (
      b.dataset.approveDevice ||
      b.dataset.rejectDevice ||
      b.dataset.revokeDevice
    ) {
      const id =
        b.dataset.approveDevice ||
        b.dataset.rejectDevice ||
        b.dataset.revokeDevice;
      b.disabled = true;
      try {
        if (b.dataset.revokeDevice) await cloud.revokeDevice(id);
        else await cloud.reviewDevice(id, Boolean(b.dataset.approveDevice));
        await showDeviceSecurity();
      } finally {
        b.disabled = false;
      }
      return;
    }
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
      askRemove("entries", b.dataset.deleteEntry);
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
      askRemove("receipts", b.dataset.deleteReceipt);
      return;
    }
    if (b.dataset.removeAccount) {
      $("#account-dialog").close();
      askRemove("accounts", b.dataset.removeAccount);
      return;
    }
    if (b.dataset.removeDebt) {
      askRemove("debts", b.dataset.removeDebt);
      return;
    }
    if (b.dataset.viewReceipt) {
      $("#account-dialog").close();
      const r = state.receipts.find((r) => r.id === b.dataset.viewReceipt);
      const url = onlineWallet ? await cloud.receiptUrl(r.path) : r.image;
      if (onlineWallet) urls.push(url);
      $("#modal-title").textContent = r.shop;
      $("#fields").innerHTML =
        `<img src="${esc(url)}" alt="Receipt" style="width:100%">`;
      $("#form-error").textContent = "";
      $("#form .submit").hidden = true;
      $("#modal").showModal();
      return;
    }
    const action = b.dataset.action;
    if (action === "local-security") showLocalSecurity();
    if (action === "excel-settings") showExcelSettings();
    if (action === "device-security") await showDeviceSecurity();
    if (action === "recovery-codes") showRecoveryCodes();
    if (action === "recover-authenticator") showAuthenticatorRecovery();
    if (action === "forgot-password") showPasswordRecovery();
    if (action === "google-login") await cloud.googleLogin();
    if (action === "phone-login") showPhoneLogin();
    if (action === "remove-card-image") {
      draftCardImage = "";
      $("#f-card-image").value = "";
      updateCardPreview();
    }
    if (action === "backend-settings") showBackendSettings();
    if (action === "default-backend") {
      busy = true;
      try {
        excelAuto = false;
        clearTimeout(excelTimer);
        excelModule?.disconnect();
        person = await cloud.useDefaultBackend();
        state = null;
        onlineWallet = false;
        $("#settings-dialog").close();
        if (person) await openAuthenticatedWallet();
        else loginScreen();
      } finally {
        busy = false;
      }
    }
    if (action === "data-management") showDataManagement();
    if (action === "backup-wallet") {
      busy = true;
      try {
        await backupWallet();
        toast("Excel backup downloaded. Keep it private.");
      } finally {
        busy = false;
      }
    }
    if (action === "remove-section") askRemove($("#delete-section").value);
    if (action === "backup-then-remove") await reviewRemoval(true);
    if (action === "review-remove") await reviewRemoval(false);
    if (action === "confirm-remove") await confirmRemoval();
    if (action === "backup-import") await completeImport(true);
    if (action === "confirm-import") await completeImport(false);
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
      a.download = `Zoro-Records-${today()}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast(
        "Downloaded records. Keep this private. Receipt photos are not included in online exports.",
      );
    }
    if (action === "help") showTutorial();
    if (action === "start-tour" && !onlineWallet && state) showTourStep(0);
    if (action === "previous-tour" && tourIndex > 0)
      showTourStep(tourIndex - 1);
    if (action === "next-tour") {
      if (tourIndex + 1 < tourSteps.length) showTourStep(tourIndex + 1);
      else tourDialog.close();
    }
    if (action === "skip-tour") tourDialog.close();
    if (action === "close-help") $("#settings-dialog").close();
    if (action === "password" && person && state) showPasswordForm();
    if (action === "sessions" && person && state) await showSessions();
    if (action === "logout-others" && person && state) {
      if (!confirm("Sign out every other signed-in browser?")) return;
      await cloud.signOutOthers();
      await showSessions();
      toast("Other sessions signed out.");
    }
    if (action === "register" || action === "login") {
      if (!cloud.configured || onlineWallet) return;
      loginScreen(action === "register");
      return;
    }
    if (action === "preview") {
      showDemo();
      return;
    }
    if (action === "logout") {
      newestOtherSession = null;
      $("#account-dialog").close();
      $("#account-detail").innerHTML = "";
      state = null;
      onlineWallet = false;
      person = null;
      for (const url of urls) URL.revokeObjectURL(url);
      urls = [];
      await cloud.logout();
      showDemo();
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
$("#settings-dialog").addEventListener("cancel", (event) => {
  if (busy) event.preventDefault();
});
$("#settings-dialog .modal-head").addEventListener("submit", (event) => {
  if (busy) event.preventDefault();
});
$("#privacy").onclick = () => {
  const hidden = document.body.classList.toggle("hidden-balances");
  $("#privacy").setAttribute(
    "aria-label",
    hidden ? "Show balances" : "Hide balances",
  );
};
document.addEventListener("change", async (event) => {
  if (event.target.id !== "f-card-image") return;
  const input = event.target,
    file = input.files[0];
  if (!file || busy) return;
  busy = true;
  $("#form .submit").disabled = true;
  $("#form-error").textContent = "";
  let bitmap;
  try {
    if (
      file.size > 10 * 1024 * 1024 ||
      !["image/jpeg", "image/png", "image/webp"].includes(file.type)
    )
      throw Error("Choose a JPG, PNG or WebP smaller than 10 MB.");
    bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 404;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#244f43";
    ctx.fillRect(0, 0, 640, 404);
    const scale = Math.max(640 / bitmap.width, 404 / bitmap.height);
    ctx.drawImage(
      bitmap,
      (640 - bitmap.width * scale) / 2,
      (404 - bitmap.height * scale) / 2,
      bitmap.width * scale,
      bitmap.height * scale,
    );
    let encoded = canvas.toDataURL("image/jpeg", 0.75);
    if (!safeCardImage(encoded)) encoded = canvas.toDataURL("image/jpeg", 0.5);
    if (!safeCardImage(encoded))
      throw Error(
        "This image is too detailed. Choose a simpler or smaller image.",
      );
    draftCardImage = encoded;
    updateCardPreview();
  } catch (error) {
    $("#form-error").textContent = error.message;
    input.value = "";
  } finally {
    bitmap?.close();
    busy = false;
    $("#form .submit").disabled = false;
  }
});
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
function showPasswordRecovery() {
  settingsDialog(
    "Recover your password",
    `<p>Enter your account email. If it is registered, you will receive a recovery link. Open the link in this browser. Keep your authenticator available.</p><form id="recovery-form">${field("Email address", "recovery-email", "email", 'required autocomplete="email"')}<button class="primary submit">Send recovery link</button><p id="recovery-status" role="status"></p></form>`,
  );
  $("#recovery-form").onsubmit = async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button");
    button.disabled = true;
    try {
      await cloud.requestPasswordReset(
        new FormData(event.currentTarget).get("recovery-email").trim(),
      );
      $("#recovery-status").textContent =
        "If this address is registered, check its inbox for a recovery link.";
    } catch (error) {
      $("#recovery-status").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
}
function showPasswordReset() {
  $("#content").innerHTML =
    `<div class="login-wrap"><div class="panel login-panel"><h1>Choose a new password</h1><form id="reset-password-form">${field("New password", "reset-password", "password", 'required minlength="12" maxlength="72" autocomplete="new-password"')}${field("Repeat new password", "reset-confirm", "password", 'required minlength="12" maxlength="72" autocomplete="new-password"')}<p id="reset-error" role="alert"></p><button class="primary submit">Save password</button></form></div></div>`;
  $("#reset-password-form").onsubmit = async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button");
    button.disabled = true;
    try {
      const values = new FormData(event.currentTarget),
        password = values.get("reset-password");
      if (
        password !== values.get("reset-confirm") ||
        new TextEncoder().encode(password).length > 72
      )
        throw Error("Passwords must match and be at most 72 UTF-8 bytes.");
      await cloud.resetPassword(password);
      history.replaceState(null, "", location.pathname);
      await cloud.logout();
      person = null;
      state = null;
      loginScreen();
      toast(
        "Password updated. Sign in with your new password and authenticator.",
      );
    } catch (error) {
      $("#reset-error").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
}
function showPhoneLogin() {
  settingsDialog(
    "Sign in with SMS",
    `<p>Enter your number in international format. SMS verifies your phone; your authenticator is still required before wallet access. Standard provider charges and rate limits apply.</p><form id="phone-form">${field("Phone number", "phone-number", "tel", 'required pattern="\\+[1-9][0-9]{6,14}" autocomplete="tel" placeholder="+353…"')}<button class="primary submit">Send code</button><p id="phone-error" role="alert"></p></form>`,
  );
  $("#phone-form").onsubmit = async (event) => {
    event.preventDefault();
    const button = event.currentTarget.querySelector("button");
    button.disabled = true;
    try {
      const phone = new FormData(event.currentTarget).get("phone-number");
      await cloud.phoneCode(phone);
      settingsDialog(
        "Enter SMS code",
        `<form id="sms-form">${field("SMS code", "sms-code", "text", 'required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6"')}<button class="primary submit">Verify phone</button><p id="phone-error" role="alert"></p></form>`,
      );
      $("#sms-form").onsubmit = async (ev) => {
        ev.preventDefault();
        const btn = ev.currentTarget.querySelector("button");
        btn.disabled = true;
        try {
          person = await cloud.verifyPhone(
            phone,
            new FormData(ev.currentTarget).get("sms-code"),
          );
          $("#settings-dialog").close();
          loginScreen();
          await openAuthenticatedWallet();
        } catch (error) {
          const el = $("#phone-error");
          if (el) el.textContent = error.message;
          else toast(error.message);
        } finally {
          btn.disabled = false;
        }
      };
    } catch (error) {
      $("#phone-error").textContent = error.message;
    } finally {
      button.disabled = false;
    }
  };
}
function showDemo() {
  excelAuto = false;
  clearTimeout(excelTimer);
  excelModule?.disconnect();
  onlineWallet = false;
  state = demo();
  page = "Home";
  render();
}
function loginScreen(registering = false) {
  excelModule?.disconnect();
  excelAuto = false;
  state = null;
  onlineWallet = false;
  $("#preview-auth").hidden = true;
  $("#preview-banner").hidden = true;
  document.querySelector("nav").innerHTML = "";
  $("#privacy").hidden = true;
  $(".demo").textContent = "● Private money space";
  const title = registering ? "Create your Zoro account" : "Sign in to Zoro";
  const passwordOptions = registering
    ? 'required minlength="12" maxlength="72" autocomplete="new-password"'
    : 'required autocomplete="current-password"';
  $("#content").innerHTML =
    '<div class="login-wrap"><h1>Your private wallet</h1><div class="panel login-panel"><h2>' +
    title +
    "</h2><p>" +
    (cloud.usingOwnBackend()
      ? "Signing into your own project: <strong>" +
        esc(cloud.backendHost()) +
        "</strong>. This is a separate project login. Use credentials you created there. Your Zoro login remains separate."
      : "Use your email address.") +
    '</p><form id="login-form">' +
    field(
      "Email address",
      "email",
      "email",
      'required autocomplete="username"',
    ) +
    field("Password", "password", "password", passwordOptions) +
    (registering ? "<small>Use at least 12 characters.</small>" : "") +
    '<p id="login-error" role="alert"></p><p id="login-status" role="status"></p><button class="primary submit">' +
    (registering ? "Create account" : "Sign in") +
    '</button></form><button id="auth-mode" class="secondary" type="button">' +
    (registering ? "Back to sign in" : "Create an account") +
    '</button><button class="secondary" type="button" data-action="forgot-password">Forgot password?</button>' +
    (!cloud.usingOwnBackend() && cloud.signInOptions.google
      ? '<button class="secondary" type="button" data-action="google-login">Continue with Google</button>'
      : "") +
    (!cloud.usingOwnBackend() && cloud.signInOptions.phone
      ? '<button class="secondary" type="button" data-action="phone-login">Continue with phone number</button>'
      : "") +
    (cloud.usingOwnBackend()
      ? '<button class="secondary" type="button" data-action="default-backend">Return to Zoro cloud</button>'
      : "") +
    '<button class="secondary" type="button" data-action="preview">Back to sample wallet</button></div></div>';
  $("#auth-mode").onclick = () => loginScreen(!registering);
  $("#login-form").onsubmit = async (e) => {
    e.preventDefault();
    const form = e.currentTarget;
    const button = form.querySelector("button");
    const mode = $("#auth-mode");
    const back = $('[data-action="preview"]');
    button.disabled = mode.disabled = back.disabled = true;
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
      button.disabled = mode.disabled = back.disabled = false;
    }
  };
}
async function finishAuthentication() {
  if (cloud.isPasswordRecovery()) return showPasswordReset();
  const approval = await cloud.deviceGate();
  if (!approval.approved) return showPendingDevice(approval);
  if (!cloud.usingOwnBackend()) {
    const backend = await cloud.savedBackend();
    if (backend) {
      excelAuto = false;
      clearTimeout(excelTimer);
      excelModule?.disconnect();
      person = await cloud.activateBackend(backend);
      state = null;
      onlineWallet = false;
      if (person) return openAuthenticatedWallet();
      return loginScreen();
    }
  } else await cloud.rememberBackend();
  return refresh(true);
}
function showPendingDevice(approval) {
  state = null;
  onlineWallet = false;
  document.querySelector("nav").innerHTML = "";
  $("#content").innerHTML =
    `<div class="login-wrap"><div class="panel login-panel"><h1>${approval.status === "rejected" ? "Browser not approved" : "Approve this sign-in"}</h1><p>Open Zoro on an already approved phone or PC, then go to Settings → New-browser approval. Check the browser and approximate location before approving. Approval requests expire after 15 minutes; sign out and start again if yours expires.</p><p>No wallet data is available in this browser until approved. Notifications appear inside Zoro while it is open; this is not a phone push notification.</p><button class="primary" id="check-device-approval">Check approval</button><button class="secondary" data-action="logout">Sign out</button><p id="approval-error" role="alert"></p></div></div>`;
  $("#check-device-approval").onclick = async (e) => {
    e.currentTarget.disabled = true;
    try {
      const status = await cloud.deviceGate();
      if (status.approved) await finishAuthentication();
      else
        $("#approval-error").textContent =
          status.status === "rejected"
            ? "This request was rejected. Contact the owner or sign out."
            : "Still waiting. Review it on your approved device.";
    } catch (error) {
      $("#approval-error").textContent = error.message;
    } finally {
      if ($("#check-device-approval"))
        $("#check-device-approval").disabled = false;
    }
  };
}
async function showDeviceSecurity() {
  if (!onlineWallet) return toast("Sign in before managing browser approvals.");
  const gate = await cloud.deviceGate();
  if (!gate.available) {
    settingsDialog(
      "Browser approval setup",
      "<p>This backend needs the <code>device-approval.sql</code> migration. Follow the advanced setup guide in GitHub. Existing password and authenticator protection remains active.</p>",
    );
    return;
  }
  const result = await cloud.devices();
  settingsDialog(
    "New-browser approval",
    `<p>When enabled, an unfamiliar browser needs approval from an approved phone or PC after password/SMS/Google and authenticator verification. Keep at least one approved browser available. A random browser token remembers trusted browsers; it is not a guarantee of physical hardware binding.</p><p>Locations are approximate network-derived labels and may be wrong or reflect a VPN. No GPS permission or raw IP is stored in this list. The app must be open to show new-request notices.</p><label><input id="device-approval-enabled" type="checkbox" ${result.enabled ? "checked" : ""}> Require approval for unfamiliar browsers</label><button class="secondary" id="refresh-devices">Refresh list</button><ul>${result.devices.map((d) => `<li><strong>${esc(browserLabel(d.label))}${d.is_current ? " (this browser)" : ""}</strong><br>${esc(d.location)} · ${esc(d.status)}<br>${esc(new Date(d.requested_at).toLocaleString())}${d.status === "pending" ? `<button class="secondary" data-approve-device="${esc(d.id)}">Approve</button><button class="secondary" data-reject-device="${esc(d.id)}">Reject</button>` : !d.is_current && d.status === "approved" ? `<button class="secondary" data-revoke-device="${esc(d.id)}">Revoke browser</button>` : ""}</li>`).join("")}</ul><p id="device-error" role="alert"></p>`,
  );
  $("#device-approval-enabled").onchange = async (e) => {
    const enabled = e.target.checked;
    e.target.disabled = true;
    try {
      await cloud.setDeviceApproval(enabled);
      toast(
        enabled
          ? "New browsers now require approval. Keep this browser available."
          : "Browser approval disabled. Authenticator verification still applies.",
      );
    } catch (error) {
      $("#device-error").textContent = error.message;
      e.target.checked = !enabled;
    } finally {
      e.target.disabled = false;
    }
  };
  $("#refresh-devices").onclick = () =>
    showDeviceSecurity().catch((error) => toast(error.message));
}
async function openAuthenticatedWallet() {
  const factor = await cloud.secondFactor();
  if (!factor) return finishAuthentication();
  $("#content").innerHTML =
    '<div class="login-wrap"><h1>Your private wallet</h1><div class="panel login-panel">' +
    (factor.secret
      ? "<h2>Set up your authenticator</h2><p>Add a time-based account named Zoro in your authenticator app. Enter this setup key there, then enter the six-digit code below.</p><p><code>" +
        esc(factor.secret) +
        "</code></p>"
      : "<h2>Verify your sign-in</h2><p>Enter the six-digit code from your authenticator app.</p>") +
    '<form id="mfa-form">' +
    field(
      "Authenticator code",
      "code",
      "text",
      'required inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6"',
    ) +
    '<p id="mfa-error" role="alert"></p><button class="primary submit">Verify</button></form>' +
    '<button type="button" class="secondary" data-action="recover-authenticator">Lost your authenticator?</button><button type="button" class="secondary" data-action="logout">Sign out</button></div></div>';
  $("#mfa-form").onsubmit = async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const submit = form.querySelector("button");
    submit.disabled = true;
    try {
      await cloud.verifyFactor(factor.id, new FormData(form).get("code"));
      await finishAuthentication();
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
      else showDemo();
    } catch (error) {
      loginScreen();
      $("#login-error").textContent =
        error.message || "Could not load your account. Sign in again.";
    }
  } else {
    showDemo();
  }
  if (!person && state) showTourStep(0);
  rates();
}
document.addEventListener("visibilitychange", () => {
  if (
    !document.hidden &&
    onlineWallet &&
    state &&
    !$("#modal").open &&
    !$("#account-dialog").open &&
    !busy
  )
    refresh().catch(() => toast("Could not refresh. Check your connection."));
});
setInterval(() => {
  if (
    onlineWallet &&
    state &&
    !document.hidden &&
    !$("#modal").open &&
    !$("#account-dialog").open &&
    !busy
  )
    refresh().catch(() => {});
}, 30000);
initializeSecurityUI({
  online: () => onlineWallet,
  userId: () => person?.id,
  backend: () => cloud.backendHost(),
  dialog: settingsDialog,
  closeDialog: () => $("#settings-dialog").close(),
  toast,
  signout: async () => {
    await cloud.logout();
    person = null;
    state = null;
    onlineWallet = false;
    showDemo();
  },
});
init();
