import { describe, it, expect } from "vitest";
import { AUTH_PUBLIC, AUTH_REQUIRED } from "../src/main/core/permissions.js";

describe("single-user auth", () => {
  it("defines public and session-only markers", () => {
    expect(AUTH_PUBLIC).toBeUndefined();
    expect(AUTH_REQUIRED).toBeNull();
  });
});
