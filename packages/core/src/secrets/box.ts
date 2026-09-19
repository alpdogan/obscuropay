export interface SecretBox {
  encrypt(plaintext: string): Promise<string>;
  decrypt(ciphertext: string): Promise<string>;
}

export function secretHint(plaintext: string): string {
  if (plaintext.length <= 4) {
    return "••••";
  }
  return `••••${plaintext.slice(-4)}`;
}

function bytesToB64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function b64ToBytes(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export class AesGcmSecretBox implements SecretBox {
  constructor(private readonly kek: Uint8Array) {
    if (kek.byteLength !== 32) {
      throw new Error("SECRET_KEK must be 32 bytes");
    }
  }

  static fromBase64(value: string): AesGcmSecretBox {
    return new AesGcmSecretBox(b64ToBytes(value));
  }

  async encrypt(plaintext: string): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await crypto.subtle.importKey("raw", this.kek as BufferSource, "AES-GCM", false, ["encrypt"]);
    const cipher = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      key,
      new TextEncoder().encode(plaintext),
    );
    const payload = new Uint8Array(iv.byteLength + cipher.byteLength);
    payload.set(iv, 0);
    payload.set(new Uint8Array(cipher), iv.byteLength);
    return bytesToB64(payload);
  }

  async decrypt(ciphertext: string): Promise<string> {
    const payload = b64ToBytes(ciphertext);
    if (payload.byteLength < 13) {
      throw new Error("invalid_ciphertext");
    }
    const iv = payload.slice(0, 12);
    const data = payload.slice(12);
    const key = await crypto.subtle.importKey("raw", this.kek as BufferSource, "AES-GCM", false, ["decrypt"]);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, data);
    return new TextDecoder().decode(plain);
  }
}
