import { readFile, writeFile } from "node:fs/promises";
import { decryptSnapshot } from "./backup-crypto.mjs";
const [input, keyFile, output] = process.argv.slice(2);
if (!input || !keyFile || !output)
  throw Error(
    "Usage: node scripts/decrypt-backup.mjs encrypted.json private-key.pem output.json",
  );
const snapshot = decryptSnapshot(
  JSON.parse(await readFile(input, "utf8")),
  await readFile(keyFile, "utf8"),
);
if (snapshot.format !== "zoro-owner-snapshot")
  throw Error("Invalid Zoro snapshot.");
await writeFile(output, JSON.stringify(snapshot), { flag: "wx", mode: 0o600 });
console.log(
  "Decrypted snapshot written to a new private file. Do not upload it to GitHub.",
);
