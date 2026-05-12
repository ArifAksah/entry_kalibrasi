import { normalizePhoneNumber } from "../phone-utils";

describe("normalizePhoneNumber", () => {
  describe("format normalization", () => {
    it("should replace leading 0 with 62", () => {
      const result = normalizePhoneNumber("08123456789");
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe("628123456789@s.whatsapp.net");
    });

    it("should remove leading + from +62 numbers", () => {
      const result = normalizePhoneNumber("+628123456789");
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe("628123456789@s.whatsapp.net");
    });

    it("should keep 62 prefix as-is", () => {
      const result = normalizePhoneNumber("628123456789");
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe("628123456789@s.whatsapp.net");
    });

    it("should produce the same JID regardless of input format", () => {
      const fromLocal = normalizePhoneNumber("08123456789");
      const fromPlus = normalizePhoneNumber("+628123456789");
      const fromCountryCode = normalizePhoneNumber("628123456789");

      expect(fromLocal.normalized).toBe(fromPlus.normalized);
      expect(fromPlus.normalized).toBe(fromCountryCode.normalized);
    });
  });

  describe("JID format", () => {
    it("should append @s.whatsapp.net suffix", () => {
      const result = normalizePhoneNumber("628123456789");
      expect(result.normalized).toMatch(/@s\.whatsapp\.net$/);
    });
  });

  describe("length validation", () => {
    it("should reject numbers shorter than 10 digits after normalization", () => {
      const result = normalizePhoneNumber("62123456"); // 8 digits
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid phone number format");
    });

    it("should accept numbers with exactly 10 digits", () => {
      const result = normalizePhoneNumber("6281234567"); // 10 digits
      expect(result.valid).toBe(true);
    });

    it("should accept numbers with exactly 15 digits", () => {
      const result = normalizePhoneNumber("628123456789012"); // 15 digits
      expect(result.valid).toBe(true);
    });

    it("should reject numbers longer than 15 digits after normalization", () => {
      const result = normalizePhoneNumber("6281234567890123"); // 16 digits
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid phone number format");
    });
  });

  describe("invalid inputs", () => {
    it("should reject empty string", () => {
      const result = normalizePhoneNumber("");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Phone number is required");
    });

    it("should reject non-numeric characters after cleaning", () => {
      const result = normalizePhoneNumber("62abc12345");
      expect(result.valid).toBe(false);
      expect(result.error).toBe("Invalid phone number format");
    });

    it("should handle whitespace and dashes in input", () => {
      const result = normalizePhoneNumber("0812-3456-7890");
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe("6281234567890@s.whatsapp.net");
    });

    it("should handle spaces in input", () => {
      const result = normalizePhoneNumber("0812 3456 789");
      expect(result.valid).toBe(true);
      expect(result.normalized).toBe("628123456789@s.whatsapp.net");
    });
  });
});
