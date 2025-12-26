import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { CreateWSSContextFnOptions } from "@trpc/server/adapters/ws";
import { TRPCError } from "@trpc/server";
import { config } from "../config";
import type { SessionManagerLike } from "../types";

export interface Context {
  sessionManager: SessionManagerLike;
  agentId: string;
  assistantName: string;
}

function normalizeHeaderValue(value: string | string[] | undefined): string | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

function getAuthTokenFromHeaders(req: CreateExpressContextOptions["req"]): string | null {
  const authHeader = normalizeHeaderValue(req.headers.authorization);
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice("Bearer ".length).trim();
  }
  const tokenHeader = normalizeHeaderValue(req.headers["x-ccp-token"]);
  return tokenHeader?.trim() || null;
}

function getAuthTokenFromConnectionParams(params: CreateWSSContextFnOptions["info"]["connectionParams"]): string | null {
  if (!params || typeof params !== "object") return null;
  const record = params as Record<string, unknown>;
  return typeof record.token === "string" ? record.token : null;
}

function assertOriginAllowed(origin: string | undefined): void {
  if (!origin) return;
  if (!config.allowedOrigins.includes(origin)) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Origin not allowed" });
  }
}

function assertValidToken(token: string | null): void {
  if (!token || token !== config.authToken) {
    throw new TRPCError({ code: "UNAUTHORIZED", message: "Invalid auth token" });
  }
}

export function createContextFactory(sessionManager: SessionManagerLike) {
  return {
    createHttpContext({ req }: CreateExpressContextOptions): Context {
      const token = getAuthTokenFromHeaders(req);
      assertValidToken(token);

      // Get runtime config or fall back to static config
      const runtimeConfig = sessionManager.getConfig();
      return {
        sessionManager,
        agentId: runtimeConfig?.primaryAgentId ?? config.primaryAgentId,
        assistantName: runtimeConfig?.assistantName ?? config.assistantName,
      };
    },

    createWsContext(opts: CreateWSSContextFnOptions): Context {
      assertOriginAllowed(opts.req.headers.origin);
      const token = getAuthTokenFromConnectionParams(opts.info.connectionParams);
      assertValidToken(token);

      // Get runtime config or fall back to static config
      const runtimeConfig = sessionManager.getConfig();
      return {
        sessionManager,
        agentId: runtimeConfig?.primaryAgentId ?? config.primaryAgentId,
        assistantName: runtimeConfig?.assistantName ?? config.assistantName,
      };
    },
  };
}
