import { ChevronDownIcon } from 'lucide-react';
import { useStore } from '@/data/store';
import { lt, t } from '@/lib/i18n';
import { scopeMenu, scopeName } from '@/lib/scope';
import { cn } from '@/lib/utils';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

/**
 * The unit selector at the far left (SPEC.md § 2, § 4): it shows the name of the selected unit. Its menu lists the units of the
 * packs in `scopeMenu`; choosing a unit of another pack switches the pack.
 */
export function ScopeSelector() {
  const scope = useStore((s) => s.scope);
  const packId = useStore((s) => s.pack.homePackId);
  const setScope = useStore((s) => s.setScope);
  const name = scopeName(packId, scope);
  const groups = scopeMenu(packId);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex h-9 items-center gap-1 rounded-md px-1 text-[18px] leading-7 font-semibold text-text hover:bg-bg-muted"
          aria-label={t('LABELS.scopeAria', { name })}
          title={name}
        >
          <span className="max-w-[240px] truncate">{name}</span>
          <ChevronDownIcon className="size-5" strokeWidth={1.5} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-56">
        {groups.map((g, i) => (
          <div key={g.pack}>
            {i > 0 ? <DropdownMenuSeparator /> : null}
            {g.scopes.map((s) => (
              <DropdownMenuItem key={s.id} onSelect={() => setScope(s.id)} className={cn(scope === s.id && 'text-primary-text')}>
                {lt(s.label)}
              </DropdownMenuItem>
            ))}
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
