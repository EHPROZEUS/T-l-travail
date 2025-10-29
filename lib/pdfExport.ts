import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { WeekSchedule, formatDate } from './planningService';

export function exportToPDF(schedule: WeekSchedule): void {
  const doc = new jsPDF();
  
  // Titre
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text('Télétravail team chiffrage', 105, 20, { align: 'center' });
  
  // Sous-titre
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  const weekTypeLabel = schedule.weekType === 'PAIR' ? 'Semaine paire' : 'Semaine impaire';
  doc.text(`Semaine ${schedule.weekNumber} - ${schedule.year} (${weekTypeLabel})`, 105, 30, { align: 'center' });
  
  // Préparer les données du tableau
  const tableData = schedule.days.map(day => [
    day.dayName,
    formatDate(day.date),
    day.personName,
    day.isRemote ? 'À domicile' : 'Au bureau'
  ]);
  
  // Générer le tableau
  autoTable(doc, {
    startY: 40,
    head: [['Jour', 'Date', 'Personne', 'Statut']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      halign: 'center'
    },
    columnStyles: {
      0: { fontStyle: 'bold' }
    },
    didParseCell: function(data) {
      if (data.column.index === 3 && data.section === 'body') {
        const isRemote = tableData[data.row.index][3] === 'À domicile';
        if (isRemote) {
          data.cell.styles.fillColor = [220, 252, 231];
          data.cell.styles.textColor = [22, 101, 52];
        } else {
          data.cell.styles.fillColor = [254, 243, 199];
          data.cell.styles.textColor = [146, 64, 14];
        }
      }
    }
  });
  
  // Footer
  const finalY = (doc as any).lastAutoTable.finalY || 100;
  doc.setFontSize(8);
  doc.setTextColor(128);
  doc.text(
    `Généré le ${new Date().toLocaleDateString('fr-FR')} à ${new Date().toLocaleTimeString('fr-FR')}`, 
    105, 
    finalY + 15, 
    { align: 'center' }
  );
  
  // Télécharger le PDF
  const filename = `planning_semaine_${schedule.weekNumber}_${schedule.year}.pdf`;
  doc.save(filename);
}