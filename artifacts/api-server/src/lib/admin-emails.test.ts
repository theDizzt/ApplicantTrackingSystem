import { afterEach, describe, expect, it } from "vitest";
import { isAdminEmail } from "./admin-emails";

const original = process.env.ADMIN_EMAILS;

describe("isAdminEmail", () => {
  afterEach(() => {
    if (original === undefined) delete process.env.ADMIN_EMAILS;
    else process.env.ADMIN_EMAILS = original;
  });

  it("matches listed emails regardless of case and spaces", () => {
    process.env.ADMIN_EMAILS = " Admin@Example.com , second@example.com";
    expect(isAdminEmail("admin@example.com")).toBe(true);
    expect(isAdminEmail("SECOND@example.com ")).toBe(true);
  });

  it("rejects everyone when the list is empty or unset", () => {
    process.env.ADMIN_EMAILS = "";
    expect(isAdminEmail("admin@example.com")).toBe(false);
    delete process.env.ADMIN_EMAILS;
    expect(isAdminEmail("admin@example.com")).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });

  it("does not match partial addresses", () => {
    process.env.ADMIN_EMAILS = "admin@example.com";
    expect(isAdminEmail("xadmin@example.com")).toBe(false);
    expect(isAdminEmail("admin@example.co")).toBe(false);
  });
});
