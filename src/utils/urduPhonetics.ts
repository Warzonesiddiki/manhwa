export interface PhoneticRule {
  id: string;
  englishTerm: string;
  urduPhonetic: string;
  category: 'rank' | 'character' | 'concept' | 'gaming';
}

export const DEFAULT_MANHWA_PHONETICS: PhoneticRule[] = [
  { id: 'p1', englishTerm: 'S-Rank', urduPhonetic: 'ایس رینک', category: 'rank' },
  { id: 'p2', englishTerm: 'F-Rank', urduPhonetic: 'ایف رینک', category: 'rank' },
  { id: 'p3', englishTerm: 'A-Rank', urduPhonetic: 'اے رینک', category: 'rank' },
  { id: 'p4', englishTerm: 'B-Rank', urduPhonetic: 'بی رینک', category: 'rank' },
  { id: 'p5', englishTerm: 'Dungeon', urduPhonetic: 'ڈنجن', category: 'gaming' },
  { id: 'p6', englishTerm: 'Dungeons', urduPhonetic: 'ڈنجنز', category: 'gaming' },
  { id: 'p7', englishTerm: 'Necromancer', urduPhonetic: 'نیکرومینسر', category: 'concept' },
  { id: 'p8', englishTerm: 'Shadow Monarch', urduPhonetic: 'شیڈو مونارک', category: 'concept' },
  { id: 'p9', englishTerm: 'Solo Leveling', urduPhonetic: 'سولو لیولنگ', category: 'concept' },
  { id: 'p10', englishTerm: 'Level Up', urduPhonetic: 'لیول اپ', category: 'gaming' },
  { id: 'p11', englishTerm: 'Hunter', urduPhonetic: 'ہنٹر', category: 'concept' },
  { id: 'p12', englishTerm: 'Hunters', urduPhonetic: 'ہنٹرز', category: 'concept' },
  { id: 'p13', englishTerm: 'Guild Master', urduPhonetic: 'گلڈ ماسٹر', category: 'concept' },
  { id: 'p14', englishTerm: 'Guild', urduPhonetic: 'گلڈ', category: 'concept' },
  { id: 'p15', englishTerm: 'Awakening', urduPhonetic: 'اویکننگ', category: 'concept' },
  { id: 'p16', englishTerm: 'Awakened', urduPhonetic: 'اویکنڈ', category: 'concept' },
  { id: 'p17', englishTerm: 'Raid', urduPhonetic: 'ریڈ', category: 'gaming' },
  { id: 'p18', englishTerm: 'Raid Team', urduPhonetic: 'ریڈ ٹیم', category: 'gaming' },
  { id: 'p19', englishTerm: 'Boss Monster', urduPhonetic: 'باس مانسٹر', category: 'gaming' },
  { id: 'p20', englishTerm: 'Monsters', urduPhonetic: 'مانسٹرز', category: 'gaming' },
  { id: 'p21', englishTerm: 'Monster', urduPhonetic: 'مانسٹر', category: 'gaming' },
  { id: 'p22', englishTerm: 'Status Window', urduPhonetic: 'اسٹیٹس ونڈو', category: 'gaming' },
  { id: 'p23', englishTerm: 'System', urduPhonetic: 'سسٹم', category: 'gaming' },
  { id: 'p24', englishTerm: 'Portal', urduPhonetic: 'پورٹل', category: 'gaming' },
  { id: 'p25', englishTerm: 'Red Gate', urduPhonetic: 'ریڈ گیٹ', category: 'gaming' },
  { id: 'p26', englishTerm: 'Gate', urduPhonetic: 'گیٹ', category: 'gaming' },
  { id: 'p27', englishTerm: 'Sung Jin-Woo', urduPhonetic: 'سنگ جن وو', category: 'character' },
  { id: 'p28', englishTerm: 'Kang Jin-Hyuk', urduPhonetic: 'کانگ جن ہیک', category: 'character' },
  { id: 'p29', englishTerm: 'Rayan', urduPhonetic: 'ریان', category: 'character' },
  { id: 'p30', englishTerm: 'Seoul', urduPhonetic: 'سیول', category: 'concept' },
];

/**
 * Replace English terms with natural phonetic Urdu script for accurate voice pronunciation
 */
export function normalizeUrduPhonetics(text: string, customRules: PhoneticRule[] = []): string {
  if (!text) return '';
  let result = text;
  const allRules = [...customRules, ...DEFAULT_MANHWA_PHONETICS];

  for (const rule of allRules) {
    const escaped = rule.englishTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    result = result.replace(regex, rule.urduPhonetic);
  }

  return result;
}
