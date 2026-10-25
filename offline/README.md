# HortiExam Offline – praktische Prüfungswerkstatt

Eigenständiger Prototyp für einen verwalteten Dienst-PC: eine HTML-Datei im aktuellen Edge, Chrome oder Firefox öffnen. Kein lokaler Server, keine Installation, keine CDN-Abhängigkeit und keine externen KI-Aufrufe. Die bestehende Flask-Anwendung bleibt unverändert.

## Start / Entwicklung

```bash
python offline/tools/build.py
# dist/index.html direkt im Browser öffnen
node --test offline/tests/*.test.cjs
```

Das Repository enthält ausschließlich synthetische Beispieldaten. Reale Prüfungsdaten außerhalb des Repositorys aufbewahren. Ein privates Paket kann lokal gebaut werden:

```bash
python offline/tools/build.py --seed /absoluter/privater/bestand.json --out /absoluter/privater/Start.html
```

`dist/` ist ignoriert. Private Builds, Quellen, Originale und Exporte niemals zu Git hinzufügen. Bei Veröffentlichung des Codes keine privaten Build-Ausgaben als Hosting-Artefakt verwenden.

## Arbeitsablauf

1. Aufgaben nach Fachrichtung, ZP/AP, Bestandsteil, Thema und Quelljahr filtern.
2. Über **Ansehen** Aufgaben, Originale, Varianten und Hinweise prüfen. Die Familienzuordnung ist ein überprüfbarer Vorschlag, kein unveränderlicher Befund.
3. Aufgaben bearbeiten: eine neue Bankrevision oder gezielt eine Kopie innerhalb einer Prüfung. Vorgängerversionen bleiben im Familienvergleich erreichbar.
4. Lösungen, Bewertungskriterien, Teilpunkte, Grafiken und Bearbeitungszeit ergänzen. Die fachliche Freigabe verlangt ein Namenskürzel. Beim erneuten Bearbeiten werden übernommene Freigaben zurückgesetzt.
5. Aufgaben per Drag-and-drop oder Schaltfläche in die Prüfung übernehmen. Die Reihenfolge lässt sich auch mit Pfeiltasten ändern.
6. **Prüfung + Lösung exportieren** erzeugt ein ZIP mit zwei druckfertigen HTML-Dateien. Bereitgestellten Download anklicken, ZIP entpacken und die gewünschte Fassung im Browser öffnen. Über Drucken als PDF speichern. Separate PDF-Anlagen liegen in getrennten Teilnehmer-/Prüferordnern.
7. **Projekt sichern** lädt die vollständige Datenbank einschließlich Originalen, Bildern und Prüfungen herunter. Browser-Speicherung ist nur eine zusätzliche Arbeitshilfe, kein Backup.
8. Arbeitsgruppen erhalten eigenständige HTML-Pakete je Fachrichtung. Rückgabe über die Projekt-JSON; **JSON zusammenführen** erhält abweichende Datensätze als separate Rückläufe. Wiederholtes Einlesen desselben Rücklaufs erzeugt keine zusätzlichen Kopien.
9. Tatsächliche Einsätze in **Meine Prüfungen** gesondert bestätigen. Ein geplanter Termin oder Jahr im Dateinamen reicht dafür nicht. Eingesetzte Prüfungen sind im Editor gesperrt; für Änderungen duplizieren.

## Datenmodell / Servermigration

`schemaVersion: 1` definiert einen portablen JSON-Vertrag. `core.js` enthält die Domänenfunktionen ohne Browser-/Speicherabhängigkeiten. `app.js` verwendet heute IndexedDB; die expliziten JSON-Dateien sind das transportable Datenformat.

| Sammlung | Zweck |
| --- | --- |
| families | Aufgabenfamilien und Zuordnungsstatus |
| tasks | Varianten und Revisionen; Verweise über previousId/supersededBy |
| sources | Originaldokumente, Rohtext, Quelljahr mit Herkunft, Prüfungsart und Fachrichtung |
| assets | Erhaltene Binärdateien; im Offline-Format Base64 |
| exams | Prüfungsentwürfe und unveränderlich kopierte Aufgabeninhalte inklusive Lösung/Anlagenverweise |
| uses | Manuell bestätigte tatsächliche Einsätze; Rückverweis auf die eingesetzte Prüfung |

Für Webgo ist als nächste Stufe ein serverseitiger PHP-Dienst vorgesehen, der diese Strukturen nach MySQL überträgt. `server/schema.mysql.sql` ist ein **noch nicht gegen einen konkreten Hostingtarif getesteter Schemaentwurf**, kein produktiver Server. Vorgehen:

1. Tarif und PHP/MySQL-Versionen prüfen; private Testumgebung einrichten.
2. Serverseitige Anmeldung, Rollen (Koordination/Prüfer), projektbezogene Rechte und CSRF-Schutz implementieren. Keine Datenbank-Zugangsdaten im Browser.
3. Binärdateien außerhalb des öffentlichen Webverzeichnisses ablegen; Downloads nur nach Rechteprüfung. JSON-IDs unverändert übernehmen, Inhalte und Referenzen prüfen.
4. Import in einer Transaktion durchführen. Projektversion per `If-Match`/Revision abgleichen; parallele Änderungen als Konflikt behandeln. Die Offline-Zusammenführung ist kein Ersatz für Servertransaktionen.
5. Automatische Sicherung und Wiederherstellung testen. Sitzungen/Aufträge zeitlich begrenzen; heruntergeladene Kopien bleiben technisch außerhalb der Kontrolle.

Die vorhandene Flask-/SQLite-Datenbank wird durch diesen Prototyp nicht verändert oder automatisch migriert. Eine etwaige Übernahme ihres Bestands benötigt einen gesonderten, geprüften Importadapter.

## Grenzen

- Keine verlässliche Offline-Ablaufsperre und kein Screenshot-/Fotoschutz. Solche Zusicherungen wären falsch.
- Keine erfundenen offiziellen Lösungen. Ohne hinterlegten und freigegebenen Lösungshorizont zeigt die Prüferfassung einen Entwurf mit offenen Punkten.
- DOCX wird als Text und eingebettete Medien gelesen. Nummerierte Aufgaben bzw. `Frage:`-Abschnitte werden als Vorschläge getrennt; integrierte Aufgaben bleiben zusammen. Tabellenlayout, SmartArt, Vektorformen, eingebettete Objekte, Textfelder und Zeichnungsbezüge brauchen Sichtprüfung am Original. Keine OCR.
- Neue `.doc`-Dateien in Word als `.docx` speichern. Der bereitgestellte Altbestand wurde separat konvertiert und geprüft; Originaldateien bleiben erhalten.
- Bilder werden nur bei ausdrücklicher Zuordnung zur Teilnehmer-/Prüferfassung ausgegeben. Originalgrafiken starten als Quellenanlagen. Zeichnungsmaßstab und Seitenumbrüche beim Ausdruck prüfen.
- IndexedDB kann auf administrierten Geräten oder bei `file://` eingeschränkt sein. Dann weiter mit manuell gesicherten Projektdateien arbeiten. Das Tool zeigt den Speicherstatus an.
- Kein gleichzeitiges Mehrbenutzerarbeiten in einer Datei. Fachrichtungs-Pakete sind vertrauliche Offline-Kopien, keine Zugriffskontrolle.

## Prüfungen

Node-Tests prüfen Snapshot-Isolation, Revisionen, Importvalidierung, idempotente Rückläufe und abhängige Referenzen, Datumstrennung, Punkte, Kandidaten-/Lösungstrennung und gleichnamige Anlagen. Zusätzlich manuelle Browserprüfung von Bank, Filtern, Bearbeitung und Vorschau. Browser-QA erfolgt mit synthetischen Daten und anschließend mit dem privaten Bestand; dieser wird nicht veröffentlicht.

JSZip 3.10.1 ist lokal gebündelt; Lizenz unter `vendor/JSZip-LICENSE.md`.
