import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { useStore } from '@/data/store';
import { preparednessReason, preparednessTransition, type PreparednessReason } from '@/lib/preparedness';
import { useLocale } from '@/lib/i18n';
import { Nav } from './Nav';
import { IncidentBanner } from './IncidentBanner';
import { CloseIncidentDialog } from '@/modules/incident/CloseIncidentDialog';

/**
 * Writes a log entry whenever preparedness mode turns on or off for a reason the manual flag did not give (SPEC.md § 12.7):
 * an incident or the route. The flag's own changes are logged by the action that makes them.
 */
function usePreparednessLog() {
  const location = useLocation();
  const preparednessOn = useStore((s) => s.preparednessOn);
  const incident = useStore((s) => s.incident);
  const logPreparednessChange = useStore((s) => s.logPreparednessChange);
  const previous = useRef<PreparednessReason | null>(null);
  const reason = preparednessReason({ preparednessOn, incident }, location.pathname);
  useEffect(() => {
    const before = previous.current;
    previous.current = reason;
    // The first render counts as a change from "off": opening a resilience route directly turns the mode on, reason "route".
    const change = preparednessTransition(before, reason);
    if (change) logPreparednessChange(change.on, change.reason);
  }, [reason, logPreparednessChange]);
}

/** App shell: nav, incident banner, content area (DESIGN.md § 3). */
export function Layout() {
  const [closeOpen, setCloseOpen] = useState(false);
  const location = useLocation();
  // The locale is read here so that the whole shell re-renders on a switch; the page content is keyed to remount.
  const locale = useLocale();
  usePreparednessLog();
  useEffect(() => {
    if (!location.hash) window.scrollTo({ top: 0 });
  }, [location.pathname, location.hash]);
  return (
    <div className="flex min-h-screen flex-col">
      <div className="print:hidden">
        <Nav />
      </div>
      <div className="print:hidden">
        <IncidentBanner onClose={() => setCloseOpen(true)} />
      </div>
      <main className="flex-1 px-6 pt-4 pb-8 print:px-0 print:pt-0 print:pb-0">
        <div key={locale} className="contents">
          <Outlet />
        </div>
      </main>
      <CloseIncidentDialog open={closeOpen} onOpenChange={setCloseOpen} />
    </div>
  );
}
