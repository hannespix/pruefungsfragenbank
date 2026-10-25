# Prüfungsblätter: Landesdesign und belegte Zeiten

Stand: 25. Oktober 2026.

Die Prüfungsblätter verwenden das aktuelle RPF-Logo, BaWue Sans Regular/Bold und
BaWue Serif Bold aus dem privaten Vorlagenbestand. Das Layout ist eine auf
Prüfungen angepasste Umsetzung, keine unveränderte amtliche Wordvorlage.

## Gestaltung

- Logo unverändert links, Seitenrand und Schutzraum; keine Verzerrung.
- Titel in BaWue Serif, Fließtext und Zwischenüberschriften in BaWue Sans;
  linksbündig, normale Groß-/Kleinschreibung, Arial als Office-Ersatz.
- BaWü Schwarz `#2A2623`, Weiß und Grau 1 `#F4F3F3`. Keine gelbe Schrift.
- Gleicher Renderer für Arbeitsblatt, Teilnehmer- und Prüferexport.
- A4 mit 18 mm Rändern; lange Aufgaben dürfen umbrechen. Browser-Druckvorschau
  und Maßstab separater Originalpläne bleiben vor Ausgabe zu prüfen.

Referenzen: https://design.landbw.de/corporate-design/basiselemente/typografie/einsatz
und https://design.landbw.de/corporate-design/basiselemente/farbe/farbwerte .

## Geschützte Gestaltungsmittel

Logo und WOFF2-Dateien liegen als Anlagen im geschützten Datenbestand. Die
öffentliche Pages-Anwendung enthält nur Renderer und CSS-Regeln. Es gibt keine
externen Font- oder CDN-Anfragen. Aufgaben verweisen auf die gemeinsam genutzten
Assets, sodass die vorhandene serverseitige Gruppenfilterung auch diese Dateien
erfasst. Laden erfolgt erst bei Anzeige des Prüfungsblatts; Exporte warten auf
alle benötigten Bytes und betten die Schrift ein. Schriftdateien werden nicht
als Plan/Anlage angezeigt oder separat ins Anlagenpaket gelegt. Die Dateien
unterliegen den Nutzungsbedingungen des Vorlagenbestands und sind für die
angeforderten dienstlichen RP-Prüfungen vorgesehen.

## Zeiten

`minutes` ist die Gesamtbearbeitungszeit der Aufgabe. `timing` speichert
Gesamtzeit, Extraktionsmethode, einzelne Phasen und Quellbelege. Eine isolierte
Planungszeit ist niemals die Gesamtzeit. Nur ausdrücklich genannte Gesamtzeiten
oder vollständig belegte Abschnitte werden als solche übernommen. Unbekannte
Gesamtzeiten bleiben `null`; Deckblatt-Summen werden bei fehlenden Angaben klar
als unvollständig beschriftet.

Manuelle Gesamtzeiten bleiben bei der Datenanreicherung erhalten. Ändert man
Gesamtzeit oder Aufgabentext, werden nicht mehr passende historische Phasen im
Blattkopf ausgeblendet. Die Belege bleiben in den Aufgabendetails erhalten;
Zeitangaben im Aufgabentext sind bei Änderungen fachlich abzugleichen.

Die initiale Bestandsprüfung erfasste alle 256 Originaldateien. Von 229 Aufgaben
haben 93 Zeitbelege, 71 eine belegte Gesamtzeit. Zwei fehlende Gesamtzeiten wurden
aus vollständigen Zeitabschnitten ergänzt. Bewertungsraster, Punktzahlen,
Aufgabentexte und Lösungen bleiben unverändert. Eingesetzte Prüfungen werden
nicht migriert. Vor der Migration wurde ein versionierter Rücksetzstand gesichert.
