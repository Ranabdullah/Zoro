// Server/owner use only. Never import this into the browser bundle.
import { createClient } from "@supabase/supabase-js";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { encryptSnapshot } from "./backup-crypto.mjs";
const url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publicKey =
  process.env.BACKUP_PUBLIC_KEY ||
  (process.env.BACKUP_PUBLIC_KEY_FILE
    ? await readFile(process.env.BACKUP_PUBLIC_KEY_FILE, "utf8")
    : "");
if (
  !/^https:\/\/[a-z0-9]+\.supabase\.co$/.test(url || "") ||
  !key ||
  !publicKey
)
  throw Error(
    "Set Supabase URL, server-side service-role secret and backup RSA public key. No backup was created.",
  );
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const vaults = [];
for (let offset = 0; ; offset += 100) {
  const { data, error } = await client
    .from("kora_vaults")
    .select("user_id,payload,revision,updated_at")
    .range(offset, offset + 99);
  if (error) throw Error("Vault backup failed.");
  vaults.push(...data);
  if (data.length < 100) break;
}
const objects = [];
async function scan(prefix = "") {
  for (let offset = 0; ; offset += 100) {
    const { data, error } = await client.storage
      .from("kora-receipts")
      .list(prefix, {
        limit: 100,
        offset,
        sortBy: { column: "name", order: "asc" },
      });
    if (error) throw Error("Receipt listing failed.");
    for (const item of data) {
      const name = prefix ? prefix + "/" + item.name : item.name;
      if (!item.id) {
        await scan(name);
        continue;
      }
      const result = await client.storage.from("kora-receipts").download(name);
      if (result.error) throw Error("Receipt download failed; backup aborted.");
      objects.push({
        name,
        data: Buffer.from(await result.data.arrayBuffer()).toString("base64"),
        contentType: result.data.type || "image/jpeg",
      });
    }
    if (data.length < 100) break;
  }
}
await scan();
const users = [];
for (let page = 1; ; page++) {
  const { data, error } = await client.auth.admin.listUsers({
    page,
    perPage: 100,
  });
  if (error) throw Error("Could not back up user mapping.");
  users.push(
    ...data.users.map((u) => ({
      id: u.id,
      email: u.email || null,
      phone: u.phone || null,
    })),
  );
  if (data.users.length < 100) break;
}
const snapshot = {
  format: "zoro-owner-snapshot",
  version: 1,
  project: url,
  created_at: new Date().toISOString(),
  vaults,
  objects,
  users,
};
const encrypted = encryptSnapshot(snapshot, publicKey);
await mkdir("backup-output", { recursive: true });
await writeFile(
  "backup-output/Zoro-encrypted-backup.json",
  JSON.stringify(encrypted),
  { mode: 0o600 },
);
console.log(
  "Encrypted snapshot created. User records, emails and images were not printed. Auth passwords, factors and configuration are not backed up.",
);
