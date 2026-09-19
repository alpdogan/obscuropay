import { describe, expect, it } from "vitest";
import { inspectUrl, isBlockedIp } from "../src/http/ssrf.ts";

describe("inspectUrl", () => {
  it("allows https public hosts", () => {
    const result = inspectUrl("https://api.example.com/search", { allowHttp: false });
    expect(result.ok).toBe(true);
  });

  it("rejects http when not allowed", () => {
    const result = inspectUrl("http://api.example.com/search", { allowHttp: false });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("http_not_allowed");
    }
  });

  it("rejects localhost and metadata", () => {
    expect(inspectUrl("https://localhost/x", { allowHttp: true }).ok).toBe(false);
    expect(inspectUrl("https://127.0.0.1/x", { allowHttp: true }).ok).toBe(false);
    expect(inspectUrl("https://169.254.169.254/latest", { allowHttp: true }).ok).toBe(false);
    expect(inspectUrl("https://metadata.google.internal/", { allowHttp: true }).ok).toBe(false);
  });

  it("rejects credentials in the URL", () => {
    const result = inspectUrl("https://user:pass@example.com/", { allowHttp: false });
    expect(result.ok).toBe(false);
  });

  it("rejects file and other schemes", () => {
    expect(inspectUrl("file:///etc/passwd", { allowHttp: true }).ok).toBe(false);
  });
});

describe("isBlockedIp", () => {
  it("blocks loopback, private, and link-local IPv4", () => {
    expect(isBlockedIp("127.0.0.1")).toBe(true);
    expect(isBlockedIp("10.1.2.3")).toBe(true);
    expect(isBlockedIp("192.168.1.1")).toBe(true);
    expect(isBlockedIp("172.16.0.1")).toBe(true);
    expect(isBlockedIp("169.254.1.1")).toBe(true);
    expect(isBlockedIp("2130706433")).toBe(true);
  });

  it("allows public IPv4", () => {
    expect(isBlockedIp("1.1.1.1")).toBe(false);
    expect(isBlockedIp("8.8.8.8")).toBe(false);
  });

  it("blocks IPv6 loopback and ULA", () => {
    expect(isBlockedIp("::1")).toBe(true);
    expect(isBlockedIp("fc00::1")).toBe(true);
    expect(isBlockedIp("fe80::1")).toBe(true);
  });
});
