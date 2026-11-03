import { useState } from 'react';
import type { Incident } from '@/data/types';
import { useStore } from '@/data/store';
import { key, lt, t } from '@/lib/i18n';
import { fmt } from '@/lib/format';
import { roleLabel, taskCounts } from '@/lib/incident';
import { SectionHeading } from '@/components/PageTitle';
import { KeyValueTable } from '@/components/KeyValueTable';
import { RolePill } from '@/components/RolePill';
import { StaffSelect } from '@/components/StaffSelect';

/** Target units are the pack's Swedish unit words; translated through INCIDENT.targetUnits when a label exists. */
export function targetUnit(unit: string): string {
  const translated = t(`INCIDENT.targetUnits.${unit}`);
  return translated === `INCIDENT.targetUnits.${unit}` ? unit : translated;
}

/** Översikt: targets (value and due time, no live measurement),  roles table with Ändra, task summary line. */
export function OverviewTab({ incident }: { incident: Incident }) {
  const staff = useStore((s) => s.staff);
  const playbooks = useStore((s) => s.playbooks);
  const assignRole = useStore((s) => s.assignRole);
  const [editing, setEditing] = useState<string | null>(null);
  const counts = taskCounts(incident.tasks);
  const playbook = playbooks.find((p) => p.id === incident.playbookId);

  return (
    <div className="grid grid-cols-2 gap-8">
      <section>
        <SectionHeading>{t('INCIDENT.targets')}</SectionHeading>
        <ul className="space-y-4">
          {incident.targets.map((target) => {
            const due = target.withinUnit === 'dygn' ? t('INCIDENT.dueDay', { d: fmt(10) }) : t('INCIDENT.due', { at: target.dueAt });
            return (
              <li key={key(target.label)}>
                <div className="mb-1 flex items-baseline justify-between gap-4">
                  <span>{lt(target.label)}</span>
                  <span className="tabular text-text-secondary">
                    {fmt(target.target)} {targetUnit(target.unit)}, {due.toLowerCase()}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 text-text-secondary">{t('INCIDENT.summary', { notStarted: counts.notStarted, inProgress: counts.inProgress, done: counts.done })}</p>
      </section>
      <section>
        <SectionHeading>{t('INCIDENT.roles')}</SectionHeading>
        <KeyValueTable
          rows={Object.entries(incident.roles).map(([role, person]) => {
            const member = staff.find((s) => s.name === person);
            const label = roleLabel(playbook, role);
            return {
              label,
              value:
                editing === role ? (
                  <StaffSelect
                    value={person}
                    ariaLabel={`${t('INCIDENT.assign')} ${label}`}
                    autoOpen
                    onChange={(name) => {
                      assignRole(role, name);
                      setEditing(null);
                    }}
                  />
                ) : person ? (
                  <span className="flex items-center gap-2">
                    {person}
                    {member ? <RolePill profession={member.profession} /> : null}
                  </span>
                ) : (
                  <span className="text-text-muted">{t('INCIDENT.unassigned')}</span>
                ),
              action:
                editing === role ? null : (
                  <button type="button" className="text-primary-text hover:text-primary-hover hover:underline" onClick={() => setEditing(role)}>
                    {t('LABELS.change')}
                  </button>
                ),
            };
          })}
        />
      </section>
    </div>
  );
}
