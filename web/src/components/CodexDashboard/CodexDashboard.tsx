import { useState, useCallback } from 'react';
import { trpc } from '../../trpc';
import type { CodexJob, CodexModel, CodexReasoningEffort, Project, CodexOutputEvent } from '../../types';
import './CodexDashboard.css';

interface CodexDashboardProps {
  projects: Project[];
}

export function CodexDashboard({ projects }: CodexDashboardProps) {
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [showNewJobForm, setShowNewJobForm] = useState(false);
  const [jobOutput, setJobOutput] = useState<Record<string, string>>({});

  // Form state
  const [prompt, setPrompt] = useState('');
  const [model, setModel] = useState<CodexModel>('gpt-5.2-codex');
  const [reasoningEffort, setReasoningEffort] = useState<CodexReasoningEffort>('xhigh');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  // Queries
  const jobsQuery = trpc.codex.list.useQuery(undefined, {
    refetchInterval: 3000,
  });

  const healthQuery = trpc.codex.health.useQuery();

  // Mutations
  const createJobMutation = trpc.codex.create.useMutation({
    onSuccess: (job) => {
      jobsQuery.refetch();
      setShowNewJobForm(false);
      setSelectedJobId(job.id);
      setPrompt('');
    },
  });

  const killJobMutation = trpc.codex.kill.useMutation({
    onSuccess: () => jobsQuery.refetch(),
  });

  const deleteJobMutation = trpc.codex.delete.useMutation({
    onSuccess: () => {
      jobsQuery.refetch();
      if (selectedJobId) {
        setSelectedJobId(null);
      }
    },
  });

  const jobs = jobsQuery.data ?? [];
  const selectedJob = jobs.find(j => j.id === selectedJobId);

  // Subscribe to output for selected job
  trpc.codex.output.useSubscription(
    { jobId: selectedJobId! },
    {
      enabled: Boolean(selectedJobId && selectedJob?.status === 'running'),
      onData: (event: CodexOutputEvent) => {
        setJobOutput(prev => ({
          ...prev,
          [event.jobId]: (prev[event.jobId] || '') + event.output,
        }));
      },
    }
  );

  // Handlers
  const handleCreateJob = useCallback(() => {
    if (!prompt.trim()) return;

    const project = projects.find(p => p.id === selectedProjectId);
    createJobMutation.mutate({
      prompt: prompt.trim(),
      model,
      reasoningEffort,
      projectId: selectedProjectId || undefined,
      workingDir: project?.path,
    });
  }, [prompt, model, reasoningEffort, selectedProjectId, projects, createJobMutation]);

  const handleKillJob = useCallback((jobId: string) => {
    killJobMutation.mutate({ jobId });
  }, [killJobMutation]);

  const handleDeleteJob = useCallback((jobId: string) => {
    deleteJobMutation.mutate({ jobId });
  }, [deleteJobMutation]);

  const getStatusClass = (status: CodexJob['status']) => {
    switch (status) {
      case 'running': return 'running';
      case 'queued': return 'queued';
      case 'completed': return 'completed';
      case 'failed': return 'failed';
      case 'killed': return 'killed';
      default: return '';
    }
  };

  const getStatusLabel = (status: CodexJob['status']) => {
    switch (status) {
      case 'running': return 'Running';
      case 'queued': return 'Queued';
      case 'completed': return 'Completed';
      case 'failed': return 'Failed';
      case 'killed': return 'Killed';
      default: return status;
    }
  };

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString();
  };

  const formatDuration = (start: string, end?: string) => {
    const startDate = new Date(start);
    const endDate = end ? new Date(end) : new Date();
    const seconds = Math.floor((endDate.getTime() - startDate.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    return `${minutes}m ${seconds % 60}s`;
  };

  if (!healthQuery.data?.available) {
    return (
      <div className="codex-empty">
        <div className="codex-empty-content">
          <CodexIcon />
          <h3>Codex CLI not available</h3>
          <p>Install the Codex CLI to use this feature.</p>
          <p className="hint">npm i -g @openai/codex</p>
        </div>
      </div>
    );
  }

  return (
    <div className="codex-dashboard">
      {/* Job List */}
      <div className="codex-sidebar">
        <div className="codex-sidebar-header">
          <span>Codex Jobs</span>
          <button
            className="new-job-btn"
            onClick={() => setShowNewJobForm(true)}
          >
            <PlusIcon />
          </button>
        </div>

        <div className="job-list">
          {jobs.length === 0 ? (
            <div className="job-list-empty">
              <p>No jobs yet</p>
              <button
                className="toolbar-btn primary"
                onClick={() => setShowNewJobForm(true)}
              >
                <PlusIcon />
                New Job
              </button>
            </div>
          ) : (
            jobs.map(job => (
              <div
                key={job.id}
                className={`job-item ${selectedJobId === job.id ? 'selected' : ''}`}
                onClick={() => setSelectedJobId(job.id)}
              >
                <div className={`job-status-dot ${getStatusClass(job.status)}`} />
                <div className="job-info">
                  <div className="job-prompt">{job.prompt.slice(0, 50)}{job.prompt.length > 50 ? '...' : ''}</div>
                  <div className="job-meta">
                    <span className="job-time">{formatTime(job.startedAt)}</span>
                    <span className={`job-status-badge ${getStatusClass(job.status)}`}>
                      {getStatusLabel(job.status)}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Job Detail / New Job Form */}
      <div className="codex-main">
        {showNewJobForm ? (
          <div className="new-job-form">
            <div className="form-header">
              <h3>New Codex Job</h3>
              <button
                className="close-btn"
                onClick={() => setShowNewJobForm(false)}
              >
                <XIcon />
              </button>
            </div>

            <div className="form-body">
              <div className="form-group">
                <label>Prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Describe what you want Codex to do..."
                  rows={4}
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Model</label>
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value as CodexModel)}
                  >
                    <option value="gpt-5.2-codex">GPT-5.2 Codex (Latest)</option>
                    <option value="gpt-5.1-codex-max">GPT-5.1 Codex Max</option>
                    <option value="gpt-5.1-codex-mini">GPT-5.1 Codex Mini</option>
                    <option value="gpt-5.1-codex">GPT-5.1 Codex</option>
                    <option value="gpt-5-codex">GPT-5 Codex</option>
                    <option value="gpt-5.2">GPT-5.2</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Reasoning Effort</label>
                  <select
                    value={reasoningEffort}
                    onChange={(e) => setReasoningEffort(e.target.value as CodexReasoningEffort)}
                  >
                    <option value="xhigh">XHigh (Maximum)</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                    <option value="minimal">Minimal</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Project</label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                  >
                    <option value="">Workspace Root</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-actions">
                <button
                  className="toolbar-btn"
                  onClick={() => setShowNewJobForm(false)}
                >
                  Cancel
                </button>
                <button
                  className="toolbar-btn primary"
                  onClick={handleCreateJob}
                  disabled={!prompt.trim() || createJobMutation.isPending}
                >
                  {createJobMutation.isPending ? 'Creating...' : 'Create Job'}
                </button>
              </div>
            </div>
          </div>
        ) : selectedJob ? (
          <div className="job-detail">
            <div className="job-detail-header">
              <div className={`job-status-indicator ${getStatusClass(selectedJob.status)}`}>
                {getStatusLabel(selectedJob.status)}
              </div>
              <div className="job-detail-actions">
                {selectedJob.status === 'running' && (
                  <button
                    className="toolbar-btn danger"
                    onClick={() => handleKillJob(selectedJob.id)}
                  >
                    <StopIcon />
                    Kill
                  </button>
                )}
                {['completed', 'failed', 'killed'].includes(selectedJob.status) && (
                  <button
                    className="toolbar-btn"
                    onClick={() => handleDeleteJob(selectedJob.id)}
                  >
                    <TrashIcon />
                    Delete
                  </button>
                )}
              </div>
            </div>

            <div className="job-detail-info">
              <div className="detail-row">
                <span className="detail-label">Prompt:</span>
                <span className="detail-value">{selectedJob.prompt}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Model:</span>
                <span className="detail-value">{selectedJob.model}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Reasoning:</span>
                <span className="detail-value">{selectedJob.reasoningEffort}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Working Dir:</span>
                <span className="detail-value">{selectedJob.workingDir}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Duration:</span>
                <span className="detail-value">
                  {formatDuration(selectedJob.startedAt, selectedJob.completedAt)}
                </span>
              </div>
            </div>

            {selectedJob.error && (
              <div className="job-error">
                <span className="error-label">Error:</span>
                <span className="error-message">{selectedJob.error}</span>
              </div>
            )}

            {selectedJob.filesChanged && selectedJob.filesChanged.length > 0 && (
              <div className="job-files">
                <h4>Files Changed</h4>
                <div className="file-list">
                  {selectedJob.filesChanged.map((file, i) => (
                    <div key={i} className={`file-item ${file.type}`}>
                      <span className="file-type">{file.type}</span>
                      <span className="file-path">{file.path}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="job-output">
              <h4>Output</h4>
              <pre className="output-content">
                {jobOutput[selectedJob.id] || selectedJob.output || 'No output yet...'}
              </pre>
            </div>
          </div>
        ) : (
          <div className="codex-empty-state">
            <CodexIcon />
            <h3>Select a job</h3>
            <p>Select a job from the list or create a new one</p>
          </div>
        )}
      </div>
    </div>
  );
}

// Icons
function CodexIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v12M6 12h12" />
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

function XIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="6" y="6" width="12" height="12" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
    </svg>
  );
}

export default CodexDashboard;
