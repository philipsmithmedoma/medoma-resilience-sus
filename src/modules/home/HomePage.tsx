import { useMemo, useState } from 'react';
import { useStore } from '@/data/store';
import { t } from '@/lib/i18n';
import { scopeName } from '@/lib/scope';
import { PageTitle } from '@/components/PageTitle';
import { HomeMap } from './HomeMap';
import { HomePatientList } from './HomePatientList';
import { NodePanel, PanelEmpty } from './NodePanel';
import { ImpactPanel } from './ImpactPanel';
import { HomeMessagesTab } from './HomeMessagesTab';
import { SubTabs } from '@/components/SubTabs';
import { useHomeImpact } from './useHomeImpact';
import { useHomeGeo } from './useHomeGeo';
import { DemoScenarios } from './DemoScenarios';

/** Sjukhus hemma (SPEC.md § 6): patient list (380 px), panel (320 px) and the map; the panel ends with the demo scenarios. */
export function HomePage() {
  const scope = useStore((s) => s.scope);
  const incident = useStore((s) => s.incident);
  const pack = useStore((s) => s.pack);
  const selectedId = useStore((s) => s.home.selectedNode);
  const infraNodes = useStore((s) => s.home.infraNodes);
  const selected = infraNodes.find((n) => n.id === selectedId) ?? null;
  const mode = useStore((s) => s.home.mode);
  const geo = useHomeGeo();
  const { impact, active } = useHomeImpact();
  const [tab, setTab] = useState<'panel' | 'messages'>('panel');
  // The road names of roads.json, for matching a message to a road (SPEC.md § 13.4).
  const roadNames = useMemo(() => [...new Set((geo?.roads.features ?? []).map((f) => f.properties.name).filter((n): n is string => Boolean(n)))].sort((a, b) => a.localeCompare(b, 'sv')), [geo]);
  // Middle pane: the result with disruptions; with a mode and none yet its instruction; else the selected node.
  const panel = active ? <ImpactPanel impact={impact} /> : mode ? <p className="px-4 py-4">{t(`HOME.instructions.${mode}`)}</p> : selected ? <NodePanel node={selected} /> : <PanelEmpty />;
  return (
    <div className="flex flex-col" style={{ height: incident ? 'calc(100vh - 136px)' : 'calc(100vh - 96px)' }}>
      <div className="mb-4">
        <PageTitle title={t('HOME.title')} scope={scopeName(pack.homePackId, scope)} />
      </div>
      <div className="-mx-6 flex min-h-[520px] flex-1 border-t border-border">
        <div className="w-[380px] shrink-0 overflow-y-auto border-r border-border">
          <HomePatientList patients={pack.homePatients} impact={impact} active={active} />
        </div>
        <div className="w-[320px] shrink-0 overflow-y-auto border-r border-border">
          <div className="px-4">
            <SubTabs
              label={t('HOME.tabs.label')}
              active={tab}
              onChange={(k) => setTab(k as 'panel' | 'messages')}
              tabs={[
                { key: 'panel', label: t('HOME.tabs.panel') },
                { key: 'messages', label: t('HOME.tabs.messages') },
              ]}
            />
          </div>
          {tab === 'panel' ? (
            <>
              {panel}
              <DemoScenarios />
            </>
          ) : (
            <HomeMessagesTab roadNames={roadNames} onCreated={() => setTab('panel')} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <HomeMap impact={impact} geo={geo} />
        </div>
      </div>
    </div>
  );
}
