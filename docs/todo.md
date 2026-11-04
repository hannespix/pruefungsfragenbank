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
- [x] **Warnungen zur Prüfungsordnung mit Lösungsvorschlag.** Verstöße stehen als rote Karten immer sichtbar über dem Editor, offene Punkte und Bestätigungen in „Pflichtangaben & Vorgaben“. Jede Karte hat einen Lösungsknopf:
  - Zeit überschritten → „Zeit von Aufgabe N ändern“ und „Zeitplan ansehen“. Quellzeiten werden nie automatisch gekürzt.
  - Aufgaben fehlen → „Fehlende Aufgaben vorschlagen“.
  - Punkte offen → „Punkte verteilen“.
  - Kombinationsaufgabe oder doppeltes Thema → „Aufgabe ansehen“ und „Einzelaufgaben vorschlagen“.
  - Mündliche Aufgabe fehlt → Vorschlag.
  - Bestätigungen zur Prüfungsverordnung erscheinen gesammelt mit „Jetzt bestätigen“.
  - Material und Freigabe → direkt ins richtige Feld.
- [x] **Aufgabeneditor in fünf Schritten.** Die Schritte sind Aufgabe → Punkte & Zeit → Lösung → Material & Anlagen → Freigabe. Jeder Schritt hat einen Haken, sobald er vollständig ist. „Weiter“ und „Zurück“ führen durch die Schritte, „Speichern“ geht jederzeit. Bei einem Speicherfehler springt der Editor zum betroffenen Schritt. Fachrichtung, Prüfungsart, Bestandteil und Übernahme-Hinweise sind eingeklappt.
- [x] **Drag & Drop per Tastatur und Touch.**
  - Tastatur: Leertaste nimmt einen Baustein auf, die Pfeiltasten verschieben ihn, Leertaste legt ab und Esc bricht ab. Alt+Pfeil verschiebt direkt. Jeder Schritt wird für Screenreader angesagt.
  - Touch: kurz gedrückt halten, ziehen, loslassen. Die Vorschau folgt dem Finger, das Blatt scrollt am Rand mit. Ein schnelles Wischen scrollt weiterhin.
- [x] **Drag & Drop überall geprüft und verbessert (Maus und Touch).**
  - Genaue Position: Die obere oder untere Hälfte eines Blatts entscheidet über „davor“ oder „danach“, bei Bausteinen die linke oder rechte Hälfte. Eine Einfügelinie zeigt die Stelle, das Deckblatt bedeutet „an den Anfang“.
  - Ersetzen per Ziehen: Belegte Themen und andere Ausführungen lassen sich auf die Prüfung ziehen. Nach einer Rückfrage wird ersetzt, die betroffenen Bausteine leuchten vorher auf.
  - Leiste „Hier ablegen“ bei jedem Ziehen:
    - mit offenen Themenplätzen und „Ans Ende“;
    - für Aufgaben aus der Prüfung zusätzlich „Entfernen“ (rückgängig mit Strg+Z);
    - auf dem Handy der Weg, Aufgaben zu ziehen, weil Liste und Blatt dort getrennte Ansichten sind;
    - bricht um, statt über den Bildschirmrand zu ragen.
  - Jedes Blatt hat einen Griff: Aufgaben lassen sich direkt auf dem Blatt verschieben. Der Baukasten folgt der Reihenfolge auf dem Blatt.
  - Automatisches Scrollen am Rand von Blatt, Aufgabenliste und Seite: Es läuft auch bei ruhendem Finger weiter und wird schneller, je näher man dem Rand kommt.
  - Touch:
    - Langes Drücken wirkt auch auf der Vorschau-Miniatur, Griffe starten sofort.
    - Die Vorschau schwebt über dem Finger.
    - Die Meldungsleiste verdeckt das Ablageziel nicht mehr.
  - Ablegen außerhalb eines Ziels fügt keinen Text ein, eine verweigerte Ablage wackelt und zeigt den Grund.
- [x] **WYSIWYG-Vorschau der Aufgaben in der Liste.** Jede Karte, auch jede „Andere Ausführung“, zeigt ein Miniatur-Blatt aus dem echten Blatt-Renderer. „Vorschau“ öffnet das ganze Blatt mit Grafiken, Umschalter zwischen allen Ausführungen, Themen- und Punktechips sowie „Zur Prüfung hinzufügen“, „Für dieses Thema ersetzen“ oder „Als Vorlage verwenden“.
- [x] **Neue Aufgaben einfacher erstellen.**
  - Schnellstart mit drei Wegen:
    - „Text einfügen“ aus Word oder PDF; Titel, Teilpunkte, Gesamtpunkte, Zeit und Lösung werden erkannt.
    - „Mit Gerüst beginnen“: Aufgabe – Hier – Planen, Durchführen, Kontrollieren.
    - „Ähnliche Aufgabe als Vorlage“.
  - Live-Vorschau des Blatts neben dem Formular; auf schmalen Bildschirmen per Knopf „Vorschau“.
  - Das Thema aus der aktuellen Auswahl wird vorbelegt.
- [x] **Rückfrage bei ungespeicherten Eingaben.** Esc, ✕ und „Abbrechen“ zeigen eine Karte mit „Weiter bearbeiten“, „Verwerfen“ und „Speichern“. Auch beim Verlassen der Seite wird gefragt.
- [x] **Kleine Bildschirme (Surface, Tablet, Laptop).**
  - Der Knopf „Vollbild“ blendet Navigation, Überschriften, Schritte und Statuszeile aus. Auf Tablets nutzt er echtes Browser-Vollbild.
  - Im Vollbild lässt sich die Aufgabenliste ausblenden, und ein Hinweis-Chip zeigt den Stand der Prüfungsordnung.
  - Der Baukasten lässt sich einklappen; bei wenig Höhe, im Vollbild oder wenn alles belegt ist, ist er automatisch eine kompakte Zeile.
  - Auf niedrigen Bildschirmen sind Kopf und Schritte kompakter, und der Arbeitsbereich ist höher.
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
