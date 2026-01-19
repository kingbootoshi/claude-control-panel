import { initTRPC, TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";
import { z } from "zod";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { config } from "../config";
import { loadConfig, setupAssistant, type CCPConfig } from "../config-store";
import { loadProjects, addProject, removeProject, getProject } from "../project-store";
import { loadSessionHistory, listSessionsForProject, deleteSession, getSessionMetadata } from "../history";
import { GHOST_TERMINAL_ID } from "../terminal-manager";
import { listWorkspaceFiles, readWorkspaceFile, isPathSafe, sanitizeFilename, estimateBase64Bytes } from "../utils/files";
import type { ChildAgent, ChildAgentEvent, ContentBlock, GitBranch, GitCommit, GitDiff, GitStatus, ImageMediaType, StreamEventMessage, TerminalEvent } from "../types";
import type { TmuxOutputEvent, TmuxSessionState, TmuxPaneState } from "../tmux-manager";
import type { CodexJob, CodexOutputEvent, CodexStatusEvent } from "../codex-manager";
import type { Context } from "./context";
import { logger } from "../utils/logger";
import { GitManager } from "../git-manager";

const log = logger.server;
const gitManager = new GitManager();

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

async function requireProjectPath(projectId: string): Promise<string> {
  const project = await getProject(projectId);
  if (!project) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Project not found" });
  }
  return project.path;
}

function assertGitPathSafe(projectPath: string, filePath: string): void {
  if (!isPathSafe(projectPath, filePath)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Access denied" });
  }
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

  // Sessions - Claude session metadata and child agents
  sessions: t.router({
    children: t.procedure
      .input(z.object({ sessionId: z.string() }))
      .query(({ ctx, input }): ChildAgent[] => {
        return ctx.terminalManager.listChildAgents(input.sessionId);
      }),

    childrenEvents: t.procedure
      .input(z.object({ sessionId: z.string() }))
      .subscription(({ ctx, input }) => {
        return observable<ChildAgentEvent>((emit) => {
          const handler = (event: ChildAgentEvent) => {
            if (event.sessionId === input.sessionId) {
              emit.next(event);
            }
          };

          ctx.agentWatcher.on("child_agent", handler);

          return () => {
            ctx.agentWatcher.off("child_agent", handler);
          };
        });
      }),
  }),

  // Ghost session management
  ghost: t.router({
    get: t.procedure.query(({ ctx }) => {
      const ghost = ctx.terminalManager.get(GHOST_TERMINAL_ID);
      return ghost
        ? { exists: true, status: ghost.status, sessionId: ghost.sessionId }
        : { exists: false };
    }),

    start: t.procedure.mutation(async ({ ctx }) => {
      const id = await ctx.terminalManager.getOrCreateGhost();
      return { terminalId: id };
    }),
  }),

  // Session metrics and compaction
  metrics: t.router({
    get: t.procedure
      .input(z.object({ terminalId: z.string() }))
      .query(({ ctx, input }) => {
        return {
          metrics: ctx.terminalManager.getMetrics(input.terminalId),
          contextLimitTokens: config.smartCompact.thresholdTokens,
          warningThresholdTokens: config.smartCompact.warningThresholdTokens,
        };
      }),

    compact: t.procedure
      .input(z.object({ terminalId: z.string(), instructions: z.string().optional() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.terminalManager.triggerCompact(input.terminalId, input.instructions);
        return { success: true };
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

    listByProject: t.procedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ input }) => {
        return listSessionsForProject(input.projectId);
      }),

    delete: t.procedure
      .input(z.object({ sessionId: z.string() }))
      .mutation(async ({ input }) => {
        const deleted = await deleteSession(input.sessionId);
        return { success: deleted };
      }),

    getMetadata: t.procedure
      .input(z.object({ sessionId: z.string() }))
      .query(async ({ input }) => {
        return getSessionMetadata(input.sessionId);
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

  // Git operations
  git: t.router({
    status: t.procedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ input }): Promise<GitStatus> => {
        const projectPath = await requireProjectPath(input.projectId);
        return gitManager.status(projectPath);
      }),

    diff: t.procedure
      .input(z.object({
        projectId: z.string(),
        filePath: z.string().optional(),
        staged: z.boolean().optional(),
      }))
      .query(async ({ input }): Promise<GitDiff[]> => {
        const projectPath = await requireProjectPath(input.projectId);
        if (input.filePath) {
          assertGitPathSafe(projectPath, input.filePath);
        }
        return gitManager.diff(projectPath, { filePath: input.filePath, staged: input.staged });
      }),

    log: t.procedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ input }): Promise<GitCommit[]> => {
        const projectPath = await requireProjectPath(input.projectId);
        return gitManager.log(projectPath, 50);
      }),

    stage: t.procedure
      .input(z.object({ projectId: z.string(), filePath: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const projectPath = await requireProjectPath(input.projectId);
        assertGitPathSafe(projectPath, input.filePath);
        await gitManager.stage(projectPath, input.filePath);
        return { success: true };
      }),

    unstage: t.procedure
      .input(z.object({ projectId: z.string(), filePath: z.string().min(1) }))
      .mutation(async ({ input }) => {
        const projectPath = await requireProjectPath(input.projectId);
        assertGitPathSafe(projectPath, input.filePath);
        await gitManager.unstage(projectPath, input.filePath);
        return { success: true };
      }),

    branches: t.procedure
      .input(z.object({ projectId: z.string() }))
      .query(async ({ input }): Promise<GitBranch[]> => {
        const projectPath = await requireProjectPath(input.projectId);
        return gitManager.branches(projectPath);
      }),
  }),

  // Tmux - multi-pane terminal orchestration
  tmux: t.router({
    available: t.procedure.query(async ({ ctx }) => {
      return ctx.tmuxManager.isTmuxAvailable();
    }),

    sessions: t.procedure.query(async ({ ctx }) => {
      return ctx.tmuxManager.listSessions();
    }),

    panes: t.procedure
      .input(z.object({ sessionName: z.string() }))
      .query(async ({ ctx, input }) => {
        return ctx.tmuxManager.listPanes(input.sessionName);
      }),

    capture: t.procedure
      .input(z.object({
        paneId: z.string(),
        lines: z.number().optional(),
        join: z.boolean().optional(),
      }))
      .query(async ({ ctx, input }) => {
        return ctx.tmuxManager.capturePane(input.paneId, { lines: input.lines, join: input.join });
      }),

    session: t.procedure.query(async ({ ctx }): Promise<TmuxSessionState | null> => {
      await ctx.tmuxManager.refreshSessionState();
      return ctx.tmuxManager.getSession();
    }),

    createPane: t.procedure
      .input(z.object({
        cwd: z.string().optional(),
        horizontal: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }): Promise<TmuxPaneState> => {
        return ctx.tmuxManager.createPane(input);
      }),

    killPane: t.procedure
      .input(z.object({ paneId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.tmuxManager.killPane(input.paneId);
        return { success: true };
      }),

    sendKeys: t.procedure
      .input(z.object({
        paneId: z.string(),
        keys: z.string(),
        enter: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await ctx.tmuxManager.sendKeys(input.paneId, input.keys, { enter: input.enter });
        return { success: true };
      }),

    sendControl: t.procedure
      .input(z.object({ paneId: z.string(), key: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.tmuxManager.sendControl(input.paneId, input.key);
        return { success: true };
      }),

    capturePane: t.procedure
      .input(z.object({
        paneId: z.string(),
        lines: z.number().optional(),
      }))
      .query(async ({ ctx, input }) => {
        const output = await ctx.tmuxManager.capturePane(input.paneId, { lines: input.lines });
        return { output };
      }),

    attachCommand: t.procedure
      .input(z.object({ sessionName: z.string() }))
      .query(({ input }) => {
        return { command: `tmux attach -t ccp-${input.sessionName}` };
      }),

    spawnClaudeCode: t.procedure
      .input(z.object({
        paneId: z.string(),
        cwd: z.string().optional(),
        projectId: z.string().optional(),
        resumeSessionId: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await ctx.tmuxManager.spawnClaudeCode(input.paneId, input);
        return { success: true };
      }),

    spawnCodex: t.procedure
      .input(z.object({
        paneId: z.string(),
        prompt: z.string(),
        cwd: z.string().optional(),
        projectId: z.string().optional(),
        reasoning: z.enum(["low", "medium", "high", "xhigh"]).optional(),
        sandbox: z.enum(["read-only", "workspace-write"]).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await ctx.tmuxManager.spawnCodex(input.paneId, input);
        return { success: true };
      }),

    spawnShell: t.procedure
      .input(z.object({
        paneId: z.string(),
        cwd: z.string().optional(),
        command: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await ctx.tmuxManager.spawnShell(input.paneId, input);
        return { success: true };
      }),

    setLayout: t.procedure
      .input(z.object({
        layout: z.enum(["tiled", "even-horizontal", "even-vertical", "main-horizontal", "main-vertical"]),
      }))
      .mutation(async ({ ctx, input }) => {
        await ctx.tmuxManager.setLayout(input.layout);
        return { success: true };
      }),

    focusPane: t.procedure
      .input(z.object({ paneId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.tmuxManager.focusPane(input.paneId);
        return { success: true };
      }),

    resizePane: t.procedure
      .input(z.object({
        paneId: z.string(),
        direction: z.enum(["up", "down", "left", "right"]),
        amount: z.number().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await ctx.tmuxManager.resizePane(input.paneId, input.direction, input.amount);
        return { success: true };
      }),

    broadcast: t.procedure
      .input(z.object({
        keys: z.string(),
        enter: z.boolean().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        await ctx.tmuxManager.broadcast(input.keys, { enter: input.enter });
        return { success: true };
      }),

    killSession: t.procedure.mutation(async ({ ctx }) => {
      await ctx.tmuxManager.killSession();
      return { success: true };
    }),

    output: t.procedure
      .input(z.object({ paneId: z.string() }))
      .subscription(({ ctx, input }) => {
        return observable<TmuxOutputEvent>((emit) => {
          const handler = (event: TmuxOutputEvent) => {
            if (event.paneId === input.paneId) {
              emit.next(event);
            }
          };

          ctx.tmuxManager.on("output", handler);
          ctx.tmuxManager.startOutputPolling(input.paneId);

          return () => {
            ctx.tmuxManager.off("output", handler);
            ctx.tmuxManager.stopOutputPolling(input.paneId);
          };
        });
      }),
  }),

  // Codex - GPT Codex agent management
  codex: t.router({
    health: t.procedure.query(async ({ ctx }) => {
      const available = await ctx.codexManager.checkCodexAvailable();
      return { available };
    }),

    list: t.procedure.query(({ ctx }): CodexJob[] => {
      return ctx.codexManager.listJobs();
    }),

    listByProject: t.procedure
      .input(z.object({ projectId: z.string() }))
      .query(({ ctx, input }): CodexJob[] => {
        return ctx.codexManager.listJobsByProject(input.projectId);
      }),

    get: t.procedure
      .input(z.object({ jobId: z.string() }))
      .query(({ ctx, input }): CodexJob | null => {
        return ctx.codexManager.getJob(input.jobId) || null;
      }),

    create: t.procedure
      .input(z.object({
        prompt: z.string().min(1),
        model: z.enum(["gpt-5.2-codex", "gpt-5.1-codex-mini", "gpt-5.1-codex-max", "gpt-5.2", "gpt-5.1-codex", "gpt-5-codex"]).optional(),
        reasoningEffort: z.enum(["minimal", "low", "medium", "high", "xhigh"]).optional(),
        projectId: z.string().optional(),
        parentSessionId: z.string().optional(),
        workingDir: z.string().optional(),
        fullAuto: z.boolean().optional(),
        sandbox: z.enum(["read-only", "workspace-write", "danger-full-access"]).optional(),
      }))
      .mutation(async ({ ctx, input }): Promise<CodexJob> => {
        return ctx.codexManager.createJob(input);
      }),

    kill: t.procedure
      .input(z.object({ jobId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.codexManager.killJob(input.jobId);
        return { success: true };
      }),

    delete: t.procedure
      .input(z.object({ jobId: z.string() }))
      .mutation(async ({ ctx, input }) => {
        await ctx.codexManager.deleteJob(input.jobId);
        return { success: true };
      }),

    sendInput: t.procedure
      .input(z.object({
        jobId: z.string(),
        input: z.string(),
      }))
      .mutation(async ({ ctx, input }) => {
        await ctx.codexManager.sendInput(input.jobId, input.input);
        return { success: true };
      }),

    getOutput: t.procedure
      .input(z.object({ jobId: z.string() }))
      .query(({ ctx, input }) => {
        return { output: ctx.codexManager.getOutput(input.jobId) };
      }),

    output: t.procedure
      .input(z.object({ jobId: z.string() }))
      .subscription(({ ctx, input }) => {
        return observable<CodexOutputEvent>((emit) => {
          const handler = (event: CodexOutputEvent) => {
            if (event.jobId === input.jobId) {
              emit.next(event);
            }
          };

          ctx.codexManager.on("output", handler);

          return () => {
            ctx.codexManager.off("output", handler);
          };
        });
      }),

    status: t.procedure
      .input(z.object({ jobId: z.string() }))
      .subscription(({ ctx, input }) => {
        return observable<CodexStatusEvent>((emit) => {
          const handler = (event: CodexStatusEvent) => {
            if (event.jobId === input.jobId) {
              emit.next(event);
            }
          };

          ctx.codexManager.on("status", handler);

          return () => {
            ctx.codexManager.off("status", handler);
          };
        });
      }),

  }),
});

export type AppRouter = typeof appRouter;
