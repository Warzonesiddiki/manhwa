import { describe, it, expect } from 'vitest';
import { normalizeUrduPhonetics, DEFAULT_MANHWA_PHONETICS } from '../../src/utils/urduPhonetics';

describe('normalizeUrduPhonetics', () => {
  it('replaces known English terms with Urdu phonetic script', () => {
    expect(normalizeUrduPhonetics('S-Rank')).toBe('ایس رینک');
    expect(normalizeUrduPhonetics('The Dungeon fell')).toBe('The ڈنجن fell');
    expect(normalizeUrduPhonetics('Sung Jin-Woo spoke')).toBe('سنگ جن وو spoke');
  });

  it('is case-insensitive on the English term', () => {
    expect(normalizeUrduPhonetics('s-rank hunter')).toBe('ایس رینک ہنٹر');
    expect(normalizeUrduPhonetics('SHADOW MONARCH')).toBe('شیڈو مونارک');
  });

  it('matches whole words only, not substrings', () => {
    // "Raid" must not rewrite inside "raider".
    expect(normalizeUrduPhonetics('the raider came')).toBe('the raider came');
  });

  it('supports custom rules ahead of defaults', () => {
    const custom = [
      { id: 'c1', englishTerm: 'Jeju', urduPhonetic: 'جیجو', category: 'concept' as const },
    ];
    expect(normalizeUrduPhonetics('Jeju Island', custom)).toBe('جیجو Island');
  });

  it('handles empty input and regex-special characters in terms safely', () => {
    expect(normalizeUrduPhonetics('')).toBe('');
    // "S-Rank" contains a hyphen (regex-special) and must not throw.
    expect(() => normalizeUrduPhonetics('F-Rank')).not.toThrow();
    expect(normalizeUrduPhonetics('F-Rank')).toBe('ایف رینک');
  });

  it('ships a non-empty default glossary with unique ids', () => {
    expect(DEFAULT_MANHWA_PHONETICS.length).toBeGreaterThan(0);
    const ids = DEFAULT_MANHWA_PHONETICS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const rule of DEFAULT_MANHWA_PHONETICS) {
      expect(rule.urduPhonetic.length).toBeGreaterThan(0);
    }
  });
});
