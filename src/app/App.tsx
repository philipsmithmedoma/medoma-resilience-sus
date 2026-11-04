import { HashRouter, Route, Routes } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from '@/components/ui/sonner';
import { StartOrgPage } from '@/modules/start/StartOrgPage';
import { Layout } from './Layout';
import { EntryRedirect, OrgGate } from './OrgRoutes';
import { Navigate, START_ORG_PATH } from './router';
import { routes } from './routes';

/**
 * Routes are hash-based and an organisation's routes carry the prefix `#/o/<org>/…` (SPEC.md § 1). `/start-org` is the sign-in
 * imitation and the root route while no organisation is selected.
 */
export function App() {
  return (
    <HashRouter>
      <TooltipProvider delayDuration={200}>
        <Routes>
          <Route path={START_ORG_PATH} element={<StartOrgPage />} />
          <Route path="/o/:org" element={<OrgGate />}>
            <Route element={<Layout />}>
              {routes.map((r) => (r.path === '/' ? <Route key="index" index element={r.element} /> : <Route key={r.path} path={r.path.slice(1)} element={r.element} />))}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>
          <Route path="*" element={<EntryRedirect />} />
        </Routes>
        <Toaster position="bottom-right" duration={3000} />
      </TooltipProvider>
    </HashRouter>
  );
}
