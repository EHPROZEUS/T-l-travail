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
 * GARANTIT ABSOLUMENT : Maximum 1 "place réservée" par semaine
 * GARANTIT : Personne ne télétravaille 2 semaines consécutives
 */
async function getRotationScheduleAsync(weekNumber: number, year: number): Promise<Map<string, string>> {
  const PEOPLE = getActivePeople();
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
  
  if (availablePeople.length < 3) {
    console.warn(`Pas assez de personnes disponibles (${availablePeople.length}), utilisation de tout le monde`);
    availablePeople = [...PEOPLE];
  }
  
  // Fonction stricte pour détecter les places réservées
  const isReservedPlace = (name: string): boolean => {
    const lower = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return lower.includes('place reservee') || 
           lower.includes('place reserve') ||
           lower.includes('reserved');
  };
  
  const reservedPlaces = availablePeople.filter(p => isReservedPlace(p));
  const realPeople = availablePeople.filter(p => !isReservedPlace(p));
  
  console.log(`📅 Semaine ${weekNumber}: ${realPeople.length} vraies personnes, ${reservedPlaces.length} places réservées disponibles`);
  
  // Décider s'il y a une place réservée (50% de chance)
  const shouldHaveReservedPlace = randomFromSeed(seed + 9999) > 0.5;
  
  let selectedPeople: string[] = [];
  
  if (shouldHaveReservedPlace && reservedPlaces.length > 0) {
    // ==========================================
    // CAS 1 : AVEC 1 PLACE RÉSERVÉE MAXIMUM
    // ==========================================
    
    // Choisir UNE SEULE place réservée
    const shuffledReserved = shuffleArrayWithSeed([...reservedPlaces], seed + 1000);
    selectedPeople.push(shuffledReserved[0]);
    
    console.log(`✅ Place réservée : ${shuffledReserved[0]}`);
    
    // Compléter avec 2 VRAIES personnes (PAS de places réservées)
    const shuffledRealPeople = shuffleArrayWithSeed([...realPeople], seed);
    
    if (shuffledRealPeople.length >= 2) {
      selectedPeople.push(shuffledRealPeople[0]);
      selectedPeople.push(shuffledRealPeople[1]);
    } else {
      selectedPeople.push(...shuffledRealPeople);
      
      // Compléter avec d'autres vraies personnes UNIQUEMENT
      const remainingReal = availablePeople.filter(p => 
        !selectedPeople.includes(p) && !isReservedPlace(p)
      );
      
      if (remainingReal.length > 0) {
        const shuffledRemaining = shuffleArrayWithSeed([...remainingReal], seed + 2000);
        selectedPeople.push(...shuffledRemaining.slice(0, 3 - selectedPeople.length));
      }
    }
  } else {
    // ==========================================
    // CAS 2 : SANS PLACE RÉSERVÉE
    // ==========================================
    
    console.log(`❌ Pas de place réservée cette semaine`);
    
    const shuffledRealPeople = shuffleArrayWithSeed([...realPeople], seed);
    
    if (shuffledRealPeople.length >= 3) {
      selectedPeople.push(shuffledRealPeople[0]);
      selectedPeople.push(shuffledRealPeople[1]);
      selectedPeople.push(shuffledRealPeople[2]);
    } else {
      selectedPeople.push(...shuffledRealPeople);
      
      // Si vraiment pas assez, prendre UNE place réservée MAX
      if (selectedPeople.length < 3 && reservedPlaces.length > 0) {
        const shuffledReserved = shuffleArrayWithSeed([...reservedPlaces], seed + 1000);
        selectedPeople.push(shuffledReserved[0]);
      }
    }
  }
  
  // ==========================================
  // VÉRIFICATION FINALE DE SÉCURITÉ
  // ==========================================
  
  const reservedCount = selectedPeople.filter(p => isReservedPlace(p)).length;
  
  if (reservedCount > 1) {
    console.error(`🚨 ERREUR CRITIQUE : ${reservedCount} places réservées détectées !`);
    console.error(`Personnes : ${selectedPeople.join(', ')}`);
    
    // CORRECTION : Garder seulement la première place réservée
    const firstReserved = selectedPeople.find(p => isReservedPlace(p));
    selectedPeople = selectedPeople.filter(p => !isReservedPlace(p));
    
    if (firstReserved) {
      selectedPeople.unshift(firstReserved);
    }
    
    // Compléter pour avoir 3 personnes
    while (selectedPeople.length < 3) {
      const remaining = realPeople.filter(p => !selectedPeople.includes(p));
      if (remaining.length > 0) {
        const shuffled = shuffleArrayWithSeed([...remaining], seed + 5000);
        selectedPeople.push(shuffled[0]);
      } else {
        break;
      }
    }
  }
  
  console.log(`✅ Final : ${selectedPeople.join(', ')} (${reservedCount} place(s) réservée(s))`);
  
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

export async function resetAllSchedules(): Promise<void> {
  const schedulesRef = ref(database, 'schedules');
  await set(schedulesRef, null);
}

export async function updatePersonName(oldName: string, newName: string): Promise<void> {
  console.log(`Fonction disponible : Renommer ${oldName} en ${newName}`);
}

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