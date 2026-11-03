import { useStore } from '@/data/store';
import { t } from '@/lib/i18n';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RolePill } from './RolePill';

interface StaffSelectProps {
  value?: string;
  onChange: (name: string) => void;
  id?: string;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
  autoOpen?: boolean;
}

/** Select listing all staff (DATA.md § 7), showing the profession pill beside each name. */
export function StaffSelect({ value, onChange, id, placeholder = t('LABELS.selectPerson'), className, ariaLabel, autoOpen }: StaffSelectProps) {
  const staff = useStore((s) => s.staff);
  return (
    <Select value={value} onValueChange={onChange} defaultOpen={autoOpen}>
      <SelectTrigger id={id} className={className ?? 'w-full'} aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {staff.map((s) => (
          <SelectItem key={s.name} value={s.name}>
            <span className="flex items-center gap-2">
              {s.name}
              <RolePill profession={s.profession} />
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
