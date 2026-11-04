import type { ReactElement } from 'react';
import { IncidentPage } from '@/modules/incident/IncidentPage';
import { ChannelPage } from '@/modules/incident/ChannelPage';
import { OverviewPage } from '@/modules/overview/OverviewPage';
import { DependenciesPage } from '@/modules/dependencies/DependenciesPage';
import { HomePage } from '@/modules/home/HomePage';
import { CallListPage } from '@/modules/home/CallListPage';
import { PlanningPage } from '@/modules/home/PlanningPage';
import { CapacityPage } from '@/modules/capacity/CapacityPage';
import { EquipmentPage } from '@/modules/equipment/EquipmentPage';
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
  { path: '/overview', element: <OverviewPage /> },
  { path: '/dependencies', element: <DependenciesPage /> },
  { path: '/home', element: <HomePage /> },
  { path: '/home/ringlista', element: <CallListPage /> },
  { path: '/incident', element: <IncidentPage /> },
  { path: '/incident/kanaler/:channelId', element: <ChannelPage /> },
  // Patients, Planning, Capacity and Equipment are real pages in both modes (SPEC.md § 8); the other platform modules are stubs.
  { path: '/patients', element: <PatientsPage /> },
  { path: '/planning', element: <PlanningPage /> },
  { path: '/capacity', element: <CapacityPage /> },
  { path: '/equipment', element: <EquipmentPage /> },
  ...PLATFORM_DEFS.filter((m) => !['patients', 'planning', 'capacity', 'equipment'].includes(m.key)).map((m) => ({ path: m.path, element: <PlatformStubPage module={m} /> })),
];
