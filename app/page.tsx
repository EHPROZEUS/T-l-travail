'use client';

import { useState, useEffect } from 'react';
import { 
  getOrGenerateSchedule, 
  listenToSchedule, 
  WeekSchedule, 
  formatDate, 
  getWeekRange 
} from '../lib/planningService';
import { exportToPDF } from '../lib/pdfExport';
import '../styles/globals.css';

export default function Home() {
  const [schedule, setSchedule] = useState<WeekSchedule | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadSchedule();
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
        <p className="subtitle">Gestion automatique du télétravail - 5 personnes</p>
      </header>

      <div className="week-info">
        <div className={`week-badge ${schedule.weekType === 'PAIR' ? 'week-even' : 'week-odd'}`}>
          <span className="week-label">{weekTypeLabel}</span>
        </div>
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
            </tr>
          </thead>
          <tbody>
            {schedule.days.map((day, index) => (
              <tr
                key={index}
                className={day.isRemote ? 'row-remote' : 'row-office'}
              >
                <td className="day-name">{day.dayName}</td>
                <td className="day-date">{formatDate(day.date)}</td>
                <td className="person-name">
                  {day.personName !== '—' ? (
                    <span className="person-tag">{day.personName}</span>
                  ) : (
                    <span className="no-person">—</span>
                  )}
                </td>
                <td className="status-cell">
                  <span
                    className={`badge ${
                      day.isRemote ? 'badge-remote' : 'badge-office'
                    }`}
                  >
                    {day.isRemote ? 'À domicile' : 'Au bureau'}
                  </span>
                </td>
              </tr>
            ))}
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
            ✅ <strong>Gilbert</strong> : télétravail fixe le mercredi (toutes les semaines)
          </li>
          <li>
            🔄 <strong>Semaines paires</strong> : Vincent (mardi) et Maurice (jeudi)
          </li>
          <li>
            🔄 <strong>Semaines impaires</strong> : Place réservée (mardi) et Fabien (jeudi)
          </li>
          <li>🚫 Pas de télétravail le lundi ni le vendredi</li>
          <li>👤 Maximum 1 personne en télétravail par jour</li>
          <li>💾 Planning sauvegardé automatiquement dans Firebase</li>
        </ul>
      </div>

      <div className="sync-info">
        🔄 Dernière mise à jour : {new Date(schedule.lastUpdated).toLocaleString('fr-FR')}
      </div>

      <footer className="footer">
        <p>Application développée avec Next.js, React & Firebase</p>
        <p className="version">
          Version 1.0.0 • {new Date().toLocaleDateString('fr-FR')}
        </p>
      </footer>
    </div>
  );
}