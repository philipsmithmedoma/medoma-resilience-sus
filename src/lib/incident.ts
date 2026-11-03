// Building an incident from a playbook – SPEC.md § 6.6.
import type { BeredskapsLage, Channel, Incident, IncidentTask, LocalizedText, Playbook } from '@/data/types';
import { COMMANDER_ROLE, LSSL_CHANNEL, SYSTEM_ACTOR } from '@/data/vocab';
import { key, lt, t } from '@/lib/i18n';
import { formatClock } from './time';

/**
 * Member roles of a channel: LSSL → every role; otherwise the Sjukvårdsledare plus the owner roles of tasks
 * whose area's first word appears in the channel name (see DECISIONS.md). Matching uses the Swedish key forms.
 */
export function channelRoles(playbook: Playbook, channel: LocalizedText): LocalizedText[] {
  if (key(channel) === LSSL_CHANNEL) return [...playbook.roles];
  const name = key(channel).toLowerCase();
  const areas = new Set(playbook.tasks.map((task) => key(task.area)));
  const matching = [...areas].filter((a) => name.includes(a.toLowerCase().split(' ')[0]));
  const roles = new Set<string>([COMMANDER_ROLE]);
  for (const task of playbook.tasks) if (matching.includes(key(task.area))) roles.add(key(task.ownerRole));
  return playbook.roles.filter((r) => roles.has(key(r)));
}

/** Distinct task areas in playbook order. */
export function areasOf(playbook: Pick<Playbook, 'tasks'>): LocalizedText[] {
  const seen = new Set<string>();
  const out: LocalizedText[] = [];
  for (const task of playbook.tasks) {
    if (seen.has(key(task.area))) continue;
    seen.add(key(task.area));
    out.push(task.area);
  }
  return out;
}

/** The display form of a role key (the Swedish key form) in the current locale. */
export function roleLabel(playbook: Pick<Playbook, 'roles'> | undefined, roleKey: string): string {
  const role = playbook?.roles.find((r) => key(r) === roleKey);
  return role ? lt(role) : roleKey;
}

interface BuildInput {
  playbook: Playbook;
  clock: number;
  commander: string;
  activatedBy: string;
  lage: BeredskapsLage;
  note?: string;
  nextId: (prefix: string) => string;
}

export function buildIncident({ playbook, clock, commander, activatedBy, lage, note, nextId }: BuildInput): Incident {
  const at = formatClock(clock);
  const tasks: IncidentTask[] = playbook.tasks.map((task) => ({
    ...task,
    id: nextId('task'),
    status: 'Not started',
    due: formatClock(clock + task.dueOffsetMin),
  }));
  const channels: Channel[] = playbook.channels.map((name) => {
    const memberRoles = channelRoles(playbook, name);
    const text =
      key(name) === LSSL_CHANNEL
        ? t('INCIDENT.systemActivated', { name: lt(playbook.name), at, lage: t(`LAGE_LABELS.${lage}`) })
        : t('INCIDENT.systemChannelOpened', { at, roles: memberRoles.map((r) => lt(r)).join(', ') });
    return {
      id: nextId('channel'),
      name,
      memberRoles,
      messages: [{ id: nextId('msg'), author: SYSTEM_ACTOR, role: SYSTEM_ACTOR, at, text }],
    };
  });
  const roles: Record<string, string | undefined> = {};
  for (const r of playbook.roles) roles[key(r)] = key(r) === COMMANDER_ROLE ? commander : undefined;
  return {
    playbookId: playbook.id,
    playbookKey: playbook.key,
    name: playbook.name,
    lage,
    activatedAt: at,
    activatedBy,
    commander,
    roles,
    tasks,
    channels,
    note: note?.trim() || undefined,
    targets: playbook.targets.map((target) => ({
      label: target.label,
      target: target.target,
      unit: target.unit,
      withinUnit: target.withinUnit,
      dueAt: formatClock(clock + target.withinMin),
    })),
  };
}

export function taskCounts(tasks: IncidentTask[]): { notStarted: number; inProgress: number; done: number; total: number } {
  return {
    notStarted: tasks.filter((task) => task.status === 'Not started').length,
    inProgress: tasks.filter((task) => task.status === 'In progress').length,
    done: tasks.filter((task) => task.status === 'Done').length,
    total: tasks.length,
  };
}
