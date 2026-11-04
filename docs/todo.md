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
- [x] **Entwürfe löschen für die zuständige Stelle vereinfacht.**
  - „Löschen“ direkt in jeder Zeile unter „Prüfungen & Ergebnisse“. Der Entwurf wandert ohne Umweg in den Papierkorb, eine Leiste mit „Rückgängig“ holt ihn sofort zurück.
  - „Mehrere Entwürfe löschen …“: einzelne, alle oder nur die leeren Entwürfe auswählen und in einem Schritt verschieben.
  - Der Papierkorb ist nach Löschdatum sortiert und hat „Alle wiederherstellen“ und „Papierkorb leeren“ (eine Bestätigung für alle).
  - Eingesetzte Prüfungen bleiben geschützt, Arbeitsgruppen sehen die Aufräum-Funktionen nicht.
- [x] **Originalseiten: Inhalt rutscht nach unten statt kleinerer Schrift.**
  - Bearbeiteter Text behält seine Schriftgröße. Alles darunter rutscht mit: Text, Logos und der Hintergrund mit Rahmen, Linien, Tabellen und Planungsfeldern.
  - Tabellenzeilen wachsen mit, senkrechte Linien laufen durch, nebeneinanderliegende Zellen zählen nur einmal.
  - Leere, umrahmte Planungsflächen (z. B. „Stichwortartige Durchführungsplanung“) werden kleiner statt verschoben. Ihr unterer Rand und die Fußzeile bleiben stehen, Schreiblinien rücken gleichmäßig zusammen.
  - Absätze, die im PDF um etwa einen Punkt überlappen, rutschen zuverlässig mit. Neue Zeilen in Aufzählungen stehen unter dem Text, nicht unter dem Aufzählungszeichen.
  - Erst wenn der Platz bis zum Seitenende nicht reicht, wird die Stelle markiert und der Druck gesperrt.
  - Gleiches Verhalten in Editor, Druckvorschau, Druckdatei und Live-Vorschau des Aufgabenfensters.
  - Neue Zeilen:
    - im Blatt mit Enter oder „+ Zeile“ am aktiven Abschnitt;
    - im Aufgabenfenster mit „+ Neue Zeile“ pro Abschnitt, die Live-Vorschau zeigt Änderungen sofort.
  - Offen: frei platzierbare zusätzliche Textfelder an beliebiger Stelle einer Originalseite.
- [x] **Arbeitsgruppen legen selbst neue Aufgaben an.**
  - „Eigene Aufgabe schreiben“ im Prüfungsblatt, „Aufgabe anlegen“ in der Aufgabenbank, „Als Vorlage verwenden“ und „Mündliche Aufgabe anlegen“ stehen jetzt auch Arbeitsgruppen zur Verfügung. Die neue Aufgabe landet direkt im eigenen Prüfungsentwurf.
  - Neue Aufgaben einer Gruppe bleiben Entwürfe, die fachliche Freigabe erteilt die zuständige Stelle.
  - Der Server erlaubt Gruppen nur neue Aufgaben und Aufgabenfamilien:
    - nur für die eigene Fachrichtung und die freigegebenen Prüfungsarten;
    - nur mit sichtbaren Quellen und Anlagen;
    - keine Änderung bestehender Bankaufgaben;
    - keine Freigaben.
  - Die Knöpfe erscheinen für Gruppen erst, wenn der Server die Funktion meldet (`capabilities: ['group-tasks']`). Der Worker wird getrennt von den Pages ausgeliefert: per Knopf über den GitHub-Workflow „Worker ausrollen“ (Actions → Worker ausrollen → Run workflow, „ausrollen“ eintippen) oder lokal mit `wrangler deploy --config online/wrangler.jsonc`.
  - Offen: Grafiken und Pläne können Gruppen weiterhin nicht hochladen.
- [x] **Alle Prüfungen eines Termins als ZIP exportieren (zuständige Stelle).**
  - Knopf „Alle Prüfungen dieses Termins exportieren (ZIP)“ unter „Prüfungen & Ergebnisse“.
  - Aufbau: `<Termin>/<Fachrichtung>/<NN>_<Prüfungsart> <Titel>/`. Je Prüfung liegen dort Prüfungsbogen, Lösung & Bewertung, Materialliste, interne Bemerkungen und Zeitplan (jeweils Word und Druckfassung) sowie die Anlagen.
  - Je Fachrichtung `00_Materialuebersicht.html`, oben `00_Uebersicht.html` mit Links und Stand sowie `LESEN.txt`.
  - Zusätzlich jede Aufgabe einzeln (Prüfungsbogen und Lösung) und die Materialliste je praktischer Aufgabe als eigene Word-Datei. Eindeutige Dateinamen nach dem Muster `ZP Baumschule - Gruppe Nord - A1 <Aufgabe> - Pruefungsbogen.docx`, Pfade für Windows kurz genug.
  - Prüfungen ohne Aufgaben und Prüfungen, die sich nicht ausgeben ließen, stehen mit Grund in der Übersicht; der Rest wird trotzdem exportiert.
- [ ] Rund 20 Formularfeldern fehlt ein `<label for>` (Barrierefreiheit).

## Anwenderwünsche vom 4. November 2026

Aus den Rückmeldungen der Aufgabenersteller, präzisiert. Reihenfolge = Umsetzungsreihenfolge.

1. [x] **Flexiblere Aufgabenauswahl.**
   - **Ziel:** Eine bestimmte Aufgabe finden, ohne die Kategorie zu kennen.
   - **Umsetzung:**
     - Die Suche durchsucht immer alle Themen der Prüfung.
     - Gibt es zu wenige Treffer, bietet die Liste „Weitere aus …“ an: aus anderen Themen, aus der anderen Prüfungsart (z. B. Abschlussprüfungsaufgaben in der Zwischenprüfung) und, für die zuständige Stelle, aus anderen Fachrichtungen.
     - Aufgaben, die nicht direkt passen, werden mit „Für diese Prüfung übernehmen“ als neue Variante kopiert. Die Kopie erscheint als Entwurf zur Freigabe, die Herkunft bleibt nachvollziehbar, Regeln und Freigaben bleiben gewahrt.
   - **Fertig wenn:**
     - Suchbegriffe ohne Treffer im Thema zeigen Treffer aus anderen Bereichen mit Herkunftsangabe.
     - Eine AP-Aufgabe lässt sich in einer ZP mit einem Klick als ZP-Variante übernehmen, auch von Arbeitsgruppen.
2. [x] **Übersichtlichere Aufgabenauswahl im Papier-Look.**
   - **Ziel:** weniger Unterfenster, kein Gedränge in der schmalen Seitenleiste.
   - **Umsetzung:**
     - Große Aufgabenauswahl als breite Ansicht neben dem Blatt mit Kartenraster, Miniaturvorschau, Filterleiste oben (Thema, Prüfungsart, Jahr) und Aktionen direkt auf der Karte.
     - Das Blatt wirkt wie in Word: grauer Arbeitsbereich, zentrierte Seiten, schlanke Werkzeugleiste oben.
   - **Fertig wenn:** Aufgaben werden ohne verschachtelte Aufklapper gefunden, verglichen und hinzugefügt, am Laptop wie am Tablet.
3. [x] **Historienzentriertes Arbeiten aus dem Archiv, auch für Arbeitsgruppen.**
   - **Ziel:** Prüfungen aus früheren Jahrgängen heraus erstellen.
   - **Umsetzung:**
     - Die Aufgabenauswahl erhält die Ansicht „Archiv nach Jahr“: Aufgaben, gruppiert nach Quelljahr und letztem Einsatz, mit optionalem Themenfilter darüber.
     - Nutzbar für Arbeitsgruppen mit den Aufgaben ihrer Fachrichtung.
     - Original-PDFs bleiben vorerst der zuständigen Stelle vorbehalten.
   - **Fertig wenn:** Eine Gruppe wählt „2023“ und übernimmt daraus Aufgaben in ihren Entwurf.
4. [x] **Textbearbeitung wie in Word.**
   - **Umsetzung:**
     - Werkzeugleiste für Textfelder auf dem Blatt: Aufzählung, Nummerierung, Einzug vergrößern/verkleinern, neue Zeile. Listen erscheinen in Blatt, Druck und Word mit hängendem Einzug.
     - Originalseiten:
       - bearbeitete Abschnitte nutzen die Breite der Textspalte, statt an der zufälligen PDF-Zeilenbreite umzubrechen;
       - die Breite lässt sich am rechten Rand ziehen und rastet an Seitenrand und Spaltenkanten ein.
   - **Fertig wenn:** Listen lassen sich ohne Tippen von Zeichen anlegen, und Zeilen brechen nicht mehr unerwartet früh um.
   - **Stand:** erledigt in zwei Teilen – (1) Werkzeugleiste mit Aufzählung, Nummerierung, Einzug und neuer Zeile, Enter/Tab wie in Word, hängender Einzug in Blatt, Druck und Word; (2) bearbeitete Abschnitte auf Originalseiten in Spaltenbreite, Breite ziehbar mit Einrasten, auch in Word.
5. [x] **Mündliche Prüfung übersichtlicher.**
   - **Umsetzung:**
     - Mündliche Vorlagen nach Themen gruppiert, mit klaren Überschriften.
     - Im Blatt und im Druck saubere Abschnittsüberschrift „Mündliche Prüfung“ mit Thema, Zeit und Punkten.
   - **Fertig wenn:** Auswahl und Ausdruck der mündlichen Aufgabe sind ohne doppelte oder missverständliche Überschriften.
   - **Umgesetzt:** einheitlich „Mündliche Prüfungsaufgabe“ (statt teils „Mündliche Aufgabe“), Vorlagen nach Thema gruppiert, ausgewählte Aufgabe als Karte mit Thema, Punkten und Zeit; Thema auch auf Deckblatt, Aufgabenseite und in Word.
6. [x] **KI-Assistent: aus Vorschlägen neue Aufgaben erstellen, auch für Arbeitsgruppen.**
   - **Umsetzung:**
     - Vorschlag hochladen (Word, Text) oder einfügen. Die KI erstellt daraus Aufgabenentwürfe im Prüfungsformat (Titel, „Aufgabe: … Hier: …“, Punkte, Zeit, Material, Lösungshinweise als Entwurf) und stellt Rückfragen zu fehlenden Angaben.
     - Nach den Antworten wird der Entwurf verfeinert und mit einem Klick als Aufgabe übernommen; bei Gruppen als Entwurf zur Freigabe.
     - Läuft über den vorhandenen, abgesicherten KI-Zugang des Servers, ohne Speicherung beim Anbieter.
   - **Fertig wenn:** Aus einem eingefügten Vorschlag entsteht nach Rückfragen eine speicherbare Aufgabe, die direkt in die Prüfung übernommen werden kann.
   - **Umgesetzt:** Worker-Endpunkt `/api/ai/draft` (strukturierte Ausgabe, Ratenbegrenzung, nichts gespeichert) und Dialog „Aus Vorschlag (KI)“. **Wird erst sichtbar, nachdem der Worker über „Worker ausrollen“ neu ausgerollt wurde.**

## Neuplanung der Oberfläche (Konzept: `docs/ui-neuplanung.md`)

Ziel: viel einfacher und intuitiver. Prüfungseditor mit einer Aufgabe: sichtbare Knöpfe 74 → ≤ 20, Aufklapper 9 → 0.

- [x] 1. Neuer Prüfungsbildschirm: Gliederung · Blatt · Checkliste, Platzhalter-Seiten mit „Vorschlag übernehmen“
  - Gemessen (Zwischenprüfung mit einer Aufgabe, 1366 × 900): 16 sichtbare Knöpfe statt 74, 0 Aufklapper in der Bedienung, 134 Wörter in Kopfzeile, Gliederung und Checkliste. Von der neuen Prüfung zur ersten Aufgabe auf dem Blatt: 1 Klick.
  - ZP: drei Themen werden automatisch gewählt und sind in der Checkliste änderbar. AP: fünf Aufgaben mit den Mindestzahlen je Prüfungsbereich, dazu die mündliche Aufgabe als eigene Seite. FW: vier Aufgaben, genau 180 Minuten.
  - Bestehende Entwürfe öffnen unverändert in der neuen Ansicht und bleiben bearbeitbar. Ältere Themenstände zeigen einen Hinweis mit „Aktuelle Vorgaben übernehmen“.
  - Die klassische Ansicht bleibt umschaltbar (Menü „⋯ → Klassische Ansicht“, zurück mit „Neue Ansicht“). Die Wahl gilt je Gerät.
- [x] 2. „Aufgabe wählen“ als Vollbild mit Reitern (Vorschläge, Alle, Nach Jahr, Selbst schreiben, KI)
  - Vorschläge zuerst: Suchfeld und höchstens sechs passende Karten, lange nicht eingesetzte zuerst. 17 sichtbare Knöpfe statt 28.
  - „Alle Aufgaben“ enthält andere Prüfungsarten und Fachrichtungen (als Kopie). „Nach Jahr“ ist das Archiv. „Selbst schreiben“ und „Aus Vorschlag (KI)“ haben je einen Knopf.
- [x] 3. Fertigstellen-Dialog statt Schritt 3
  - Ein Satz Zusammenfassung, „Noch offen“ mit genau einem Knopf je Punkt, „Erledigt“ als kurze Liste, Nachricht an die zuständige Stelle (speichert beim Tippen), Seitennotizen.
  - Unten „An die zuständige Stelle übergeben“ (Gruppe) bzw. „Prüfung freigeben“ (zuständige Stelle) und „Weiter bearbeiten“. Zeitplan, Punkteverteilung, Vorschau & Druck als Links. 10 Knöpfe, keine Aufklapper.
- [x] 4. Startseiten (Karten für Gruppen, Tabelle für die zuständige Stelle), Navigation Start · Aufgaben · Einstellungen
  - Arbeitsgruppe: je Prüfung eine Karte mit Fortschritt, „Als Nächstes: …“ und genau einem Knopf (Weiterarbeiten / Prüfung beginnen).
  - Zuständige Stelle: Tabelle Fachrichtung × Prüfungsart mit Status (In Arbeit · n von m, Wartet auf Freigabe, Freigegeben); ein Klick öffnet die Prüfung. Oben „Arbeitsgruppen einladen“ und „Alles ausgeben (ZIP)“.
  - Navigation: Start · Aufgaben · Einstellungen. Unter „Einstellungen“ liegen alle bisherigen Verwaltungsseiten als Kacheln auf einer Seite.
- [ ] 5. Handy, einheitliche Begriffe, Hilfe statt i-Blasen; Test mit Anwendern

## Rückmeldungen

- [x] **Materiallisten aus den Quellen den Aufgaben zuordnen.**
  - Unter „Einstellungen → Import & Quellen“ steht „Materiallisten aus den Quellen“ mit dem Knopf „Quellen durchsuchen“. Der Bericht zeigt, wie viele eigene Materiallisten-Dokumente es gibt und welche Aufgaben bereits eine Material-Rubrik im eigenen Text haben. Er listet außerdem jede Zuordnung mit Vorschau und alle nicht eindeutigen Abschnitte.
  - Zuordnung nur bei eindeutig passendem Titel, gleicher Fachrichtung und Prüfungsart, bei bekanntem Jahr nur im selben Jahr.
  - Übernommen wird mit einem Klick als Vorschlag mit Herkunft; die Liste wird als Quelle an die Aufgabe gebunden, auch in offenen Prüfungen. Bestätigte oder selbst geschriebene Listen bleiben unverändert.
- [x] Begriff „Familieneinsatz“ verwirrte: Einsatzhistorie jetzt in Klartext („Zuletzt in einer Prüfung eingesetzt am … (diese oder eine ähnliche Ausführung)“, „Jüngste Vorlage aus …“).
- [x] **Notizen zu jeder Seite.** Ein Knopf „Notiz“ erscheint in der Seitenleiste, sobald man an einer Seite arbeitet.
  - Die Notiz steht als gelber Zettel über der Seite; Originalseiten haben je Vorder- und Rückseite eine eigene Notiz.
  - Sie wird nie gedruckt und landet nicht in Word. Die zuständige Stelle sieht alle Notizen unter „Fertigstellen“ und im Ausgabepaket unter „Interne Bemerkungen“.
  - Eine leer gelassene Notiz verschwindet wieder. Notizen ändern keine erteilte Freigabe.
- [x] **Alternative Aufgaben** zu einer Aufgabe, z. B. mehrere mündliche Aufgaben für die Gemüsebau-Prüfung.
  - Im Seitenmenü steht „Alternative hinzufügen“. Es öffnet eine Vollbild-Auswahl mit drei Wegen: „Kopie zum Umschreiben“, „Neue Aufgabe schreiben“ oder eine Aufgabe aus dem Bestand. Bei der ZP sind das nur Einzelaufgaben aus demselben Thema, bei der mündlichen Aufgabe die mündlichen Vorlagen.
  - Alternativen stehen als eigene Seiten direkt hinter ihrer Aufgabe („Aufgabe 2 · Alternative B“) und sind in der Gliederung eingerückt. Im Seitenmenü gibt es „Als Hauptaufgabe verwenden“ und „Entfernen“.
  - Sie zählen nie zur Aufgabenzahl, Zeit oder Punktzahl der Prüfungsordnung. Sie werden aber gedruckt, nach Word exportiert, in den Pflichtangaben geprüft und mit freigegeben.
  - Der Server prüft Alternativen wie Hauptaufgaben: eigene Fachrichtung, richtige Art, keine Freigabe durch die Arbeitsgruppe.
- [x] Seitenmenü „Weitere Aktionen“ in der neuen Ansicht: Einträge reagierten auf echte Mausklicks nicht, weil die Leiste beim Klick kurz unsichtbar wurde. Ein geöffnetes Menü bleibt jetzt sichtbar.

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
