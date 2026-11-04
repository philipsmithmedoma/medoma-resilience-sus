import { useParams } from 'react-router-dom';
import { Link } from '@/app/router';
import { toast } from 'sonner';
import { useStore } from '@/data/store';
import { lt, t } from '@/lib/i18n';
import { PageTitle } from '@/components/PageTitle';
import { MessageThread } from '@/components/MessageThread';

/** SPEC.md § 6.6 – channel thread view. */
export function ChannelPage() {
  const { channelId } = useParams();
  const incident = useStore((s) => s.incident);
  const sendChannelMessage = useStore((s) => s.sendChannelMessage);
  const channel = incident?.channels.find((c) => c.id === channelId);

  if (!incident || !channel) {
    return (
      <div className="space-y-4">
        <PageTitle title={t('INCIDENT.title')} />
        <p>{t('INCIDENT.noActive')}</p>
        <Link to="/incident" className="text-primary-text hover:text-primary-hover hover:underline">
          {t('INCIDENT.backToIncident')}
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Link to="/incident" className="text-primary-text hover:text-primary-hover hover:underline">
        {t('INCIDENT.backToIncident')}
      </Link>
      <PageTitle title={lt(channel.name)} scope={lt(incident.name)} />
      <p className="text-small text-text-secondary">{channel.memberRoles.map((r) => lt(r)).join(', ')}</p>
      <MessageThread
        messages={channel.messages}
        className="h-[calc(100vh-300px)] min-h-[360px] max-w-[900px]"
        onSend={(text) => {
          sendChannelMessage(channel.id, text);
          toast(t('INCIDENT.messageSent'));
        }}
      />
    </div>
  );
}
