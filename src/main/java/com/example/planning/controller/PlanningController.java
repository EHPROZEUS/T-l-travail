package com.example.planning.controller;

import com.example.planning.model.Planning;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.*;

@Controller
public class PlanningController {

    private final Map<String, String> planningPaire = Map.of(
        "MARDI", "Vincent",
        "MERCREDI", "Gilbert",
        "JEUDI", "Maurice"
    );

    private final Map<String, String> planningImpaire = Map.of(
        "MARDI", "Fabien",
        "MERCREDI", "Gilbert",
        "JEUDI", "Place réservée"
    );

    @GetMapping("/")
    public String home(Model model) {
        LocalDate today = LocalDate.now();
        int week = today.getDayOfYear() / 7 + 1;
        boolean isPaire = (week % 2 == 0);

        Map<String, String> planning = isPaire ? planningPaire : planningImpaire;

        List<Planning> semaine = new ArrayList<>();
        LocalDate lundi = today.minusDays(today.getDayOfWeek().getValue() - 1);

        String[] jours = {"LUNDI", "MARDI", "MERCREDI", "JEUDI", "VENDREDI"};
        for (int i = 0; i < 5; i++) {
            String jour = jours[i];
            String personne = (i == 0 || i == 4) ? "" : planning.getOrDefault(jour, "");
            semaine.add(new Planning(jour, personne, lundi.plusDays(i)));
        }

        model.addAttribute("semaine", semaine);
        model.addAttribute("isPaire", isPaire);
        model.addAttribute("aujourdHui", today.format(DateTimeFormatter.ofPattern("dd MMMM yyyy", java.util.Locale.FRENCH)));

        return "index";
    }
}