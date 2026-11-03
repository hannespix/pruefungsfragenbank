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

Die zuständige Stelle verwaltet unter **Grundeinstellungen** die angebotenen Themen, ihre Namen, Erläuterungen, Reihenfolge und Sichtbarkeit sowie Standardtitel, Teilnehmerhinweise und eine organisatorische Zielzeit. Die ZP-Einstellungen gelten für alle Gärtner-Fachrichtungen, AP und FW_AP jeweils für die Fachrichtung. Neue Prüfungen speichern einen eigenen Themenstand; spätere Änderungen schreiben bestehende Prüfungen nicht um. Ausgeblendete Themen und ihre früheren Verwendungen bleiben erhalten.

Beim Vorbereitungstermin bestimmt die zuständige Stelle, welche Prüfungsarten je Fachrichtung neu erstellt werden dürfen. Eine später abgewählte Prüfungsart bleibt mit vorhandenen Entwürfen zugänglich. Die Auswahl ersetzt keine Zugangsfreigabe.

1. **Themen auswählen:** Themen für die konkrete Prüfung festlegen. Bei der ZP ist je gewähltem Generalthema genau eine Einzelaufgabe vorgesehen; Kombinationsaufgaben werden nicht angeboten. AP-Themenwahl ersetzt keine praktische Aufgabenanzahl, Bereichsminima oder Höchstzeit.
2. **Aufgaben & Prüfungsblatt:** Passende Varianten vergleichen und als unabhängige Kopien übernehmen. Aufgabenstellung, Lösung, Punkte, Zeit und Anlagen im Entwurf prüfen und bearbeiten. Neue AP- und FW_AP-Prüfungen enthalten zusätzlich genau eine separate mündliche Aufgabe derselben Prüfungsart und Fachrichtung. Sie erhöht weder praktische Aufgabenzahl noch praktische Punkte/Zeit; ZP hat keinen separaten mündlichen Bestandteil. Fehlende mündliche Vorlagen muss die zuständige Stelle ergänzen.
3. **Prüfen & abschließen:** Materiallisten je praktischer Aufgabe festlegen, Vorschläge prüfen und ausdrücklich bestätigen; anschließend Blatt, Lösung, Anlagen und interne Bemerkungen kontrollieren. „Bearbeitung abschließen & zur Prüfungsübersicht“ wartet auf die Speicherung und kehrt erst danach zurück. Bei einem Fehler bleibt der Entwurf geöffnet. Eine fehlende mündliche Pflichtaufgabe verhindert Abschluss und Prüfungsexport; weitere offene Hinweise bleiben sichtbar. Die Übergabe ist keine fachliche Freigabe und kein Nachweis eines tatsächlichen Prüfungseinsatzes.

Materiallisten sind organisatorische Metadaten. Klar bezeichnete Rubriken werden als Vorschlag übernommen, sonst entsteht ein allgemeiner Vorschlag ohne erfundene Mengen. Änderungen an Liste oder Arbeitsauftrag setzen die Bestätigung zurück. Die zuständige Stelle kann eine separate **Materialübersicht** drucken; Zusatzlisten werden nicht auf Teilnehmerseiten ergänzt und verändern den Originalwortlaut nicht. Bereits im Original enthaltene Materialrubriken bleiben Teil der Aufgabe.

Im Offline-Build vor dem Schließen eine Projektdatei sichern. Die zuständige Stelle kann Prüfung und Lösung als vertrauliches ZIP mit Word- und Druckfassungen exportieren. Der Online-Dienst speichert Arbeitsstände zentral; siehe [Online-Betrieb](../online/README.md). Tatsächliche Einsätze erst nach der durchgeführten Prüfung dokumentieren. Eingesetzte Prüfungen sind gesperrt; für Änderungen eine Kopie erstellen.

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
| patterns | Prüfungsmuster pro Prüfungsart und Fachrichtung; jede Prüfung erhält eine Kopie ihres Themenstands |
| settings | Zentrale Themen- und Standardangaben für neue Prüfungen, mit Revision je Geltungsbereich |
| workshops | Vorbereitungstermine, Fachrichtungsgruppen, vorgesehene Prüfungsarten und Mitwirkende |
| uses | Manuell bestätigte tatsächliche Einsätze; Rückverweis auf die eingesetzte Prüfung |

Der eigenständige Offline-Build verwendet lokale Projektdaten. Der separate Online-Dienst in `online/` stellt temporäre Gruppenzugänge, zentrale Speicherung und serverseitige Rollen bereit; dessen Build enthält keinen eingebetteten Aufgabenbestand. Einrichtung und Betrieb sind in [online/README.md](../online/README.md) beschrieben. Das frühere verschlüsselte Passwortpaket ist ein eigener Testzugang und ersetzt diese Rollenprüfung nicht.

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

## Einstieg für die zuständige Stelle

Nach dem Öffnen erscheint die Leitungsübersicht. „Termin vorbereiten“ legt einen
Vorbereitungstermin mit Prüfungsjahr und Fachrichtungsgruppen an. Jede Gruppe hat
die beim Termin vorgesehenen Prüfungsarten; für Gemüsebau und Zierpflanzenbau
ist zusätzlich die Fachwerker-Abschlussprüfung verfügbar. Mehrere Entwürfe je
Prüfungsart sind möglich. Bereits angelegte Entwürfe bleiben erreichbar, wenn
eine Prüfungsart später für die Neuerstellung abgewählt wird. „Prüfungen & Ergebnisse“ zeigt auch ältere, noch keinem
Vorbereitungstermin zugeordnete Prüfungen. Diese können über „Prüfungsdaten
bearbeiten“ zugeordnet werden, sofern Fachrichtung und Prüfungsjahr passen.

Vorbereitungstermin und tatsächlicher Prüfungstermin sind getrennte Angaben.
Meeting-Metadaten (`workshops`) und Prüfungsverweise (`workshopId`, `examYear`)
sind additive Felder des Projektformats. Alte Projekte bleiben lesbar. Konflikte
beim Import erhalten beide Fassungen einschließlich ihrer Verweise.

Im eigenständigen Offline-Build ist der Gruppenbereich die Bearbeitungsansicht
der zuständigen Stelle. Funktionierende Einladungen, Gerätefreigaben,
gemeinsames Speichern und serverseitige Exportrechte gehören zum separaten
Online-Dienst. Die dortige Arbeitsgruppe darf Themen auswählen, Prüfungsentwürfe
bearbeiten und Materiallisten bestätigen; zentrale Grundeinstellungen,
fachliche Aufgabenfreigaben und Exporte bleiben der zuständigen Stelle vorbehalten.
