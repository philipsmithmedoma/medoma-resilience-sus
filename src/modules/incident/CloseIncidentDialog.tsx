import { toast } from 'sonner';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useStore } from '@/data/store';
import { t } from '@/lib/i18n';

interface CloseIncidentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** Close dialog, opened from the banner and from the active incident. */
export function CloseIncidentDialog({ open, onOpenChange }: CloseIncidentDialogProps) {
  const closeIncident = useStore((s) => s.closeIncident);
  const close = () => {
    closeIncident();
    onOpenChange(false);
    toast(t('INCIDENT.incidentClosed'));
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('INCIDENT.closeTitle')}</DialogTitle>
          <DialogDescription>{t('INCIDENT.closeBody')}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            {t('LABELS.cancel')}
          </Button>
          <Button variant="destructive" onClick={close}>
            {t('LABELS.closeIncident')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
