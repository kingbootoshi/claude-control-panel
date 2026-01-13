import { initTRPC, TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { config } from "../config";
import { loadConfig, setupAssistant, type CCPConfig } from "../config-store";
import { loadProjects, addProject, removeProject, getProject } from "../project-store";
import { loadSessionHistory } from "../history";
import { listWorkspaceFiles, readWorkspaceFile, isPathSafe, sanitizeFilename, estimateBase64Bytes } from "../utils/files";
import type { ContentBlock, ImageMediaType, StreamEventMessage, TerminalEvent } from "../types";
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

function hashInput(input: unknown): string {
  const json = JSON.stringify(input) ?? "undefined";
  return crypto.createHash("sha256").update(json).digest("hex");
}

function mapEventToMessage(event: TerminalEvent): StreamEventMessage {
  return {
    terminalId: event.terminalId,
    timestamp: new Date().toISOString(),
    ...event.event,
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
      .mutation(async ({ input }) => {
        await setupAssistant(input.name, input.claudeMd);
        return { success: true };
      }),
  }),

  // Project management
  projects: t.router({
    list: t.procedure.query(async () => {
      return loadProjects();
    }),

    get: t.procedure
      .input(z.object({ id: z.string() }))
      .query(async ({ input }) => {
        const project = await getProject(input.id);
        if (!project) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        return project;
      }),

    create: t.procedure
      .input(z.object({
        name: z.string().min(1).max(100),
        path: z.string().optional(),
      }))
      .mutation(async ({ input }) => {
        // If no path provided, create project in workspace
        const projectPath = input.path || path.join(config.workspaceRoot, "projects", input.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
        return addProject(input.name, projectPath);
      }),

    remove: t.procedure
      .input(z.object({ id: z.string() }))
      .mutation(async ({ input }) => {
        await removeProject(input.id);
        return { success: true };
      }),
  }),

  // Terminal management
  terminals: t.router({
    list: t.procedure.query(({ ctx }) => {
      return ctx.terminalManager.list();
    }),

    get: t.procedure
      .input(z.object({ terminalId: z.string() }))
      .query(({ ctx, input }) => {
        const terminal = ctx.terminalManager.get(input.terminalId);
        if (!terminal) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Terminal not found" });
        }
        return terminal;
      }),

    spawn: t.procedure
      .input(z.object({
        projectId: z.string().nullable(),
      }))
      .mutation(async ({ ctx, input }) => {
        const terminalId = await ctx.terminalManager.spawn(input.projectId);
        return { terminalId };
      }),

    send: t.procedure
      .input(z.object({
        terminalId: z.string(),
        content: z.string().optional(),
        attachments: z.array(attachmentSchema).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const terminal = ctx.terminalManager.get(input.terminalId);
        if (!terminal) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Terminal not found" });
        }

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

          // File attachment - save to workspace uploads
          const uploadsDir = path.join(config.workspaceRoot, "uploads");
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
          log.info({ blocks: contentBlocks.length, terminalId: input.terminalId }, "Multimodal message received");
          await ctx.terminalManager.send(input.terminalId, contentBlocks);
        } else if (content.trim()) {
          log.info({ chars: content.length, terminalId: input.terminalId }, "User message received");
          await ctx.terminalManager.send(input.terminalId, content);
        }
      }),

    close: t.procedure
      .input(z.object({ terminalId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.terminalManager.close(input.terminalId);
        return { success: true };
      }),

    resume: t.procedure
      .input(z.object({ terminalId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.terminalManager.resume(input.terminalId);
        return { success: true };
      }),

    kill: t.procedure
      .input(z.object({ terminalId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.terminalManager.kill(input.terminalId);
        return { success: true };
      }),

    events: t.procedure
      .input(z.object({ terminalId: z.string() }))
      .subscription(({ ctx, input }) => {
        return observable<StreamEventMessage>((emit) => {
          const handler = (data: TerminalEvent) => {
            if (data.terminalId === input.terminalId) {
              if (data.event.type === "tool_start") {
                log.info({ toolName: data.event.toolName, inputHash: hashInput(data.event.input) }, "Tool invoked");
              }
              emit.next(mapEventToMessage(data));
            }
          };

          ctx.terminalManager.on("terminal_event", handler);

          return () => {
            ctx.terminalManager.off("terminal_event", handler);
          };
        });
      }),
  }),

  // History - loads from Claude's session files
  history: t.router({
    get: t.procedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        if (!input.sessionId) {
          return { blocks: [], lastContextTokens: 0 };
        }
        return loadSessionHistory(input.sessionId);
      }),

    getByTerminal: t.procedure
      .input(z.object({ terminalId: z.string() }))
      .query(async ({ ctx, input }) => {
        const terminal = ctx.terminalManager.get(input.terminalId);
        if (!terminal || !terminal.sessionId) {
          return { blocks: [], lastContextTokens: 0 };
        }
        return loadSessionHistory(terminal.sessionId);
      }),
  }),

  // Files - browse workspace or project files
  files: t.router({
    listWorkspace: t.procedure.query(async () => {
      return listWorkspaceFiles(config.workspaceRoot);
    }),

    listProject: t.procedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ input }) => {
        const project = await getProject(input.projectId);
        if (!project) {
          throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
        }
        return listWorkspaceFiles(project.path);
      }),

    read: t.procedure
      .input(z.object({
        basePath: z.string(),
        filePath: z.string().min(1),
      }))
      .query(async ({ input }) => {
        if (!isPathSafe(input.basePath, input.filePath)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
        }
        const fullPath = path.join(input.basePath, input.filePath);
        const content = await readWorkspaceFile(fullPath);
        return { content };
      }),
  }),
});

export type AppRouter = typeof appRouter;
