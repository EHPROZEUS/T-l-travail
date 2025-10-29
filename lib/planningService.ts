import { database } from './firebase';
import { ref, set, get, onValue } from 'firebase/database';

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

// Liste des 6 personnes
const PEOPLE: string[] = [
  "Vincent",
  "Maurice",
  "Gilbert",
  "Place réservée",
  "Fabien",
  "Place réservée 2"
];

// Cache pour stocker le cycle généré
let currentCycle: Map<number, Map<string, string>> | null = null;
let currentCycleStartWeek: number | null = null;

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
 * Génère un cycle complet de 2 semaines avec rotation aléatoire
 * 6 personnes, 3 jours disponibles (Mardi, Mercredi, Jeudi)
 * Pattern : 3 personnes par semaine, chaque personne 1 fois par cycle
 */
function generateRandomCycle(startWeek: number): Map<number, Map<string, string>> {
  const cycle = new Map<number, Map<string, string>>();
  const seed = startWeek;
  
  const availableDays = ['Mardi', 'Mercredi', 'Jeudi'];
  
  // Récupérer les personnes de la semaine PRÉCÉDENTE (semaine avant ce cycle)
  let previousWeekPeople: Set<string> = new Set();
  
  if (startWeek > 1) {
    const previousWeekNumber = startWeek - 1;
    const previousRotation = getRotationSchedulePrevious(previousWeekNumber);
    if (previousRotation) {
      previousWeekPeople = new Set(Array.from(previousRotation.values()));
    }
  }
  
  // Diviser les 6 personnes en 2 groupes de 3
  // Groupe 1 : ne contient AUCUNE personne de la semaine précédente
  // Groupe 2 : contient les autres
  
  const availableForWeek1 = PEOPLE.filter(p => !previousWeekPeople.has(p));
  const remainingPeople = PEOPLE.filter(p => previousWeekPeople.has(p));
  
  // Si pas assez de personnes disponibles, prendre tout le monde
  let week1People: string[];
  let week2People: string[];
  
  if (availableForWeek1.length >= 3) {
    // Assez de personnes non-consécutives pour la semaine 1
    const shuffled1 = shuffleArrayWithSeed([...availableForWeek1], seed);
    week1People = shuffled1.slice(0, 3);
    
    // Semaine 2 : les 3 personnes restantes
    week2People = PEOPLE.filter(p => !week1People.includes(p));
  } else {
    // Fallback : mélanger tout le monde
    const shuffledAll = shuffleArrayWithSeed([...PEOPLE], seed);
    week1People = shuffledAll.slice(0, 3);
    week2People = shuffledAll.slice(3, 6);
  }
  
  // Semaine 1 : attribuer des jours aléatoires
  const week1Schedule = new Map<string, string>();
  const week1Days = shuffleArrayWithSeed([...availableDays], seed + 100);
  for (let i = 0; i < 3; i++) {
    week1Schedule.set(week1Days[i], week1People[i]);
  }
  cycle.set(0, week1Schedule);
  
  // Semaine 2 : attribuer des jours aléatoires
  const week2Schedule = new Map<string, string>();
  const week2Days = shuffleArrayWithSeed([...availableDays], seed + 200);
  for (let i = 0; i < 3; i++) {
    week2Schedule.set(week2Days[i], week2People[i]);
  }
  cycle.set(1, week2Schedule);
  
  return cycle;
}

/**
 * Fonction helper pour obtenir le planning d'une semaine précédente
 * (sans modifier le cache actuel)
 */
function getRotationSchedulePrevious(weekNumber: number): Map<string, string> | null {
  const cycleNumber = Math.floor((weekNumber - 1) / 2);
  const positionInCycle = (weekNumber - 1) % 2;
  const cycleStartWeek = cycleNumber * 2 + 1;
  
  // Générer temporairement ce cycle
  const tempCycle = generateRandomCycleSimple(cycleStartWeek);
  return tempCycle.get(positionInCycle) || null;
}

/**
 * Version simple de génération (sans vérification de consécutif)
 * Utilisé uniquement pour vérifier l'historique
 */
function generateRandomCycleSimple(startWeek: number): Map<number, Map<string, string>> {
  const cycle = new Map<number, Map<string, string>>();
  const seed = startWeek;
  
  const availableDays = ['Mardi', 'Mercredi', 'Jeudi'];
  const shuffledPeople = shuffleArrayWithSeed([...PEOPLE], seed);
  
  // Semaine 1
  const week1Schedule = new Map<string, string>();
  const week1Days = shuffleArrayWithSeed([...availableDays], seed + 100);
  for (let i = 0; i < 3; i++) {
    week1Schedule.set(week1Days[i], shuffledPeople[i]);
  }
  cycle.set(0, week1Schedule);
  
  // Semaine 2
  const week2Schedule = new Map<string, string>();
  const week2Days = shuffleArrayWithSeed([...availableDays], seed + 200);
  for (let i = 0; i < 3; i++) {
    week2Schedule.set(week2Days[i], shuffledPeople[i + 3]);
  }
  cycle.set(1, week2Schedule);
  
  return cycle;
}

/**
 * Obtenir le planning pour une semaine donnée
 */
function getRotationSchedule(weekNumber: number): Map<string, string> {
  // Déterminer dans quel cycle on est (cycle de 2 semaines)
  const cycleNumber = Math.floor((weekNumber - 1) / 2);
  const positionInCycle = (weekNumber - 1) % 2;
  const cycleStartWeek = cycleNumber * 2 + 1;
  
  // Générer un nouveau cycle si nécessaire
  if (currentCycleStartWeek !== cycleStartWeek) {
    currentCycle = generateRandomCycle(cycleStartWeek);
    currentCycleStartWeek = cycleStartWeek;
  }
  
  // Retourner le planning de cette semaine dans le cycle
  return currentCycle!.get(positionInCycle) || new Map();
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

export function generateWeekSchedule(startDate: Date): WeekSchedule {
  const monday = getMonday(new Date(startDate));
  const weekType = getWeekType(monday);
  const weekNumber = getWeekNumber(monday);
  const year = getWeekYear(monday);
  
  const days: DaySchedule[] = [];
  const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
  
  // Obtenir la rotation pour cette semaine
  const rotation = getRotationSchedule(weekNumber);
  
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
    schedule = generateWeekSchedule(monday);
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
  // Réinitialiser le cache
  currentCycle = null;
  currentCycleStartWeek = null;
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