import { database } from './firebase';
import { ref, set, get, onValue } from 'firebase/database';

export type WeekType = 'PAIR' | 'IMPAIR';

export interface Person {
  name: string;
}

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

// Jours de télétravail possibles (indices : 1=Mardi, 2=Mercredi, 3=Jeudi)
const REMOTE_DAYS = [1, 2, 3]; // Mardi, Mercredi, Jeudi

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
 * Calcule quelle personne télétravaille quel jour selon la semaine
 * Rotation : chaque personne télétravaille 1 fois toutes les 5 semaines
 * Aucune personne ne télétravaille 2 semaines consécutives
 */
function getRotationSchedule(weekNumber: number): { [dayIndex: number]: string } {
  // Cycle de 5 semaines
  const cyclePosition = (weekNumber - 1) % 5;
  
  // Définir la rotation : chaque personne a un jour différent à chaque cycle
  const rotationMatrix: { [cycle: number]: { [dayIndex: number]: number } } = {
    0: { 1: 0, 2: 1, 3: 2 }, // Semaine 1, 6, 11... : Vincent(Mardi), Maurice(Mercredi), Gilbert(Jeudi)
    1: { 1: 3, 2: 4, 3: 0 }, // Semaine 2, 7, 12... : Place réservée(Mardi), Fabien(Mercredi), Vincent(Jeudi)
    2: { 1: 1, 2: 2, 3: 3 }, // Semaine 3, 8, 13... : Maurice(Mardi), Gilbert(Mercredi), Place réservée(Jeudi)
    3: { 1: 4, 2: 0, 3: 1 }, // Semaine 4, 9, 14... : Fabien(Mardi), Vincent(Mercredi), Maurice(Jeudi)
    4: { 1: 2, 2: 3, 3: 4 }  // Semaine 5, 10, 15... : Gilbert(Mardi), Place réservée(Mercredi), Fabien(Jeudi)
  };
  
  const schedule: { [dayIndex: number]: string } = {};
  const rotation = rotationMatrix[cyclePosition];
  
  for (const dayIndex in rotation) {
    const personIndex = rotation[dayIndex];
    schedule[dayIndex] = PEOPLE[personIndex];
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
    const personName = rotation[i] || null;
    
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