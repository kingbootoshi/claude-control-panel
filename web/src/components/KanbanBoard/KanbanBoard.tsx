import { useState, useCallback } from 'react';
import './KanbanBoard.css';

export type TaskPriority = 'high' | 'medium' | 'low';
export type TaskTag = 'feature' | 'bug' | 'enhancement' | 'docs';
export type TaskStatus = 'todo' | 'in_progress' | 'done';

export interface Task {
  id: string;
  title: string;
  description?: string;
  priority: TaskPriority;
  tags: TaskTag[];
  status: TaskStatus;
  assignedAgent?: string;
  createdAt: string;
  completedAt?: string;
}

interface KanbanBoardProps {
  tasks?: Task[];
  onTaskClick?: (task: Task) => void;
  onRunWithAgent?: (task: Task) => void;
  onNewTask?: () => void;
}

// Sample tasks for demo
const sampleTasks: Task[] = [
  {
    id: '1',
    title: 'Add GitHub OAuth integration',
    description: 'Create OAuth flow, add callback route, persist tokens',
    priority: 'high',
    tags: ['feature'],
    status: 'todo',
    createdAt: new Date().toISOString(),
  },
  {
    id: '2',
    title: 'Fix mobile viewport height on iOS Safari',
    description: 'Address the 100vh issue on iOS Safari PWA mode',
    priority: 'medium',
    tags: ['bug'],
    status: 'todo',
    createdAt: new Date().toISOString(),
  },
  {
    id: '3',
    title: 'Refactor terminal component for better perf',
    description: 'Virtualize long message lists, optimize re-renders',
    priority: 'low',
    tags: ['enhancement'],
    status: 'todo',
    createdAt: new Date().toISOString(),
  },
  {
    id: '4',
    title: 'Add keyboard shortcuts documentation',
    description: 'Document all available keyboard shortcuts',
    priority: 'low',
    tags: ['docs'],
    status: 'todo',
    createdAt: new Date().toISOString(),
  },
  {
    id: '5',
    title: 'Implement session persistence with Redis',
    description: 'Store session state in Redis for resumability',
    priority: 'high',
    tags: ['feature'],
    status: 'in_progress',
    assignedAgent: 'ghost',
    createdAt: new Date().toISOString(),
  },
  {
    id: '6',
    title: 'Add extended thinking toggle',
    description: 'Allow users to enable/disable extended thinking',
    priority: 'medium',
    tags: ['enhancement'],
    status: 'in_progress',
    assignedAgent: 'builder',
    createdAt: new Date().toISOString(),
  },
  {
    id: '7',
    title: 'Fix setup wizard scroll on mobile',
    priority: 'low',
    tags: ['bug'],
    status: 'done',
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  },
  {
    id: '8',
    title: 'iOS Safari PWA mobile UX improvements',
    priority: 'low',
    tags: ['bug'],
    status: 'done',
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  },
  {
    id: '9',
    title: 'Add setup wizard and settings panel',
    priority: 'low',
    tags: ['feature'],
    status: 'done',
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  },
  {
    id: '10',
    title: 'Add extended thinking with streaming',
    priority: 'low',
    tags: ['feature'],
    status: 'done',
    createdAt: new Date().toISOString(),
    completedAt: new Date().toISOString(),
  },
];

export function KanbanBoard({
  tasks = sampleTasks,
  onTaskClick,
  onRunWithAgent,
  onNewTask
}: KanbanBoardProps) {
  const [_filter, setFilter] = useState<string>('');
  const [_searchQuery, setSearchQuery] = useState('');

  const todoTasks = tasks.filter(t => t.status === 'todo');
  const inProgressTasks = tasks.filter(t => t.status === 'in_progress');
  const doneTasks = tasks.filter(t => t.status === 'done');

  const agentsWorking = inProgressTasks.filter(t => t.assignedAgent).length;

  const handleRunWithAgent = useCallback((e: React.MouseEvent, task: Task) => {
    e.stopPropagation();
    onRunWithAgent?.(task);
  }, [onRunWithAgent]);

  return (
    <div className="kanban-board">
      {/* Board Header */}
      <div className="board-header">
        <div className="board-title">Task Board</div>
        <div className="board-stats">
          <span className="board-stat"><span className="value">{todoTasks.length}</span> to do</span>
          <span className="board-stat"><span className="accent">{inProgressTasks.length}</span> in progress</span>
          <span className="board-stat"><span className="value">{doneTasks.length}</span> done</span>
        </div>
      </div>

      {/* Board Toolbar */}
      <div className="board-toolbar">
        <button className="board-btn" onClick={() => setSearchQuery('')}>
          <SearchIcon />
          search
        </button>
        <button className="board-btn" onClick={() => setFilter('')}>
          <FilterIcon />
          filter
        </button>
        <button className="board-btn primary" onClick={onNewTask}>
          <PlusIcon />
          new task
        </button>
      </div>

      {/* Kanban Columns */}
      <div className="kanban-columns">
        {/* To Do Column */}
        <KanbanColumn
          title="To Do"
          count={todoTasks.length}
          onAdd={onNewTask}
        >
          {todoTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick?.(task)}
              onRunWithAgent={(e) => handleRunWithAgent(e, task)}
            />
          ))}
        </KanbanColumn>

        {/* In Progress Column */}
        <KanbanColumn
          title="In Progress"
          count={inProgressTasks.length}
        >
          {inProgressTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick?.(task)}
              showAgent
            />
          ))}
        </KanbanColumn>

        {/* Done Column */}
        <KanbanColumn
          title="Done"
          count={doneTasks.length}
        >
          {doneTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              onClick={() => onTaskClick?.(task)}
              isDone
            />
          ))}
        </KanbanColumn>
      </div>

      {/* Footer Stats */}
      <div className="board-footer">
        <span className="footer-stat"><span className="value">{tasks.length}</span> tasks</span>
        {agentsWorking > 0 && (
          <span className="footer-stat accent">{agentsWorking} agents working</span>
        )}
      </div>
    </div>
  );
}

// Kanban Column Component
interface KanbanColumnProps {
  title: string;
  count: number;
  onAdd?: () => void;
  children: React.ReactNode;
}

function KanbanColumn({ title, count, onAdd, children }: KanbanColumnProps) {
  return (
    <div className="kanban-column">
      <div className="column-header">
        <div className="column-title">
          <span>{title}</span>
          <span className="column-count">{count}</span>
        </div>
        {onAdd && (
          <button className="column-add" onClick={onAdd}>
            <PlusIcon />
          </button>
        )}
      </div>
      <div className="column-body">
        {children}
      </div>
    </div>
  );
}

// Task Card Component
interface TaskCardProps {
  task: Task;
  onClick?: () => void;
  onRunWithAgent?: (e: React.MouseEvent) => void;
  showAgent?: boolean;
  isDone?: boolean;
}

function TaskCard({ task, onClick, onRunWithAgent, showAgent, isDone }: TaskCardProps) {
  return (
    <div
      className={`task-card ${isDone ? 'done' : ''}`}
      onClick={onClick}
    >
      <div className="task-header">
        <div className={`task-priority ${isDone ? 'muted' : task.priority}`} />
        <div className="task-content">
          <div className={`task-title ${isDone ? 'strikethrough' : ''}`}>
            {task.title}
          </div>
          {task.description && !isDone && (
            <div className="task-description">{task.description}</div>
          )}
        </div>
      </div>
      <div className="task-footer">
        <div className="task-tags">
          {task.tags.map(tag => (
            <span key={tag} className={`task-tag ${tag}`}>{tag}</span>
          ))}
        </div>
        {onRunWithAgent && !isDone && (
          <div className="task-actions">
            <button
              className="task-action"
              title="Run with agent"
              onClick={onRunWithAgent}
            >
              <PlayIcon />
            </button>
          </div>
        )}
      </div>
      {showAgent && task.assignedAgent && (
        <div className="task-agent">
          <span className="agent-dot" />
          <span>{task.assignedAgent} working...</span>
        </div>
      )}
    </div>
  );
}

// Icons
function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

function FilterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  );
}

export default KanbanBoard;
