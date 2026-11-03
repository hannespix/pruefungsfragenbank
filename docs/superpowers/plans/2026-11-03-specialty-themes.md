# Fachrichtungsspezifische ZP-Themen

Ursache: `zwischenpruefungScope` gab die neun Generalthemen unabhängig von der
Fachrichtung zurück; neue gemeinsame Grundeinstellungen verstärkten dies.

Entscheidung: Gemeinsame sechs Grundthemen nach § 8, belegte lokale Ergänzungen
nach Fachrichtung; ausdrückliche administrative Erweiterung nur je Fachrichtung.
Keine starre Verbotsliste und keine automatische Freischaltung aus beliebigen
Stichwörtern. Belege und Grenzen: [Quellenabgleich](../../zp-specialty-themes.md).

- [x] Aktuelle Excelquelle und importierte Originaltexte prüfen; Fehler reproduzieren.
- [x] Gemeinsame Kataloglogik und fachrichtungsbezogene Einstellungen korrigieren.
- [x] Historische Stände lesbar erhalten; neue Auswahl/Rotation gemeinsam begrenzen.
- [x] Server: keine zusätzlichen fremden Themen über Altstände einschleusen.
- [x] UI-Regressionsprüfung, unabhängige Review, vollständige Tests und Builds.
- [x] Kompatiblen Worker bereitstellen; KI-Aufruf mit synthetischem Text live prüfen.

Zusätzlich behoben: Der KI-Aufruf scheiterte an `redirect: 'error'`, das die
Workers-Laufzeit nicht unterstützt. `manual` mit ausdrücklicher Ablehnung von
Weiterleitungen erhält den Schutz der Zugangsdaten. Anbieterfehler werden
begrenzt und ohne vertrauliche Antwortinhalte eingeordnet. Der überflüssige
Source-Map-Verweis von pdf-lib wurde entfernt; die CSP bleibt unverändert.

Verifiziert: 293 Offline-Tests, 227 Online-Tests, drei Python-Tests und Builds;
Live-KI-Test mit HTTP 200 und korrigiertem synthetischem Text. Veröffentlichung
über PR und Pages-Workflow; anschließend Vergleich der öffentlichen Datei
mit dem lokalen Build.
