// Incident actions – SPEC.md § 6.6. Mixed into the store as a slice.
import type { StateCreator } from 'zustand';
import type { AppStore } from './store';
import type { BeredskapsLage, IncidentTask, Message, TaskStatus } from './types';
import { COMMANDER_ROLE, CURRENT_USER, KAROLINSKA_ID, SYSTEM_ACTOR } from './vocab';
import { key, lt, same, t, tm } from '@/lib/i18n';
import { buildIncident } from '@/lib/incident';
import { formatClock } from '@/lib/time';

export interface IncidentActions {
  activatePlaybook: (playbookId: string, commander: string, lage: BeredskapsLage, note?: string) => void;
  closeIncident: () => void;
  setLage: (lage: BeredskapsLage) => void;
  setTaskStatus: (taskId: string, status: TaskStatus) => void;
  /** Marks a task done by its Swedish (key) title. */
  markTaskDoneByTitle: (title: string) => void;
  assignTask: (taskId: string, owner: string) => void;
  /** Roles are addressed by their Swedish key form. */
  assignRole: (role: string, person: string) => void;
  addTask: (input: { title: string; area: string; ownerRole: string; dueInMin: number }) => void;
  sendChannelMessage: (channelId: string, text: string) => void;
}

export const createIncidentSlice: StateCreator<AppStore, [], [], IncidentActions> = (set, get) => ({
  activatePlaybook: (playbookId, commander, lage, note) => {
    const { playbooks, clock, nextId, logEntry } = get();
    const playbook = playbooks.find((p) => p.id === playbookId);
    if (!playbook || get().incident) return;
    const incident = buildIncident({ playbook, clock, commander, activatedBy: CURRENT_USER.name, lage, note, nextId });
    const name = lt(playbook.name);
    const logStartId = logEntry(t('INCIDENT.audit.activated', { name }), name, [t(`LAGE_LABELS.${lage}`), note?.trim()].filter(Boolean).join('. '));
    incident.logStartId = logStartId;
    set({ incident });
    for (const task of incident.tasks) logEntry(t('INCIDENT.audit.createdTask', { title: lt(task.title) }), lt(task.area), t('INCIDENT.audit.dueDetail', { role: lt(task.ownerRole), due: task.due }), SYSTEM_ACTOR);
    for (const c of incident.channels) logEntry(t('INCIDENT.audit.openedChannel', { name: lt(c.name) }), name, c.memberRoles.map((r) => lt(r)).join(', '), SYSTEM_ACTOR);
  },

  closeIncident: () => {
    const { incident, logEntry } = get();
    if (!incident) return;
    logEntry(t('INCIDENT.audit.closed'), lt(incident.name));
    const { log, clock } = get();
    const start = incident.logStartId ? log.findIndex((e) => e.id === incident.logStartId) : log.length;
    const slice = log.slice(Math.max(0, start));
    set((s) => ({ incident: null, closedIncidents: [...s.closedIncidents, { incident, closedAt: formatClock(clock - 1), log: slice }] }));
  },

  setLage: (lage) => {
    const { incident, logEntry } = get();
    if (!incident || incident.lage === lage) return;
    set({ incident: { ...incident, lage } });
    logEntry(t('INCIDENT.audit.changedLage', { lage: t(`LAGE_LABELS.${lage}`) }), lt(incident.name), t(`LAGE_LABELS.${lage}`));
  },

  setTaskStatus: (taskId, status) => {
    const { incident, logEntry } = get();
    const task = incident?.tasks.find((x) => x.id === taskId);
    if (!incident || !task) return;
    set({ incident: { ...incident, tasks: incident.tasks.map((x) => (x.id === taskId ? { ...x, status } : x)) } });
    logEntry(t('INCIDENT.audit.taskStatus', { title: lt(task.title), status: tm('TASK_STATUS_LABELS')[status] }), lt(task.title), lt(task.area));
  },

  markTaskDoneByTitle: (title) => {
    const { incident, setTaskStatus } = get();
    const task = incident?.tasks.find((x) => key(x.title) === title);
    if (task && task.status !== 'Done') setTaskStatus(task.id, 'Done');
  },

  assignTask: (taskId, owner) => {
    const { incident, logEntry } = get();
    const task = incident?.tasks.find((x) => x.id === taskId);
    if (!incident || !task) return;
    set({ incident: { ...incident, tasks: incident.tasks.map((x) => (x.id === taskId ? { ...x, owner } : x)) } });
    logEntry(t('INCIDENT.audit.assignedTask', { title: lt(task.title), person: owner }), lt(task.title), lt(task.ownerRole));
  },

  assignRole: (role, person) => {
    const { incident, playbooks, logEntry } = get();
    if (!incident) return;
    const commander = role === COMMANDER_ROLE ? person : incident.commander;
    set({ incident: { ...incident, commander, roles: { ...incident.roles, [role]: person } } });
    const playbook = playbooks.find((p) => p.id === incident.playbookId);
    const roleText = playbook?.roles.find((r) => key(r) === role);
    logEntry(t('INCIDENT.audit.changedRole', { role: roleText ? lt(roleText) : role, person }), roleText ? lt(roleText) : role, lt(incident.name));
  },

  addTask: ({ title, area, ownerRole, dueInMin }) => {
    const { incident, playbooks, clock, nextId, logEntry } = get();
    if (!incident) return;
    const playbook = playbooks.find((p) => p.id === incident.playbookId);
    const areaText = incident.tasks.find((x) => key(x.area) === area)?.area ?? same(area);
    const roleText = playbook?.roles.find((r) => key(r) === ownerRole) ?? same(ownerRole);
    const task: IncidentTask = { id: nextId('task'), title: same(title), area: areaText, ownerRole: roleText, dueOffsetMin: dueInMin, status: 'Not started', due: formatClock(clock + dueInMin) };
    set({ incident: { ...incident, tasks: [...incident.tasks, task] } });
    logEntry(t('INCIDENT.audit.addedTask'), title, `${lt(areaText)}, ${t('INCIDENT.audit.dueDetail', { role: lt(roleText), due: task.due })}`);
  },

  sendChannelMessage: (channelId, text) => {
    const { incident, clock, nextId, logEntry } = get();
    const channel = incident?.channels.find((c) => c.id === channelId);
    if (!incident || !channel || !text.trim()) return;
    const message: Message = { id: nextId('msg'), author: CURRENT_USER.name, role: t('LABELS.currentUserRole'), at: formatClock(clock), text: text.trim(), nodeId: KAROLINSKA_ID };
    set({
      incident: {
        ...incident,
        channels: incident.channels.map((c) => (c.id === channelId ? { ...c, messages: [...c.messages, message] } : c)),
      },
    });
    logEntry(t('INCIDENT.audit.sentMessage', { channel: lt(channel.name) }), lt(channel.name), message.text);
  },
});
