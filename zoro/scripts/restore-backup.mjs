import { createClient } from "@supabase/supabase-js";
import { readFile } from "node:fs/promises";
const [file, ...args] = process.argv.slice(2);
if (!file)
  throw Error(
    "Usage: node scripts/restore-backup.mjs decrypted-snapshot.json [--apply]",
  );
const snapshot = JSON.parse(await readFile(file, "utf8"));
if (
  snapshot.format !== "zoro-owner-snapshot" ||
  snapshot.version !== 1 ||
  !Array.isArray(snapshot.vaults) ||
  !Array.isArray(snapshot.objects)
)
  throw Error("Invalid owner snapshot.");
const url = process.env.SUPABASE_URL,
  key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw Error(
    "Set target SUPABASE_URL and server-side SUPABASE_SERVICE_ROLE_KEY.",
  );
if (url !== snapshot.project && !args.includes("--allow-new-project"))
  throw Error(
    "Target is a different project. Prefer the per-user Excel migration. For administrator mapping, use --allow-new-project after recreating users with matching IDs.",
  );
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
for (const row of snapshot.vaults) {
  const checked = await client.auth.admin.getUserById(row.user_id);
  if (checked.error || !checked.data.user)
    throw Error(
      "A snapshot owner does not exist in the destination. Stop and map/recreate users first.",
    );
}
console.log(
  "Restore validated. This overwrites matching vaults and matching receipt paths; it does not restore passwords, MFA, browser approvals or provider settings.",
);
if (!args.includes("--apply")) {
  console.log(
    "Dry run only. Back up the destination, then add --apply when ready.",
  );
  process.exit(0);
}
for (const item of snapshot.objects) {
  if (!/^[a-f0-9-]{36}\/[a-f0-9-]+\.jpg$/i.test(item.name))
    throw Error("Unexpected receipt path.");
  const data = Buffer.from(item.data, "base64");
  if (data.length > 2097152) throw Error("Receipt exceeds bucket limit.");
  const result = await client.storage
    .from("kora-receipts")
    .upload(item.name, data, { contentType: "image/jpeg", upsert: true });
  if (result.error)
    throw Error("Receipt restore failed. Stop and review before retrying.");
}
for (const row of snapshot.vaults) {
  const current = await client
    .from("kora_vaults")
    .select("revision")
    .eq("user_id", row.user_id)
    .maybeSingle();
  if (current.error) throw Error("Could not inspect target vault.");
  const revision = Math.max(row.revision || 0, current.data?.revision || 0) + 1;
  const result = await client
    .from("kora_vaults")
    .upsert({
      user_id: row.user_id,
      payload: row.payload,
      revision,
      updated_at: new Date().toISOString(),
    });
  if (result.error)
    throw Error("Vault restore failed; check target before retrying.");
}
console.log(
  "Restore writes completed. Verify balances/photos and take a new backup before reopening the app to users.",
);
