import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign, webcrypto } from "node:crypto";
import { createPin, checkPin, derToRaw } from "../dist/local-security.js";
test("local PIN uses a random salt and validates without storing the PIN", async () => {
  const a = await createPin("456789"),
    b = await createPin("456789");
  assert.notEqual(a.hash, b.hash);
  assert.equal(await checkPin("456789", a), true);
  assert.equal(await checkPin("456780", a), false);
  assert.equal(JSON.stringify(a).includes("456789"), false);
  await assert.rejects(() => createPin("123"));
});
test("WebAuthn DER conversion produces verifiable P-256 signatures and rejects malformed input", async () => {
  const { privateKey, publicKey } = generateKeyPairSync("ec", {
    namedCurve: "prime256v1",
  });
  const data = Buffer.from("sample authenticator data");
  const sig = sign("sha256", data, privateKey);
  const key = await webcrypto.subtle.importKey(
    "spki",
    publicKey.export({ format: "der", type: "spki" }),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  assert.equal(
    await webcrypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      derToRaw(sig),
      data,
    ),
    true,
  );
  assert.throws(() => derToRaw(new Uint8Array([1, 2, 3])));
});
