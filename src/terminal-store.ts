import fs from "fs/promises";
import path from "path";
import { config } from "./config";
import type { Terminal } from "./types";
import { logger } from "./utils/logger";

const log = logger.daemon;

interface TerminalsFile {
  version: 1;
  terminals: Terminal[];
}

function getTerminalsPath(): string {
  return path.join(config.workspaceRoot, ".ccp-terminals.json");
}

export async function loadTerminals(): Promise<Terminal[]> {
  try {
    const data = await fs.readFile(getTerminalsPath(), "utf-8");
    const file = JSON.parse(data) as TerminalsFile;
    return file.terminals.map((terminal) => ({
      ...terminal,
      isPersistent: terminal.isPersistent ?? false,
      childAgents: terminal.childAgents ?? [],
    }));
  } catch {
    // File doesn't exist or is invalid - return empty list
    return [];
  }
}

export async function saveTerminals(terminals: Terminal[]): Promise<void> {
  const file: TerminalsFile = {
    version: 1,
    terminals,
  };
  await fs.mkdir(config.workspaceRoot, { recursive: true });
  await fs.writeFile(getTerminalsPath(), JSON.stringify(file, null, 2));
}

export async function upsertTerminal(terminal: Terminal): Promise<void> {
  const terminals = await loadTerminals();
  const index = terminals.findIndex((t) => t.id === terminal.id);

  if (index >= 0) {
    terminals[index] = terminal;
  } else {
    terminals.push(terminal);
  }

  await saveTerminals(terminals);
  log.debug({ terminalId: terminal.id, status: terminal.status }, "Terminal persisted");
}

export async function updateTerminalStatus(id: string, status: Terminal["status"]): Promise<void> {
  const terminals = await loadTerminals();
  const terminal = terminals.find((t) => t.id === id);

  if (terminal) {
    terminal.status = status;
    await saveTerminals(terminals);
    log.debug({ terminalId: id, status }, "Terminal status updated");
  }
}

export async function updateTerminalSessionId(id: string, sessionId: string): Promise<void> {
  const terminals = await loadTerminals();
  const terminal = terminals.find((t) => t.id === id);

  if (terminal) {
    terminal.sessionId = sessionId;
    await saveTerminals(terminals);
    log.debug({ terminalId: id, sessionId }, "Terminal sessionId updated");
  }
}

export async function deleteTerminal(id: string): Promise<void> {
  const terminals = await loadTerminals();
  const filtered = terminals.filter((t) => t.id !== id);
  await saveTerminals(filtered);
  log.info({ terminalId: id }, "Terminal deleted from store");
}

export async function getTerminal(id: string): Promise<Terminal | null> {
  const terminals = await loadTerminals();
  return terminals.find((t) => t.id === id) || null;
}
