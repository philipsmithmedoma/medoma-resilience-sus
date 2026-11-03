import type { ReactElement } from 'react';
import { IncidentPage } from '@/modules/incident/IncidentPage';
import { ChannelPage } from '@/modules/incident/ChannelPage';
import { HomePage } from '@/modules/home/HomePage';
import { CallListPage } from '@/modules/home/CallListPage';
import { PlanningPage } from '@/modules/home/PlanningPage';
import { PatientsPage } from '@/modules/home/PatientsPage';
import { PlatformStubPage } from '@/modules/home/PlatformStubPage';
import { PLATFORM_DEFS } from '@/data/vocab';
import { RootRedirect } from './RootRedirect';

export interface RouteDef {
  path: string;
  element: ReactElement;
}

/** SPEC.md § 2 routes (hash-based). */
export const routes: RouteDef[] = [
  // The root decides by the preparedness state: the first preparedness page in preparedness mode, Patienter otherwise.
  { path: '/', element: <RootRedirect /> },
  { path: '/home', element: <HomePage /> },
  { path: '/home/ringlista', element: <CallListPage /> },
  { path: '/incident', element: <IncidentPage /> },
  { path: '/incident/kanaler/:channelId', element: <ChannelPage /> },
  // Patients and Planning are real pages in both modes (SPEC.md § 8); the other platform modules are stubs.
  { path: '/patients', element: <PatientsPage /> },
  { path: '/planning', element: <PlanningPage /> },
  ...PLATFORM_DEFS.filter((m) => m.key !== 'patients' && m.key !== 'planning').map((m) => ({ path: m.path, element: <PlatformStubPage module={m} /> })),
];
