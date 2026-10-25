# Originalseiten Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** Unveränderten Originalwortlaut und Vorder-/Rückseitenaufteilung im neuen CI für neue Prüfungen verwenden.
**Architecture:** Quellenbezogene Seitenmodelle in privaten Aufgabendatensätzen, geschützte Anlagen, gemeinsamer Renderer für Editor und Export.
**Tech Stack:** Vanilla JavaScript, vorhandene Cloudflare-Datenhaltung, Python/PyMuPDF und LibreOffice für die einmalige Quellaufbereitung.
**Spec:** ../specs/2026-10-26-original-pages-design.md

## Global Constraints
- Originaltexte, Zugangsdaten und private CI-Anlagen bleiben außerhalb des öffentlichen Repository.
- Bestehende Entwürfe und bereits eingesetzte Prüfungen nicht stillschweigend überschreiben.
- Seitentext gegen HTML-Injektion escapen; Anlagenverweise auf freigegebene Aufgabenanlagen begrenzen.
- Vor Veröffentlichung Original und neue Ausgabe visuell vergleichen, einschließlich Rückseiten.

## Review Focus
- Ungerade Seitenzahlen: nächste Aufgabe beginnt vorn, keine verschobene Rückseite.
- Nachträgliche Textänderungen: kein veralteter Originaltext im Export.
- Vertrauliche Lösungen: nur in Prüferfassung.
- Fehlende Anlagen oder überfüllte Textblöcke: erkennbar, kein stiller unvollständiger Druck.
- Ungewöhnliche Vorlagen: komplexe Tabellen, Zeichnungen, mehr als zwei Seiten.

### 1 Quellenaufbereitung
- [x] Originale nach PDF rendern, vollständige Text-/Seitenstruktur erfassen und Audit erstellen.
- [x] Werkzeug `offline/tools/extract_layout.py` erstellt seitenbezogene JSON-Modelle und Hintergrundanlagen, kein Seed im Repository.
- [x] Repräsentative ZP/AP einschließlich mehrseitiger Planung visuell prüfen.

### 2 Seitenmodell und Renderer
- [x] Regressionstests: Originaltexte/zweite Seite, Duplexreihenfolge, unveraltete Änderungen, HTML-Escaping, Prüferinhalte.
- [x] `offline/src/source-layout.js` validiert und rendert Modelle; `core.js`, `paper.js` und Buildskripte integrieren.
- [x] Editor unterstützt direkte Textblockänderungen, Seitenwahl und unveränderte Rechte.
- [x] Originalseiten im Export ohne generische Deckblätter; Lösungen gesondert.

### 3 Daten und Veröffentlichung
- [x] Migration gegen aktuelle Versionen vorbereiten, prüfen und nur Aufgabenbank/benötigte Anlagen ergänzen.
- [x] Hilfe erläutert Originalseiten, Bearbeitung und Druck im Duplexformat.
- [x] Tests/Builds, Rendering und unabhängige Codeprüfung; nötige Backendvalidierung bereitstellen.
- [ ] PR erstellen, CI abwarten, zusammenführen, Pages und privaten Datenbestand prüfen.

## Verification evidence
- 229 tasks associated with original page models; 464 source pages. Private text audit retained with corpus.
- 85 offline JavaScript tests, 42 online tests and 3 Python extraction tests pass.
- Browser check of all source blocks: no overflow warnings. Direct editing and reverse-page navigation verified.
- Representative ZP/AP print renders retain 2, 2 and 4 source pages; reverse planning fields visually compared.
- Independent review completed; import collision references, mixed solution order and bank figure visibility corrected.
- Worker validation deployed with existing secret and D1 bindings preserved.
