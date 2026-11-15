import {
  randomBytes,
  createCipheriv,
  createDecipheriv,
  publicEncrypt,
  privateDecrypt,
  constants,
} from "node:crypto";
import { gzipSync, gunzipSync } from "node:zlib";
export function encryptSnapshot(snapshot, publicKey) {
  const key = randomBytes(32),
    iv = randomBytes(12),
    cipher = createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(gzipSync(Buffer.from(JSON.stringify(snapshot)))),
    cipher.final(),
  ]);
  const wrapped = publicEncrypt(
    {
      key: publicKey,
      oaepHash: "sha256",
      padding: constants.RSA_PKCS1_OAEP_PADDING,
    },
    key,
  );
  return {
    format: "zoro-encrypted-snapshot",
    version: 1,
    algorithm: "RSA-OAEP-SHA256+A256GCM+gzip",
    iv: iv.toString("base64"),
    tag: cipher.getAuthTag().toString("base64"),
    key: wrapped.toString("base64"),
    data: ciphertext.toString("base64"),
  };
}
export function decryptSnapshot(envelope, privateKey) {
  if (
    envelope.format !== "zoro-encrypted-snapshot" ||
    envelope.version !== 1 ||
    envelope.algorithm !== "RSA-OAEP-SHA256+A256GCM+gzip"
  )
    throw Error("Unsupported backup format.");
  const key = privateDecrypt(
    {
      key: privateKey,
      oaepHash: "sha256",
      padding: constants.RSA_PKCS1_OAEP_PADDING,
    },
    Buffer.from(envelope.key, "base64"),
  );
  const decipher = createDecipheriv(
    "aes-256-gcm",
    key,
    Buffer.from(envelope.iv, "base64"),
  );
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64"));
  const data = Buffer.concat([
    decipher.update(Buffer.from(envelope.data, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(
    gunzipSync(data, { maxOutputLength: 512 * 1024 * 1024 }).toString("utf8"),
  );
}
