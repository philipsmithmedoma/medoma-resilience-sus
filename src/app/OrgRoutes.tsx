import { useEffect } from 'react';
import { Navigate as RouterNavigate, Outlet, useLocation as useRouterLocation, useParams } from 'react-router-dom';
import { organisationById, organisations } from '@/data/packs/organisations';
import { useStore } from '@/data/store';
import { orgPrefix, START_ORG_PATH, stripOrg } from './router';

/**
 * The gate of `/o/:org/…` (SPEC.md § 1): the organisation in the route is the organisation of the session. A direct link or a reload
 * carries it, so the store follows the route; an unknown organisation goes to the start page. Nothing under the gate renders before the
 * store holds that organisation, so a page never sees another organisation's data.
 */
export function OrgGate() {
  const { org } = useParams();
  const known = organisationById(org);
  const current = useStore((s) => s.organisationId);
  const selectOrganisation = useStore((s) => s.selectOrganisation);
  useEffect(() => {
    if (known && current !== known.id) selectOrganisation(known.id);
  }, [known, current, selectOrganisation]);
  if (!known) return <RouterNavigate to={START_ORG_PATH} replace />;
  if (current !== known.id) return null;
  return <Outlet />;
}

/**
 * Everything outside an organisation's prefix: the root route and old links without a prefix. With one organisation (or one already
 * signed in) it goes straight into it, keeping the path; otherwise it is the start page.
 */
export function EntryRedirect() {
  const { pathname, search } = useRouterLocation();
  const current = useStore((s) => s.organisationId);
  const sole = organisations.length === 1 ? organisations[0].id : null;
  const org = current ?? sole;
  if (!org) return <RouterNavigate to={START_ORG_PATH} replace />;
  const rest = stripOrg(pathname);
  return <RouterNavigate to={`${orgPrefix(org)}${rest === '/' ? '' : rest}${search}`} replace />;
}
