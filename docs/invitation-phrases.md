# Wortcodes für Arbeitsgruppen

Neue Einladungen bestehen aus fünf kurzen deutschen Wörtern, beispielsweise
`apfel-birne-anker-besen-garten`. Auf der Startseite öffnet **Arbeitsgruppe
beitreten** die Eingabe für Einladungscode und Name/Gerät. Leerzeichen und
Bindestriche sind gleichwertig; Groß- und Kleinschreibung spielt keine Rolle.
Ein QR-Code oder vollständiger Einladungslink öffnet weiterhin direkt die
Namenseingabe. Hilfe und Anmeldung der zuständigen Stelle bleiben erreichbar.

Nach jeder Beitrittsanfrage muss die zuständige Stelle den Gerätecode vergleichen
und das Gerät ausdrücklich freigeben. Erst danach werden die Aufgaben geladen.
Ein Wortcode allein gibt keinen Lese- oder Schreibzugriff auf Prüfungsunterlagen.

## Technischer Vertrag

- `POST /api/access/open` liefert weiterhin `invitations: [{specialty, token}]`;
  `token` ist bei neuen Einladungen der kanonische Wortcode mit Bindestrichen.
- `POST /api/join` nimmt weiterhin `{invitation, label}` an. Bestehende
  Einladungen aus 64 Hexadezimalzeichen bleiben bis zu ihrer bisherigen
  Ablaufzeit beziehungsweise Sperrung gültig. Es ist keine Datenmigration nötig.
- `HortiOnline.invitationCode(meetingId, specialty)` liefert den Code für
  Anzeige und Druck oder `null`, wenn die Einladung lokal nicht vorhanden,
  abgelaufen oder nicht mehr in der aktiven Generation ist. Bestehende opaque
  Codes werden unverändert zurückgegeben. `HortiOnline.link(...)` verwendet
  dieselben Prüfungen und setzt den Code ausschließlich in das URL-Fragment.
- Die UI entfernt das Fragment sofort. Eingegebene Wortcodes werden nicht in
  Browser-Speichern abgelegt. Nur Sitzungstoken und ausstehender Gerätecode
  werden wie bisher tabbezogen gespeichert und serverseitig erneut geprüft.
- Der kompatible Worker muss vor dem neuen Frontend bereitgestellt werden.

## Sicherheitsgrenzen

`online/invitation-phrases.js` enthält genau 256 eindeutige ASCII-Wörter mit
drei bis acht Buchstaben. Für jedes der fünf Wörter liefert
`crypto.getRandomValues(new Uint8Array(5))` ein unabhängiges Byte. Die Zuordnung
hat keine Modulo-Verzerrung; Wiederholungen sind erlaubt. Damit gibt es
256⁵ = 2⁴⁰ mögliche Codes. Die Wortliste ist öffentlich und kein Geheimnis.

Diese 40 Bit sind absichtlich weniger als die bisherigen 256 Bit zufälliger
Einladungslinks. Der Code ist eine kurzlebige Beitrittsberechtigung, kein
Passwort und kein Ersatz für Gerätefreigabe. Eine verteilte Ratebegrenzungsumgehung
oder der Verlust der Datenbank ist bei 40 Bit ernster als bei 256 Bit; insbesondere
ist ein SHA-256-Hash kein Schutz gegen das vollständige Durchprobieren eines
kleinen Geheimnisraums. Dauerhafte Zugangsdaten dürfen diesen Mechanismus nicht
übernehmen. Sitzungstoken behalten ihre unabhängigen 256 Zufallsbits.

Die vorhandene Grenze von 40 Beitrittsversuchen pro IP und fünf Minuten zählt
auch ungültige Eingaben. Ungültige, unbekannte, abgelaufene und gesperrte Codes
erhalten dieselbe Fehlermeldung ohne Termin- oder Fachrichtungsdaten. Vor der
Normalisierung gilt ein Rohdatenlimit von 160 Zeichen; nur fünf Wörter mit
bekannten Trennzeichen oder ein vollständiger alter Hex-Code sind zulässig.
Fremde Zeichen werden nicht stillschweigend entfernt.

Die Datenbank speichert weiterhin ausschließlich den SHA-256-Hash des
kanonischen Codes in `invites.hash`. Laufzeit von maximal 24 Stunden,
zehnminütige ausstehende Anfragen, Fachrichtungsbindung und sofortige
serverseitige Generation-/Sperrprüfung bleiben unverändert. Schließen oder
erneutes Öffnen eines Termins widerruft alte Codes und Gerätesitzungen.

Automatisierte Tests verwenden ausschließlich synthetische Demodaten und eine
temporäre SQLite-Datenbank. Sie prüfen Wortauswahl, Normalisierung, Formulare,
alte Links, Ratebegrenzung, Ablauf, Sperrung, Fachrichtungsbindung und die
unverändert erforderliche Gerätefreigabe.
