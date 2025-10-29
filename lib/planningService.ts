import { database } from './firebase';
import { ref, set, get, onValue } from 'firebase/database';

export type WeekType = 'PAIR' | 'IMPAIR';

export interface Person {
  name: string;
  assignedDay: 'MARDI' | 'MERCREDI' | 'JEUDI';
  weekType: WeekType | null;
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

const PEOPLE_CONFIG: Person[] = [
  { name: "Gilbert", assignedDay: "MERCREDI", weekType: null },
  { name: "Vincent", assignedDay: "MARDI", weekType: "PAIR" },
  { name: "Maurice", assignedDay: "JEUDI", weekType: "PAIR" },
  { name: "Place réservée", assignedDay: "MARDI", weekType: "IMPAIR" },
  { name: "Fabien", assignedDay: "JEUDI", weekType: "IMPAIR" }
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

export function generateWeekSchedule(startDate: Date): WeekSchedule {
  const monday = getMonday(new Date(startDate));
  const weekType = getWeekType(monday);
  const weekNumber = getWeekNumber(monday);
  const year = getWeekYear(monday);
  
  const days: DaySchedule[] = [];
  const daysOfWeek = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi'];
  
  for (let i = 0; i < 5; i++) {
    const currentDate = new Date(monday);
    currentDate.setDate(monday.getDate() + i);
    
    const dayName = daysOfWeek[i];
    const personName = getRemotePersonForDay(i, weekType);
    
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

function getRemotePersonForDay(dayIndex: number, weekType: WeekType): string | null {
  if (dayIndex === 0 || dayIndex === 4) {
    return null;
  }
  
  const dayNames = ['LUNDI', 'MARDI', 'MERCREDI', 'JEUDI', 'VENDREDI'];
  const dayName = dayNames[dayIndex];
  
  for (const person of PEOPLE_CONFIG) {
    if (person.name === "Gilbert" && dayName === person.assignedDay) {
      return person.name;
    }
    
    if (dayName === person.assignedDay && person.weekType === weekType) {
      return person.name;
    }
  }
  
  return null;
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