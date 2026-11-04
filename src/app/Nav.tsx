import { Link, NavLink, START_ORG_PATH, useLocation, useNavigate } from './router';
import { BookOpenIcon, ChevronDownIcon, HeadphonesIcon, MessageSquareIcon, XIcon } from 'lucide-react';
import { CURRENT_USER, PLATFORM_DEFS } from '@/data/vocab';
import { organisationById } from '@/data/packs/organisations';
import { useStore } from '@/data/store';
import { t } from '@/lib/i18n';
import { CLOSE_FALLBACK, START_PATH, closeBlocked, isPreparednessRoute, navModel, preparednessActive } from '@/lib/preparedness';
import { cn } from '@/lib/utils';
import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ScopeSelector } from './ScopeSelector';
import { DemoControls } from './DemoControls';
import { ClockControl } from './ClockControl';
import { ThemeToggle } from './ThemeToggle';
import { LocaleToggle } from './LocaleToggle';

// The platform marks the active module with a 3 px primary bar along the very top edge of the nav.
const ACTIVE_BAR = 'text-primary-text before:absolute before:top-0 before:right-0 before:left-0 before:h-[3px] before:bg-primary';

function ModuleTab({ label, path }: { label: string; path: string }) {
  return (
    <NavLink to={path} className={({ isActive }) => cn('relative flex h-12 items-center text-nav whitespace-nowrap text-text hover:text-primary-text group-data-[prep=true]:text-[15px]', isActive && ACTIVE_BAR)}>
      {label}
    </NavLink>
  );
}

/** The five platform entries in one menu labelled "Medoma" (preparedness mode); it carries the active bar on a platform page. */
function PlatformMenu() {
  const { pathname } = useLocation();
  const active = PLATFORM_DEFS.some((m) => m.path === pathname);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={t('STUB.menuAria')} className={cn('relative flex h-12 items-center gap-1 text-nav whitespace-nowrap text-text hover:text-primary-text group-data-[prep=true]:text-[15px]', active && ACTIVE_BAR)}>
          {t('STUB.menu')}
          <ChevronDownIcon className="size-4 group-data-[prep=true]:size-3.5" strokeWidth={1.5} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="min-w-44">
        {PLATFORM_DEFS.map((m) => (
          <DropdownMenuItem key={m.key} asChild className={cn(pathname === m.path && 'text-primary-text')}>
            <Link to={m.path}>{t(`MODULES.${m.key}`)}</Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Normal operation: the outlined "Beredskap" button. It sets the manual flag and opens Start (SPEC.md § 12.7). */
function EnterButton() {
  const navigate = useNavigate();
  const setPreparedness = useStore((s) => s.setPreparedness);
  return (
    <Button
      variant="secondary"
      size="sm"
      title={t('PREP.enterTitle')}
      onClick={() => {
        setPreparedness(true);
        navigate(START_PATH);
      }}
    >
      {t('PREP.enter')}
    </Button>
  );
}

/**
 * Preparedness mode: the filled indicator "Beredskapsläge" in the accent colour with its close control. Closing clears the flag
 * and, on a preparedness route, goes to Planering; it is disabled while an incident is active.
 */
function Indicator() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const incident = useStore((s) => s.incident);
  const setPreparedness = useStore((s) => s.setPreparedness);
  const blocked = closeBlocked({ incident });
  const close = () => {
    setPreparedness(false);
    if (isPreparednessRoute(pathname)) navigate(CLOSE_FALLBACK);
  };
  return (
    <span role="status" className="inline-flex h-7 items-center gap-0.5 rounded-md bg-indicator-bg pr-0.5 pl-2 text-[13px] leading-[18px] font-medium whitespace-nowrap text-primary-foreground">
      {t('PREP.active')}
      <Tooltip>
        <TooltipTrigger asChild>
          {/* A disabled button takes no pointer events, so the tooltip hangs on the wrapper. */}
          <span tabIndex={blocked ? 0 : -1} className="inline-flex">
            <button
              type="button"
              aria-label={t('PREP.close')}
              aria-disabled={blocked}
              disabled={blocked}
              onClick={close}
              className={cn('flex size-5 items-center justify-center rounded hover:bg-black/15', blocked && 'cursor-not-allowed opacity-50 hover:bg-transparent')}
            >
              <XIcon className="size-3.5" strokeWidth={2} aria-hidden />
            </button>
          </span>
        </TooltipTrigger>
        <TooltipContent>{blocked ? t('PREP.closeBlocked') : t('PREP.close')}</TooltipContent>
      </Tooltip>
    </span>
  );
}

/** The organisation's name beside the logo (SPEC.md § 1). */
function OrganisationName() {
  const org = organisationById(useStore((s) => s.organisationId));
  if (!org) return null;
  return (
    <span title={org.name} aria-label={t('LABELS.organisationAria', { name: org.name })} className="block max-w-[190px] truncate px-1 text-[12px] leading-4 text-text-secondary">
      {org.name}
    </span>
  );
}

/** The user menu at the far right: "Byt organisation" is the only way back to the start page, and it is logged. */
function UserMenu() {
  const navigate = useNavigate();
  const leaveOrganisation = useStore((s) => s.leaveOrganisation);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={t('LABELS.userMenuAria')} title={CURRENT_USER.name} className="flex items-center gap-1 rounded-md px-1 hover:bg-bg-muted">
          <span className="flex size-8 items-center justify-center rounded-full bg-avatar-bg text-[14px] font-semibold text-avatar-text group-data-[prep=true]:size-7 group-data-[prep=true]:text-[13px]">{CURRENT_USER.initials}</span>
          {/* The name text needs room the clusters do not have below 1360 px; the avatar keeps it as a title (DECISIONS.md, KS build). */}
          <span className="hidden text-[16px] leading-6 min-[1360px]:inline">{CURRENT_USER.name}</span>
          <ChevronDownIcon className="size-4" strokeWidth={1.5} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        <DropdownMenuItem
          onSelect={() => {
            // Route first, then the store: the organisation's gate is gone by the time the store says nobody is signed in.
            navigate(START_ORG_PATH);
            leaveOrganisation();
          }}
        >
          {t('LABELS.switchOrganisation')}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Top navigation in two states chosen by `preparednessActive`, not by the viewport: normal operation (platform tabs, divider,
 * "Beredskap" button) and preparedness mode (a "Medoma" menu, divider, the preparedness modules, the indicator). Both fit at
 * 1280 px in both languages.
 */
export function Nav() {
  const { pathname } = useLocation();
  const preparednessOn = useStore((s) => s.preparednessOn);
  const incident = useStore((s) => s.incident);
  const model = navModel(preparednessActive({ preparednessOn, incident }, pathname));
  const active = model.button === 'indicator';
  return (
    <header data-prep={active} className="group flex h-12 items-center border-b border-border bg-surface px-3 whitespace-nowrap group-data-[prep=true]:px-1.5">
      <div className="flex shrink-0 items-center gap-3 group-data-[prep=true]:gap-2">
        <Link to="/" aria-label={t('LABELS.backToStart')} className="flex items-center">
          <Logo />
        </Link>
        {/* The organisation's name stacked over the unit selector, so that both fit beside the seven platform tabs at 1280 px. */}
        <div className="flex flex-col justify-center">
          <OrganisationName />
          <ScopeSelector />
        </div>
      </div>
      <nav aria-label={t('LABELS.modulesAria')} className="ml-2 group-data-[prep=true]:ml-1 flex h-full shrink-0 items-center gap-4 group-data-[prep=true]:gap-1.5">
        {model.platform === 'tabs' ? model.platformModules.map((m) => <ModuleTab key={m.key} label={t(`MODULES.${m.key}`)} path={m.path} />) : <PlatformMenu />}
        {/* 1 px divider between the platform's existing modules and the preparedness part (DESIGN.md § 3). */}
        <span aria-hidden className="h-5 w-px bg-border" />
        {model.preparednessTabs.map((m) => (
          <ModuleTab key={m.key} label={t(`MODULES.${m.key}`)} path={m.path} />
        ))}
        {active ? <Indicator /> : <EnterButton />}
      </nav>
      <div className="ml-auto flex shrink-0 items-center gap-1 pl-2 group-data-[prep=true]:gap-0 group-data-[prep=true]:pl-1">
        {/* The decorative icons only in normal operation and only from 1400 px: the seven platform tabs need the width at 1280 px. */}
        {!active ? (
          <>
            <span title={t('LABELS.chat')} className="hidden text-text min-[1400px]:inline">
              <MessageSquareIcon className="size-5" strokeWidth={1.5} aria-hidden />
            </span>
            <span title={t('LABELS.support')} className="hidden text-text min-[1400px]:inline">
              <HeadphonesIcon className="size-5" strokeWidth={1.5} aria-hidden />
            </span>
            <span title={t('LABELS.documentation')} className="hidden text-text min-[1400px]:inline">
              <BookOpenIcon className="size-5" strokeWidth={1.5} aria-hidden />
            </span>
          </>
        ) : null}
        <ClockControl />
        <LocaleToggle />
        <ThemeToggle />
        <DemoControls />
        <UserMenu />
      </div>
    </header>
  );
}

