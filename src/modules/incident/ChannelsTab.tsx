import { useNavigate } from 'react-router-dom';
import { MessageSquareIcon } from 'lucide-react';
import type { Incident } from '@/data/types';
import { ICON_TINTS } from '@/data/vocab';
import { lt, tn } from '@/lib/i18n';
import { IconTile } from '@/components/Card';

/** Kanaler: list with member roles and message count; click → /incident/kanaler/:channelId. */
export function ChannelsTab({ incident }: { incident: Incident }) {
  const navigate = useNavigate();
  return (
    <ul className="divide-y divide-border border-y border-border">
      {incident.channels.map((c) => (
        <li key={c.id}>
          <button type="button" onClick={() => navigate(`/incident/kanaler/${c.id}`)} className="flex w-full items-center gap-4 py-2 text-left hover:bg-bg-muted">
            <IconTile icon={MessageSquareIcon} iconClass={ICON_TINTS.messages.icon} tileClass={ICON_TINTS.messages.tile} />
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{lt(c.name)}</span>
              <span className="block text-small text-text-secondary">{c.memberRoles.map((r) => lt(r)).join(', ')}</span>
            </span>
            <span className="tabular text-text-secondary">{tn('INCIDENT.messages', c.messages.length)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
