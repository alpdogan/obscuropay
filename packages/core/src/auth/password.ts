import { badRequest } from "../errors.ts";

const ITERATIONS = 210_000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

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

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= (a[i] ?? 0) ^ (b[i] ?? 0);
  }
  return diff === 0;
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations },
    material,
    KEY_BITS,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await derive(password, salt, ITERATIONS);
  return `pbkdf2-sha256$${ITERATIONS}$${bytesToB64(salt)}$${bytesToB64(key)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2-sha256") {
    return false;
  }
  const iterations = Number(parts[1]);
  const salt = b64ToBytes(parts[2] ?? "");
  const expected = b64ToBytes(parts[3] ?? "");
  if (!Number.isInteger(iterations) || iterations < 1 || expected.length === 0) {
    return false;
  }
  const actual = await derive(password, salt, iterations);
  return timingSafeEqual(actual, expected);
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function assertEmail(email: string): string {
  const normalized = normalizeEmail(email);
  if (normalized.length > 320 || !EMAIL_RE.test(normalized)) {
    throw badRequest("invalid_email", "Enter a valid email address");
  }
  return normalized;
}

export function assertPassword(password: string): void {
  if (password.length < 12 || password.length > 128) {
    throw badRequest("invalid_password", "Password must be between 12 and 128 characters");
  }
}
