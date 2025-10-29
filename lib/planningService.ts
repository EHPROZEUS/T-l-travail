import { database } from './firebase';
import { ref, set, get, onValue } from 'firebase/database';
import { getActivePeople, getActivePeopleCount } from './config';

export type WeekType = 'PAIR' | 'IMPAIR';

export interface DaySchedule {
  date: string;
  dayName: string;
  personName: string;
  isRemote: boolean;
}

export interface WeekSchedule {
  weekNumber: number;
  year: number;
  weekType: WeekType;
  days: DaySchedule[];
  lastUpdated: string;
}

/**
 * Fonction pour générer un nombre aléatoire avec seed (déterministe)
 */
function randomFromSeed(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

/**
 * Mélanger un tableau de façon déterministe avec seed
 */
function shuffleArrayWithSeed<T>(array: T[], seed: number): T[] {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const random = randomFromSeed(seed + i);
    const j = Math.floor(random * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Génère le planning pour une semaine en évitant les consécutifs
 * Vérifie qui était en télétravail la semaine précédente
 */
/**
 * Génère le planning pour une semaine en évitant les consécutifs
 * Vérifie qui était en télétravail la semaine précédente
 * GARANTIT : Maximum 1 "place réservée" par semaine
 * GARANTIT : Personne ne télétravaille 2 semaines consécutives
 */
async function getRotationScheduleAsync(weekNumber: number, year: number): Promise<Map<string, string>> {
  const PEOPLE = getActivePeople(); // Récupérer les personnes actives depuis la config
  const availableDays = ['Mardi', 'Mercredi', 'Jeudi'];
  const seed = weekNumber + year * 1000;
  
  // Récupérer la semaine précédente depuis Firebase
  let previousWeekPeople: Set<string> = new Set();
  
  if (weekNumber > 1) {
    const prevSchedule = await getScheduleFromFirebase(weekNumber - 1, year);
    if (prevSchedule) {
      prevSchedule.days.forEach(day => {
        if (day.isRemote && day.personName !== '—') {
          previousWeekPeople.add(day.personName);
        }
      });
    }
  } else if (weekNumber === 1 && year > 2025) {
    // Cas spécial : semaine 1 de l'année, vérifier la dernière semaine de l'année précédente
    const prevSchedule = await getScheduleFromFirebase(52, year - 1);
    if (prevSchedule) {
      prevSchedule.days.forEach(day => {
        if (day.isRemote && day.personName !== '—') {
          previousWeekPeople.add(day.personName);
        }
      });
    }
  }
  
  // Personnes disponibles (EXCLUANT celles de la semaine précédente)
  let availablePeople = PEOPLE.filter(p => !previousWeekPeople.has(p));
  
  // Si pas assez de personnes disponibles (ne devrait jamais arriver avec 6 personnes)
  if (availablePeople.length < 3) {
    console.warn(`Pas assez de personnes disponibles (${availablePeople.length}), utilisation de tout le monde`);
    availablePeople = [...PEOPLE];
  }
  
  // Séparer les "places réservées" des vraies personnes PARMI LES DISPONIBLES
  const reservedPlaces = availablePeople.filter(p => 
    p.toLowerCase().includes('place réservée') || 
    p.toLowerCase().includes('place reservée')
  );
  const realPeople = availablePeople.filter(p => 
    !p.toLowerCase().includes('place réservée') && 
    !p.toLowerCase().includes('place reservée')
  );
  
  // Sélectionner les personnes :
  // 1. Maximum 1 place réservée
  // 2. Compléter avec des vraies personnes
  let selectedPeople: string[] = [];
  
  // Mélanger les vraies personnes disponibles
  const shuffledRealPeople = shuffleArrayWithSeed([...realPeople], seed);
  
  // Décider aléatoirement s'il y a une place réservée cette semaine (50% de chance)
  const hasReservedPlace = randomFromSeed(seed + 9999) > 0.5 && reservedPlaces.length > 0;
  
  if (hasReservedPlace && reservedPlaces.length > 0) {
    // Prendre 1 place réservée au hasard
    const shuffledReserved = shuffleArrayWithSeed([...reservedPlaces], seed + 1000);
    selectedPeople.push(shuffledReserved[0]);
    
    // Compléter avec 2 vraies personnes
    if (shuffledRealPeople.length >= 2) {
      selectedPeople.push(...shuffledRealPeople.slice(0, 2));
    } else {
      // Fallback : prendre ce qui reste
      selectedPeople.push(...shuffledRealPeople);
      // Si toujours pas assez, prendre parmi toutes les personnes disponibles
      const remaining = availablePeople.filter(p => !selectedPeople.includes(p));
      const shuffledRemaining = shuffleArrayWithSeed([...remaining], seed + 2000);
      selectedPeople.push(...shuffledRemaining.slice(0, 3 - selectedPeople.length));
    }
  } else {
    // Prendre 3 vraies personnes
    if (shuffledRealPeople.length >= 3) {
      selectedPeople.push(...shuffledRealPeople.slice(0, 3));
    } else {
      // Pas assez de vraies personnes, prendre toutes les vraies + compléter avec places réservées
      selectedPeople.push(...shuffledRealPeople);
      const shuffledReserved = shuffleArrayWithSeed([...reservedPlaces], seed + 1000);
      selectedPeople.push(...shuffledReserved.slice(0, 3 - selectedPeople.length));
    }
  }
  
  // Vérification finale : S'assurer qu'on a bien 3 personnes
  if (selectedPeople.length < 3) {
    console.warn(`Seulement ${selectedPeople.length} personnes sélectionnées, ajout de personnes aléatoires`);
    const remaining = availablePeople.filter(p => !selectedPeople.includes(p));
    const shuffledRemaining = shuffleArrayWithSeed([...remaining], seed + 3000);
    selectedPeople.push(...shuffledRemaining.slice(0, 3 - selectedPeople.length));
  }
  
  // Attribuer des jours aléatoires
  const shuffledDays = shuffleArrayWithSeed([...availableDays], seed + 500);
  
  const schedule = new Map<string, string>();
  for (let i = 0; i < Math.min(3, selectedPeople.length); i++) {
    schedule.set(shuffledDays[i], selectedPeople[i]);
  }
  
  return schedule;
}

export function getWeekType(date: Date): WeekType {
  const weekNumber = getWeekNumber(date);
  return weekNumber % 2 === 0 ? 'PAIR' : 'IMPAIR';
}

export function getWeekNumber(date: Date): number {
  const target = new Date(date.valueOf());
  const dayNum = (date.getDay() + 6) % 7;
  target.setDate(target.getDate() - dayNum + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  return 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
}

export function getWeekYear(date: Date): number {
  const target = new Date(date.valueOf());
  target.setDate(target.getDate() - ((date.getDay() + 6) % 7) + 3);
  return target.getFullYear();
}

export function getMonday(date: Date): Date {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}

export async function generateWeekSchedule(startDate: Date): Promise<WeekSchedule> {
  const monday = getMonday(new Date(startDate));
  const weekType = getWeekType(monday);
  const weekNumber = getWeekNumber(monday);
  const year = getWeekYear(monday);
  
  const days: DaySchedule[] = [];
  const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
  
  // Obtenir la rotation pour cette semaine (avec vérification anti-consécutif)
  const rotation = await getRotationScheduleAsync(weekNumber, year);
  
  for (let i = 0; i < 5; i++) {
    const currentDate = new Date(monday);
    currentDate.setDate(monday.getDate() + i);
    
    const dayName = daysOfWeek[i];
    const personName = rotation.get(dayName) || null;
    
    days.push({
      date: currentDate.toISOString(),
      dayName,
      personName: personName || '—',
      isRemote: personName !== null
    });
  }
  
  return {
    weekNumber,
    year,
    weekType,
    days,
    lastUpdated: new Date().toISOString()
  };
}

export async function saveScheduleToFirebase(schedule: WeekSchedule): Promise<void> {
  const scheduleRef = ref(database, `schedules/${schedule.year}/week${schedule.weekNumber}`);
  await set(scheduleRef, schedule);
}

export async function getScheduleFromFirebase(weekNumber: number, year: number): Promise<WeekSchedule | null> {
  const scheduleRef = ref(database, `schedules/${year}/week${weekNumber}`);
  const snapshot = await get(scheduleRef);
  
  if (snapshot.exists()) {
    return snapshot.val();
  }
  return null;
}

export function listenToSchedule(
  weekNumber: number,
  year: number,
  callback: (schedule: WeekSchedule | null) => void
): () => void {
  const scheduleRef = ref(database, `schedules/${year}/week${weekNumber}`);
  
  const unsubscribe = onValue(scheduleRef, (snapshot) => {
    if (snapshot.exists()) {
      callback(snapshot.val());
    } else {
      callback(null);
    }
  });
  
  return unsubscribe;
}

export async function getOrGenerateSchedule(weekOffset: number = 0): Promise<WeekSchedule> {
  const today = new Date();
  today.setDate(today.getDate() + (weekOffset * 7));
  
  const monday = getMonday(today);
  const weekNumber = getWeekNumber(monday);
  const year = getWeekYear(monday);
  
  let schedule = await getScheduleFromFirebase(weekNumber, year);
  
  if (!schedule) {
    schedule = await generateWeekSchedule(monday);
    await saveScheduleToFirebase(schedule);
  }
  
  return schedule;
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
}

export function getWeekRange(schedule: WeekSchedule): string {
  const firstDay = formatDate(schedule.days[0].date);
  const lastDay = formatDate(schedule.days[4].date);
  return `${firstDay} - ${lastDay}`;
}

/**
 * ============================================
 * FONCTIONS ADMIN
 * ============================================
 */

/**
 * Réinitialiser TOUT le planning Firebase
 */
export async function resetAllSchedules(): Promise<void> {
  const schedulesRef = ref(database, 'schedules');
  await set(schedulesRef, null);
}

/**
 * Mettre à jour le nom d'une personne globalement
 */
export async function updatePersonName(oldName: string, newName: string): Promise<void> {
  console.log(`Fonction disponible : Renommer ${oldName} en ${newName}`);
}

/**
 * Mettre à jour la personne en télétravail pour un jour spécifique
 */
export async function updateDayPerson(
  schedule: WeekSchedule,
  dayIndex: number,
  personName: string | null
): Promise<WeekSchedule> {
  const updatedSchedule = { ...schedule };
  
  updatedSchedule.days[dayIndex] = {
    ...updatedSchedule.days[dayIndex],
    personName: personName || '—',
    isRemote: personName !== null && personName !== ''
  };
  
  updatedSchedule.lastUpdated = new Date().toISOString();
  
  await saveScheduleToFirebase(updatedSchedule);
  
  return updatedSchedule;
}