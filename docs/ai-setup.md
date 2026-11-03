# Optionale KI-Schreibhilfe einrichten

Die Schreibhilfe benötigt einen Anthropic-API-Schlüssel. Er bleibt im geschützten Cloudflare-Worker `hortiexam-access`; der öffentliche Browser-Client bekommt ihn nicht. Die Einrichtung erfolgt einmal über einen manuellen GitHub-Workflow. Ohne Einrichtung bleibt das manuelle Bearbeiten möglich.

## 1. Zwei GitHub Secrets vorbereiten

Im Repository [hannespix/pruefungsfragenbank](https://github.com/hannespix/pruefungsfragenbank) **Settings → Secrets and variables → Actions → Secrets → New repository secret** öffnen. Alternativ direkt die [Actions-Secrets-Einstellungen](https://github.com/hannespix/pruefungsfragenbank/settings/secrets/actions) verwenden.

Diese beiden Einträge als **Repository Secrets**, nicht als Variables, anlegen:

| Name – genau so eingeben | Inhalt |
| --- | --- |
| `ANTHROPIC_API_KEY` | Der eigene Anthropic-API-Schlüssel, ohne Anführungszeichen, Leerzeichen oder Zeilenumbrüche |
| `CLOUDFLARE_API_TOKEN` | Ein Cloudflare-API-Token mit der unten beschriebenen Berechtigung |

Den Wert nur in GitHubs Feld **Secret** einfügen und **Add secret** wählen. Ein Name wie `APIsecret` wird vom Workflow nicht verwendet. Schlüssel nicht in Issues, Chat, Dateien, Workflow-Eingaben oder Kommandozeilenargumente kopieren.

**Warum ein zweites Secret?** GitHub speichert den Anthropic-Schlüssel zunächst nur für Actions. Der vorhandene Pages-Workflow baut die öffentliche Oberfläche und kann dem getrennt betriebenen Cloudflare-Worker kein Secret bereitstellen. `CLOUDFLARE_API_TOKEN` erlaubt dem Einrichtungsworkflow, den Schlüssel direkt an Cloudflare zu übertragen. Ein GitHub-Token oder die vorhandene Cloudflare-Verbindung im Chat ersetzt diesen Token nicht.

## 2. Den Cloudflare-Token erstellen

1. Bei [Cloudflare](https://dash.cloudflare.com/profile/api-tokens) **My Profile → API Tokens → Create Token → Create Custom Token** öffnen.
2. Einen verständlichen Namen wie `HortiExam KI-Secret` vergeben.
3. Genau die benötigte Berechtigung wählen: **Account → Workers Scripts → Edit**. In der API-Dokumentation heißt sie `Workers Scripts Write`. Keine DNS-, Zone-, D1- oder Kontoverwaltungsrechte hinzufügen.
4. Unter **Account Resources** auf **Include → Specific account** begrenzen und das Konto mit der ID `75bd02fca8d386c43fa477bfb15a4b67` auswählen. Dieses Recht gilt für Worker-Skripte dieses Kontos; es ist kein auf ein einzelnes Secret begrenztes Recht.
5. **Continue to summary → Create Token** wählen. Den angezeigten Token als Repository Secret `CLOUDFLARE_API_TOKEN` hinterlegen.

## 3. Aktivieren oder den Schlüssel ersetzen

Voraussetzung: Der Workflow und die KI-Version des Workers müssen bereits veröffentlicht sein. Der Einrichtungsworkflow aktualisiert ausschließlich das Secret und lädt keinen Anwendungscode hoch.

1. Im Repository **Actions → KI-Schreibhilfe einrichten → Run workflow** öffnen. Der Workflow erscheint, sobald die Datei auf `main` liegt.
2. Als Branch **main** und als Aktion **aktivieren-oder-aktualisieren** auswählen.
3. **Run workflow** anklicken und den erfolgreichen Abschluss abwarten. Läufe anderer Branches werden übersprungen; Pushes und Pull Requests starten keine Einrichtung.
4. HortiExam neu laden, anmelden und die Schreibhilfe bei einem kurzen, unkritischen Beispieltext ausprobieren. Erst **Vorschlag erstellen** sendet den ausgewählten Text an Anthropic. Der Vorschlag muss anschließend geprüft und ausdrücklich übernommen werden.

Ein grüner Einrichtungslauf bestätigt die Speicherung bei Cloudflare. Er prüft weder die Gültigkeit des Anthropic-Schlüssels noch Guthaben oder Modellzugriff und sendet keine Testanfrage an Anthropic. Bei Nutzung können Anthropic-API-Kosten entstehen.

Zum Schlüsselwechsel das GitHub Secret `ANTHROPIC_API_KEY` bearbeiten und denselben Workflow erneut starten. Nur das GitHub Secret zu ändern aktualisiert den laufenden Worker noch nicht.

## 4. Deaktivieren

Unter **Actions → KI-Schreibhilfe einrichten → Run workflow** den Branch **main** und die Aktion **deaktivieren** wählen. Der Workflow entfernt ausschließlich `ANTHROPIC_API_KEY` aus dem Worker. Dafür wird nur `CLOUDFLARE_API_TOKEN` benötigt.

Das Anthropic-Secret bleibt in GitHub erhalten, damit die Schreibhilfe später erneut aktiviert werden kann. Zum vollständigen Aufräumen nach erfolgreicher Deaktivierung auch das GitHub Secret löschen und bei Bedarf den Anthropic-Schlüssel beim Anbieter widerrufen. Das bloße Löschen des GitHub Secrets deaktiviert den bereits eingerichteten Worker nicht.

Ein abgelaufener oder widerrufener Cloudflare-Token verhindert spätere Einrichtungs- und Deaktivierungsläufe; er schaltet eine bereits aktive Schreibhilfe nicht ab. Bei fehlendem Token kann `ANTHROPIC_API_KEY` auch direkt in der Konfiguration des Workers bei Cloudflare entfernt werden.

## Wenn die Einrichtung fehlschlägt

- **Secret fehlt oder ist ungültig:** Namen und Inhalte in GitHub prüfen; beide Einträge müssen Actions-Repository-Secrets sein. Der Schlüssel darf keine Leerzeichen oder Zeilenumbrüche enthalten.
- **Cloudflare hat die Änderung nicht bestätigt:** Token, Kontozuordnung, Berechtigung und Vorhandensein des Workers `hortiexam-access` prüfen. Nach einem Verbindungsabbruch kann die Änderung bereits erfolgt sein; den Zustand im Cloudflare-Dashboard prüfen und gegebenenfalls erneut starten.
- **Einrichtung erfolgreich, Schreibhilfe trotzdem nicht nutzbar:** App neu laden und prüfen, ob die aktuelle Worker-Version veröffentlicht ist. Gültigkeit, Guthaben und Modellzugriff des Anthropic-Schlüssels beim Anbieter prüfen. Der aktuelle Worker verwendet standardmäßig `claude-sonnet-5-5`.

Bei einer fehlgeschlagenen Nutzung nennt die App die erkannte Ursache, ohne den Schlüssel oder die Anbieter-Antwort anzuzeigen:

| Meldung | Nächster Schritt der zuständigen Stelle |
| --- | --- |
| API-Schlüssel abgewiesen | Einen gültigen Anthropic-API-Schlüssel als GitHub Secret hinterlegen und den Einrichtungsworkflow erneut ausführen. |
| Berechtigung für Modell oder Arbeitsbereich fehlt | Modellzugriff und Arbeitsbereich des Schlüssels in der Claude Console prüfen. |
| API-Guthaben aufgebraucht oder Abrechnung abgewiesen | [Abrechnung und Guthaben](https://platform.claude.com/settings/billing) der zum Schlüssel gehörenden Organisation prüfen. Der grüne GitHub-Lauf prüft dieses Guthaben nicht. |
| Ausgabenlimit erreicht | Das Organisations- oder Arbeitsbereichslimit in der Claude Console prüfen; wiederholte Versuche heben es nicht auf. |
| Arbeitsbereich erforderlich oder nicht verfügbar | Einen API-Schlüssel verwenden, der auf den gewünschten Arbeitsbereich begrenzt ist, und die Einrichtung erneut ausführen. Organisationsweite Schlüssel benötigen bei Anthropic zusätzlich eine Arbeitsbereichsangabe; diese Anwendung verwendet einen auf einen Arbeitsbereich begrenzten Schlüssel. |
| Modell nicht verfügbar | Modellname und Modellzugriff prüfen. Ohne eigene Worker-Variable `ANTHROPIC_MODEL` wird `claude-sonnet-5-5` verwendet. |
| Anfragelimit erreicht oder Anbieter überlastet | Später erneut versuchen. Es gibt keine automatischen Wiederholungen. |
| Anfrageformat abgelehnt | Die Worker-Konfiguration und ihre Kompatibilität mit der Anthropic-API prüfen; den Schlüssel nicht vorsorglich austauschen. |
| Vorübergehend nicht erreichbar | Verbindung oder Anbieterbetrieb prüfen; diese Meldung allein belegt keinen ungültigen Schlüssel. |
| Verbindung nicht hergestellt oder Antwort nicht vollständig gelesen | Verbindung vom Worker zum Anbieter prüfen; die Meldung unterscheidet den Verbindungsaufbau vom Lesen der Antwort. |
| Unerwartete Weiterleitung | Die feste Anbieteradresse und Verbindung prüfen. Der Worker folgt keinen Weiterleitungen und gibt dabei weder Schlüssel noch Prüfungstext weiter. |

Eine Anbieter-Ablehnung meldet die App als Dienstfehler, ohne die eigene HortiExam-Anmeldung zu beenden. Zur Einordnung bestimmter Fehler liest der Worker höchstens 8 KiB der Fehlerantwort und erkennt ausschließlich bekannte Fehlerarten und dokumentierte Meldungsanfänge. Er gibt nur eigene feste Meldungen zurück und protokolliert weder Anbietertext noch Schlüssel oder Prüfungstext.

Die KI-Anfrage verwendet `redirect: 'manual'` und lehnt HTTP-Weiterleitungen ab.
Cloudflare Workers unterstützt `redirect: 'error'` nicht; dieser Wert bricht
bereits den Aufbau der Anfrage mit einem `TypeError` ab. Node-Tests allein
erkennen diesen Unterschied nicht. Ein Regressionstest bildet die Einschränkung
nach und prüft, dass auch mit `manual` keine Weiterleitung verfolgt wird.

Die Einrichtung schreibt keine Schlüssel oder Anbieter-Antworten in Logs oder Artefakte. Sie übergibt Zugangsdaten ausschließlich als Umgebungsvariablen an das Skript und verwendet die Cloudflare-API für genau ein Secret. Worker-Code, Datenbankbindung und andere Secrets werden dabei erhalten. Ein Lauf dauert höchstens drei Minuten; die API-Anfrage hat ein Zeitlimit von 20 Sekunden und folgt keinen Weiterleitungen.

## Technische Referenzen

- [GitHub: Secrets in Actions verwenden](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets)
- [Cloudflare: API-Token erstellen](https://developers.cloudflare.com/fundamentals/api/get-started/create-token/)
- [Cloudflare: einzelnes Worker-Secret setzen](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/secrets/methods/update/)
- [Cloudflare: einzelnes Worker-Secret löschen](https://developers.cloudflare.com/api/resources/workers/subresources/scripts/subresources/secrets/methods/delete/)
- [Anthropic: API-Fehler](https://platform.claude.com/docs/en/api/errors)
- [Anthropic: Authentifizierung und Arbeitsbereich](https://platform.claude.com/docs/en/manage-claude/authentication)
- [Anthropic: Anfragen- und Ausgabenlimits](https://platform.claude.com/docs/en/api/rate-limits)
- [Anthropic: Claude Sonnet 5.5](https://platform.claude.com/docs/en/models/sonnet-5-5/overview)
- [Cloudflare: unterstützte Request- und Redirect-Optionen](https://developers.cloudflare.com/workers/runtime-apis/request/)

API-Endpunkte und Rechte geprüft am 3. November 2026. Lokale Tests mit synthetischen Werten: `node --test online/tests/ai-secret.test.mjs`.
