import { beforeEach, describe, expect, it } from 'vitest';
import { useStore } from './store';
import { INITIAL_CLOCK } from '@/lib/time';

const s = () => useStore.getState();

describe('store (SPEC.md § 6)', () => {
  beforeEach(() => s().reset());

  it('starts at 14:40 with the default pack, its default scope and an empty log', () => {
    expect(s().clock).toBe(INITIAL_CLOCK);
    expect(s().scope).toBe('karolinska');
    expect(s().pack.homePackId).toBe('karolinska');
    expect(s().log).toHaveLength(0);
    expect(s().incident).toBeNull();
    expect(s().preparednessOn).toBe(false);
  });

  it('logEntry appends an entry stamped with the clock and advances the clock one minute', () => {
    s().logEntry('Gjorde något', 'Objekt', 'Detalj');
    expect(s().clock).toBe(INITIAL_CLOCK + 1);
    const last = s().log[s().log.length - 1];
    expect(last).toMatchObject({ at: '14:40', actor: 'Eva Lind', action: 'Gjorde något', object: 'Objekt', detail: 'Detalj' });
  });

  it('advanceClock moves the shared clock 60 minutes without moving it again for its own log entry', () => {
    s().advanceClock(60);
    expect(s().clock).toBe(INITIAL_CLOCK + 60);
    expect(s().log.at(-1)).toMatchObject({ action: 'Flyttade fram klockan', detail: '+60 min', area: 'home' });
  });

  it('reset restores the pack without sharing object identity and clears the incident', () => {
    s().activatePlaybook('pb1', 'Eva Lind', 'Stabsläge');
    expect(s().incident).not.toBeNull();
    s().playbooks[0].code = 'XX';
    s().reset();
    expect(s().playbooks[0].code).toBe('PB1');
    expect(s().incident).toBeNull();
    expect(s().clock).toBe(INITIAL_CLOCK);
  });

  it('the manual preparedness flag is logged with the reason "manual"', () => {
    s().setPreparedness(true);
    expect(s().preparednessOn).toBe(true);
    expect(s().log.at(-1)).toMatchObject({ action: 'Beredskapsläge på', detail: 'Orsak: manuellt', ref: 'manual' });
    s().setPreparedness(true); // no change, no entry
    expect(s().log).toHaveLength(1);
    s().setPreparedness(false);
    expect(s().log.at(-1)).toMatchObject({ action: 'Beredskapsläge av' });
  });
});
