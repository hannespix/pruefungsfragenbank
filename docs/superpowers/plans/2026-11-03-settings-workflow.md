# Zentrale Grundeinstellungen und geführte Prüfungserstellung

**Goal:** Die zuständige Stelle verwaltet Themen und organisatorische Standards zentral. Prüfende wählen zuerst Themen, dann Aufgaben und prüfen schließlich die bearbeitbaren Seiten samt Materiallisten und mündlichem Prüfungsteil.

**Architecture:** Private, nach Prüfungsbereich getrennte `settings`-Datensätze überlagern stabile Kategorienkennungen. Neue Prüfungen speichern einen eigenen Katalogstand. Praktische Aufgaben bleiben in `items`; eine mündliche Aufgabe wird separat in `oralItem` gespeichert. Materiallisten sind organisatorische Metadaten, keine Änderung am Originalwortlaut.

**Tech Stack:** Bestehende JavaScript-Domänenmodule und Browseroberfläche; Cloudflare Worker/D1-Datensätze; GitHub Pages ohne eingebettete Prüfungsdaten.

## Unveränderliche Grenzen

- ZP-Standard: neun vorgegebene Generalthemen, Einzelaufgaben, höchstens eine Aufgabe je ausgewähltem Thema.
- AP: fünf komplexe praktische Aufgaben, bestehende Bereichsminima und rechtliche Dauergrenze bleiben geschützt. Administrierbare Themen dürfen diese Regeln nicht aufheben.
- Keine automatischen Änderungen an verwendeten Prüfungen oder Quelldokumenten. Neue Prüfungen übernehmen einen eingefrorenen Kategorienstand.
- Gruppenzugänge dürfen ihre Prüfung bearbeiten und vorgesehene Themen auswählen, aber keine zentralen Einstellungen ändern oder Katalog-/Regeldefinitionen fälschen.
- Historische Namen und Zuordnungen bleiben nach zentralen Änderungen nachvollziehbar. Verwendete Kategorien werden ausgeblendet statt aus alten Datensätzen entfernt.
- Interne Bemerkungen und zusätzliche organisatorische Materiallisten gehören nicht in Teilnehmerausgaben.

## Zentrale Einstellungen

- [x] `settings` als optionale, additive Projektkollektion (D1 `records`, keine neue Tabelle); alte Projekte erhalten eine leere Liste.
- [x] ZP-Konfiguration fachrichtungsübergreifend, AP/FW je Fachrichtung; Namen, Hilfetext, Reihenfolge, Sichtbarkeit, eigene Kategorien und organisatorische Standardangaben.
- [x] Reine Auflösung ohne globalen veränderlichen Katalog: `settingsFor`, `resolveCatalog`, `checkSettings`, `snapshotPattern`, `examContext` in der Planungsdomäne.
- [x] Eigene Kategorien nur explizit zuordnen. Umbenennungen ändern weder Originaltexte noch automatische Quellenerkennung.
- [x] Neue Prüfungsmuster enthalten `categoryDefinitions`; alte Muster ohne Definitionen behalten ihre bisherige Auslegung.
- [x] Eigene AP-Kategorien benötigen eine fachlich begründete Bereichszuordnung; kein automatischer gesetzlicher Status durch eine Einstellung.
- [x] Administrator-Seite mit Bereichsauswahl, verständlichen Bearbeiten-/Entfernen-/Wiederherstellen-Aktionen und Vorschau der Standardangaben.

## Materiallisten

- [x] `materials` pro praktischer Aufgabe: bearbeitbarer Text, `proposal`/`confirmed`, begrenzte Herkunftsangaben. Fehlende Felder bleiben für Altbestände zulässig.
- [x] Explizite Materialabschnitte bevorzugen; sonst vorsichtige allgemeine Vorschläge ohne erfundene Mengen oder Produktspezifikationen. Nie automatisch bestätigen.
- [x] Änderungen am Arbeitsauftrag bzw. Übernahme in eine neue Prüfung setzen die Materialbestätigung zurück. Materialänderungen allein entziehen keine fachliche Inhaltsfreigabe.
- [x] Eigene organisatorische Gesamtübersicht; keine Zusatzmaterialdaten in Teilnehmerausgaben. Materialstatus im abschließenden Prüfschritt sichtbar.

## Mündliche Aufgabe

- [x] Genau ein separates `oralItem` für neue AP/FW_AP, keines für ZP. Fachrichtung, Ausbildungsgang und `kind: oral` müssen exakt passen.
- [x] `examEntries`, `findExamItem`, `setOralItem`, `removeOralItem`, `oralStatus`, `oralTotals` in der Kerndomäne; praktische Summen und Bereichsregeln bleiben auf `items` begrenzt.
- [x] Vorhandene 28 Gärtner-AP-Vorlagen anbieten. Fehlende FW-Vorlagen als fehlend anzeigen; keine automatische Übertragung von Gärtner-Aufgaben auf Fachwerker.
- [x] Mündliche Originalseiten, Anlagen, Lösungen und Bearbeitungen durch WYSIWYG, Vorschau und Word führen; historische Berichtsheft-Zulassungen in neuen Kopien bereinigen.
- [x] Herkunft, Einsatzhistorie, Backup/Import, Konfliktkopien und serverseitige Zugriffsbeschränkungen berücksichtigen.
- [x] Fehlende mündliche Aufgabe verhindert die abschließende Übergabe; ungeklärte Lösungen/Punkte bleiben sichtbar. Diese Vorgabe ist eine organisatorische Nutzervorgabe und wird nicht als zusätzliche gesetzliche Pflicht bezeichnet.

## Geführter Ablauf

- [x] Schritt 1: Generalthemen/Themen auswählen, klare Bereichsregeln und Aufgabenverfügbarkeit anzeigen.
- [x] Schritt 2: passende praktische Aufgaben und bei AP einmal die mündliche Aufgabe auswählen; Änderungen direkt auf den Seiten bearbeiten.
- [x] Schritt 3: Materialien, interne Bemerkungen und offene Hinweise durchsehen; anschließend zentrale Speicherung abwarten und zur Übersicht zurückkehren.
- [x] ZP-Gruppen dürfen nur die gültige Auswahl der Themen ändern; der zugrunde liegende Kategorienstand bleibt geschützt. AP-Themenwahl steuert die Aufgabenangebote, ersetzt keine Bereichsprüfung.

## Nachweise

- [x] Eigene Kategorien, Umbenennen, Ausblenden, stabile Altprüfungen, Importkonflikte und serverseitige Rechte testen.
- [x] Materialherkunft, Bestätigungswechsel, unveränderter Originaltext und vertrauliche Ausgabegrenzen testen.
- [x] Mündliches Singleton, Scope-Abweisung, unveränderte praktische Summen, Anlagen und HTML/Word-Ausgaben testen.
- [x] Geführten Ablauf auf Desktop/Mobilgerät sowie Speicherfehler und Rückkehr zur Übersicht prüfen.
- [x] Vollständige lokale Prüfung: 288 Offline- und 187 Online-Tests bestanden.
- [x] Unabhängige Domänen-, Export- und UI-Prüfung; alle konkreten Befunde behoben und regressionsgeprüft.
- [ ] PR/Merge und Deployment; Veröffentlichung wird über die GitHub-Checks und den laufenden Worker geprüft.

## Fachwerker-Logo und freigegebene Prüfungsarten

- [x] Arbeitsbereiche speichern erlaubte Prüfungsarten pro Fachrichtung; vorhandene Entwürfe bleiben erreichbar. Neue Gruppenprüfungen und Kopien prüfen die Erlaubnis auch serverseitig.
- [x] Vorhandenes BW-Logo für FW-Vorlagen nutzen. Fehlender Logoplatz wird nur nach Nachweis vollständig freier Bildfläche ergänzt; HTML und Word nutzen dieselbe Position.
- [x] Alle zwölf vorhandenen FW-Vorlagen bestehen die Pixelprüfung des vorgesehenen Logobereichs. Prüfung erfolgt lokal; Originaldaten bleiben unverändert.

## Betriebsgrenzen

Neue Datenfelder sind additiv; keine Bestandsmigration oder Änderung vorhandener Quelldateien ist nötig. Materialvorschläge und fachlich ungeprüfte Lösungen bleiben ausdrücklich ungeprüft. Für FW fehlen im Altbestand mündliche Vorlagen; die zuständige Stelle kann sie passend anlegen. Der pausierte KI-API-Zugang wird durch diese Änderung nicht eingerichtet.
