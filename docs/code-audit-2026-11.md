# Code-Audit November 2026

Geprüft wurden alle drei Teile des Repos: die Flask-App, `offline/` und `online/`, dazu die Build-Skripte und die CI.
Jeder Befund wurde am Code nachvollzogen und, wo es ging, mit einem Skript reproduziert.
Behobene Befunde haben einen Regressionstest. Dieser schlägt gegen den alten Code fehl und läuft mit dem Fix durch.

## Behoben

| Schwere | Bereich | Befund | Fix |
|---|---|---|---|
| kritisch | Flask | `debug=True` auf `0.0.0.0`: Werkzeug-Debugger und Tracebacks im LAN erreichbar, mit gefälschtem `Host`-Header bis zur Konsole | Debug nur mit `HORTIEXAM_DEBUG=1` und dann nur auf `127.0.0.1` |
| hoch | Flask | `SECRET_KEY` fest im Quelltext, in jeder `.exe` gleich | aus der Umgebung oder einmalig zufällig erzeugt in `instance/secret_key` |
| hoch | Flask | Gespeicherte API-Schlüssel per `GET /settings/api/<id>` im Klartext an jeden im LAN | Schlüssel wird nie mehr ausgeliefert, ein leeres Feld behält ihn, Entfernen per Checkbox |
| hoch | Flask | Stored XSS: Fragen-HTML wird nur im Browser bereinigt, die JSON-Routen speichern beliebiges HTML; Kategorie und Tags werden unescaped gerendert | serverseitige Allowlist (`html_sanitizer.py`) beim Schreiben und Lesen; Metadaten escapen |
| hoch | Offline/Online | Stored XSS über Fachwerker-Unteraufgaben (`btn()` escaped Labels nicht); online lesbar: Session-Token | `E(name)` |
| mittel | Flask | CSRF: fremde Seiten konnten `/settings` absenden (z. B. die Standard-KI umbiegen) | Origin-/Referer-Prüfung für alle schreibenden Anfragen |
| mittel | Flask | Neue Prüfungsfragen bekamen alle Position 0 (`max or -1`) | `None`-Prüfung |
| mittel | Flask | Jede Bearbeitung löschte `category_code` | nur überschreiben, wenn das Feld mitgeschickt wird |
| mittel | Flask | Export: 500 bei Zeilenumbruch im Titel, `&amp;` im Word-Text, Exportdateien blieben liegen | Export im Speicher, Entities auflösen, Dateiname bereinigen |
| mittel | Online | Unangemeldete Anfragen mit 18 MB wurden vollständig gepuffert und geparst | Body wird erst nach Session- und Rollenprüfung gelesen |
| mittel | Online | Jede Speicherung durch eine Gruppe löschte die verborgenen Quellen-Anlagen und machte den `reviewKey` der Koordination ungültig | verborgene Links werden wiederhergestellt |
| mittel | Offline | „Lösungsstatus herabsetzen“ galt als Bestätigung der Freigabe für geänderten Inhalt | nur Freigabe mit Namen bestätigt |
| mittel | Offline | Online-Import wurde lokal übernommen, bevor der Server ihn angenommen hatte; ein abgelehnter Import blockierte alle weiteren Speicherungen | erst zentral speichern, dann übernehmen |
| mittel | Offline | Gleitkommasummen: 180-Minuten-Prüfung (Fachwerker) scheiterte an `179.99999999999997`; Import ergab `3.6999999999999997` Punkte | auf Hundertstel runden bzw. mit Toleranz vergleichen |
| niedrig | Offline | Ausdrucke zeigten `30.299999999999997 Punkte`; offene Kriterien bekamen 0 Punkte; UTC- statt Ortsdatum; `merge()` mit IDs wie `constructor`; U+FFFF im Word-Export; Jahreszahl nach `_` nicht erkannt; Drag-and-drop auf sich selbst | siehe Commit `fix(offline)` |
| niedrig | Online | Login-Limit pro einzelner IPv6-Adresse umgehbar, Limiter-Zeilen wuchsen unbegrenzt; Nicht-Objekt-JSON führte zu 500 | Limit pro /64, Aufräumen, 400 |
| niedrig | Build/CI | Mehrfach-Ersetzung der Platzhalter (Seed-Text `/*HELP*/` zerstört den Build); `rmtree` ohne Prüfung; `build_pages.py` akzeptierte Symlinks und beliebige Manifeste; Pages-Deploy von jedem Branch | Ersetzung in einem Durchgang (Ausgabe byte-identisch), Prüfungen, Deploy nur von `main` |

## Offen – Empfehlungen nach Priorität

1. **Flask-App stilllegen oder absichern.** Sie hat keinerlei Anmeldung: Jede Person im LAN kann alles lesen, ändern und löschen. Die API-URL der KI ist frei wählbar (SSRF ins interne Netz). `offline/` und `online/` decken den Funktionsumfang ab und sind deutlich besser abgesichert. Empfehlung: archivieren. Wenn sie bleiben soll: Anmeldung (mindestens ein gemeinsames Passwort), Allowlist für die API-URL und Werkzeug fest pinnen.
2. **Verschlüsseltes Datenpaket im öffentlichen Repo.** `offline/pages/sealed/` (18 MB) ist öffentlich. Die Verschlüsselung ist solide (PBKDF2 mit 600k Iterationen, AES-GCM). Trotzdem kann der Chiffretext dauerhaft offline angegriffen werden, und ein Schlüsselwechsel wirkt nicht rückwirkend, weil die Git-Historie bleibt. Wird das Paket nicht mehr gebraucht (der Pages-Workflow nutzt `online/`), sollte es aus dem Repo verschwinden.
3. **Versionen nach Löschen (Online).** Wird ein Datensatz gelöscht und mit derselben ID neu angelegt, beginnt seine Version wieder bei 1. Ein veralteter Tab kann ihn dann überschreiben (ABA-Problem). Lösung: Versionen streng monoton vergeben (`max(clock, version)+1`). Das ändert die Versionswerte, die die Tests fest erwarten, deshalb gehört es in einen eigenen PR.
4. **Falsche Konflikte (409).** Der Schreibschutz prüft eine globale Uhr. Jeder Fehler im Batch wird nach drei Versuchen zu „Gleichzeitige Änderung“. Besser: pro Datensatz prüfen und nur bei Guard-Fehlern erneut versuchen.
5. **Herkunft und Sitzung.** `ALLOWED_ORIGIN=https://hannespix.github.io` gilt für jede Pages-Seite des Kontos, und das Token liegt im sessionStorage dieser Herkunft. Eine eigene Domain für die App trennt das.
6. **CI-Secrets.** `CLOUDFLARE_API_TOKEN` und `ANTHROPIC_API_KEY` liegen als Repository-Secrets vor. Sicherer ist ein Environment, das nur `main` nutzen darf und eine Freigabe verlangt. Actions per Commit-SHA pinnen.
7. **Abhängigkeiten.** `npm audit`: `wrangler@4.152.0` zieht ein verwundbares `undici` nach (nur Dev-Tooling). Auf `wrangler@4.157+` aktualisieren.
8. **UX-Datenverlust.** Esc, ✕ oder „Abbrechen“ im Aufgabeneditor verwerfen Eingaben ohne Rückfrage. Ein ungültiger gespeicherter Projektstand wird als „Browser-Speicher nicht verfügbar“ gemeldet.
9. **Wartbarkeit.** `app.js` (242 KB) und `worker.js` sind im Minified-Stil geschrieben (Zeilen bis 11 KB). Reviews und Diffs sind dadurch kaum möglich. Formatieren und nach Ansichten aufteilen; ein auto-escapendes `html`-Template einführen, damit `btn()` standardmäßig escaped.
10. **Barrierefreiheit.** Rund 20 Formularfelder (z. B. `exam-title`, `task-type`) haben kein `<label for>`.
11. **Aufräumen in D1.** Gelöschte Anlagen bleiben in `assets` und `asset_chunks`. Abgelaufene Sessions werden nie entfernt. Ein geplanter Job sollte beides löschen, auch wegen der Speicherzusage für die EU.
