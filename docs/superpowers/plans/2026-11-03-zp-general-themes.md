# Zwischenprüfung: Generalthemen und Einzelaufgaben

**Goal:** Gärtner-Zwischenprüfungen aus Einzelaufgaben zu neun vorgegebenen Generalthemen zusammenstellen, mit wechselnden Rotationsvorschlägen.

**Architecture:** Der gemeinsame Planungsbereich erhält den Kategorienstand `zp-general-2026`. Neue Prüfungen verwenden diesen Stand; gespeicherte historische Prüfungsmuster behalten ihre Auslegung. Editor, Fragenbank und serverseitige Validierung verwenden dieselben Funktionen.

**Tech Stack:** JavaScript-Domänenmodule, Browser-Editor, Cloudflare Worker, Node-Testläufer.

## Vorgaben und Quellen

- Nur Gärtner-ZP; Abschlussprüfungen und Fachwerker behalten ihre Regeln.
- Neun Generalthemen in der Reihenfolge der Nutzervorgabe. Pro Prüfung höchstens eine Einzelaufgabe je Generalthema, keine Kombinationsaufgaben. Keine zusätzliche feste Gesamtanzahl erfinden.
- Excel-Abgleich: `Notenberechnung Gärtner AP S 2026`, Blatt `Aufgaben`, enthält AP-Kategorien, aber keine eigene Gärtner-ZP-Liste. „Durchführen von Arbeiten an der Pflanze“ und „Vermehren von Pflanzen“ stimmen überein. Engere oder zusammengefasste AP-/FW-Kategorien ersetzen die ausdrücklich vorgegebenen ZP-Generalthemen nicht.
- Originale und bestehende Prüfungen bleiben erhalten. Unklare und kombinierte Aufgaben bleiben zur Prüfung in der Fragenbank, erscheinen jedoch nicht als Einzelaufgaben im neuen ZP-Editor.
- Wiederholte Vorschläge wechseln bei vorhandenen Alternativen; die Einsatzhistorie der Aufgabenfamilie bleibt Grundlage der Rotation.

## Umsetzung und Nachweis

- [x] Planungsfunktionen und Schema um den neuen Stand erweitern; Tests für alle Fachrichtungen, Altbestände, einzelne/mehrere Themen und Rotation ergänzen.
- [x] Im Editor genau neun Generalthemen anzeigen; Einzelaufgaben filtern, doppelte Themen beim Hinzufügen und Ersetzen abfangen und die Regel verständlich erklären.
- [x] Musterverwaltung auf 0/1 Aufgabe je Generalthema begrenzen; gespeicherte Altentwürfe erst nach ausdrücklicher Übernahme umstellen.
- [x] Aktuellen privaten Bestand nur lesend gegen neue Regeln prüfen; keine Prüfungsinhalte veröffentlichen.
- [x] Browser-/Domänen-/Worker-Tests, Builds und unabhängige Codeprüfung durchführen.
- [ ] PR zusammenführen, Worker und GitHub Pages prüfen.

## Zusätzlicher Nutzerauftrag: zusammenhängende Textpunkte

- [x] WYSIWYG-Originalseiten: zusammenhängende Absätze bzw. Aufzählungspunkte über Zeilenumbrüche und Einrückungen hinweg gemeinsam bearbeiten; separate Punkte und Überschriften getrennt lassen.
- [x] Ganze Textpunkte für die optionale Schreibhilfe bereitstellen; ursprüngliche Seiten, Anlagen und Exportmöglichkeiten erhalten. Die pausierte KI-Servereinrichtung bleibt außerhalb dieses Auftrags.
- [x] Mehrzeilige Punkte, Einrückungen, getrennte Aufzählungen sowie Bearbeiten und Export anhand synthetischer Beispiele prüfen.

## Review-Schwerpunkte

Historische Muster, leere Aufgabenpools, falsch oder mehrfach zugeordnete Aufgaben, unterschiedliche Varianten derselben Familie, Ersetzen/Drag-and-drop sowie Layouts mit Spalten oder Tabellen.


## Ergänzungen im selben Meilenstein

- [x] Interne Bemerkungen pro Prüfung: automatisch speichern, in Übersicht anzeigen, aus Teilnehmer-/Prüferausgaben und Word ausschließen.
- [x] „Bearbeitung abschließen & zur Prüfungsübersicht“: Speicherung abwarten, bei Fehlern im Entwurf bleiben, Übergabe ohne fachliche Freigabe dokumentieren.

## Prüfung

405 Tests erfolgreich (247 offline, 158 online). Synthetische Desktop-/Mobilansicht und zusammenhängende Originaltextpunkte gerendert. Privaten Bestand nur lesend geprüft: 74 ZP-Aufgaben, davon 72 Einzelaufgaben und zwei ausgeschlossene Kombinationsaufgaben. Originale unverändert. Mehrdeutige ältere Textänderungen bleiben konservativ als ein zusammenhängender Block erhalten.
