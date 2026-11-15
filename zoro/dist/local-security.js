// A local screen lock. Server-side authentication and device approval are separate.
const b64 = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
const un64 = (text) =>
  Uint8Array.from(atob(text.replaceAll("-", "+").replaceAll("_", "/")), (c) =>
    c.charCodeAt(0),
  );
const equal = (a, b) =>
  a.length === b.length && a.reduce((v, n, i) => v | (n ^ b[i]), 0) === 0;
const random = () => crypto.getRandomValues(new Uint8Array(32));
async function pinHash(pin, salt) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(pin),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "PBKDF2", hash: "SHA-256", salt, iterations: 310000 },
      key,
      256,
    ),
  );
}
export async function createPin(pin) {
  if (!/^\d{6,12}$/.test(pin)) throw Error("Choose a PIN with 6–12 digits.");
  const salt = random();
  return { salt: b64(salt), hash: b64(await pinHash(pin, salt)) };
}
export async function checkPin(pin, record) {
  if (!/^\d{6,12}$/.test(pin)) return false;
  return equal(await pinHash(pin, un64(record.salt)), un64(record.hash));
}
export function derToRaw(signature) {
  const a = new Uint8Array(signature);
  let pos = 0;
  const length = () => {
    let n = a[pos++];
    if (n & 128) {
      const count = n & 127;
      if (count > 2) throw Error("Invalid signature.");
      n = 0;
      for (let i = 0; i < count; i++) n = n * 256 + a[pos++];
    }
    return n;
  };
  if (a[pos++] !== 48 || length() !== a.length - pos)
    throw Error("Invalid signature.");
  const out = new Uint8Array(64);
  for (let half = 0; half < 2; half++) {
    if (a[pos++] !== 2) throw Error("Invalid signature.");
    let size = length();
    while (size > 32 && a[pos] === 0) {
      pos++;
      size--;
    }
    if (size < 1 || size > 32 || pos + size > a.length)
      throw Error("Invalid signature.");
    out.set(a.slice(pos, pos + size), half * 32 + 32 - size);
    pos += size;
  }
  if (pos !== a.length) throw Error("Invalid signature.");
  return out;
}
export async function enrollBiometric(userId) {
  if (
    !window.PublicKeyCredential ||
    !(await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable())
  )
    throw Error(
      "This device/browser does not offer a platform authenticator. Use a PIN instead.",
    );
  const credential = await navigator.credentials.create({
    publicKey: {
      challenge: random(),
      rp: { name: "Zoro", id: location.hostname },
      user: {
        id: new TextEncoder().encode(userId).slice(0, 64),
        name: "Zoro local lock",
        displayName: "Zoro local lock",
      },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        userVerification: "required",
        residentKey: "preferred",
      },
      attestation: "none",
      timeout: 60000,
    },
  });
  const publicKey = credential?.response.getPublicKey?.();
  if (!publicKey)
    throw Error(
      "This browser cannot register a local biometric lock. Use a PIN.",
    );
  return { id: credential.id, publicKey: b64(publicKey) };
}
export async function verifyBiometric(record) {
  const challenge = random(),
    credential = await navigator.credentials.get({
      publicKey: {
        challenge,
        rpId: location.hostname,
        allowCredentials: [{ type: "public-key", id: un64(record.id) }],
        userVerification: "required",
        timeout: 60000,
      },
    });
  if (!credential || credential.id !== record.id)
    throw Error("Authenticator did not match.");
  const response = credential.response,
    data = JSON.parse(new TextDecoder().decode(response.clientDataJSON)),
    auth = new Uint8Array(response.authenticatorData);
  if (
    data.type !== "webauthn.get" ||
    data.challenge !== b64(challenge) ||
    data.origin !== location.origin ||
    data.crossOrigin ||
    auth.length < 37 ||
    (auth[32] & 5) !== 5
  )
    throw Error("Authenticator verification failed.");
  const rpHash = new Uint8Array(
    await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(location.hostname),
    ),
  );
  if (!equal(auth.slice(0, 32), rpHash))
    throw Error("Authenticator origin did not match.");
  const clientHash = new Uint8Array(
      await crypto.subtle.digest("SHA-256", response.clientDataJSON),
    ),
    signed = new Uint8Array(auth.length + 32);
  signed.set(auth);
  signed.set(clientHash, auth.length);
  const key = await crypto.subtle.importKey(
    "spki",
    un64(record.publicKey),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
  if (
    !(await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      derToRaw(response.signature),
      signed,
    ))
  )
    throw Error("Authenticator signature did not verify.");
}
export const biometricSupport = () => Boolean(window.PublicKeyCredential);
