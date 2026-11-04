# Neuplanung der Oberfläche: viel einfacher, viel intuitiver

Stand: 4. November 2026 · Anlass: Rückmeldung „Das Tool soll noch viel einfacher und intuitiver zu bedienen sein.“
Anklickbarer Entwurf: Design-Canvas „Prüfungswerkstatt – neue Oberfläche“ (Link im zugehörigen PR).

## 1. Bestandsaufnahme (gemessen)

Gemessen im Browser (1366 × 900), Demo-Daten, zuständige Stelle. „Sichtbar“ = ohne Scrollen im Bild.

| Bildschirm | Knöpfe/Links | davon sichtbar | Aufklapper | Wörter |
|---|---:|---:|---:|---:|
| Übersicht | 29 | 29 | 6 | 151 |
| Arbeitsbereich einer Fachrichtung | 24 | 22 | 3 | 217 |
| Prüfungseditor · Schritt 1 Themen | 15 | 14 | 4 | 245 |
| Prüfungseditor · Schritt 2 (leer) | 72 | 53 | 5 | 744 |
| **Prüfungseditor · Schritt 2 mit einer Aufgabe** | **93** | **74** | **9** | **888** |
| Prüfungseditor · Schritt 3 | 35 | 26 | 3 | 366 |
| Aufgaben & Archiv | 49 | 27 | 5 | 750 |
| Verwaltung · Grundeinstellungen | 36 | 24 | 6 | 295 |

Was am meisten bremst:

1. **Dieselbe Information mehrfach.** „Wie viele Aufgaben zu welchem Thema“ steht im Editor bis zu fünfmal:
   - Prüfungsaufbau-Kacheln
   - Chip „1/3 Aufgaben“
   - Baukasten
   - Themen-Zähler „0 von 1“
   - Seiten auf dem Blatt
2. **Zu viele Ebenen übereinander.** Im Editor liegen übereinander:
   - Kopfzeile, drei Schritt-Reiter, Status-Chips, „Pflichtangaben & Vorgaben“
   - Aufgabenauswahl mit Filtern, Baukasten
   - zweizeilige Werkzeugleiste, Warnbanner
   - Blatt mit „Weitere Aktionen“
3. **Versteckte Wege.** „Weitere Optionen“, „Weitere Aktionen“, „Ansicht & Ausgabe“, i-Blasen und Aufklapper in Aufklappern.
4. **Ein Assistent, der keiner ist.** Die drei Schritte (Themen → Aufgaben → Prüfen) zwingen zum Hin- und Herspringen. Schritt 1 lässt sich ohnehin automatisch erledigen.
5. **Fachjargon aus der Entwicklung.** Beispiele: Arbeitsbereich, Muster, Familie, Pflichtangaben, Prüfungsaufbau, Baukasten, Vorbereitungstermin.
6. **Navigation der zuständigen Stelle.** Drei Hauptpunkte und sechs Unterpunkte unter „Verwaltung“; die Übersicht doppelt sich mit „Prüfungen“.

## 2. Leitbild

**Die Prüfung ist ein Dokument.** Man öffnet sie, arbeitet direkt auf dem Blatt und stellt sie fertig – wie in Word. Das Tool sagt jederzeit, was als Nächstes zu tun ist, und bietet den Knopf dafür an.

Grundsätze:

1. **Ein Bildschirm, eine Hauptaktion.** Alles andere erscheint erst, wenn es gebraucht wird.
2. **Jede Information steht genau einmal.** Der Fortschritt steht nur in der Checkliste.
3. **Das Tool führt.** Jede offene Sache hat einen Knopf, der sie erledigt („Aufgabe 3 wählen“, „Lösung ergänzen“).
4. **Keine Aufklapper in Aufklappern, keine i-Blasen.** Kurze Sätze; ausführliche Erklärungen stehen in der Hilfe.
5. **Gleiche Sprache überall.** Termin · Fachrichtung · Prüfung · Aufgabe · Thema · Ausführung · Vorlage.

## 3. Neue Struktur

### Orte

| Rolle | Orte |
|---|---|
| Arbeitsgruppe | **Start** („Eure Prüfungen“) · **Prüfung** |
| Zuständige Stelle | **Start** (Übersicht als Tabelle) · **Aufgaben** · **Einstellungen** · **Prüfung** |

Die Seitenleiste mit Verwaltungsmenü entfällt. Unter **Einstellungen** liegt alles, was selten gebraucht wird, als Abschnitte einer Seite:
- Termin & Fachrichtungen
- Zugänge & QR-Codes
- Ausschüsse & Mitwirkende
- Themenvorgaben
- Import & Quellen
- Papierkorb
- Sicherung

### Bildschirme (siehe Entwurf)

1. **Start (Arbeitsgruppe):**
   - Je Prüfung eine große Karte mit Fortschritt, „Als Nächstes: …“ und genau einem Knopf („Weiterarbeiten“ / „Prüfung beginnen“).
   - Darunter zwei leise Links: Aufgaben/Archiv und „Aus Vorschlag (KI)“.
2. **Prüfung bearbeiten** – drei Spalten:
   - **Gliederung** links: Seitenminiaturen, zum Umsortieren ziehen. Ersetzt Baukasten und Seitenauswahl.
   - **Blatt** in der Mitte, Word-Look:
     - Fehlende Aufgaben erscheinen als **Platzhalter-Seite** mit „Vorschlag übernehmen“ (ein Klick) und „Andere Aufgabe wählen“.
     - Die Textwerkzeuge erscheinen als kleine schwebende Leiste nur beim Schreiben.
   - **Checkliste** rechts:
     - der einzige Ort für den Fortschritt, mit Knopf pro offenem Punkt;
     - die Themen ändert man hier („ändern“), statt in einem eigenen Schritt;
     - Hinweise zur Prüfungsordnung erscheinen hier, nur wenn sie zutreffen.
   - Kopfzeile: zurück · Titel · „Gespeichert“ · Rückgängig/Wiederholen · Vorschau & Druck · **Fertigstellen**.
3. **Aufgabe wählen** – Vollbild statt Dauer-Seitenleiste, mit Reitern:
   - **Vorschläge** (Standard, lange nicht verwendet zuerst)
   - Alle Aufgaben (inklusive anderer Prüfungsart und Fachrichtungen)
   - Nach Jahr
   - Selbst schreiben
   - Aus Vorschlag (KI)

   Karten mit Vorschau und einem Knopf „Übernehmen“.
4. **Fertigstellen** – ein Dialog statt Schritt 3:
   - „Noch offen“ mit je einem Knopf, „Erledigt“ als kurze Liste;
   - Nachricht an die zuständige Stelle;
   - „Übergeben“.

   Zeitplan, Punkteverteilung, Materiallisten und interne Bemerkungen sind von hier erreichbar.
5. **Start (zuständige Stelle):**
   - Tabelle Fachrichtung × Prüfungsart mit Status („In Arbeit · 3 von 5“, „Wartet auf Freigabe“, „Freigegeben“); ein Klick öffnet die Prüfung.
   - Oben „Arbeitsgruppen einladen“ und „Alles ausgeben (ZIP)“.
6. **Handy:**
   - Das Blatt einspaltig; fehlende Aufgaben als Platzhalter-Karte.
   - Die Checkliste als Leiste unten („2 von 5 · Als Nächstes: …“), aufziehbar.

### Was wohin wandert

| Heute | Neu |
|---|---|
| Schritt-Reiter 1–2–3 | entfällt: Themen automatisch (änderbar in der Checkliste), Fertigstellen-Dialog |
| Prüfungsaufbau-Kacheln, Status-Chips, „Pflichtangaben & Vorgaben“ | Checkliste |
| Baukasten | Gliederung links + Platzhalter-Seiten |
| Aufgabenauswahl als Dauer-Seitenleiste | „Aufgabe wählen“ als Vollbild, nur bei Bedarf |
| „Aufgaben automatisch ergänzen“ | Vorschlag direkt auf jeder Platzhalter-Seite |
| „Weitere Optionen“, „Ansicht & Ausgabe“, „Weitere Aktionen“ | Kopfzeile (Vorschau & Druck, Fertigstellen); Seitenaktionen per Rechtsklick/„⋯“ an der Seite |
| Mündliche Aufgabe als Aufklapper | eigene Seite in der Gliederung mit Platzhalter wie oben |
| Verwaltung (6 Menüpunkte) | Einstellungen (eine Seite mit Abschnitten) |

## 4. Ziele, an denen wir messen

| Messgröße (Prüfungseditor mit einer Aufgabe) | heute | Ziel |
|---|---:|---:|
| sichtbare Knöpfe/Links | 74 | ≤ 20 |
| Aufklapper | 9 | 0 |
| Wörter auf dem Bildschirm (ohne Blatt-Inhalt) | ≈ 650 | ≤ 200 |
| Klicks von „Prüfung öffnen“ bis zur ersten Aufgabe auf dem Blatt | 4 | 2 |

Dazu ein kurzer Test mit drei Mitgliedern einer Arbeitsgruppe ohne Einweisung. Aufgabe: „Stellt eine Zwischenprüfung zusammen und übergebt sie.“ Erfolg heißt: ohne Hilfe, unter 15 Minuten.

Die Messung läuft als Browserprobe im Repo mit, damit die Zahlen nicht wieder wachsen.

## 5. Umsetzung in Schritten (je ein PR, jeder für sich nutzbar)

Daten, Exporte (Word, Druck, ZIP), Prüfregeln und der Worker bleiben unverändert. Alte Aktionen bleiben intern erhalten, damit die Tests weiter greifen.

1. **Neuer Prüfungsbildschirm.**
   - Gliederung · Blatt · Checkliste, dazu Platzhalter-Seiten mit „Vorschlag übernehmen“.
   - Schritt-Reiter, Baukasten, Status-Chips und Prüfungsaufbau-Kacheln entfallen.
   - *Fertig wenn:* Eine Prüfung lässt sich ohne Schritt-Reiter vollständig zusammenstellen; Messgrößen ≤ Ziel.
2. **„Aufgabe wählen“ als Vollbild** mit Reitern: Vorschläge zuerst; Archiv, andere Prüfungsart und KI-Assistent integriert.
   - *Fertig wenn:* Jede Platzhalter-Seite führt in zwei Klicks zu einer übernommenen Aufgabe.
3. **Fertigstellen-Dialog** statt Schritt 3, mit „Noch offen“-Knöpfen und Übergabe.
   - *Fertig wenn:* Alle heutigen Prüfungen aus Schritt 3 erscheinen dort mit einem Knopf zum Beheben.
4. **Startseiten und Navigation.**
   - Arbeitsgruppe: Karten.
   - Zuständige Stelle: Tabelle.
   - Navigation: Start · Aufgaben · Einstellungen.
   - *Fertig wenn:* Die Verwaltungsunterpunkte sind als Abschnitte unter „Einstellungen“ erreichbar.
5. **Handy, Sprache, Hilfe.**
   - Handy-Ansicht mit Checklisten-Leiste.
   - Begriffe nach Abschnitt 2 vereinheitlichen.
   - i-Blasen in die Hilfe überführen.
   - Test mit Anwendern.

## 6. Offene Entscheidungen

- Sollen Arbeitsgruppen „Aufgaben“ als eigenen Ort sehen? Im Entwurf erreichen sie Aufgaben nur über „Aufgabe wählen“ und einen Link auf der Startseite.
- Themen der Zwischenprüfung: Sollen sie immer automatisch gewählt werden (änderbar), oder soll die Gruppe beim ersten Öffnen kurz bestätigen?
- Soll die alte Oberfläche für eine Übergangszeit umschaltbar bleiben?
