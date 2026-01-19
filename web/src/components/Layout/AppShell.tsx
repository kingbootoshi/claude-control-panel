import type { ReactNode } from 'react';

interface AppShellProps {
  topBar: ReactNode;
  sidebar: ReactNode;
  main: ReactNode;
  rightPanel: ReactNode;
  statusBar: ReactNode;
}

export function AppShell({ topBar, sidebar, main, rightPanel, statusBar }: AppShellProps) {
  return (
    <div className="app-shell">
      {topBar}
      {sidebar}
      {main}
      {rightPanel}
      {statusBar}
    </div>
  );
}
