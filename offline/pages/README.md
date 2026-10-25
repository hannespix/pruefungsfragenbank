# Verschlüsselter GitHub-Pages-Praxistest

Die Website enthält die Anwendung und einen verschlüsselten Aufgabenbestand. Das Passwort wird ausschließlich lokal zum Entschlüsseln verwendet und ist weder im Repository noch in Actions-Secrets enthalten. Kein Serverkonto, keine gemeinsame Speicherung.

## Nutzung

- HTTPS-Adresse öffnen, Zugangspasswort einfügen.
- Originalbestand bearbeiten, Zwischen-/Abschlussprüfung auswählen, neue Prüfungen erstellen.
- Vor dem Schließen **Projekt sichern**. Projektdateien, Gruppenpakete und Prüfungsexporte sind ausdrücklich **unverschlüsselt und vertraulich**. Sie benötigen einen geeigneten Speicherort.
- Zum Weiterarbeiten nach erneutem Entschlüsseln die zuletzt exportierte Projektdatei öffnen.
- Sitzung schließen verwirft den Arbeitsstand nach Bestätigung. Auch Browserabsturz kann nicht exportierte Änderungen verlieren. Es gibt absichtlich keine Klartextspeicherung in IndexedDB oder Local Storage. Auch aus dieser Testversion exportierte Gruppen-HTML-Dateien arbeiten nur im Sitzungsspeicher; dort regelmäßig „Projekt sichern“ verwenden.

## Sicherheitsgrenze

AES-256-GCM, PBKDF2-SHA256 mit 600000 Iterationen, 16 zufällige Salt-Bytes, 12 zufällige Nonce-Bytes; gesamte JSON inklusive Originaldokumenten/Anlagen wird vor der Verschlüsselung gzip-komprimiert. Passwort mit mindestens 24 zufälligen Zeichen separat verteilen. Entschlüsselung über Web Crypto und DecompressionStream, nur in aktuellen Browsern über HTTPS. Die innere App läuft in einem Sandbox-Iframe ohne Same-Origin-Recht und mit eigener CSP ohne Netzwerkzugriffe.

Die öffentliche Website und Repository-Historie enthalten den Ciphertext. Wer ihn und das Passwort erhalten hat, kann ihn auch nach Abschaltung entschlüsseln. Passwortwechsel schützt alte Kopien nicht. Keine technische Screenshot-Sperre, keine Fernlöschung, kein produktiver Zugangsdienst. Die Betreiber des Codes könnten die Website verändern; GitHub-Konto und Schreibrechte müssen deshalb geschützt bleiben.

## Bestand aktualisieren

Nur lokal, niemals in Actions. Originaldaten und Passwort außerhalb des Repositorys halten. `seal.cjs` liest das Passwort aus einer Datei, nicht aus Kommandozeilenargumenten. Mit neuem zufälligem Passwort und einem neuen Ausgabeverzeichnis versiegeln:

```sh
node offline/tools/seal.cjs --seed /private/bestand.json --password-file /private/zugang.password.txt --out /private/sealed-new
```

Den erzeugten Ordner prüfen und nur `manifest.json` und `part-*.bin` unter `offline/pages/sealed/` ersetzen. Das Ausgangsverzeichnis enthält niemals HTML, JSON-Klartextbestände oder Passwörter. `build_pages.py` lehnt zusätzliche Dateien im versiegelten Ordner und bereits bestehende Ausgabeordner ab. Actions veröffentlicht ausschließlich `pages-dist`, nie den Repository-Wurzelordner oder lokale Offline-Builds.

## Abschalten

Zuerst den Workflow **Encrypted HortiExam Pages** unter Actions deaktivieren, damit Änderungen die Seite nicht erneut bereitstellen. Anschließend unter Settings → Pages die Site über **Unpublish site** zurückziehen. Das entfernt weder heruntergeladene Kopien noch Ciphertext aus der Git-Historie.

Für Gruppenrechte, widerrufbare Zugänge und gemeinsame Speicherung ist weiterhin ein echtes Backend vorgesehen, z. B. PHP und MySQL bei webgo.
