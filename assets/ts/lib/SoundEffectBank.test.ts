import { describe, it, expect, vi } from 'vitest';
import { SoundEffectBank } from './SoundEffectBank';

/* test-setup stubs HTMLMediaElement.play/pause; jsdom builds the Audio elements. */
function makeBank(muted = { value: false }) {
  const bank = new SoundEffectBank(
    { pop: 'pop.ogg', fuse: 'fuse.ogg' },
    () => muted.value,
  );
  return { bank, muted };
}

describe('SoundEffectBank', () => {
  it('plays a one-shot from the start when unmuted', () => {
    const { bank } = makeBank();
    const pop = bank.get('pop')!;
    pop.currentTime = 5;
    const play = vi.spyOn(pop, 'play').mockResolvedValue(undefined);

    bank.play('pop');

    expect(pop.currentTime).toBe(0); // rewound
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('plays nothing while the mute predicate is true', () => {
    const muted = { value: true };
    const { bank } = makeBank(muted);
    const play = vi.spyOn(bank.get('pop')!, 'play');

    bank.play('pop');

    expect(play).not.toHaveBeenCalled();
  });

  it('reads the predicate live, so unmuting takes effect without re-wiring', () => {
    const muted = { value: true };
    const { bank } = makeBank(muted);
    const play = vi.spyOn(bank.get('pop')!, 'play').mockResolvedValue(undefined);

    bank.play('pop');
    expect(play).not.toHaveBeenCalled();

    muted.value = false;
    bank.play('pop');
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('applies per-play volume and playback-rate overrides', () => {
    const { bank } = makeBank();
    const pop = bank.get('pop')!;
    vi.spyOn(pop, 'play').mockResolvedValue(undefined);

    bank.play('pop', { volume: 0.3, playbackRate: 2 });

    expect(pop.volume).toBe(0.3);
    expect(pop.playbackRate).toBe(2);
  });

  it('loops a channel and stops it by rewinding', () => {
    const { bank } = makeBank();
    const fuse = bank.get('fuse')!;
    vi.spyOn(fuse, 'play').mockResolvedValue(undefined);
    const pause = vi.spyOn(fuse, 'pause');

    bank.loop('fuse');
    expect(fuse.loop).toBe(true);

    fuse.currentTime = 4;
    bank.stopLoop('fuse');
    expect(pause).toHaveBeenCalledTimes(1);
    expect(fuse.currentTime).toBe(0);
  });

  it('ignores unknown names without throwing', () => {
    const { bank } = makeBank();
    expect(() => bank.play('nope')).not.toThrow();
    expect(() => bank.stopLoop('nope')).not.toThrow();
    expect(bank.get('nope')).toBeUndefined();
  });

  it('applyMute toggles a live loop, leaving one-shots to the predicate', () => {
    const { bank } = makeBank();
    const fuse = bank.get('fuse')!;
    const pop = bank.get('pop')!;
    vi.spyOn(fuse, 'play').mockResolvedValue(undefined);
    bank.loop('fuse'); // marks fuse as a looping channel

    bank.applyMute(true);
    expect(fuse.muted).toBe(true);   // live loop silenced on the spot
    expect(pop.loop).toBe(false);    // one-shot untouched

    bank.applyMute(false);
    expect(fuse.muted).toBe(false);  // and audible again
  });
});
