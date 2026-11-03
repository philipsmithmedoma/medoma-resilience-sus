import { useState } from 'react';
import type { Incident, TaskStatus } from '@/data/types';
import { useStore } from '@/data/store';
import { TASK_STATUSES } from '@/data/vocab';
import { key, lt, t, tm } from '@/lib/i18n';
import { areasOf } from '@/lib/incident';
import { StatusGlyph } from '@/components/StatusGlyph';
import { RolePill, TextPill } from '@/components/RolePill';
import { StaffSelect } from '@/components/StaffSelect';

function nextTaskStatus(status: TaskStatus): TaskStatus {
  const i = TASK_STATUSES.indexOf(status);
  return TASK_STATUSES[(i + 1) % TASK_STATUSES.length];
}

/** Uppgifter: grouped by area in playbook order; status glyph cycles; Tilldela opens a staff select. */
export function TasksTab({ incident }: { incident: Incident }) {
  const staff = useStore((s) => s.staff);
  const setTaskStatus = useStore((s) => s.setTaskStatus);
  const assignTask = useStore((s) => s.assignTask);
  const [assigning, setAssigning] = useState<string | null>(null);
  const areas = areasOf(incident);

  return (
    <div className="space-y-8">
      {areas.map((area) => {
        const tasks = incident.tasks.filter((task) => key(task.area) === key(area));
        return (
          <section key={key(area)}>
            <h2 className="mb-2 text-heading">
              {lt(area)} <span className="font-normal text-text-secondary">({tasks.length})</span>
            </h2>
            <ul className="divide-y divide-border border-y border-border">
              {tasks.map((task) => {
                const owner = staff.find((s) => s.name === task.owner);
                return (
                  <li key={task.id} className="flex min-h-10 items-center gap-3 py-1.5">
                    <button
                      type="button"
                      aria-label={`${lt(task.title)}: ${tm('TASK_STATUS_LABELS')[task.status]}. ${t('INCIDENT.changeStatus')}`}
                      title={tm('TASK_STATUS_LABELS')[task.status]}
                      onClick={() => setTaskStatus(task.id, nextTaskStatus(task.status))}
                      className="flex size-8 shrink-0 items-center justify-center rounded-md hover:bg-bg-muted"
                    >
                      <StatusGlyph status={task.status} />
                    </button>
                    <span className="min-w-0 flex-1">
                      {lt(task.title)}
                      {task.note ? <span className="block text-small text-text-muted">{task.note}</span> : null}
                    </span>
                    <TextPill>{lt(task.ownerRole)}</TextPill>
                    {owner ? (
                      <span className="flex items-center gap-2 text-small text-text-secondary">
                        {owner.name}
                        <RolePill profession={owner.profession} />
                      </span>
                    ) : null}
                    <span className="w-14 text-right tabular text-text-secondary" title={t('INCIDENT.due', { at: task.due })}>
                      {task.due}
                    </span>
                    {assigning === task.id ? (
                      <StaffSelect
                        className="w-56"
                        value={task.owner}
                        ariaLabel={`${t('INCIDENT.assign')} ${lt(task.title)}`}
                        autoOpen
                        onChange={(name) => {
                          assignTask(task.id, name);
                          setAssigning(null);
                        }}
                      />
                    ) : (
                      <button type="button" className="w-16 text-right text-primary-text hover:text-primary-hover hover:underline" onClick={() => setAssigning(task.id)}>
                        {t('INCIDENT.assign')}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
