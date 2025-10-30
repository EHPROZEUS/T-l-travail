import { database } from './firebase';
import { ref, push, set, onValue, remove, get, Unsubscribe } from 'firebase/database';

export interface Note {
  id: string;
  content: string;
  author: string;
  authorUsername: string;
  timestamp: number;
}

export interface PublicAnnouncement {
  id: string;
  content: string;
  author: string;
  authorUsername: string;
  timestamp: number;
  displayType: 'pinned' | 'week-range' | 'specific-week';
  startWeek?: number;
  endWeek?: number;
  specificWeek?: number;
  year: number;
}

export interface AdminUser {
  username: string;
  password: string;
  displayName: string;
  canDeleteAll: boolean;
}

// Configuration par défaut (sera écrasée par Firebase)
const DEFAULT_ADMINS: Record<string, AdminUser> = {
  admin1: {
    username: 'admin1',
    password: '120698',
    displayName: 'Loïc',
    canDeleteAll: true
  },
  admin2: {
    username: 'admin2',
    password: '2025',
    displayName: 'Kamel',
    canDeleteAll: false
  }
};

/**
 * Initialiser les admins dans Firebase (première utilisation)
 */
export async function initializeAdmins(): Promise<void> {
  const adminsRef = ref(database, 'admins');
  const snapshot = await get(adminsRef);
  
  if (!snapshot.exists()) {
    // Première utilisation : créer les admins par défaut
    await set(adminsRef, DEFAULT_ADMINS);
  }
}

/**
 * Récupérer les admins depuis Firebase
 */
export async function getAdmins(): Promise<Record<string, AdminUser>> {
  const adminsRef = ref(database, 'admins');
  const snapshot = await get(adminsRef);
  
  if (snapshot.exists()) {
    return snapshot.val();
  }
  
  // Si pas d'admins en base, initialiser
  await initializeAdmins();
  return DEFAULT_ADMINS;
}

/**
 * Changer le mot de passe d'un admin
 */
export async function changePassword(
  username: string,
  oldPassword: string,
  newPassword: string
): Promise<{ success: boolean; message: string }> {
  try {
    const admins = await getAdmins();
    const admin = admins[username];

    if (!admin) {
      return { success: false, message: 'Utilisateur introuvable' };
    }

    if (admin.password !== oldPassword) {
      return { success: false, message: 'Ancien mot de passe incorrect' };
    }

    if (newPassword.length < 4) {
      return { success: false, message: 'Le mot de passe doit contenir au moins 4 caractères' };
    }

    // Mettre à jour le mot de passe dans Firebase
    const adminRef = ref(database, `admins/${username}/password`);
    await set(adminRef, newPassword);

    return { success: true, message: 'Mot de passe modifié avec succès !' };
  } catch (error) {
    console.error('Erreur lors du changement de mot de passe:', error);
    return { success: false, message: 'Erreur lors de la modification' };
  }
}

/**
 * Ajouter une nouvelle note
 */
export async function addNote(
  content: string,
  author: string,
  authorUsername: string
): Promise<void> {
  const notesRef = ref(database, 'notes');
  const newNoteRef = push(notesRef);
  
  const note = {
    content,
    author,
    authorUsername,
    timestamp: Date.now()
  };

  await set(newNoteRef, note);
}

/**
 * Supprimer une note
 */
export async function deleteNote(noteId: string): Promise<void> {
  const noteRef = ref(database, `notes/${noteId}`);
  await remove(noteRef);
}

/**
 * Écouter les changements de notes en temps réel
 */
export function listenToNotes(callback: (notes: Note[]) => void): Unsubscribe {
  const notesRef = ref(database, 'notes');
  
  return onValue(notesRef, (snapshot) => {
    const data = snapshot.val();
    
    if (!data) {
      callback([]);
      return;
    }

    const notes: Note[] = Object.entries(data).map(([id, note]: [string, any]) => ({
      id,
      content: note.content,
      author: note.author,
      authorUsername: note.authorUsername,
      timestamp: note.timestamp
    }));

    // Trier par date décroissante (plus récent en premier)
    notes.sort((a, b) => b.timestamp - a.timestamp);

    callback(notes);
  });
}

/**
 * Vérifier les identifiants admin (depuis Firebase)
 */
export async function verifyAdmin(username: string, password: string): Promise<AdminUser | null> {
  const admins = await getAdmins();
  const admin = admins[username];
  
  if (admin && admin.password === password) {
    return admin;
  }
  
  return null;
}

/**
 * Vérifier si un admin peut supprimer une note
 */
export function canDeleteNote(currentAdmin: AdminUser, noteAuthorUsername: string): boolean {
  // Admin1 peut tout supprimer
  if (currentAdmin.canDeleteAll) {
    return true;
  }
  
  // Les autres admins peuvent supprimer uniquement leurs propres notes
  return currentAdmin.username === noteAuthorUsername;
}

/**
 * Ajouter une annonce publique
 */
export async function addPublicAnnouncement(
  content: string,
  author: string,
  authorUsername: string,
  displayType: 'pinned' | 'week-range' | 'specific-week',
  year: number,
  options?: {
    startWeek?: number;
    endWeek?: number;
    specificWeek?: number;
  }
): Promise<void> {
  const announcementsRef = ref(database, 'publicAnnouncements');
  const newAnnouncementRef = push(announcementsRef);
  
  const announcement: Omit<PublicAnnouncement, 'id'> = {
    content,
    author,
    authorUsername,
    timestamp: Date.now(),
    displayType,
    year,
    ...options
  };

  await set(newAnnouncementRef, announcement);
}

/**
 * Supprimer une annonce publique
 */
export async function deletePublicAnnouncement(announcementId: string): Promise<void> {
  const announcementRef = ref(database, `publicAnnouncements/${announcementId}`);
  await remove(announcementRef);
}

/**
 * Récupérer les annonces publiques pour une semaine donnée
 */
export async function getAnnouncementsForWeek(weekNumber: number, year: number): Promise<PublicAnnouncement[]> {
  const announcementsRef = ref(database, 'publicAnnouncements');
  const snapshot = await get(announcementsRef);
  
  if (!snapshot.exists()) {
    return [];
  }

  const allAnnouncements = snapshot.val();
  const announcements: PublicAnnouncement[] = [];

  Object.entries(allAnnouncements).forEach(([id, announcement]: [string, any]) => {
    const ann: PublicAnnouncement = { id, ...announcement };

    // Vérifier si l'annonce doit être affichée pour cette semaine
    if (ann.displayType === 'pinned') {
      // Toujours afficher
      announcements.push(ann);
    } else if (ann.displayType === 'specific-week') {
      // Afficher pour une semaine spécifique
      if (ann.specificWeek === weekNumber && ann.year === year) {
        announcements.push(ann);
      }
    } else if (ann.displayType === 'week-range') {
      // Afficher pour une plage de semaines
      if (
        ann.year === year &&
        ann.startWeek !== undefined &&
        ann.endWeek !== undefined &&
        weekNumber >= ann.startWeek &&
        weekNumber <= ann.endWeek
      ) {
        announcements.push(ann);
      }
    }
  });

  // Trier par date décroissante
  announcements.sort((a, b) => b.timestamp - a.timestamp);

  return announcements;
}

/**
 * Écouter toutes les annonces publiques (pour l'admin)
 */
export function listenToAllAnnouncements(callback: (announcements: PublicAnnouncement[]) => void): Unsubscribe {
  const announcementsRef = ref(database, 'publicAnnouncements');
  
  return onValue(announcementsRef, (snapshot) => {
    const data = snapshot.val();
    
    if (!data) {
      callback([]);
      return;
    }

    const announcements: PublicAnnouncement[] = Object.entries(data).map(([id, announcement]: [string, any]) => ({
      id,
      ...announcement
    }));

    // Trier par date décroissante
    announcements.sort((a, b) => b.timestamp - a.timestamp);

    callback(announcements);
  });
}