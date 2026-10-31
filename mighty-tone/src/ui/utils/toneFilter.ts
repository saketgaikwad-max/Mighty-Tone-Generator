import type { Tone } from '../../store/db.ts';

export function applyToneFilter(tones: Tone[], filter: string): Tone[] {
  if (filter === 'all') return tones;
  if (filter.startsWith('archetype:')) {
    const arch = filter.slice('archetype:'.length);
    return tones.filter((t) => t.archetype === arch);
  }
  if (filter.startsWith('instrument:')) {
    const inst = filter.slice('instrument:'.length);
    return tones.filter((t) => t.instrument === inst);
  }
  return tones;
}
