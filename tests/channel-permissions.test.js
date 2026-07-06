import { describe, it, expect } from "vitest";
import { getChannelPermission } from "../src/main/ipc/permissions/channel-permissions.js";
import { AUTH_PUBLIC, AUTH_REQUIRED } from "../src/main/core/permissions.js";

describe("channel-permissions", () => {
  it("marks login as public", () => {
    expect(getChannelPermission("auth:login")).toBe(AUTH_PUBLIC);
  });

  it("requires session for business channels", () => {
    expect(getChannelPermission("masters:units:list")).toBe(AUTH_REQUIRED);
    expect(getChannelPermission("settings:get")).toBe(AUTH_REQUIRED);
    expect(getChannelPermission("tools:restore")).toBe(AUTH_REQUIRED);
  });
});
