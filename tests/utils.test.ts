import { formatJoinCode } from "@/lib/utils";

describe("formatJoinCode", () => {
  it("maps bytes into a six-character join code", () => {
    expect(formatJoinCode(Uint8Array.from([0, 1, 2, 3, 4, 5]))).toBe("ABCDEF");
  });

  it("produces different codes for different byte sequences", () => {
    expect(formatJoinCode(Uint8Array.from([0, 0, 0, 0, 0, 0]))).toBe("AAAAAA");
    expect(formatJoinCode(Uint8Array.from([31, 31, 31, 31, 31, 31]))).toBe("999999");
  });
});
