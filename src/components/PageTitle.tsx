import type { ReactNode } from 'react';

interface PageTitleProps {
  title: string;
  scope?: string;
  children?: ReactNode; // right-hand cluster (chips, links)
}

/** Page title 24/600 with the scope name after it in text-secondary (DESIGN.md § 3). */
export function PageTitle({ title, scope, children }: PageTitleProps) {
  return (
    <div className="flex min-h-8 items-center gap-3">
      <h1 className="text-title">
        {title}
        {scope ? <span className="ml-2 font-normal text-text-secondary">{scope}</span> : null}
      </h1>
      {children ? <div className="flex items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function SectionHeading({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <h2 className="text-heading">{children}</h2>
      {right}
    </div>
  );
}
