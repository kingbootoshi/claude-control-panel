# PRD: Ghost Control Panel - Unified AI Agent Orchestration Platform

**Version:** 2.0
**Date:** 2026-01-18
**Author:** Saint/Bootoshi
**Status:** Draft

---

## Executive Summary

Ghost Control Panel (GCP) is a unified orchestration platform for AI coding agents. It provides a terminal-first, tmux-based interface for managing Claude Code sessions, Codex (GPT) agents, and general computer interaction through a single cohesive experience.

**Core Vision**: One platform to create codebases, orchestrate agents, manage context, and interact with your computer - all through Claude skills and natural language.

### Key Capabilities

1. **Smart Compaction** - Automatic context-aware compaction with custom instructions that preserve critical state
2. **General Chat (Ghost)** - A persistent Claude Code session for computer interaction, using skills for everything from video processing to file management
3. **Project Sessions** - Claude Code sessions attached to specific codebases with full context
4. **Codex Orchestration** - Spawn and manage GPT agents for parallel investigation and implementation
5. **Tmux-Based Observability** - Real-time visibility into all agent sessions with steering capabilities

---

## Problem Statement

### Current Pain Points

**Context Loss During Compaction**
- PreCompact hooks are **broken** (GitHub issue #13572)
- Auto-compact uses default instructions that lose critical context
- Users lose track of decisions, dead ends, and task state
- No way to customize what gets preserved

**Fragmented Agent Experience**
- Claude Code CLI and Codex CLI are separate tools
- No unified view of multiple concurrent sessions
- No easy way to steer/interrupt agents mid-task
- Starting a "general chat" requires manual session management

**Missing Computer Assistant**
- No persistent session for non-project tasks
- Users restart Claude Code each time for system tasks
- Skills-based workflows (video processing, file management) lack a home
- No continuity for general computer interaction

**Limited Observability**
- Can't see what agents are doing in real-time
- No way to capture output from running sessions
- Difficult to manage multiple parallel agents
- No unified dashboard for all agent activity

---

## Goals

### Must Have (P0)

| Feature | Description |
|---------|-------------|
| Smart Compaction | Track tokens, auto-trigger `/compact` with custom instructions at threshold |
| General Session (Ghost) | Persistent Claude Code session for computer interaction via skills |
| Session Metrics | Token usage, compaction history, cost tracking per session |
| Tmux Integration | All sessions in tmux for observability and steering |
| Unified Session List | Single view of all Claude, Codex, and general sessions |

### Should Have (P1)

| Feature | Description |
|---------|-------------|
| Codex Orchestration | Spawn, monitor, and manage Codex agents from the platform |
| Project Scaffolding | Create new codebases with CLAUDE.md, proper structure |
| Session Persistence | Resume sessions across control panel restarts |
| Context Warnings | Visual alerts when approaching compaction threshold |

### Nice to Have (P2)

| Feature | Description |
|---------|-------------|
| Cost Budgets | Per-session and daily cost limits |
| Session Recording | Record and replay agent sessions |
| Multi-Model Support | Switch between Claude models per session |
| Codebase Mapping | Auto-generate CODEBASE_MAP.md for projects |

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Ghost Control Panel                             │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │   General    │  │   Project    │  │    Codex     │              │
│  │   Session    │  │   Sessions   │  │    Agents    │              │
│  │   (Ghost)    │  │              │  │              │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                 │                  │                       │
│         └────────────┬────┴──────────────────┘                       │
│                      │                                               │
│              ┌───────▼────────┐                                      │
│              │  Tmux Manager  │                                      │
│              │   (Sessions)   │                                      │
│              └───────┬────────┘                                      │
│                      │                                               │
│         ┌────────────┼────────────┐                                  │
│         ▼            ▼            ▼                                  │
│    ┌─────────┐  ┌─────────┐  ┌─────────┐                            │
│    │ tmux:   │  │ tmux:   │  │ tmux:   │                            │
│    │ ghost   │  │ project │  │ codex-  │                            │
│    │         │  │ -abc    │  │ xyz123  │                            │
│    └─────────┘  └─────────┘  └─────────┘                            │
│                                                                      │
├─────────────────────────────────────────────────────────────────────┤
│                     Smart Compaction Engine                          │
│  ┌─────────────────────────────────────────────────────────────┐    │
│  │  Token Tracking │ Threshold Detection │ Custom Instructions  │    │
│  └─────────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Technical Design

### 1. Smart Compaction System

#### 1.1 Why This Matters

From agent research (Cursor, Windsurf, Factory.ai):
- **Cursor**: Uses "memories" that persist key facts across sessions
- **Windsurf**: Cascade memories preserve architectural decisions and user preferences
- **Factory.ai**: Recommends measuring "continuation success rate" not just token count

Our approach: Custom `/compact` instructions that explicitly structure what survives.

#### 1.2 Session Metrics

```typescript
interface SessionMetrics {
  sessionId: string;
  sessionType: 'general' | 'project' | 'codex';

  // Token tracking
  currentContextTokens: number;      // Latest from turn_complete
  peakContextTokens: number;         // Highest observed this session
  totalInputTokensSpent: number;     // Cumulative (for cost tracking)

  // Compaction tracking
  compactionCount: number;
  compactionHistory: CompactionRecord[];

  // Cost tracking
  totalCostUsd: number;

  // Timing
  sessionStartedAt: string;
  lastActivityAt: string;
  totalActiveTimeMs: number;
}

interface CompactionRecord {
  id: string;
  timestamp: string;
  trigger: 'auto' | 'manual' | 'smart';
  preTokens: number;
  postTokens: number | null;         // Filled after next turn_complete
  customInstructions: boolean;
  preservedSections: string[];       // Which sections were requested
}
```

#### 1.3 Smart Compact Configuration

```typescript
interface SmartCompactConfig {
  enabled: boolean;                  // Default: true

  // Thresholds (as percentage of maxContextTokens)
  thresholdPercent: number;          // Trigger compact (default: 0.80)
  warnPercent: number;               // Emit warning (default: 0.70)
  maxContextTokens: number;          // Model limit (default: 200000)

  // Behavior
  autoTrigger: boolean;              // Auto-send /compact at threshold
  confirmBeforeCompact: boolean;     // Ask user before auto-compact

  // Custom instructions
  customInstructions: string;        // The compact prompt template
  preserveSections: string[];        // Sections to always include
}

// Defaults
const DEFAULT_SMART_COMPACT_CONFIG: SmartCompactConfig = {
  enabled: true,
  thresholdPercent: 0.80,
  warnPercent: 0.70,
  maxContextTokens: 200000,
  autoTrigger: true,
  confirmBeforeCompact: false,
  customInstructions: SMART_COMPACT_TEMPLATE,
  preserveSections: [
    'IMMEDIATE_NEXT_ACTION',
    'SETTLED_DECISIONS',
    'DEAD_ENDS',
    'TRUST_ANCHORS',
    'TASK_QUEUE',
    'USER_PREFERENCES',
    'KEY_FILES'
  ]
};
```

#### 1.4 Smart Compact Prompt Template

```typescript
const SMART_COMPACT_TEMPLATE = `
In addition to the default summary, explicitly include these sections at the END:

## COMPACT #[N]
This is compaction number [N] in this session.

## IMMEDIATE NEXT ACTION
State the single most important next step as a specific imperative:
- Include exact file paths and line numbers if applicable
- Make it actionable without additional context
- Format: "Do X in Y to achieve Z"

## SETTLED DECISIONS
Decisions that should NOT be revisited (each with rationale):
| Decision | Rationale | Context |
|----------|-----------|---------|
| [What] | [Why] | [When decided] |

## DEAD ENDS
Approaches tried and failed (prevents retry loops):
| Attempted | Failed Because | Lesson |
|-----------|----------------|--------|
| [What] | [Why it failed] | [What to avoid] |

## TRUST ANCHORS
Components verified working (don't re-verify):
| Component | Verification | Status |
|-----------|--------------|--------|
| [What] | [How confirmed] | [When] |

## TASK QUEUE
Remaining work in priority order:
1. **[Task]** - Dependencies: [deps], Blocked by: [blockers]
2. **[Task]** - Dependencies: [deps]

## USER PREFERENCES
- [Preference] - PERMANENT (persists beyond session)
- [Preference] - SESSION (this session only)

## KEY FILES
Files most relevant to current work:
| Path | Relevance |
|------|-----------|
| [path] | [why it matters now] |

## SESSION CONTEXT
- **Project**: [Name/path]
- **Main Goal**: [What we're accomplishing]
- **Current Phase**: [Where we are]
- **Blockers**: [Any blockers]
`;
```

#### 1.5 Integration with ClaudeSession

```typescript
class ClaudeSession extends EventEmitter {
  private metrics: SessionMetrics;
  private smartCompactConfig: SmartCompactConfig;
  private compactInProgress: boolean = false;

  constructor(options: ClaudeSessionOptions) {
    super();
    this.metrics = this.initializeMetrics(options);
    this.smartCompactConfig = options.smartCompactConfig ?? DEFAULT_SMART_COMPACT_CONFIG;
  }

  private initializeMetrics(options: ClaudeSessionOptions): SessionMetrics {
    return {
      sessionId: options.sessionId ?? crypto.randomUUID(),
      sessionType: options.sessionType ?? 'project',
      currentContextTokens: 0,
      peakContextTokens: 0,
      totalInputTokensSpent: 0,
      compactionCount: 0,
      compactionHistory: [],
      totalCostUsd: 0,
      sessionStartedAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString(),
      totalActiveTimeMs: 0,
    };
  }

  // Called on every turn_complete event
  private updateMetrics(event: TurnCompleteEvent): void {
    const previousTokens = this.metrics.currentContextTokens;

    this.metrics.currentContextTokens = event.currentContextTokens;
    this.metrics.peakContextTokens = Math.max(
      this.metrics.peakContextTokens,
      event.currentContextTokens
    );
    this.metrics.totalInputTokensSpent += event.totalInputTokensSpent ?? 0;
    this.metrics.totalCostUsd += event.costUsd ?? 0;
    this.metrics.lastActivityAt = new Date().toISOString();

    // Update post-tokens for last compaction if pending
    this.updatePendingCompactionRecord(event.currentContextTokens);

    // Emit metrics update
    this.emit('event', {
      type: 'metrics_updated',
      metrics: { ...this.metrics }
    });

    // Check thresholds
    this.checkCompactionThresholds();
  }

  private checkCompactionThresholds(): void {
    if (!this.smartCompactConfig.enabled || this.compactInProgress) return;

    const { currentContextTokens } = this.metrics;
    const { thresholdPercent, warnPercent, maxContextTokens, autoTrigger } = this.smartCompactConfig;

    const warnThreshold = warnPercent * maxContextTokens;
    const compactThreshold = thresholdPercent * maxContextTokens;
    const currentPercent = currentContextTokens / maxContextTokens;

    // Warning threshold
    if (currentContextTokens >= warnThreshold && currentContextTokens < compactThreshold) {
      this.emit('event', {
        type: 'context_warning',
        currentTokens: currentContextTokens,
        thresholdTokens: compactThreshold,
        percent: currentPercent,
        message: `Context at ${(currentPercent * 100).toFixed(0)}% - approaching compact threshold`
      });
    }

    // Compact threshold
    if (autoTrigger && currentContextTokens >= compactThreshold) {
      this.triggerSmartCompact();
    }
  }

  async triggerSmartCompact(): Promise<void> {
    if (this.compactInProgress) return;

    this.compactInProgress = true;
    const compactNumber = this.metrics.compactionCount + 1;

    // Prepare compact instructions
    const instructions = this.smartCompactConfig.customInstructions
      .replace(/\[N\]/g, String(compactNumber));

    // Record pre-compact state
    const record: CompactionRecord = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      trigger: 'smart',
      preTokens: this.metrics.currentContextTokens,
      postTokens: null,
      customInstructions: true,
      preservedSections: this.smartCompactConfig.preserveSections
    };
    this.metrics.compactionHistory.push(record);

    // Emit event
    this.emit('event', {
      type: 'smart_compact_triggered',
      compactNumber,
      preTokens: this.metrics.currentContextTokens,
      recordId: record.id
    });

    // Send compact command
    await this.sendMessage(`/compact ${instructions}`);
  }

  // Called on compact_boundary event
  private handleCompactBoundary(event: CompactBoundaryEvent): void {
    this.metrics.compactionCount++;
    this.compactInProgress = false;

    this.emit('event', {
      type: 'compact_complete',
      preTokens: event.compact_metadata?.pre_tokens,
      compactNumber: this.metrics.compactionCount
    });
  }

  private updatePendingCompactionRecord(postTokens: number): void {
    // Find most recent record with null postTokens
    const pending = this.metrics.compactionHistory
      .filter(r => r.postTokens === null)
      .pop();

    if (pending) {
      pending.postTokens = postTokens;
    }
  }

  // Public API
  getMetrics(): SessionMetrics {
    return { ...this.metrics };
  }

  getSmartCompactConfig(): SmartCompactConfig {
    return { ...this.smartCompactConfig };
  }

  updateSmartCompactConfig(updates: Partial<SmartCompactConfig>): void {
    this.smartCompactConfig = { ...this.smartCompactConfig, ...updates };
  }
}
```

---

### 2. General Session (Ghost)

#### 2.1 Concept

Ghost is a persistent Claude Code session that acts as your computer assistant:
- Not attached to any specific project
- Full access to Claude skills (video processing, file management, etc.)
- Persists across control panel restarts
- Has its own CLAUDE.md with system-wide preferences
- Primary interface for non-coding tasks

#### 2.2 General Session Configuration

```typescript
interface GeneralSessionConfig {
  // Identity
  sessionName: string;               // Default: "Ghost"
  workspacePath: string;             // Default: ~/ghost-workspace

  // Behavior
  autoStart: boolean;                // Start on control panel launch
  persistSession: boolean;           // Resume across restarts

  // CLAUDE.md for general session
  claudeMdPath: string;              // Default: ~/ghost-workspace/CLAUDE.md

  // Smart compact (inherits from global but can override)
  smartCompact?: Partial<SmartCompactConfig>;
}

const DEFAULT_GENERAL_SESSION_CONFIG: GeneralSessionConfig = {
  sessionName: 'Ghost',
  workspacePath: expandPath('~/ghost-workspace'),
  autoStart: true,
  persistSession: true,
  claudeMdPath: expandPath('~/ghost-workspace/CLAUDE.md'),
};
```

#### 2.3 Ghost Workspace Structure

```
~/ghost-workspace/
├── CLAUDE.md              # System-wide preferences and instructions
├── .claude/
│   └── session.json       # Session persistence
├── scripts/               # User scripts accessible to Ghost
├── downloads/             # Default download location
└── scratch/               # Temporary workspace
```

#### 2.4 Ghost CLAUDE.md Template

```markdown
# Ghost - Computer Assistant

## Identity
- Name: Ghost
- Role: Personal computer assistant for Saint/Bootoshi
- Purpose: System tasks, file management, content creation support

## Capabilities
- Full access to Claude skills
- Video processing (via ~/scripts/)
- File management and organization
- Research and information gathering
- Code assistance (non-project specific)

## Preferences
- No emojis
- No em dashes - use hyphens or colons
- Bun for TypeScript, uv for Python
- Concise responses

## Common Tasks
- Video processing: Use ~/scripts/video-stitch.sh for OBS recordings
- File organization: Respect existing directory structure
- Research: Use Exa for code search, web search for general info

## Notes
- This is a general-purpose session, not attached to any project
- For project-specific work, use a project session instead
- Session persists across control panel restarts
```

#### 2.5 General Session Manager

```typescript
class GeneralSessionManager {
  private session: ClaudeSession | null = null;
  private config: GeneralSessionConfig;
  private tmuxManager: TmuxManager;

  constructor(config: GeneralSessionConfig, tmuxManager: TmuxManager) {
    this.config = config;
    this.tmuxManager = tmuxManager;
  }

  async initialize(): Promise<void> {
    // Ensure workspace exists
    await this.ensureWorkspace();

    // Auto-start if configured
    if (this.config.autoStart) {
      await this.start();
    }
  }

  private async ensureWorkspace(): Promise<void> {
    const { workspacePath, claudeMdPath } = this.config;

    // Create workspace directory
    await fs.mkdir(workspacePath, { recursive: true });
    await fs.mkdir(path.join(workspacePath, '.claude'), { recursive: true });
    await fs.mkdir(path.join(workspacePath, 'scripts'), { recursive: true });
    await fs.mkdir(path.join(workspacePath, 'downloads'), { recursive: true });
    await fs.mkdir(path.join(workspacePath, 'scratch'), { recursive: true });

    // Create CLAUDE.md if not exists
    if (!await fileExists(claudeMdPath)) {
      await fs.writeFile(claudeMdPath, GHOST_CLAUDE_MD_TEMPLATE);
    }
  }

  async start(): Promise<void> {
    if (this.session) {
      log.warn('General session already running');
      return;
    }

    // Check for existing session to resume
    const existingSessionId = this.config.persistSession
      ? await this.loadPersistedSession()
      : null;

    // Create tmux session
    const tmuxSessionName = `gcp-${this.config.sessionName.toLowerCase()}`;
    await this.tmuxManager.createSession(tmuxSessionName);

    // Create Claude session
    this.session = new ClaudeSession({
      cwd: this.config.workspacePath,
      sessionFile: path.join(this.config.workspacePath, '.claude', 'session.json'),
      resumeSessionId: existingSessionId,
      sessionType: 'general',
      smartCompactConfig: {
        ...DEFAULT_SMART_COMPACT_CONFIG,
        ...this.config.smartCompact
      }
    });

    // Forward events
    this.session.on('event', (event) => {
      this.emit('event', { ...event, sessionName: this.config.sessionName });
    });

    await this.session.start();
    log.info({ sessionName: this.config.sessionName }, 'General session started');
  }

  async stop(): Promise<void> {
    if (!this.session) return;

    // Persist session ID if configured
    if (this.config.persistSession) {
      await this.persistSession();
    }

    await this.session.stop();
    this.session = null;
    log.info({ sessionName: this.config.sessionName }, 'General session stopped');
  }

  async sendMessage(content: string): Promise<void> {
    if (!this.session) {
      throw new Error('General session not running');
    }
    await this.session.sendMessage(content);
  }

  getMetrics(): SessionMetrics | null {
    return this.session?.getMetrics() ?? null;
  }

  isRunning(): boolean {
    return this.session !== null;
  }

  private async loadPersistedSession(): Promise<string | null> {
    try {
      const sessionFile = path.join(this.config.workspacePath, '.claude', 'session.json');
      const data = await fs.readFile(sessionFile, 'utf-8');
      return JSON.parse(data).sessionId;
    } catch {
      return null;
    }
  }

  private async persistSession(): Promise<void> {
    const sessionId = this.session?.getSessionId();
    if (!sessionId) return;

    const sessionFile = path.join(this.config.workspacePath, '.claude', 'session.json');
    await fs.writeFile(sessionFile, JSON.stringify({ sessionId }, null, 2));
  }
}
```

---

### 3. Unified Session Management

#### 3.1 Session Types

```typescript
type SessionType = 'general' | 'project' | 'codex';

interface UnifiedSession {
  id: string;
  type: SessionType;
  name: string;                      // Display name
  status: SessionStatus;

  // Type-specific fields
  projectPath?: string;              // For project sessions
  codexJobId?: string;               // For codex sessions
  reasoningEffort?: ReasoningEffort; // For codex sessions

  // Common
  tmuxSession: string;               // tmux session name
  createdAt: string;
  lastActivityAt: string;

  // Metrics (Claude sessions only)
  metrics?: SessionMetrics;
}

type SessionStatus =
  | 'starting'
  | 'running'
  | 'idle'
  | 'compacting'
  | 'completed'
  | 'failed';

type ReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh';
```

#### 3.2 Unified Session Store

```typescript
class UnifiedSessionStore {
  private sessions: Map<string, UnifiedSession> = new Map();
  private emitter: EventEmitter = new EventEmitter();

  // CRUD operations
  add(session: UnifiedSession): void {
    this.sessions.set(session.id, session);
    this.emitter.emit('session_added', session);
  }

  update(id: string, updates: Partial<UnifiedSession>): void {
    const session = this.sessions.get(id);
    if (!session) return;

    Object.assign(session, updates);
    session.lastActivityAt = new Date().toISOString();
    this.emitter.emit('session_updated', session);
  }

  remove(id: string): void {
    const session = this.sessions.get(id);
    if (!session) return;

    this.sessions.delete(id);
    this.emitter.emit('session_removed', session);
  }

  // Queries
  get(id: string): UnifiedSession | undefined {
    return this.sessions.get(id);
  }

  list(filter?: { type?: SessionType; status?: SessionStatus }): UnifiedSession[] {
    let sessions = Array.from(this.sessions.values());

    if (filter?.type) {
      sessions = sessions.filter(s => s.type === filter.type);
    }
    if (filter?.status) {
      sessions = sessions.filter(s => s.status === filter.status);
    }

    return sessions.sort((a, b) =>
      new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
    );
  }

  getGeneral(): UnifiedSession | undefined {
    return this.list({ type: 'general' })[0];
  }

  // Events
  on(event: string, listener: (...args: any[]) => void): void {
    this.emitter.on(event, listener);
  }
}
```

---

### 4. Tmux Integration

#### 4.1 Why Tmux?

- **Observability**: Attach to any session to see real-time output
- **Steering**: Send keystrokes to running agents
- **Persistence**: Sessions survive control panel restarts
- **Multiplexing**: View multiple sessions in splits/tabs
- **Low overhead**: Native terminal, no additional GUI

#### 4.2 Tmux Manager

```typescript
interface TmuxSession {
  name: string;
  attached: boolean;
  windows: number;
  created: Date;
}

class TmuxManager {
  private prefix: string;

  constructor(prefix: string = 'gcp-') {
    this.prefix = prefix;
  }

  // Session management
  async createSession(name: string, command?: string): Promise<string> {
    const sessionName = this.prefixName(name);

    const args = ['new-session', '-d', '-s', sessionName];
    if (command) {
      args.push(command);
    }

    await this.exec(args);
    return sessionName;
  }

  async killSession(name: string): Promise<void> {
    await this.exec(['kill-session', '-t', this.prefixName(name)]);
  }

  async listSessions(): Promise<TmuxSession[]> {
    try {
      const output = await this.exec([
        'list-sessions',
        '-F',
        '#{session_name}:#{session_attached}:#{session_windows}:#{session_created}'
      ]);

      return output
        .trim()
        .split('\n')
        .filter(line => line.startsWith(this.prefix))
        .map(line => {
          const [name, attached, windows, created] = line.split(':');
          return {
            name: name.replace(this.prefix, ''),
            attached: attached === '1',
            windows: parseInt(windows),
            created: new Date(parseInt(created) * 1000)
          };
        });
    } catch {
      return [];
    }
  }

  // Interaction
  async sendKeys(session: string, keys: string): Promise<void> {
    await this.exec(['send-keys', '-t', this.prefixName(session), keys, 'Enter']);
  }

  async capturePane(session: string, lines: number = 100): Promise<string> {
    return await this.exec([
      'capture-pane',
      '-t', this.prefixName(session),
      '-p',
      '-S', `-${lines}`
    ]);
  }

  // Layout
  async splitWindow(session: string, direction: 'h' | 'v'): Promise<void> {
    const flag = direction === 'h' ? '-h' : '-v';
    await this.exec(['split-window', flag, '-t', this.prefixName(session)]);
  }

  // Utilities
  getAttachCommand(session: string): string {
    return `tmux attach -t ${this.prefixName(session)}`;
  }

  private prefixName(name: string): string {
    return name.startsWith(this.prefix) ? name : `${this.prefix}${name}`;
  }

  private async exec(args: string[]): Promise<string> {
    const proc = Bun.spawn(['tmux', ...args], {
      stdout: 'pipe',
      stderr: 'pipe'
    });

    const output = await new Response(proc.stdout).text();
    const exitCode = await proc.exited;

    if (exitCode !== 0) {
      const stderr = await new Response(proc.stderr).text();
      throw new Error(`tmux error: ${stderr}`);
    }

    return output;
  }
}
```

#### 4.3 Tmux Session Naming Convention

```
gcp-ghost           # General session
gcp-proj-{slug}     # Project sessions
gcp-codex-{jobId}   # Codex agent sessions
```

---

### 5. Codex Agent Integration

#### 5.1 Codex Agent Manager

```typescript
interface CodexJob {
  id: string;
  prompt: string;
  status: 'running' | 'completed' | 'failed';
  reasoning: ReasoningEffort;
  sandbox: 'read-only' | 'workspace-write';
  workingDir: string;
  tmuxSession: string;
  startedAt: string;
  completedAt?: string;
  result?: string;
}

interface CodexSpawnOptions {
  prompt: string;
  reasoning?: ReasoningEffort;
  sandbox?: 'read-only' | 'workspace-write';
  files?: string[];
  includeMap?: boolean;
  workingDir?: string;
}

class CodexAgentManager {
  private tmuxManager: TmuxManager;
  private sessionStore: UnifiedSessionStore;

  constructor(tmuxManager: TmuxManager, sessionStore: UnifiedSessionStore) {
    this.tmuxManager = tmuxManager;
    this.sessionStore = sessionStore;
  }

  async spawn(options: CodexSpawnOptions): Promise<string> {
    const {
      prompt,
      reasoning = 'high',
      sandbox = 'read-only',
      files = [],
      includeMap = false,
      workingDir = process.cwd()
    } = options;

    // Build codex-agent command
    const args = ['codex-agent', 'start', `"${prompt}"`];
    args.push('-r', reasoning);
    args.push('-s', sandbox);
    args.push('-d', workingDir);

    for (const file of files) {
      args.push('-f', file);
    }

    if (includeMap) {
      args.push('--map');
    }

    // Execute and capture job ID
    const output = await this.execCodexAgent(args);
    const jobId = this.parseJobId(output);

    if (!jobId) {
      throw new Error('Failed to get job ID from codex-agent');
    }

    // Add to session store
    const session: UnifiedSession = {
      id: jobId,
      type: 'codex',
      name: `Codex: ${prompt.slice(0, 30)}...`,
      status: 'running',
      codexJobId: jobId,
      reasoningEffort: reasoning,
      tmuxSession: `codex-agent-${jobId}`,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString()
    };

    this.sessionStore.add(session);

    // Start polling for completion
    this.pollJobStatus(jobId);

    return jobId;
  }

  async getStatus(jobId: string): Promise<CodexJob | null> {
    const output = await this.execCodexAgent(['status', jobId]);
    return this.parseJobStatus(output);
  }

  async getResult(jobId: string, wait: boolean = false): Promise<string> {
    const args = ['result', jobId];
    if (wait) args.push('--wait');

    return await this.execCodexAgent(args);
  }

  async capture(jobId: string, lines: number = 100): Promise<string> {
    return await this.execCodexAgent(['capture', jobId, String(lines)]);
  }

  async send(jobId: string, message: string): Promise<void> {
    await this.execCodexAgent(['send', jobId, `"${message}"`]);
  }

  async kill(jobId: string): Promise<void> {
    await this.execCodexAgent(['kill', jobId]);
    this.sessionStore.update(jobId, { status: 'failed' });
  }

  async listJobs(): Promise<CodexJob[]> {
    const output = await this.execCodexAgent(['jobs']);
    return this.parseJobList(output);
  }

  private async pollJobStatus(jobId: string): Promise<void> {
    const poll = async () => {
      const status = await this.getStatus(jobId);
      if (!status) return;

      if (status.status !== 'running') {
        this.sessionStore.update(jobId, {
          status: status.status === 'completed' ? 'completed' : 'failed'
        });
        return;
      }

      // Continue polling
      setTimeout(poll, 5000);
    };

    poll();
  }

  private async execCodexAgent(args: string[]): Promise<string> {
    const proc = Bun.spawn(['codex-agent', ...args], {
      stdout: 'pipe',
      stderr: 'pipe'
    });
    return await new Response(proc.stdout).text();
  }

  private parseJobId(output: string): string | null {
    const match = output.match(/Job started: ([a-f0-9]+)/);
    return match?.[1] ?? null;
  }

  private parseJobStatus(output: string): CodexJob | null {
    // Parse codex-agent status output
    // Implementation depends on codex-agent output format
    return null;
  }

  private parseJobList(output: string): CodexJob[] {
    // Parse codex-agent jobs output
    return [];
  }
}
```

---

### 6. Project Scaffolding

#### 6.1 Create New Project

```typescript
interface ProjectTemplate {
  name: string;
  description: string;
  files: Record<string, string>;     // path -> content
  dependencies?: string[];
  devDependencies?: string[];
  scripts?: Record<string, string>;
}

const TYPESCRIPT_BUN_TEMPLATE: ProjectTemplate = {
  name: 'typescript-bun',
  description: 'TypeScript project with Bun runtime',
  files: {
    'CLAUDE.md': `# Project: {{name}}

## Stack
- Runtime: Bun
- Language: TypeScript

## Commands
- \`bun run dev\` - Start development
- \`bun test\` - Run tests
- \`bun run build\` - Build for production

## Conventions
- Use strict TypeScript
- Pino for logging
- No emojis in code or docs
`,
    'package.json': JSON.stringify({
      name: '{{slug}}',
      version: '0.1.0',
      type: 'module',
      scripts: {
        dev: 'bun run src/index.ts',
        build: 'bun build src/index.ts --outdir dist --target node',
        test: 'bun test'
      }
    }, null, 2),
    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        target: 'ESNext',
        module: 'ESNext',
        moduleResolution: 'bundler',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true
      },
      include: ['src']
    }, null, 2),
    'src/index.ts': `console.log('Hello from {{name}}!');
`,
    '.gitignore': `node_modules/
dist/
.env
*.log
`
  }
};

class ProjectScaffolder {
  private templates: Map<string, ProjectTemplate> = new Map();
  private sessionStore: UnifiedSessionStore;

  constructor(sessionStore: UnifiedSessionStore) {
    this.sessionStore = sessionStore;
    this.registerTemplate(TYPESCRIPT_BUN_TEMPLATE);
  }

  registerTemplate(template: ProjectTemplate): void {
    this.templates.set(template.name, template);
  }

  async create(options: {
    name: string;
    path: string;
    template: string;
  }): Promise<UnifiedSession> {
    const template = this.templates.get(options.template);
    if (!template) {
      throw new Error(`Unknown template: ${options.template}`);
    }

    const slug = this.slugify(options.name);
    const projectPath = path.join(options.path, slug);

    // Create directory
    await fs.mkdir(projectPath, { recursive: true });

    // Create files from template
    for (const [filePath, content] of Object.entries(template.files)) {
      const fullPath = path.join(projectPath, filePath);
      const processedContent = this.processTemplate(content, {
        name: options.name,
        slug
      });

      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, processedContent);
    }

    // Initialize git
    await this.exec(['git', 'init'], { cwd: projectPath });

    // Install dependencies
    if (template.dependencies?.length || template.devDependencies?.length) {
      await this.exec(['bun', 'install'], { cwd: projectPath });
    }

    // Create and register session
    const session: UnifiedSession = {
      id: crypto.randomUUID(),
      type: 'project',
      name: options.name,
      status: 'idle',
      projectPath,
      tmuxSession: `proj-${slug}`,
      createdAt: new Date().toISOString(),
      lastActivityAt: new Date().toISOString()
    };

    this.sessionStore.add(session);
    return session;
  }

  private slugify(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  }

  private processTemplate(content: string, vars: Record<string, string>): string {
    return content.replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
  }

  private async exec(args: string[], options?: { cwd?: string }): Promise<void> {
    const proc = Bun.spawn(args, {
      cwd: options?.cwd,
      stdout: 'pipe',
      stderr: 'pipe'
    });
    await proc.exited;
  }
}
```

---

### 7. API Endpoints

```typescript
// Session Management
GET    /api/sessions                       // List all sessions
POST   /api/sessions                       // Create new session
GET    /api/sessions/:id                   // Get session details
DELETE /api/sessions/:id                   // Close session
POST   /api/sessions/:id/message           // Send message to session
GET    /api/sessions/:id/metrics           // Get session metrics
POST   /api/sessions/:id/compact           // Trigger manual compact
POST   /api/sessions/:id/attach            // Get tmux attach command

// General Session
GET    /api/general                        // Get general session status
POST   /api/general/start                  // Start general session
POST   /api/general/stop                   // Stop general session
POST   /api/general/message                // Send message to general session

// Smart Compaction
GET    /api/config/smart-compact           // Get smart compact config
PATCH  /api/config/smart-compact           // Update smart compact config

// Codex Agents
POST   /api/codex/spawn                    // Spawn new agent
GET    /api/codex/jobs                     // List all jobs
GET    /api/codex/jobs/:id                 // Get job status
GET    /api/codex/jobs/:id/result          // Get job result
POST   /api/codex/jobs/:id/send            // Send message to job
DELETE /api/codex/jobs/:id                 // Kill job

// Projects
GET    /api/projects                       // List projects
POST   /api/projects                       // Create new project
GET    /api/projects/:id                   // Get project details
DELETE /api/projects/:id                   // Remove project (not files)

// Tmux
GET    /api/tmux/sessions                  // List tmux sessions
POST   /api/tmux/sessions/:name/capture    // Capture pane output
POST   /api/tmux/sessions/:name/send       // Send keys to session
```

---

### 8. Configuration

#### 8.1 Environment Variables

```bash
# Server
PORT=3847
HOST=0.0.0.0

# General Session
GHOST_ENABLED=true
GHOST_WORKSPACE=~/ghost-workspace
GHOST_AUTO_START=true
GHOST_SESSION_NAME=Ghost

# Smart Compaction
SMART_COMPACT_ENABLED=true
SMART_COMPACT_THRESHOLD=0.80
SMART_COMPACT_WARN=0.70
SMART_COMPACT_AUTO_TRIGGER=true

# Codex Integration
CODEX_ENABLED=true
CODEX_DEFAULT_REASONING=high
CODEX_DEFAULT_SANDBOX=read-only

# Model
MODEL=claude-sonnet-4-20250514
MAX_THINKING_TOKENS=31999
```

#### 8.2 Config File (gcp-config.json)

```json
{
  "general": {
    "enabled": true,
    "sessionName": "Ghost",
    "workspacePath": "~/ghost-workspace",
    "autoStart": true,
    "persistSession": true
  },
  "smartCompact": {
    "enabled": true,
    "thresholdPercent": 0.80,
    "warnPercent": 0.70,
    "autoTrigger": true,
    "confirmBeforeCompact": false
  },
  "codex": {
    "enabled": true,
    "defaultReasoning": "high",
    "defaultSandbox": "read-only"
  },
  "tmux": {
    "prefix": "gcp-"
  },
  "projects": {
    "defaultPath": "~/dev"
  }
}
```

---

### 9. Implementation Plan

#### Phase 1: Smart Compaction (3-4 days)
- [ ] Add SessionMetrics interface and tracking
- [ ] Implement SmartCompactConfig and loading
- [ ] Add threshold checking to ClaudeSession
- [ ] Create custom compact prompt template
- [ ] Emit context_warning and smart_compact_triggered events
- [ ] Persist metrics to session file
- [ ] Add /api/sessions/:id/metrics endpoint
- [ ] Add /api/sessions/:id/compact endpoint

#### Phase 2: General Session (2-3 days)
- [ ] Create GeneralSessionManager class
- [ ] Set up ghost-workspace structure
- [ ] Create Ghost CLAUDE.md template
- [ ] Implement auto-start on control panel launch
- [ ] Add session persistence across restarts
- [ ] Add /api/general/* endpoints
- [ ] Wire up to TerminalManager

#### Phase 3: Tmux Integration (2-3 days)
- [ ] Create TmuxManager class
- [ ] Implement session creation/destruction
- [ ] Add capture and send-keys functionality
- [ ] Migrate all sessions to tmux-backed
- [ ] Add /api/tmux/* endpoints
- [ ] Add attach command generation

#### Phase 4: Codex Integration (3-4 days)
- [ ] Create CodexAgentManager class
- [ ] Implement spawn/status/result/kill
- [ ] Add job polling and status updates
- [ ] Integrate with UnifiedSessionStore
- [ ] Add /api/codex/* endpoints
- [ ] Add to unified session list

#### Phase 5: UI Updates (2-3 days)
- [ ] Add unified session list component
- [ ] Add context usage progress bars
- [ ] Add compaction history view
- [ ] Add Codex job monitoring
- [ ] Add session type indicators
- [ ] Add tmux attach buttons

---

### 10. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Context Preservation | >90% recall | Post-compact quiz on key facts |
| Token Efficiency | <85% avg usage | Mean context % across sessions |
| Compaction Success | <10% manual fixes | Corrections needed after smart compact |
| Session Management | <2s switch time | Time to switch between sessions |
| Agent Observability | 100% capturable | All output retrievable via tmux |
| Ghost Availability | 99% uptime | General session available when needed |

---

### 11. Open Questions

1. **Threshold default**: 80% vs 75% vs 85%?
2. **Confirm before compact**: Should auto-compact require confirmation?
3. **Per-project templates**: Different compact instructions per project?
4. **Cost budgets**: Should we implement cost limits per session/day?
5. **Model selection**: Allow changing model per session?

---

## Appendix A: Full Smart Compact Prompt

```
/compact In addition to the default summary, explicitly include these sections at the END:

## COMPACT #[N]
This is compaction number [N] in this session.

## IMMEDIATE NEXT ACTION
State the single most important next step as a specific imperative:
- Include exact file paths and line numbers if applicable
- Make it actionable without additional context
- Format: "Do X in Y to achieve Z"

## SETTLED DECISIONS
Decisions that should NOT be revisited:
| Decision | Rationale | Context |
|----------|-----------|---------|

## DEAD ENDS
Approaches tried and failed:
| Attempted | Failed Because | Lesson |
|-----------|----------------|--------|

## TRUST ANCHORS
Components verified working:
| Component | Verification | Status |
|-----------|--------------|--------|

## TASK QUEUE
Remaining work in priority order:
1. **[Task]** - Dependencies: [deps]
2. **[Task]** - Dependencies: [deps]

## USER PREFERENCES
- [Preference] - PERMANENT
- [Preference] - SESSION

## KEY FILES
| Path | Relevance |
|------|-----------|

## SESSION CONTEXT
- **Project**: [Name/path]
- **Main Goal**: [What we're accomplishing]
- **Current Phase**: [Where we are]
```

---

## Appendix B: CLI Quick Reference

```bash
# General Session
ghost                    # Attach to Ghost session
ghost "message"          # Send message to Ghost

# Project Sessions
gcp new my-project       # Create new project
gcp open my-project      # Open project session
gcp list                 # List all sessions
gcp attach <session>     # Attach to tmux session

# Codex Agents
gcp codex "prompt"       # Spawn Codex agent
gcp codex jobs           # List Codex jobs
gcp codex result <id>    # Get job result
gcp codex kill <id>      # Kill job

# Smart Compaction
gcp compact <session>    # Trigger compact
gcp metrics <session>    # View session metrics
```

---

## Appendix C: Directory Structure

```
~/ghost-workspace/           # General session workspace
├── CLAUDE.md
├── .claude/
│   └── session.json
├── scripts/
├── downloads/
└── scratch/

~/dev/                       # Default project location
└── my-project/
    ├── CLAUDE.md
    ├── .claude/
    │   └── session.json
    └── src/

~/.gcp/                      # Control panel data
├── config.json
├── sessions/
│   └── <session-id>.json
└── logs/
```
