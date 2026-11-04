// The organisation prefix of the hash route (SPEC.md § 1): every route of an organisation lives under `#/o/<org>/…`, so that a reload
// and a direct link keep the organisation. The app's own paths are written without the prefix (`/patients`); these wrappers add it to
// links and navigation and take it off the location, so a page never has to know it. The start page `/start-org` has no prefix.
import { forwardRef } from 'react';
import {
  Link as RouterLink,
  Navigate as RouterNavigate,
  NavLink as RouterNavLink,
  useLocation as useRouterLocation,
  useNavigate as useRouterNavigate,
  type LinkProps,
  type NavLinkProps,
  type NavigateOptions,
} from 'react-router-dom';
import { useStore } from '@/data/store';

export const START_ORG_PATH = '/start-org';
const ORG_PREFIX = /^\/o\/[^/]+/;

/** The prefix of an organisation's routes, `/o/<org>`. */
export const orgPrefix = (org: string | null): string => (org ? `/o/${org}` : '');

/** An app path with the organisation's prefix; paths that already carry one, and the start page, are left as they are. */
export function withOrg(org: string | null, to: string): string {
  if (!to.startsWith('/') || to === START_ORG_PATH || ORG_PREFIX.test(to)) return to;
  return to === '/' ? orgPrefix(org) || '/' : orgPrefix(org) + to;
}

/** The path without the organisation's prefix ("/o/sus/patients" is "/patients"; "/o/sus" is "/"). */
export const stripOrg = (pathname: string): string => pathname.replace(ORG_PREFIX, '') || '/';

/** The organisation named by a path's prefix, or null. */
export const orgOfPath = (pathname: string): string | null => pathname.match(/^\/o\/([^/]+)/)?.[1] ?? null;

const useOrgId = (): string | null => useStore((s) => s.organisationId);

export const Link = forwardRef<HTMLAnchorElement, Omit<LinkProps, 'to'> & { to: string }>(function Link({ to, ...rest }, ref) {
  return <RouterLink ref={ref} to={withOrg(useOrgId(), to)} {...rest} />;
});

export const NavLink = forwardRef<HTMLAnchorElement, Omit<NavLinkProps, 'to'> & { to: string }>(function NavLink({ to, ...rest }, ref) {
  return <RouterNavLink ref={ref} to={withOrg(useOrgId(), to)} {...rest} />;
});

export function Navigate({ to, replace }: { to: string; replace?: boolean }) {
  return <RouterNavigate to={withOrg(useOrgId(), to)} replace={replace} />;
}

export function useNavigate(): (to: string, options?: NavigateOptions) => void {
  const navigate = useRouterNavigate();
  const org = useOrgId();
  return (to, options) => navigate(withOrg(org, to), options);
}

/** The location with the organisation's prefix taken off the pathname (the rest as the router has it). */
export function useLocation(): ReturnType<typeof useRouterLocation> {
  const location = useRouterLocation();
  return { ...location, pathname: stripOrg(location.pathname) };
}
