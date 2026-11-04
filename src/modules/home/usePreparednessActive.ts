import { useLocation } from '@/app/router';
import { useStore } from '@/data/store';
import { preparednessActive } from '@/lib/preparedness';

/** True while preparedness mode is on for the current route (SPEC.md § 12.7); Planning and Patients gain their resilience layer with it. */
export function usePreparednessActive(): boolean {
  const { pathname } = useLocation();
  const preparednessOn = useStore((s) => s.preparednessOn);
  const incident = useStore((s) => s.incident);
  return preparednessActive({ preparednessOn, incident }, pathname);
}
