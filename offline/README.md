# HortiExam Offline – praktische Prüfungswerkstatt

Eigenständiger Prototyp für einen verwalteten Dienst-PC: eine HTML-Datei im aktuellen Edge, Chrome oder Firefox öffnen. Kein lokaler Server, keine Installation, keine CDN-Abhängigkeit und keine externen KI-Aufrufe. Die bestehende Flask-Anwendung bleibt unverändert.

## Start / Entwicklung

```bash
python offline/tools/build.py
# dist/index.html direkt im Browser öffnen
node --test offline/tests/*.test.cjs
```

Das Repository enthält synthetische Beispieldaten und unter `pages/sealed` den verschlüsselten Testbestand. Unverschlüsselte Originaldaten und Passwörter bleiben außerhalb des Repositorys. Ein privates Paket kann lokal gebaut werden:

```bash
python offline/tools/build.py --seed /absoluter/privater/bestand.json --out /absoluter/privater/Start.html
```

`dist/` ist ignoriert. Private Builds, Quellen, Originale und Exporte niemals zu Git hinzufügen. Bei Veröffentlichung des Codes keine privaten Build-Ausgaben als Hosting-Artefakt verwenden.

## Arbeitsablauf

1. **Prüfungsbereich**: Zwischen- oder Abschlussprüfung und Fachrichtung wählen. Kategorien, Familien, Quellen und Entwürfe bleiben diesem Bereich zugeordnet.
2. **Prüfungsmuster**: aus originalen Aufgabenköpfen vorgeschlagene Kategorien prüfen, erforderliche Anzahlen festlegen und mit Namen bestätigen. Der Archivbestand beweist keine vollständige jährliche Zusammensetzung. 0 schließt eine Kategorie aus.
3. **Kategorien → Aufgabenfamilien → Varianten**: Varianten vergleichen, Quelljahre und bestätigte Einsätze getrennt prüfen. Manuelle Kategorienkorrektur im Aufgabeneditor; Kombinationsaufgaben dürfen mehrere Kategorien abdecken.
4. Neue Prüfung übernimmt eine feste Musterkopie. Die Kategorienanzeige zeigt fehlende, passende und überbesetzte Slots. Rotationsvorschläge bevorzugen ältere Familienbelege und vermeiden doppelte Familien. Unbekannte Historie zählt nicht als „nie benutzt“.
5. Aufgaben bearbeiten, Lösungen, Punkte, Grafiken und Zeit ergänzen; Teilnehmer- und Prüferfassung ansehen. Nicht bestätigte Muster, unpassende Kategorien oder fehlende fachliche Freigaben bleiben als Entwurf gekennzeichnet.
6. Im **Koordinationsprototyp**: Projektdatei vor dem Schließen sichern; Prüfung und Lösung können gemeinsam als ZIP exportiert werden. Diese Exporte sind vertraulicher Klartext. Es gibt keine Offline-Satellitenfunktion mehr.
7. Tatsächliche Einsätze gesondert bestätigen. Geplante Termine werden nicht als Nutzung gewertet. Eingesetzte Prüfungen sind gesperrt; zum Ändern duplizieren.

JSON-Import erhält abweichende Aufgaben als separate Kopien. **Abweichende Prüfungsmuster desselben Bereichs werden ausdrücklich abgewiesen**, bis sie fachlich abgeglichen wurden; keine stille Auswahl oder Löschung eines Konflikts.

## Datenmodell / Servermigration

`schemaVersion: 1` definiert einen portablen JSON-Vertrag. `core.js` enthält die Domänenfunktionen ohne Browser-/Speicherabhängigkeiten. `app.js` verwendet heute IndexedDB; die expliziten JSON-Dateien sind das transportable Datenformat.

| Sammlung | Zweck |
| --- | --- |
| families | Aufgabenfamilien und Zuordnungsstatus |
| tasks | Varianten und Revisionen; Verweise über previousId/supersededBy |
| sources | Originaldokumente, Rohtext, Quelljahr mit Herkunft, Prüfungsart und Fachrichtung |
| assets | Erhaltene Binärdateien; im Offline-Format Base64 |
| exams | Prüfungsentwürfe und unveränderlich kopierte Aufgabeninhalte inklusive Lösung/Anlagenverweise |
| patterns | Bestätigbare, versionierte Pflichtkategorien pro Prüfungsart und Fachrichtung; jede Prüfung erhält eine Kopie |
| uses | Manuell bestätigte tatsächliche Einsätze; Rückverweis auf die eingesetzte Prüfung |

Die Oberfläche bleibt auf GitHub Pages. Für temporäre Prüferzugänge und gemeinsames Speichern ist **GitHub Pages + privates Datenrepository + serverlose API** vorgesehen. Siehe `docs/architecture/github-session-access.md` für Sitzungsfreigabe, QR-Einladungen, serverseitige Rollen, Exportrechte und Konfliktbehandlung. Diese Zugangskontrolle ist noch nicht implementiert oder ausgerollt. Das aktuelle gemeinsame Passwort ist nur für den Koordinationstest geeignet.

`server/schema.mysql.sql` bleibt ein älterer, nicht ausgerollter Alternativentwurf. Er ist keine Voraussetzung für die nun gewünschte GitHub-Architektur.

Die vorhandene Flask-/SQLite-Datenbank wird durch diesen Prototyp nicht verändert oder automatisch migriert. Eine etwaige Übernahme ihres Bestands benötigt einen gesonderten, geprüften Importadapter.

## Grenzen

- Keine verlässliche Offline-Ablaufsperre und kein Screenshot-/Fotoschutz. Solche Zusicherungen wären falsch.
- Keine erfundenen offiziellen Lösungen. Ohne hinterlegten und freigegebenen Lösungshorizont zeigt die Prüferfassung einen Entwurf mit offenen Punkten.
- DOCX wird als Text und eingebettete Medien gelesen. Nummerierte Aufgaben bzw. `Frage:`-Abschnitte werden als Vorschläge getrennt; integrierte Aufgaben bleiben zusammen. Tabellenlayout, SmartArt, Vektorformen, eingebettete Objekte, Textfelder und Zeichnungsbezüge brauchen Sichtprüfung am Original. Keine OCR.
- Neue `.doc`-Dateien in Word als `.docx` speichern. Der bereitgestellte Altbestand wurde separat konvertiert und geprüft; Originaldateien bleiben erhalten.
- Bilder werden nur bei ausdrücklicher Zuordnung zur Teilnehmer-/Prüferfassung ausgegeben. Originalgrafiken starten als Quellenanlagen. Zeichnungsmaßstab und Seitenumbrüche beim Ausdruck prüfen.
- IndexedDB kann auf administrierten Geräten oder bei `file://` eingeschränkt sein. Dann weiter mit manuell gesicherten Projektdateien arbeiten. Das Tool zeigt den Speicherstatus an.
- Kein gleichzeitiges Mehrbenutzerarbeiten in einer Datei. Keine Prüferrollen oder widerrufbaren Sitzungskonten im statischen Prototyp.

## Prüfungen

Node-Tests prüfen Snapshot-Isolation, Revisionen, Importvalidierung, idempotente Rückläufe und abhängige Referenzen, Datumstrennung, Punkte, Kandidaten-/Lösungstrennung und gleichnamige Anlagen. Zusätzlich manuelle Browserprüfung von Bank, Filtern, Bearbeitung und Vorschau. Browser-QA erfolgt mit synthetischen Daten und anschließend mit dem privaten Bestand; dieser wird nicht veröffentlicht.

JSZip 3.10.1 ist lokal gebündelt; Lizenz unter `vendor/JSZip-LICENSE.md`.
