# Einladungen während der Freigabe wieder anzeigen

## Ursache

Der Browser hält Einladungstexte nur in einer Map. D1 speichert bislang lediglich deren Hash. Nach Neuladen oder erneuter Anmeldung gibt es daher keinen darstellbaren QR-Inhalt mehr, obwohl die Einladung weiter gültig ist.

## Umsetzung

- [x] Reproduzierender API-/Clienttest: öffnen, abmelden/neu anmelden, dieselben Wörter und Links wieder erhalten; vorhandener Gruppenzugang bleibt gültig.
- [x] Eigene Tabelle `invitation_codes` für verschlüsselte darstellbare Codes; unabhängiges Worker-Secret `INVITATION_VAULT_KEY`, AES-GCM mit zufälliger Nonce und gebundenen Metadaten. Keine Einladungstexte in Projektbackup, Logs oder Browser-Dauerspeicher.
- [x] Nur die zuständige Stelle kann aktive Einladungen über `/api/access/invitations` abrufen. Schließen, Ablauf und neue Generation verhindern Abruf; Neuanzeigen verändert keine bestehende Freigabe.
- [x] Für ältere Hash-only-Freigaben einmalig zusätzliche Einladungen anlegen, da die früheren Texte nicht rekonstruierbar sind. Bereits verteilte Links und bestätigte Geräte bleiben gültig. Gleichzeitige Abrufe liefern denselben gespeicherten Code.
- [x] Browser lädt die Einladungen beim Öffnen von „QR-Code & Zugang“ nach. Kopieren und Drucken funktionieren auch nach erneuter Anmeldung.
- [x] Hilfe präzisieren; Rechte, Ablauf, Nebenläufigkeit und verschlüsselte Speicherung testen.
- [x] Unabhängige Backend-/UI-Review, 288 Offline-, 203 Online- und 3 Python-Tests; alle Builds erfolgreich.
- [x] Additive Tabelle und separates Worker-Secret eingerichtet; Worker-Inhalt nach Veröffentlichung vollständig abgeglichen. Live-Prüfung: sechs Codes nach neuer Anmeldung identisch, Freigabe und Gerätezustände unverändert.
- [ ] PR zusammenführen und Pages-Deployment mit lokalem Build vergleichen. Keine laufende Sitzung neu öffnen oder schließen.

Zusätzlich behoben: Verspätete QR-Antworten nach Schließen/Terminwechsel werden durch eine eindeutige Abruf-ID verworfen; Drucken bleibt während des Ladens gesperrt.
