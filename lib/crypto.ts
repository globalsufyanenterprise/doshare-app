// Optional end-to-end layer: both sides type the same passcode,
// which becomes an AES-GCM key (PBKDF2). The passcode never leaves the browser.
const enc = new TextEncoder();
const dec = new TextDecoder();

export const encodeText = (s: string) => enc.encode(s);
export const decodeText = (b: ArrayBuffer) => dec.decode(b);

export function toBuffer(x: unknown): ArrayBuffer {
  if (x instanceof ArrayBuffer) return x;
  if (ArrayBuffer.isView(x)) {
    return new Uint8Array(x.buffer, x.byteOffset, x.byteLength).slice().buffer as ArrayBuffer;
  }
  throw new Error('Unexpected data format');
}

export async function deriveKey(passcode: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', enc.encode(passcode), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: enc.encode('doshare-v1'), iterations: 150000, hash: 'SHA-256' },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Output layout: 12-byte IV followed by ciphertext
export async function encryptBytes(key: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  const out = new Uint8Array(12 + ct.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ct), 12);
  return out.buffer;
}

export async function decryptBytes(key: CryptoKey, data: ArrayBuffer): Promise<ArrayBuffer> {
  const iv = new Uint8Array(data, 0, 12);
  const ct = new Uint8Array(data, 12);
  return crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct);
}
