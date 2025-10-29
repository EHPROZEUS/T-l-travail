package com.example.planning.model;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;

public class Planning {
    private final String jour;
    private final String personne;
    private final LocalDate date;

    public Planning(String jour, String personne, LocalDate date) {
        this.jour = jour;
        this.personne = personne;
        this.date = date;
    }

    public String getJour() { return jour; }
    public String getPersonne() { return personne; }
    public String getDateFr() {
        return date.format(DateTimeFormatter.ofPattern("dd/MM"));
    }
    public boolean isTeletravail() { return personne != null && !personne.isEmpty(); }
}