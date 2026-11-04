# Todo-Liste

Lebende Liste der gewünschten Verbesserungen. Erledigtes wird abgehakt und mit dem PR verknüpft.
Jedes Paket geht als eigener PR raus und wird nach grüner CI automatisch gemergt.

## Bedienung & Gestaltung

- [x] **Undo/Redo mit Verlauf.** Große Buttons „Rückgängig“ und „Wiederholen“ in der Kopfleiste, dazu eine Verlaufsliste mit Klartext-Schritten („Aufgabe „X“ zur Prüfung hinzugefügt“) und Uhrzeit. Ein Klick springt zu einem beliebigen Stand. Tastenkürzel: Strg+Z und Strg+Umschalt+Z bzw. Strg+Y; in Textfeldern gilt das Rückgängig des Browsers. Funktioniert offline und online. Nach „Aktualisieren“, „Anderes Projekt öffnen“ und endgültigem Löschen beginnt der Verlauf neu, damit nie fremde Stände überschrieben werden.
- [x] **„Aufgaben automatisch ergänzen“ gut erkennbar.** Der Button hatte weiße Schrift auf hellgrünem Grund.
- [x] **Leerseiten im Bearbeitungsmodus ausblenden.** Leere Rückseiten für den Duplexdruck erscheinen nur noch als schmale Markierung. Originalseiten ohne bearbeitbaren Text sind eingeklappt („Anzeigen“). Gedruckt wird unverändert.
- [x] **Hinweis „Text passt nicht in die Originalvorlage“ lesbar.** Statt des abgeschnittenen Browser-Tooltips zeigt der Editor eine Warnkarte mit „Zur Stelle springen“ und, bei geänderten Stellen, „Originaltext wiederherstellen“. Betroffene Stellen tragen ein Etikett „zu viel Text“.
- [x] **Baukasten-Oberfläche.** Aufgaben als grafische Bausteine (Thema mit Farbe und Symbol, Punkte, Minuten, Status auf einen Blick). Die Prüfung als Baukasten-Fläche mit einem Platz pro gefordertem Thema („hier fehlt noch: Vermehren von Pflanzen“). Weniger Formularfelder, Details erst bei Bedarf. *Erster Schritt umgesetzt: Baukasten über dem Blatt, farbige Bausteine mit Symbol in der Aufgabenliste. Weitere Vereinfachung der Formulare folgt.*
- [x] **Drag & Drop mit Animation.** Bausteine aus der Liste auf die Prüfung ziehen, mit Vorschau beim Ziehen, hervorgehobenen Zielplätzen, Einfüge-Linie, „Einrasten“-Animation und sanftem Nachrücken beim Umsortieren. Auf Touch-Geräten weiterhin per Tippen.
- [ ] **Warnungen zur Prüfungsordnung mit Lösungsvorschlag.** Jeder Verstoß als Karte mit Ein-Klick-Lösung, wo eine eindeutige Korrektur möglich ist. Beispiele: Zeit überschritten → „Zeiten automatisch vorschlagen“; Thema fehlt → „Passende Aufgabe ergänzen“; Punkte fehlen → „Punkte verteilen“; Kombinationsaufgabe in der ZP → „Durch Einzelaufgabe ersetzen“.
- [ ] Rückfrage beim Schließen des Aufgabeneditors mit ungespeicherten Eingaben (Esc / ✕ / Abbrechen).
- [ ] Rund 20 Formularfeldern fehlt ein `<label for>` (Barrierefreiheit).

## Technik & Sicherheit (aus `docs/code-audit-2026-11.md`)

- [ ] Flask-App stilllegen oder mit Anmeldung absichern.
- [ ] Verschlüsseltes Paket `offline/pages/sealed/` aus dem öffentlichen Repo entfernen, falls nicht mehr benötigt.
- [ ] Monotone Datensatzversionen im Worker (ABA nach Löschen und Neuanlegen).
- [ ] Schreibschutz pro Datensatz statt über die globale Uhr (falsche 409-Konflikte).
- [ ] Eigene Domain statt `hannespix.github.io` als `ALLOWED_ORIGIN`.
- [ ] Cloudflare- und Anthropic-Secrets in ein geschütztes GitHub-Environment; Actions per SHA pinnen.
- [ ] `wrangler` auf 4.157+ aktualisieren (`undici`-Advisories).
- [ ] Geplanter Job zum Aufräumen alter Sessions und verwaister Anlagen in D1.
- [ ] `app.js` und `worker.js` lesbar formatieren und nach Ansichten aufteilen.
