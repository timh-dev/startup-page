// @vitest-environment node
import { describe, expect, it } from "vitest";
import { isPrivateAddress } from "./safeFetch";

describe("isPrivateAddress", () => {
  it("flags loopback, private, link-local, CGNAT and multicast addresses", () => {
    for (const address of [
      "127.0.0.1",
      "10.1.2.3",
      "172.16.0.1",
      "172.31.255.255",
      "192.168.0.10",
      "169.254.169.254",
      "100.64.0.1",
      "0.0.0.0",
      "224.0.0.1",
      "::1",
      "::",
      "fd00::1",
      "fe80::1",
      "::ffff:10.0.0.1",
      "[::1]",
    ]) {
      expect(isPrivateAddress(address), address).toBe(true);
    }
  });

  it("allows public addresses", () => {
    for (const address of ["93.184.216.34", "172.32.0.1", "8.8.8.8", "2606:4700:4700::1111", "::ffff:8.8.8.8"]) {
      expect(isPrivateAddress(address), address).toBe(false);
    }
  });

  it("treats anything that isn't an IP as unsafe", () => {
    expect(isPrivateAddress("example.com")).toBe(true);
  });
});
