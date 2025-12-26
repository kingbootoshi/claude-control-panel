import { initTRPC, TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { config, getAgentWorkspace } from "../config";
import { loadConfig, type CCPConfig } from "../config-store";
import { loadSessionHistory } from "../history";
import { listWorkspaceFiles, readWorkspaceFile, isPathSafe, sanitizeFilename, estimateBase64Bytes } from "../utils/files";
import type { ContentBlock, ImageMediaType, StreamEvent, StreamEventMessage } from "../types";
import type { Context } from "./context";
import { logger } from "../utils/logger";

const log = logger.server;

const t = initTRPC.context<Context>().create();

const attachmentSchema = z.object({
  type: z.enum(["image", "file"]),
  name: z.string().min(1),
  data: z.string().min(1),
  mimeType: z.string().min(1),
});

const agentIdSchema = z.string().regex(/^[a-zA-Z0-9_-]+$/);

function assertAgentAccess(ctx: Context, agentId: string): void {
  if (agentId !== ctx.agentId) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Unknown agent" });
  }
}

function hashInput(input: unknown): string {
  const json = JSON.stringify(input) ?? "undefined";
  return crypto.createHash("sha256").update(json).digest("hex");
}

function mapEventToMessage(event: StreamEvent, agentId: string): StreamEventMessage {
  return {
    agentId,
    timestamp: new Date().toISOString(),
    ...event,
  };
}

export const appRouter = t.router({
  // Config management
  config: t.router({
    get: t.procedure.query(async (): Promise<CCPConfig | null> => {
      return loadConfig();
    }),

    save: t.procedure
      .input(z.object({
        name: z.string().min(1).max(50),
        claudeMd: z.string().max(50000),
      }))
      .mutation(async ({ ctx, input }) => {
        const result = await ctx.sessionManager.setupAgent(input.name, input.claudeMd);
        return { success: true, agentId: result.agentId };
      }),
  }),

  // Session management
  session: t.router({
    restart: t.procedure.mutation(async ({ ctx }) => {
      await ctx.sessionManager.restart();
      return { success: true };
    }),
  }),

  agents: t.router({
    list: t.procedure.query(({ ctx }) => {
      return [
        {
          id: ctx.agentId,
          name: ctx.assistantName,
          sessionId: ctx.sessionManager.getSessionId(),
          status: ctx.sessionManager.hasConfig() ? "online" : "offline",
        },
      ];
    }),
  }),

  history: t.router({
    get: t.procedure.input(z.object({ agentId: agentIdSchema })).query(async ({ ctx, input }) => {
      assertAgentAccess(ctx, input.agentId);
      const sessionId = ctx.sessionManager.getSessionId();
      if (!sessionId) {
        return { blocks: [], lastContextTokens: 0 };
      }
      return loadSessionHistory(sessionId);
    }),
  }),

  files: t.router({
    list: t.procedure.input(z.object({ agentId: agentIdSchema })).query(async ({ ctx, input }) => {
      assertAgentAccess(ctx, input.agentId);
      const agentPath = getAgentWorkspace(input.agentId);
      return listWorkspaceFiles(agentPath);
    }),

    read: t.procedure.input(z.object({ agentId: agentIdSchema, path: z.string().min(1) })).query(async ({ ctx, input }) => {
      assertAgentAccess(ctx, input.agentId);
      const agentPath = getAgentWorkspace(input.agentId);
      if (!isPathSafe(agentPath, input.path)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
      }
      const fullPath = path.join(agentPath, input.path);
      const content = await readWorkspaceFile(fullPath);
      return { content };
    }),
  }),

  chat: t.router({
    send: t.procedure
      .input(
        z.object({
          agentId: agentIdSchema,
          content: z.string().optional(),
          attachments: z.array(attachmentSchema).optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        assertAgentAccess(ctx, input.agentId);
        const attachments = input.attachments ?? [];
        const content = input.content ?? "";

        if (!content.trim() && attachments.length === 0) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "Message is empty" });
        }

        let textContent = content;
        const contentBlocks: ContentBlock[] = [];

        for (const attachment of attachments) {
          const bytes = estimateBase64Bytes(attachment.data);
          if (bytes > config.uploadMaxBytes) {
            throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "Attachment too large" });
          }

          if (attachment.type === "image") {
            contentBlocks.push({
              type: "image",
              source: {
                type: "base64",
                media_type: attachment.mimeType as ImageMediaType,
                data: attachment.data,
              },
            });
            log.info({ name: attachment.name, mimeType: attachment.mimeType }, "Image attachment added");
            continue;
          }

          const uploadsDir = path.join(getAgentWorkspace(input.agentId), "uploads");
          await fs.mkdir(uploadsDir, { recursive: true });
          const filename = `${Date.now()}-${sanitizeFilename(attachment.name)}`;
          const filepath = path.join(uploadsDir, filename);
          await fs.writeFile(filepath, Buffer.from(attachment.data, "base64"));
          textContent += `\n\n[Attached file: ${filepath}]`;
          log.info({ name: attachment.name, path: filepath }, "File attachment saved");
        }

        if (textContent.trim()) {
          contentBlocks.push({ type: "text", text: textContent });
        }

        if (contentBlocks.length > 0) {
          log.info({ blocks: contentBlocks.length, agentId: input.agentId }, "Multimodal message received");
          await ctx.sessionManager.sendMessage(contentBlocks);
        } else if (content.trim()) {
          log.info({ chars: content.length, agentId: input.agentId }, "User message received");
          await ctx.sessionManager.sendMessage(content);
        }
      }),

    events: t.procedure.input(z.object({ agentId: agentIdSchema })).subscription(({ ctx, input }) => {
      assertAgentAccess(ctx, input.agentId);
      return observable<StreamEventMessage>((emit) => {
        const handler = (event: StreamEvent) => {
          if (event.type === "tool_start") {
            log.info({ toolName: event.toolName, inputHash: hashInput(event.input) }, "Tool invoked");
          }
          emit.next(mapEventToMessage(event, input.agentId));
        };

        ctx.sessionManager.on("event", handler);

        return () => {
          ctx.sessionManager.off("event", handler);
        };
      });
    }),
  }),
});

export type AppRouter = typeof appRouter;
