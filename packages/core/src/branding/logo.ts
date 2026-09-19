import { badRequest } from "../errors.ts";

export const LOGO_MAX_BYTES = 256 * 1024;
export const LOGO_TYPES = ["image/png", "image/jpeg", "image/webp"] as const;
export type LogoType = (typeof LOGO_TYPES)[number];

const MAGIC: Record<LogoType, number[][]> = {
  "image/png": [[0x89, 0x50, 0x4e, 0x47]],
  "image/jpeg": [[0xff, 0xd8, 0xff]],
  "image/webp": [[0x52, 0x49, 0x46, 0x46]],
};

export function assertDisplayName(value: string): string {
  const name = value.trim();
  if (name.length < 1 || name.length > 80) {
    throw badRequest("invalid_display_name", "display_name must be 1–80 characters");
  }
  if (/[<>]/.test(name) || /javascript:/i.test(name)) {
    throw badRequest("invalid_display_name", "display_name cannot include HTML or script");
  }
  return name;
}

export function inspectLogo(bytes: Uint8Array, declaredType: string): LogoType {
  if (bytes.byteLength === 0 || bytes.byteLength > LOGO_MAX_BYTES) {
    throw badRequest("invalid_logo", "Logo must be between 1 byte and 256 KiB");
  }
  if (!LOGO_TYPES.includes(declaredType as LogoType)) {
    throw badRequest("invalid_logo", "Logo must be PNG, JPEG, or WebP");
  }
  const type = declaredType as LogoType;
  const ok = MAGIC[type].some((prefix) => prefix.every((byte, index) => bytes[index] === byte));
  if (!ok) {
    throw badRequest("invalid_logo", "Logo bytes do not match the declared image type");
  }
  return type;
}
