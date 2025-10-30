'use client';

import { useState, useEffect } from 'react';
import { 
  getOrGenerateSchedule, 
  listenToSchedule, 
  WeekSchedule, 
  formatDate, 
  getWeekRange,
  resetAllSchedules,
  updatePersonName,
  updateDayPerson
} from '../lib/planningService';
import { getActivePeopleCount, PEOPLE_CONFIG } from '../lib/config';
import { getHoliday } from '../lib/holidays';
import { exportToPDF } from '../lib/pdfExport';
import { 
  verifyAdmin, 
  listenToNotes, 
  addNote, 
  deleteNote, 
  canDeleteNote,
  changePassword,
  initializeAdmins,
  addPublicAnnouncement,
  deletePublicAnnouncement,
  getAnnouncementsForWeek,
  listenToAllAnnouncements,
  AdminUser,
  Note,
  PublicAnnouncement
} from '../lib/notesService';
import '../styles/globals.css';

export default function Home() {
  const [schedule, setSchedule] = useState<WeekSchedule | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Admin states
  const [currentAdmin, setCurrentAdmin] = useState<AdminUser | null>(null);
  const [adminUsername, setAdminUsername] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [showAdminLogin, setShowAdminLogin] = useState(false);
  const [editingDay, setEditingDay] = useState<number | null>(null);
  const [newPersonName, setNewPersonName] = useState('');

  // Notes states
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNoteContent, setNewNoteContent] = useState('');
  const [showNotesPanel, setShowNotesPanel] = useState(false);

  // Change password states
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Reset admin2 password states
  const [showResetAdmin2, setShowResetAdmin2] = useState(false);
  const [resetAdmin2Password, setResetAdmin2Password] = useState('');
  const [resetAdmin2Confirm, setResetAdmin2Confirm] = useState('');

  // Public announcements states
  const [publicAnnouncements, setPublicAnnouncements] = useState<PublicAnnouncement[]>([]);
  const [allAnnouncements, setAllAnnouncements] = useState<PublicAnnouncement[]>([]);
  const [showAnnouncementsPanel, setShowAnnouncementsPanel] = useState(false);
  const [showCreateAnnouncement, setShowCreateAnnouncement] = useState(false);
  const [announcementContent, setAnnouncementContent] = useState('');
  const [announcementType, setAnnouncementType] = useState<'pinned' | 'week-range' | 'specific-week'>('pinned');
  const [announcementYear, setAnnouncementYear] = useState<number>(new Date().getFullYear());
  const [announcementStartWeek, setAnnouncementStartWeek] = useState('');
  const [announcementEndWeek, setAnnouncementEndWeek] = useState('');
  const [announcementSpecificWeek, setAnnouncementSpecificWeek] = useState('');

  useEffect(() => {
    loadSchedule();
    initializeAdmins();
  }, [weekOffset]);

  useEffect(() => {
    if (!schedule) return;

    const unsubscribe = listenToSchedule(
      schedule.weekNumber,
      schedule.year,
      (updatedSchedule) => {
        if (updatedSchedule) {
          setSchedule(updatedSchedule);
        }
      }
    );

    return () => unsubscribe();
  }, [schedule?.weekNumber, schedule?.year]);

  useEffect(() => {
    if (!currentAdmin) return;

    const unsubscribe = listenToNotes((updatedNotes) => {
      setNotes(updatedNotes);
    });

    return () => unsubscribe();
  }, [currentAdmin]);

  useEffect(() => {
    if (!currentAdmin) return;

    const unsubscribe = listenToAllAnnouncements((announcements) => {
      setAllAnnouncements(announcements);
    });

    return () => unsubscribe();
  }, [currentAdmin]);

  useEffect(() => {
    if (!schedule) return;

    const loadAnnouncements = async () => {
      const announcements = await getAnnouncementsForWeek(schedule.weekNumber, schedule.year);
      setPublicAnnouncements(announcements);
    };

    loadAnnouncements();
  }, [schedule?.weekNumber, schedule?.year]);

  const loadSchedule = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getOrGenerateSchedule(weekOffset);
      setSchedule(data);
    } catch (err) {
      console.error('Erreur lors du chargement:', err);
      setError('Erreur lors du chargement du planning. Vérifiez votre configuration Firebase.');
    } finally {
      setLoading(false);
    }
  };

  const handlePreviousWeek = () => {
    setWeekOffset(weekOffset - 1);
  };

  const handleNextWeek = () => {
    setWeekOffset(weekOffset + 1);
  };

  const handleCurrentWeek = () => {
    setWeekOffset(0);
  };

  const handleExportPDF = () => {
    if (schedule) {
      exportToPDF(schedule);
    }
  };

  const handleAdminLogin = async () => {
    const admin = await verifyAdmin(adminUsername, adminPassword);
    
    if (admin) {
      setCurrentAdmin(admin);
      setShowAdminLogin(false);
      setAdminUsername('');
      setAdminPassword('');
    } else {
      alert('❌ Identifiants incorrects !');
      setAdminPassword('');
    }
  };

  const handleAdminLogout = () => {
    setCurrentAdmin(null);
    setShowNotesPanel(false);
    setShowAnnouncementsPanel(false);
    setShowChangePassword(false);
    setShowResetAdmin2(false);
  };

  const handleResetAll = async () => {
    if (window.confirm('⚠️ ATTENTION : Cela va supprimer TOUT le planning. Êtes-vous sûr ?')) {
      try {
        await resetAllSchedules();
        alert('✅ Planning réinitialisé !');
        setWeekOffset(0);
        await loadSchedule();
      } catch (err) {
        alert('❌ Erreur lors de la réinitialisation');
        console.error(err);
      }
    }
  };

  const handleEditDay = (dayIndex: number, currentPerson: string) => {
    setEditingDay(dayIndex);
    setNewPersonName(currentPerson === '—' ? '' : currentPerson);
  };

  const handleSaveEdit = async () => {
    if (!schedule || editingDay === null) return;

    try {
      const updatedSchedule = await updateDayPerson(
        schedule,
        editingDay,
        newPersonName.trim() || null
      );
      setSchedule(updatedSchedule);
      setEditingDay(null);
      setNewPersonName('');
      alert('✅ Modification enregistrée !');
    } catch (err) {
      alert('❌ Erreur lors de la modification');
      console.error(err);
    }
  };

  const handleCancelEdit = () => {
    setEditingDay(null);
    setNewPersonName('');
  };

  const handleAddNote = async () => {
    if (!currentAdmin || !newNoteContent.trim()) {
      alert('⚠️ Veuillez écrire un message');
      return;
    }

    try {
      await addNote(
        newNoteContent.trim(),
        currentAdmin.displayName,
        currentAdmin.username
      );
      setNewNoteContent('');
    } catch (err) {
      alert('❌ Erreur lors de l\'ajout de la note');
      console.error(err);
    }
  };

  const handleDeleteNote = async (noteId: string, noteAuthorUsername: string) => {
    if (!currentAdmin) return;

    if (!canDeleteNote(currentAdmin, noteAuthorUsername)) {
      alert('⚠️ Vous ne pouvez supprimer que vos propres notes');
      return;
    }

    if (window.confirm('❓ Supprimer cette note ?')) {
      try {
        await deleteNote(noteId);
      } catch (err) {
        alert('❌ Erreur lors de la suppression');
        console.error(err);
      }
    }
  };

  const handleChangePassword = async () => {
    if (!currentAdmin) return;

    if (!oldPassword || !newPassword || !confirmPassword) {
      alert('⚠️ Veuillez remplir tous les champs');
      return;
    }

    if (newPassword !== confirmPassword) {
      alert('❌ Les nouveaux mots de passe ne correspondent pas');
      return;
    }

    if (newPassword.length < 4) {
      alert('❌ Le mot de passe doit contenir au moins 4 caractères');
      return;
    }

    try {
      const result = await changePassword(
        currentAdmin.username,
        oldPassword,
        newPassword
      );

      if (result.success) {
        alert('✅ ' + result.message);
        setShowChangePassword(false);
        setOldPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setCurrentAdmin({ ...currentAdmin, password: newPassword });
      } else {
        alert('❌ ' + result.message);
      }
    } catch (err) {
      alert('❌ Erreur lors de la modification du mot de passe');
      console.error(err);
    }
  };

  const handleCancelChangePassword = () => {
    setShowChangePassword(false);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  // NOUVELLE FONCTION : Réinitialiser le mot de passe admin2
  const handleResetAdmin2Password = async () => {
    if (!currentAdmin || currentAdmin.username !== 'admin1') {
      alert('❌ Seul l\'admin principal peut réinitialiser le mot de passe admin2');
      return;
    }

    if (!resetAdmin2Password || !resetAdmin2Confirm) {
      alert('⚠️ Veuillez remplir tous les champs');
      return;
    }

    if (resetAdmin2Password !== resetAdmin2Confirm) {
      alert('❌ Les mots de passe ne correspondent pas');
      return;
    }

    if (resetAdmin2Password.length < 4) {
      alert('❌ Le mot de passe doit contenir au moins 4 caractères');
      return;
    }

    if (window.confirm('⚠️ Êtes-vous sûr de vouloir réinitialiser le mot de passe de admin2 (Kamel) ?')) {
      try {
        // On utilise changePassword avec un bypass pour admin1
const { ref, update } = await import('firebase/database');
const { database } = await import('../lib/firebase');

await update(ref(database, 'admins/admin2'), {
  password: resetAdmin2Password
});

        alert('✅ Mot de passe admin2 réinitialisé avec succès !');
        setShowResetAdmin2(false);
        setResetAdmin2Password('');
        setResetAdmin2Confirm('');
      } catch (err) {
        alert('❌ Erreur lors de la réinitialisation');
        console.error(err);
      }
    }
  };

  const handleCancelResetAdmin2 = () => {
    setShowResetAdmin2(false);
    setResetAdmin2Password('');
    setResetAdmin2Confirm('');
  };

  const handleCreateAnnouncement = async () => {
    if (!currentAdmin || !announcementContent.trim()) {
      alert('⚠️ Veuillez écrire un message');
      return;
    }

    const options: any = {};

    if (announcementType === 'specific-week') {
      const weekNum = parseInt(announcementSpecificWeek);
      if (!weekNum || weekNum < 1 || weekNum > 53) {
        alert('❌ Numéro de semaine invalide (1-53)');
        return;
      }
      options.specificWeek = weekNum;
    } else if (announcementType === 'week-range') {
      const startWeek = parseInt(announcementStartWeek);
      const endWeek = parseInt(announcementEndWeek);
      if (!startWeek || !endWeek || startWeek < 1 || endWeek > 53 || startWeek > endWeek) {
        alert('❌ Plage de semaines invalide');
        return;
      }
      options.startWeek = startWeek;
      options.endWeek = endWeek;
    }

    try {
      await addPublicAnnouncement(
        announcementContent.trim(),
        currentAdmin.displayName,
        currentAdmin.username,
        announcementType,
        announcementYear,
        options
      );
      
      setAnnouncementContent('');
      setAnnouncementType('pinned');
      setAnnouncementStartWeek('');
      setAnnouncementEndWeek('');
      setAnnouncementSpecificWeek('');
      setShowCreateAnnouncement(false);
      alert('✅ Annonce publiée avec succès !');
    } catch (err) {
      alert('❌ Erreur lors de la publication');
      console.error(err);
    }
  };

  const handleDeleteAnnouncement = async (announcementId: string) => {
    if (!currentAdmin) return;

    if (window.confirm('❓ Supprimer cette annonce publique ?')) {
      try {
        await deletePublicAnnouncement(announcementId);
      } catch (err) {
        alert('❌ Erreur lors de la suppression');
        console.error(err);
      }
    }
  };

  const getAnnouncementTypeLabel = (announcement: PublicAnnouncement): string => {
    if (announcement.displayType === 'pinned') {
      return '📌 Épinglée (toutes les semaines)';
    } else if (announcement.displayType === 'specific-week') {
      return `📅 Semaine ${announcement.specificWeek} / ${announcement.year}`;
    } else {
      return `📅 Semaines ${announcement.startWeek} à ${announcement.endWeek} / ${announcement.year}`;
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <div className="spinner"></div>
        <p>Chargement du planning...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <div className="error-box">
          <h2>⚠️ Erreur</h2>
          <p>{error}</p>
          <button onClick={loadSchedule} className="btn btn-primary">
            Réessayer
          </button>
        </div>
      </div>
    );
  }

  if (!schedule) {
    return <div>Aucun planning disponible</div>;
  }

  const weekTypeLabel = schedule.weekType === 'PAIR' ? 'Semaine paire' : 'Semaine impaire';
  const weekRange = getWeekRange(schedule);

  return (
    <div className="container">
      <header className="header">
        <h1 className="title">📅 Télétravail team chiffrage</h1>
        <p className="subtitle">
          Gestion automatique du télétravail - {getActivePeopleCount()} personnes
        </p>
        
        {/* Admin Button */}
        <div className="admin-toggle">
          {!currentAdmin ? (
            <button 
              onClick={() => setShowAdminLogin(!showAdminLogin)} 
              className="btn-admin-toggle"
            >
              🔐 Mode Admin
            </button>
          ) : (
            <div className="admin-header-info">
              <span className="admin-welcome">👋 Bonjour {currentAdmin.displayName}</span>
              <button 
                onClick={handleAdminLogout} 
                className="btn-admin-toggle active"
              >
                🚪 Déconnexion
              </button>
            </div>
          )}
        </div>

        {/* Admin Login Modal */}
        {showAdminLogin && !currentAdmin && (
          <div className="admin-login">
            <h3>🔐 Connexion Admin</h3>
            <div className="login-form">
              <input
                type="text"
                placeholder="Identifiant (admin1 ou admin2)"
                value={adminUsername}
                onChange={(e) => setAdminUsername(e.target.value)}
                className="admin-input"
              />
              <input
                type="password"
                placeholder="Mot de passe"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleAdminLogin()}
                className="admin-input"
              />
              <button onClick={handleAdminLogin} className="btn btn-primary">
                Se connecter
              </button>
              <div className="admin-info-box">
                <p><strong>👤 Comptes disponibles :</strong></p>
                <ul>
                  <li><strong>admin1</strong> : Loïc (Admin principal)</li>
                  <li><strong>admin2</strong> : Kamel</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Admin Panel */}
        {currentAdmin && (
          <div className="admin-panel">
            <h3>🔧 Panneau Admin</h3>
            
            {/* Actions Admin */}
            <div className="admin-actions">
              <button 
                onClick={() => setShowNotesPanel(!showNotesPanel)} 
                className="btn btn-primary"
              >
                {showNotesPanel ? '📝 Masquer les notes' : '📝 Afficher les notes'}
              </button>
              <button 
                onClick={() => setShowAnnouncementsPanel(!showAnnouncementsPanel)} 
                className="btn btn-info"
              >
                {showAnnouncementsPanel ? '📢 Masquer les annonces' : '📢 Gérer les annonces'}
              </button>
              <button 
                onClick={() => setShowChangePassword(!showChangePassword)} 
                className="btn btn-secondary"
              >
                🔑 Changer mon mot de passe
              </button>
              {currentAdmin.username === 'admin1' && (
                <button 
                  onClick={() => setShowResetAdmin2(!showResetAdmin2)} 
                  className="btn btn-warning"
                  style={{ background: 'var(--warning-color)' }}
                >
                  🔄 Réinitialiser mot de passe admin2
                </button>
              )}
              <button onClick={handleResetAll} className="btn btn-danger">
                🗑️ Réinitialiser tout le planning
              </button>
            </div>

            {/* Change Password Panel */}
            {showChangePassword && (
              <div className="change-password-panel">
                <h4>🔑 Modifier mon mot de passe</h4>
                <div className="change-password-form">
                  <div className="form-group">
                    <label>Ancien mot de passe</label>
                    <input
                      type="password"
                      value={oldPassword}
                      onChange={(e) => setOldPassword(e.target.value)}
                      placeholder="Entrez votre ancien mot de passe"
                      className="password-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Nouveau mot de passe</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Entrez le nouveau mot de passe"
                      className="password-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Confirmer le nouveau mot de passe</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Confirmez le nouveau mot de passe"
                      className="password-input"
                    />
                  </div>
                  <div className="password-actions">
                    <button onClick={handleChangePassword} className="btn btn-success">
                      ✅ Valider
                    </button>
                    <button onClick={handleCancelChangePassword} className="btn btn-secondary">
                      ❌ Annuler
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Reset Admin2 Password Panel - NOUVEAU */}
            {showResetAdmin2 && currentAdmin.username === 'admin1' && (
              <div className="change-password-panel" style={{ borderColor: 'var(--warning-color)' }}>
                <h4>🔄 Réinitialiser le mot de passe de admin2 (Kamel)</h4>
                <p style={{ color: 'var(--gray-600)', marginBottom: '1rem' }}>
                  En tant qu'admin principal, vous pouvez définir un nouveau mot de passe pour admin2.
                </p>
                <div className="change-password-form">
                  <div className="form-group">
                    <label>Nouveau mot de passe pour admin2</label>
                    <input
                      type="password"
                      value={resetAdmin2Password}
                      onChange={(e) => setResetAdmin2Password(e.target.value)}
                      placeholder="Entrez le nouveau mot de passe"
                      className="password-input"
                    />
                  </div>
                  <div className="form-group">
                    <label>Confirmer le nouveau mot de passe</label>
                    <input
                      type="password"
                      value={resetAdmin2Confirm}
                      onChange={(e) => setResetAdmin2Confirm(e.target.value)}
                      placeholder="Confirmez le nouveau mot de passe"
                      className="password-input"
                    />
                  </div>
                  <div className="password-actions">
                    <button onClick={handleResetAdmin2Password} className="btn btn-success">
                      ✅ Réinitialiser
                    </button>
                    <button onClick={handleCancelResetAdmin2} className="btn btn-secondary">
                      ❌ Annuler
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Notes Panel */}
            {showNotesPanel && (
              <div className="notes-panel">
                <h4>📝 Notes et Messages</h4>
                <p className="notes-description">
                  Laissez des messages pour communiquer entre admins.
                  <span className="shortcut-hint">💡 Astuce : <kbd>Ctrl</kbd> + <kbd>Entrée</kbd> pour envoyer</span>
                </p>

                {/* Ajouter une note */}
                <div className="add-note-form">
                  <textarea
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && e.ctrlKey) {
                        handleAddNote();
                      }
                    }}
                    placeholder="Écrivez votre message ici... (Ctrl+Entrée pour envoyer)"
                    rows={4}
                    className="note-textarea"
                  />
                  <button onClick={handleAddNote} className="btn btn-success">
                    📤 Envoyer la note
                  </button>
                </div>

                {/* Liste des notes */}
                <div className="notes-list">
                  {notes.length === 0 ? (
                    <p className="no-notes">📝 Aucune note pour le moment</p>
                  ) : (
                    notes.map((note) => (
                      <div key={note.id} className="note-item">
                        <div className="note-header">
                          <span className="note-author">{note.author}</span>
                          <span className="note-date">
                            {new Date(note.timestamp).toLocaleString('fr-FR')}
                          </span>
                        </div>
                        <div className="note-content">{note.content}</div>
                        {canDeleteNote(currentAdmin, note.authorUsername) && (
                          <button
                            onClick={() => handleDeleteNote(note.id, note.authorUsername)}
                            className="btn-delete-note"
                          >
                            🗑️ Supprimer
                          </button>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {/* Announcements Panel */}
            {showAnnouncementsPanel && (
              <div className="announcements-panel">
                <h4>📢 Gestion des Annonces Publiques</h4>
                <p className="announcements-description">
                  Créez des annonces visibles par tous les utilisateurs. Choisissez la période d'affichage.
                </p>

                <button 
                  onClick={() => {
                    setShowCreateAnnouncement(!showCreateAnnouncement);
                    if (!showCreateAnnouncement && schedule) {
                      setAnnouncementYear(schedule.year);
                    }
                  }} 
                  className="btn btn-success"
                  style={{ marginBottom: '1rem' }}
                >
                  {showCreateAnnouncement ? '❌ Annuler' : '➕ Créer une annonce'}
                </button>

                {/* Create Announcement Form */}
                {showCreateAnnouncement && (
                  <div className="create-announcement-form">
                    <div className="form-group">
                      <label>Message de l'annonce</label>
                      <textarea
                        value={announcementContent}
                        onChange={(e) => setAnnouncementContent(e.target.value)}
                        placeholder="Écrivez votre annonce..."
                        rows={3}
                        className="announcement-textarea"
                      />
                    </div>

                    <div className="form-group">
                      <label>Type d'affichage</label>
                      <select 
                        value={announcementType} 
                        onChange={(e) => setAnnouncementType(e.target.value as any)}
                        className="announcement-select"
                      >
                        <option value="pinned">📌 Épinglée (toutes les semaines)</option>
                        <option value="specific-week">📅 Semaine spécifique</option>
                        <option value="week-range">📅 Plage de semaines</option>
                      </select>
                    </div>

                    {announcementType !== 'pinned' && (
                      <div className="form-group">
                        <label>Année</label>
                        <input
                          type="number"
                          min="2024"
                          max="2030"
                          value={announcementYear}
                          onChange={(e) => setAnnouncementYear(parseInt(e.target.value) || new Date().getFullYear())}
                          placeholder="Ex: 2025"
                          className="announcement-input"
                        />
                        <small style={{ color: 'var(--gray-600)', fontSize: '0.85rem' }}>
                          💡 Année par défaut : celle de la semaine affichée ({schedule?.year || new Date().getFullYear()}). Vous pouvez la modifier.
                        </small>
                      </div>
                    )}

                    {announcementType === 'specific-week' && (
                      <div className="form-group">
                        <label>Numéro de semaine (1-53)</label>
                        <input
                          type="number"
                          min="1"
                          max="53"
                          value={announcementSpecificWeek}
                          onChange={(e) => setAnnouncementSpecificWeek(e.target.value)}
                          placeholder="Ex: 42"
                          className="announcement-input"
                        />
                      </div>
                    )}

                    {announcementType === 'week-range' && (
                      <div className="week-range-inputs">
                        <div className="form-group">
                          <label>Semaine de début</label>
                          <input
                            type="number"
                            min="1"
                            max="53"
                            value={announcementStartWeek}
                            onChange={(e) => setAnnouncementStartWeek(e.target.value)}
                            placeholder="Ex: 40"
                            className="announcement-input"
                          />
                        </div>
                        <div className="form-group">
                          <label>Semaine de fin</label>
                          <input
                            type="number"
                            min="1"
                            max="53"
                            value={announcementEndWeek}
                            onChange={(e) => setAnnouncementEndWeek(e.target.value)}
                            placeholder="Ex: 45"
                            className="announcement-input"
                          />
                        </div>
                      </div>
                    )}

                    <button onClick={handleCreateAnnouncement} className="btn btn-success">
                      📢 Publier l'annonce
                    </button>
                  </div>
                )}

                {/* List of All Announcements */}
                <div className="announcements-list">
                  <h5>📋 Toutes les annonces</h5>
                  {allAnnouncements.length === 0 ? (
                    <p className="no-announcements">📢 Aucune annonce pour le moment</p>
                  ) : (
                    allAnnouncements.map((announcement) => (
                      <div key={announcement.id} className="announcement-item">
                        <div className="announcement-header">
                          <span className="announcement-author">{announcement.author}</span>
                          <span className="announcement-type">{getAnnouncementTypeLabel(announcement)}</span>
                        </div>
                        <div className="announcement-content">{announcement.content}</div>
                        <div className="announcement-footer">
                          <span className="announcement-date">
                            {new Date(announcement.timestamp).toLocaleString('fr-FR')}
                          </span>
                          <button
                            onClick={() => handleDeleteAnnouncement(announcement.id)}
                            className="btn-delete-announcement"
                          >
                            🗑️ Supprimer
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </header>

      <div className="week-info">
        <div className={`week-badge ${schedule.weekType === 'PAIR' ? 'week-even' : 'week-odd'}`}>
          <span className="week-label">{weekTypeLabel}</span>
        </div>

        {/* Public Announcements Display */}
        {publicAnnouncements.length > 0 && (
          <div className="public-announcements-display">
            <h3>📢 Annonces</h3>
            {publicAnnouncements.map((announcement) => (
              <div key={announcement.id} className="public-announcement-item">
                <div className="public-announcement-header">
                  <span className="public-announcement-author">👤 {announcement.author}</span>
                  <span className="public-announcement-date">
                    {new Date(announcement.timestamp).toLocaleDateString('fr-FR')}
                  </span>
                </div>
                <div className="public-announcement-content">{announcement.content}</div>
              </div>
            ))}
          </div>
        )}

        <div className="week-details">
          <span className="week-number">
            Semaine <strong>{schedule.weekNumber}</strong> - {schedule.year}
          </span>
          <span className="week-range">{weekRange}</span>
        </div>
      </div>

      <div className="navigation">
        <button onClick={handlePreviousWeek} className="btn btn-nav btn-prev">
          ← Semaine précédente
        </button>

        {weekOffset !== 0 && (
          <button onClick={handleCurrentWeek} className="btn btn-nav btn-current">
            📍 Semaine actuelle
          </button>
        )}

        <button onClick={handleNextWeek} className="btn btn-nav btn-next">
          Semaine suivante →
        </button>
      </div>

      <div className="schedule-container">
        <table className="schedule-table">
          <thead>
            <tr>
              <th className="col-day">Jour</th>
              <th className="col-date">Date</th>
              <th className="col-person">Personne en télétravail</th>
              <th className="col-status">Statut</th>
              {currentAdmin && <th className="col-actions">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {schedule.days.map((day, index) => {
              const dayDate = new Date(day.date);
              const holiday = getHoliday(dayDate);
              
              return (
                <tr
                  key={index}
                  className={`${day.isRemote ? 'row-remote' : 'row-office'} ${holiday ? 'row-holiday' : ''}`}
                >
                  <td className="day-name">
                    {day.dayName}
                    {holiday && (
                      <span className="holiday-indicator" title={holiday.name}>
                        {' '}{holiday.emoji}
                      </span>
                    )}
                  </td>
                  <td className="day-date">
                    {formatDate(day.date)}
                    {holiday && (
                      <div className="holiday-name">{holiday.name}</div>
                    )}
                  </td>
                  <td className="person-name">
                    {editingDay === index ? (
                      <input
                        type="text"
                        value={newPersonName}
                        onChange={(e) => setNewPersonName(e.target.value)}
                        className="edit-input"
                        placeholder="Nom ou vide"
                        autoFocus
                      />
                    ) : (
                      <>
                        {day.personName !== '—' ? (
                          <span className="person-tag">{day.personName}</span>
                        ) : (
                          <span className="no-person">
                            {holiday ? `${holiday.emoji} Férié` : '—'}
                          </span>
                        )}
                      </>
                    )}
                  </td>
                  <td className="status-cell">
                    <span
                      className={`badge ${
                        holiday ? 'badge-holiday' :
                        day.isRemote ? 'badge-remote' : 'badge-office'
                      }`}
                    >
                      {holiday ? '🎉 Jour férié' : 
                       day.isRemote ? 'À domicile' : 'Au bureau'}
                    </span>
                  </td>
                  {currentAdmin && (
                    <td className="actions-cell">
                      {editingDay === index ? (
                        <>
                          <button 
                            onClick={handleSaveEdit} 
                            className="btn-action btn-save"
                          >
                            ✓
                          </button>
                          <button 
                            onClick={handleCancelEdit} 
                            className="btn-action btn-cancel"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <button 
                          onClick={() => handleEditDay(index, day.personName)} 
                          className="btn-action btn-edit"
                        >
                          ✏️
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="actions">
        <button onClick={handleExportPDF} className="btn btn-primary btn-pdf">
          📄 Télécharger le PDF
        </button>
      </div>

      <div className="rules">
        <h3>📋 Règles du planning</h3>
        <ul>
          <li>
            🔄 <strong>Rotation automatique</strong> : Jours aléatoires pour chaque semaine
          </li>
          <li>
            👥 <strong>{getActivePeopleCount()} personnes</strong> :{' '}
            {PEOPLE_CONFIG.filter(p => p.active).map(p => p.name).join(', ')}
          </li>
          <li>
            ⚡ <strong>Équitable</strong> : Personne ne télétravaille 2 semaines consécutives
          </li>
          <li>
            📅 <strong>3 personnes par semaine</strong> : Mardi, Mercredi, Jeudi
          </li>
          <li>🚫 Pas de télétravail le lundi ni le vendredi</li>
          <li>🎲 Jours attribués aléatoirement à chaque semaine</li>
          <li>💾 Planning sauvegardé automatiquement dans Firebase</li>
          <li>🕐 Respect des horaires : 8h-17h OU 9h-18h avec 1h de pause déjeuner 🍽️</li>
          <li>🎯 Objectif : Minimum 20 devis par jour (quand les conditions le permettent)</li>
          <li>🎉 Jours fériés français automatiquement détectés</li>
        </ul>
      </div>

      <div className="sync-info">
        🔄 Dernière mise à jour : {new Date(schedule.lastUpdated).toLocaleString('fr-FR')}
      </div>

      <footer className="footer">
        <p className="signature">
          Application développée par <span className="author-name">Loïc.L</span> avec Next.js, React & Firebase
        </p>
        <p className="version">
          Version 1.0.0 • {new Date().toLocaleDateString('fr-FR')}
        </p>
      </footer>
    </div>
  );
}