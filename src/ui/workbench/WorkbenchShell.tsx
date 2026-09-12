import type { ReactNode } from 'react';

export interface WorkbenchShellProps {
  title: ReactNode;
  status: ReactNode;
  placementSurface: ReactNode;
  children?: ReactNode;
}

export function WorkbenchShell({ title, status, placementSurface, children }: WorkbenchShellProps) {
  return (
    <main className="lab-center" aria-label="실험실 작업대">
      <div className="workspace-title">
        <strong>{title}</strong>
        <div>{status}</div>
      </div>
      {placementSurface}
      {children}
    </main>
  );
}
