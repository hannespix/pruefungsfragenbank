# Kategorienamen aus der Excel-Notenberechnung

Die bereitgestellte Vorlage „Notenberechnung Gärtner AP S 2026“ ist die
maßgebliche Quelle für die Bezeichnungen der praktischen Gärtner-Abschlussprüfung.
Verwendet wird ausschließlich das Blatt **Aufgaben**, dort ausgewiesener
Aufgabenstand **03.02.2020**. Die 83 fachrichtungsspezifischen Einträge stehen in:

| Fachrichtung | Titelzellen |
| --- | --- |
| Zierpflanzenbau | C12:C24 |
| Gemüsebau | E12:E25 |
| Baumschule | I12:I23 |
| Obstbau | K12:K23 |
| Staudengärtnerei | C32:C40 |
| Garten- und Landschaftsbau | E32:E43 |
| Friedhofsgärtnerei | I32:I42 |

`offline/src/planning.js` enthält die exakten Titel, Zellbelege und die zugehörigen
Bereichsnummern. Bereichsnummern werden dokumentiert, nicht als Pflichtanzahl
interpretiert. Auf ausdrücklichen Wunsch verwenden ZP und AP je Fachrichtung
dieselben Kategorien und Titel. Ihre Aufgaben, Muster, Anzahlen und Historien
bleiben getrennt. Ausdrücklich als GBF/Fachwerker oder mit Code 171–177
gekennzeichnete Aufgaben verwenden weiterhin die bisherigen Namen.
Die separaten GBF-Blätter wurden nicht in die Gärtner-Kategorien übernommen.
Die Arbeitsmappe, Makros, personenbezogene Angaben und Bewertungsformeln werden
nicht veröffentlicht und nicht verändert.

Bekannte Kategorie-IDs bleiben erhalten. Neu getrennte Kategorien, etwa
„Sortieren von Obst“ und „Bepflanzen von Rabatten“, erhalten eigene IDs.
Originaltitel, Aufgabenwortlaut, Bewertungen und gespeicherte Prüfungen werden
nicht umgeschrieben. Kategorien ohne Aufgaben sind als Auswahl verfügbar.

Neue und ausdrücklich neu gespeicherte AP- und ZP-Muster tragen
`categoryCatalog: "excel-ap-2026"`. Ältere Muster behalten ihre bisherige
Klassifikation für Vollständigkeit, Vorschläge, Filter, Navigation und Beschriftung.
Dadurch werden bestätigte historische Entwürfe nicht durch die feinere Einteilung
nachträglich unvollständig. Aufgabenbank und Katalogexporte verwenden die aktuellen
fachrichtungsspezifischen Bezeichnungen.

Der Worker validiert dieselben Kategorie-IDs wie der Client. Bei Veröffentlichung
muss daher auch der Worker aktualisiert werden; eine Datenmigration ist nicht nötig.

Ältere ZP-Zuordnungen außerhalb des gemeinsamen Fachrichtungskatalogs bleiben als
„Kategorie noch zuordnen“ sichtbar. Sie werden nicht automatisch einer fachlich
unpassenden Kategorie zugewiesen. Unversionierte historische ZP-Muster behalten
wie AP-Muster ihre ursprüngliche Klassifikation.
