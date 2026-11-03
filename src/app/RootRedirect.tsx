import { Navigate } from 'react-router-dom';
import { useStore } from '@/data/store';
import { preparednessActive, rootTarget } from '@/lib/preparedness';

/** SPEC.md § 12.7: `/` goes to Start in preparedness mode and to the first platform module otherwise. */
export function RootRedirect() {
  const preparednessOn = useStore((s) => s.preparednessOn);
  const incident = useStore((s) => s.incident);
  // The route is "/" here, which is no preparedness route: the other two reasons decide.
  return <Navigate to={rootTarget(preparednessActive({ preparednessOn, incident }, '/'))} replace />;
}
