/**
 * Jours fériés français avec emojis
 */

export interface Holiday {
  name: string;
  emoji: string;
  isFixed: boolean; // true = date fixe, false = date mobile (Pâques, etc.)
}

// Jours fériés fixes (même date chaque année)
const FIXED_HOLIDAYS: { [key: string]: Holiday } = {
  '01-01': { name: 'Jour de l\'an', emoji: '🎆', isFixed: true },
  '05-01': { name: 'Fête du Travail', emoji: '⚒️', isFixed: true },
  '05-08': { name: 'Victoire 1945', emoji: '🇫🇷', isFixed: true },
  '07-14': { name: 'Fête Nationale', emoji: '🇫🇷', isFixed: true },
  '08-15': { name: 'Assomption', emoji: '✨', isFixed: true },
  '11-01': { name: 'Toussaint', emoji: '🕯️', isFixed: true },
  '11-11': { name: 'Armistice 1918', emoji: '🕊️', isFixed: true },
  '12-25': { name: 'Noël', emoji: '🎅', isFixed: true },
  '12-26': { name: 'Saint-Étienne (Alsace-Moselle)', emoji: '🎄', isFixed: true }
};

/**
 * Calcul de Pâques (algorithme de Meeus/Jones/Butcher)
 */
function calculateEaster(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  
  return new Date(year, month - 1, day);
}

/**
 * Jours fériés mobiles (calculés à partir de Pâques)
 */
function getMobileHolidays(year: number): Map<string, Holiday> {
  const holidays = new Map<string, Holiday>();
  const easter = calculateEaster(year);
  
  // Lundi de Pâques (Pâques + 1 jour)
  const easterMonday = new Date(easter);
  easterMonday.setDate(easter.getDate() + 1);
  const easterMondayKey = `${String(easterMonday.getMonth() + 1).padStart(2, '0')}-${String(easterMonday.getDate()).padStart(2, '0')}`;
  holidays.set(easterMondayKey, { 
    name: 'Lundi de Pâques', 
    emoji: '🐣', 
    isFixed: false 
  });
  
  // Ascension (Pâques + 39 jours)
  const ascension = new Date(easter);
  ascension.setDate(easter.getDate() + 39);
  const ascensionKey = `${String(ascension.getMonth() + 1).padStart(2, '0')}-${String(ascension.getDate()).padStart(2, '0')}`;
  holidays.set(ascensionKey, { 
    name: 'Ascension', 
    emoji: '☁️', 
    isFixed: false 
  });
  
  // Lundi de Pentecôte (Pâques + 50 jours)
  const pentecost = new Date(easter);
  pentecost.setDate(easter.getDate() + 50);
  const pentecostKey = `${String(pentecost.getMonth() + 1).padStart(2, '0')}-${String(pentecost.getDate()).padStart(2, '0')}`;
  holidays.set(pentecostKey, { 
    name: 'Lundi de Pentecôte', 
    emoji: '🕊️', 
    isFixed: false 
  });
  
  return holidays;
}

/**
 * Vérifier si une date est un jour férié
 */
export function getHoliday(date: Date): Holiday | null {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const key = `${month}-${day}`;
  
  // Vérifier les jours fixes
  if (FIXED_HOLIDAYS[key]) {
    return FIXED_HOLIDAYS[key];
  }
  
  // Vérifier les jours mobiles
  const mobileHolidays = getMobileHolidays(year);
  if (mobileHolidays.has(key)) {
    return mobileHolidays.get(key)!;
  }
  
  return null;
}

/**
 * Obtenir tous les jours fériés d'une année
 */
export function getAllHolidays(year: number): Map<string, Holiday> {
  const allHolidays = new Map<string, Holiday>();
  
  // Ajouter les jours fixes
  Object.entries(FIXED_HOLIDAYS).forEach(([key, holiday]) => {
    allHolidays.set(key, holiday);
  });
  
  // Ajouter les jours mobiles
  const mobileHolidays = getMobileHolidays(year);
  mobileHolidays.forEach((holiday, key) => {
    allHolidays.set(key, holiday);
  });
  
  return allHolidays;
}

/**
 * Vérifier si c'est un week-end
 */
export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6; // Dimanche ou Samedi
}