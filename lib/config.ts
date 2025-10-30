/**
 * Configuration des personnes pour le planning de télétravail
 * Modifiez uniquement les noms dans ce fichier pour changer les personnes
 */

export interface PersonConfig {
  id: string;
  name: string;
  active: boolean;
}

// Configuration des 6 personnes
// Pour changer un nom, modifiez uniquement la propriété "name"
// Pour désactiver une personne, mettez "active: false"
export const PEOPLE_CONFIG: PersonConfig[] = [
  {
    id: "person1",
    name: "Fabien",
    active: true
  },
  {
    id: "person2",
    name: "Gilbert",
    active: true
  },
  {
    id: "person3",
    name: "Vincent",
    active: true
  },
  {
    id: "person4",
    name: "Maurice",
    active: true
  },
  {
    id: "person5",
    name: "Place réservée",
    active: true
  },
  {
    id: "person6",
    name: "Place réservée 2",
    active: true
  }
];

/**
 * Obtenir la liste des personnes actives
 */
export function getActivePeople(): string[] {
  return PEOPLE_CONFIG
    .filter(person => person.active)
    .map(person => person.name);
}

/**
 * Obtenir le nombre total de personnes actives
 */
export function getActivePeopleCount(): number {
  return PEOPLE_CONFIG.filter(person => person.active).length;
}

/**
 * Obtenir une personne par son ID
 */
export function getPersonById(id: string): PersonConfig | undefined {
  return PEOPLE_CONFIG.find(person => person.id === id);
}

/**
 * Obtenir une personne par son nom
 */
export function getPersonByName(name: string): PersonConfig | undefined {
  return PEOPLE_CONFIG.find(person => person.name === name);
}