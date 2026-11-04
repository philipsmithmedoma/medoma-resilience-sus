import { useNavigate } from '@/app/router';
import { organisations as registry } from '@/data/packs/organisations';
import { useStore } from '@/data/store';
import { t } from '@/lib/i18n';
import { Button } from '@/components/ui/button';
import type { Organisation } from '@/data/types';

/**
 * The start page `/start-org` (SPEC.md § 1): it imitates the sign-in. One card per organisation with its name and the names of its
 * units, and "Logga in". In production the sign-in decides the organisation; in the prototype the choice is made here, once. The page is
 * the root route while no organisation is selected; with only one organisation it is skipped, but it stays in the code.
 */
export function StartOrgPage({ organisations = registry }: { organisations?: Organisation[] }) {
  const navigate = useNavigate();
  const selectOrganisation = useStore((s) => s.selectOrganisation);
  const signIn = (id: string) => {
    selectOrganisation(id);
    navigate(`/o/${id}`);
  };
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      <img src={`${import.meta.env.BASE_URL}logo-full.svg`} alt="Medoma" className="h-10 w-auto dark:invert" />
      <h1 className="mt-10 text-[24px] leading-8 font-semibold">{t('START.title')}</h1>
      <ul className="mt-8 flex w-full max-w-[720px] flex-col gap-4">
        {organisations.map((o) => (
          <li key={o.id} className="flex items-center justify-between gap-6 rounded-lg border border-border bg-surface p-5 shadow-card">
            <div className="min-w-0">
              <h2 className="text-[18px] leading-7 font-normal">{o.name}</h2>
              <p className="text-body text-text-secondary">
                <span>{t('START.units')}: </span>
                {o.units.map((u) => u.name).join(', ')}
              </p>
            </div>
            <Button aria-label={t('START.signInAria', { name: o.name })} onClick={() => signIn(o.id)}>
              {t('START.signIn')}
            </Button>
          </li>
        ))}
      </ul>
      <p className="mt-6 text-small text-text-muted">{t('START.hint')}</p>
    </div>
  );
}
