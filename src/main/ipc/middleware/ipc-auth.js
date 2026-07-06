import { toErrorResponse } from "../../core/errors";
import { resolveSession } from "../../services/session-service";
import { getChannelPermission } from "../permissions/channel-permissions";

export function extractToken(payload) {
  if (typeof payload === "string") return payload;
  if (payload && typeof payload === "object" && payload._token) {
    return payload._token;
  }
  return null;
}

export function stripInternalFields(payload) {
  if (payload == null || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }
  const { _token, _payload, ...rest } = payload;
  if (Object.keys(rest).length > 0) {
    return rest;
  }
  if (_payload !== undefined) {
    return _payload;
  }
  return undefined;
}

const SCALAR_PAYLOAD_CHANNELS = {
  "masters:units:delete": "id",
  "masters:warehouses:delete": "id",
  "masters:accounts:delete": "id",
  "masters:routes:delete": "id",
  "masters:salesmen:delete": "id",
  "masters:products:delete": "id",
  "masters:customers:delete": "id",
  "masters:vendors:delete": "id",
  "purchase:invoices:get": "id",
  "sales:quotations:convert": "id",
  "sales:loadslips:deliver": "id",
  "sales:returns:invoice": "id",
  "sales:recoveries:outstanding": "customerId",
  "inventory:stocktake:sheet": "warehouseId",
  "tools:export:csv": "entity",
  "tools:import:csv": "entity",
  "tools:printHtml": "html",
};

export function normalizeServicePayload(channel, payload) {
  const clean = stripInternalFields(payload);
  const scalarKey = SCALAR_PAYLOAD_CHANNELS[channel];

  if (scalarKey && clean && typeof clean === "object" && clean[scalarKey] !== undefined) {
    const otherKeys = Object.keys(clean).filter((key) => key !== scalarKey);
    if (otherKeys.length === 0) {
      return clean[scalarKey];
    }
  }

  return clean;
}

export async function authorizeChannel(channel, payload) {
  const authRequirement = getChannelPermission(channel);

  if (authRequirement === undefined) {
    return { authorized: true, ctx: null, payload: stripInternalFields(payload) };
  }

  const token = extractToken(payload);
  const session = await resolveSession(token);

  if (!session.success) {
    return {
      authorized: false,
      response: { success: false, error: "Unauthorized", code: "UNAUTHORIZED" },
    };
  }

  return {
    authorized: true,
    ctx: session.data,
    payload: stripInternalFields(payload),
  };
}

export function wrapHandler(handler) {
  return async (payload, ctx) => {
    try {
      if (ctx) {
        return await handler(payload, ctx);
      }
      return await handler(payload);
    } catch (error) {
      return toErrorResponse(error);
    }
  };
}
