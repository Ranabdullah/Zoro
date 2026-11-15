import { PublicClientApplication } from "@azure/msal-browser";
const scopes = ["Files.ReadWrite"],
  clientId = (window.ZORO_CONFIG || {}).microsoftClientId;
let client,
  account,
  item = null,
  queue = Promise.resolve(),
  namespace = "";
export const configured = Boolean(clientId);
async function init() {
  if (!client) {
    client = new PublicClientApplication({
      auth: {
        clientId,
        authority: "https://login.microsoftonline.com/common",
        redirectUri: location.origin + "/excel-callback.html",
      },
      cache: { cacheLocation: "sessionStorage" },
    });
    await client.initialize();
  }
  return client;
}
export async function connect(walletId) {
  if (!configured)
    throw Error(
      "The owner must configure MICROSOFT_CLIENT_ID and the Microsoft SPA callback first.",
    );
  const app = await init(),
    result = await app.loginPopup({ scopes, prompt: "select_account" });
  account = result.account;
  namespace = "zoro-excel:" + walletId + ":" + account.homeAccountId;
  const saved = sessionStorage.getItem(namespace);
  item = saved ? JSON.parse(saved) : null;
  return account.username;
}
export const connected = () => Boolean(account);
export const workbookUrl = () => item?.webUrl || null;
export function disconnect() {
  account = null;
  item = null;
  namespace = "";
}
async function token() {
  const app = await init();
  try {
    return (await app.acquireTokenSilent({ scopes, account })).accessToken;
  } catch {
    throw Error(
      "Microsoft access expired. Reconnect Excel in Settings. Your wallet remains saved in Zoro.",
    );
  }
}
export function sync(buffer) {
  const selected = account?.homeAccountId,
    sessionKey = namespace;
  const run = async () => {
    if (
      !selected ||
      account?.homeAccountId !== selected ||
      namespace !== sessionKey
    )
      throw Error("Reconnect the Microsoft account before syncing.");
    const accessToken = await token();
    const route = item?.id
      ? `/me/drive/items/${encodeURIComponent(item.id)}/content`
      : `/me/drive/root:/Zoro-${crypto.randomUUID()}.xlsx:/content`;
    const response = await fetch("https://graph.microsoft.com/v1.0" + route, {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      },
      body: buffer,
    });
    if (!response.ok)
      throw Error(
        "Excel sync failed. Check OneDrive access and reconnect; your wallet is still saved in Zoro.",
      );
    const data = await response.json();
    if (account?.homeAccountId !== selected || namespace !== sessionKey) return;
    item = { id: data.id, webUrl: data.webUrl };
    sessionStorage.setItem(namespace, JSON.stringify(item));
    return item;
  };
  queue = queue.catch(() => {}).then(run);
  return queue;
}
