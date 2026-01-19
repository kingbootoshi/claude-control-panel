import { describe, expect, it, vi } from "vitest";
import { appRouter } from "../src/trpc/router";
import { TmuxManager } from "../src/tmux-manager";
import { CodexManager } from "../src/codex-manager";
import type { TerminalManagerLike, TmuxPane, TmuxSession } from "../src/types";

class FakeTerminalManager implements TerminalManagerLike {
  getOrCreateGhost = vi.fn(async () => "ghost");
  spawn = vi.fn(async () => "terminal-1");
  send = vi.fn(async () => undefined);
  close = vi.fn(async () => undefined);
  resume = vi.fn(async () => undefined);
  kill = vi.fn(async () => undefined);
  list = vi.fn(() => []);
  get = vi.fn(() => undefined);
  getMetrics = vi.fn(() => null);
  triggerCompact = vi.fn(async () => undefined);
  hasConfig = vi.fn(() => true);
  getAssistantName = vi.fn(() => "Claude");
  on = vi.fn(() => this);
  off = vi.fn(() => this);
}

function createCaller(tmuxManager: TmuxManager) {
  const terminalManager = new FakeTerminalManager();
  const codexManager = new CodexManager();

  return appRouter.createCaller({
    terminalManager,
    tmuxManager,
    codexManager,
    assistantName: "Claude",
  });
}

describe("tRPC tmux router", () => {
  it("returns tmux availability", async () => {
    const tmuxManager = new TmuxManager();
    const availableSpy = vi.spyOn(tmuxManager, "isTmuxAvailable").mockResolvedValue(true);
    const caller = createCaller(tmuxManager);

    const available = await caller.tmux.available();

    expect(available).toBe(true);
    expect(availableSpy).toHaveBeenCalledTimes(1);
  });

  it("lists tmux sessions", async () => {
    const tmuxManager = new TmuxManager();
    const sessions: TmuxSession[] = [
      { name: "alpha", windows: 2, created: "2024-01-01T00:00:00.000Z", attached: false },
    ];
    const listSpy = vi.spyOn(tmuxManager, "listSessions").mockResolvedValue(sessions);
    const caller = createCaller(tmuxManager);

    const result = await caller.tmux.sessions();

    expect(result).toEqual(sessions);
    expect(listSpy).toHaveBeenCalledTimes(1);
  });

  it("lists tmux panes for a session", async () => {
    const tmuxManager = new TmuxManager();
    const panes: TmuxPane[] = [
      {
        id: "%1",
        sessionName: "alpha",
        windowIndex: 0,
        paneIndex: 0,
        cwd: "/tmp",
        command: "bash",
        active: true,
      },
    ];
    const listSpy = vi.spyOn(tmuxManager, "listPanes").mockResolvedValue(panes);
    const caller = createCaller(tmuxManager);

    const result = await caller.tmux.panes({ sessionName: "alpha" });

    expect(result).toEqual(panes);
    expect(listSpy).toHaveBeenCalledWith("alpha");
  });

  it("captures tmux pane output", async () => {
    const tmuxManager = new TmuxManager();
    const captureSpy = vi.spyOn(tmuxManager, "capturePane").mockResolvedValue("hello");
    const caller = createCaller(tmuxManager);

    const result = await caller.tmux.capture({ paneId: "%2", lines: 50, join: true });

    expect(result).toBe("hello");
    expect(captureSpy).toHaveBeenCalledWith("%2", { lines: 50, join: true });
  });

  it("sends keys to a pane", async () => {
    const tmuxManager = new TmuxManager();
    const sendSpy = vi.spyOn(tmuxManager, "sendKeys").mockResolvedValue(undefined);
    const caller = createCaller(tmuxManager);

    const result = await caller.tmux.sendKeys({ paneId: "%3", keys: "ls", enter: false });

    expect(result).toEqual({ success: true });
    expect(sendSpy).toHaveBeenCalledWith("%3", "ls", { enter: false });
  });

  it("sends control keys to a pane", async () => {
    const tmuxManager = new TmuxManager();
    const sendSpy = vi.spyOn(tmuxManager, "sendControl").mockResolvedValue(undefined);
    const caller = createCaller(tmuxManager);

    const result = await caller.tmux.sendControl({ paneId: "%4", key: "C" });

    expect(result).toEqual({ success: true });
    expect(sendSpy).toHaveBeenCalledWith("%4", "C");
  });

  it("builds an attach command for a session", async () => {
    const tmuxManager = new TmuxManager();
    const caller = createCaller(tmuxManager);

    const result = await caller.tmux.attachCommand({ sessionName: "alpha" });

    expect(result).toEqual({ command: "tmux attach -t ccp-alpha" });
  });
});
