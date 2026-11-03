import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export interface SubTab {
  key: string;
  label: string;
  to?: string; // route-based tab
}

interface SubTabsProps {
  tabs: SubTab[];
  active: string;
  onChange?: (key: string) => void;
  label: string;
}

/** DESIGN.md § 3 sub-tabs: 16/500, 12 px vertical padding, 2 px underline (primary active, border inactive). */
export function SubTabs({ tabs, active, onChange, label }: SubTabsProps) {
  return (
    <div role="tablist" aria-label={label} className="flex gap-6 border-b border-border">
      {tabs.map((t) => {
        const isActive = t.key === active;
        const className = cn(
          '-mb-px border-b-2 px-0.5 py-3 text-nav',
          isActive ? 'border-primary-text text-primary-text' : 'border-transparent text-text hover:text-primary-text',
        );
        if (t.to) {
          return (
            <Link key={t.key} to={t.to} role="tab" aria-selected={isActive} className={className}>
              {t.label}
            </Link>
          );
        }
        return (
          <button key={t.key} type="button" role="tab" aria-selected={isActive} className={className} onClick={() => onChange?.(t.key)}>
            {t.label}
          </button>
        );
      })}
    </div>
  );
}
