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

// Liste des 5 personnes
const PEOPLE: string[] = [
  "Vincent",
  "Maurice",
  "Gilbert",
  "Place réservée",
  "Fabien"
];

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

/**
 * Rotation simple sur 5 semaines
 * Chaque personne télétravaille 1 fois toutes les 5 semaines
 * Le nombre de personnes par semaine peut varier (2 ou 3)
 */
function getRotationSchedule(weekNumber: number): Map<string, string> {
  const cyclePosition = (weekNumber - 1) % 5;
  
  // Rotation ultra-équitable : chaque personne télétravaille 2 fois sur 5 semaines
  // Pattern : 2-2-2-2-2 = 10 jours (2 jours/personne)
  const rotations: { [cycle: number]: { [day: string]: string } } = {
    0: { 'Mardi': 'Vincent', 'Jeudi': 'Maurice' },                    // 2 personnes
    1: { 'Mardi': 'Gilbert', 'Mercredi': 'Place réservée' },          // 2 personnes
    2: { 'Mercredi': 'Fabien', 'Jeudi': 'Vincent' },                  // 2 personnes
    3: { 'Mardi': 'Maurice', 'Jeudi': 'Gilbert' },                    // 2 personnes
    4: { 'Mardi': 'Place réservée', 'Mercredi': 'Fabien' }            // 2 personnes
  };
  
  const schedule = new Map<string, string>();
  const rotation = rotations[cyclePosition];
  
  for (const day in rotation) {
    schedule.set(day, rotation[day]);
  }
  
  return schedule;
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
}

/**
 * Mettre à jour le nom d'une personne globalement
 * (fonction de réserve pour évolution future)
 */
export async function updatePersonName(oldName: string, newName: string): Promise<void> {
  console.log(`Fonction disponible : Renommer ${oldName} en ${newName}`);
  // Pourrait être implémenté pour renommer partout dans Firebase
}

/**
 * Mettre à jour la personne en télétravail pour un jour spécifique
 */
export async function updateDayPerson(
  schedule: WeekSchedule,
  dayIndex: number,
  personName: string | null
): Promise<WeekSchedule> {
  // Créer une copie du planning
  const updatedSchedule = { ...schedule };
  
  // Mettre à jour le jour spécifique
  updatedSchedule.days[dayIndex] = {
    ...updatedSchedule.days[dayIndex],
    personName: personName || '—',
    isRemote: personName !== null && personName !== ''
  };
  
  // Mettre à jour le timestamp
  updatedSchedule.lastUpdated = new Date().toISOString();
  
  // Sauvegarder dans Firebase
  await saveScheduleToFirebase(updatedSchedule);
  
  return updatedSchedule;
}