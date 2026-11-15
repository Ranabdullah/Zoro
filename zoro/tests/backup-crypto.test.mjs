import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { encryptSnapshot, decryptSnapshot } from "../scripts/backup-crypto.mjs";
test("owner snapshots encrypt records and reject tampered ciphertext", () => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });
  const data = {
    format: "zoro-owner-snapshot",
    vaults: [{ owner: "fictional-user", balance: 1234 }],
    objects: [],
  };
  const encrypted = encryptSnapshot(data, publicKey);
  assert.equal(JSON.stringify(encrypted).includes("fictional-user"), false);
  assert.deepEqual(decryptSnapshot(encrypted, privateKey), data);
  const bytes = Buffer.from(encrypted.data, "base64");
  bytes[0] ^= 1;
  assert.throws(() =>
    decryptSnapshot(
      { ...encrypted, data: bytes.toString("base64") },
      privateKey,
    ),
  );
});
