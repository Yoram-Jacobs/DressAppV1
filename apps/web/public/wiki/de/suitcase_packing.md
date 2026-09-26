# Koffer-Packassistent

Packen Sie effizient und stressfrei für jedes Reiseziel mit KI-gestützter Wettervorhersage und dialogbasierter Verfeinerung der Checkliste.

## Übersicht
Der Kofferpackassistent nimmt Ihnen den Reisestress ab: Er analysiert Ihren Reiseplan, das Wetter am Zielort sowie Ihren persönlichen Kleiderschrankkatalog, um eine maßgeschneiderte, tagesgenaue Pack-Checkliste zu erstellen. Angetrieben von **Google Gemini 3.5 Flash-Lite** über `llm_gateway.py` generiert der Assistent in Sekundenschnelle vollständige Packpläne und ermöglicht es Ihnen, Artikel interaktiv per Chat-Dialog anzupassen.

## Voraussetzungen
- Name der Zielstadt sowie Abreise- und Rückreisedatum.
- Ein aktiver Kleiderschrankbestand mit mindestens einigen Basiskleidungsstücken.
- Internetverbindung zum Abrufen der Wettervorhersage für das Reiseziel.

## Schritt-für-Schritt-Anleitung
1. **Reise erstellen**: Öffnen Sie den Reiter „Suitcase“ (Koffer), tippen Sie auf **New Trip** (Neue Reise) und geben Sie Zielstadt, Start- und Enddatum sowie den Reisezweck ein (z. B. *Geschäftlich*, *Strandurlaub*, *Städtereise*).
2. **Packplan generieren**: Tippen Sie auf **Generate Checklist** (Checkliste generieren). Die KI ruft die prognostizierten Temperaturen und Wetterbedingungen für Ihr Reiseziel ab, gleicht diese mit den Artikeln in Ihrem Kleiderschrank ab und erstellt eine ausgewogene Packliste.
3. **Tägliche Outfits überprüfen**: Prüfen Sie die Tag für Tag vorgeschlagenen Kombinationen und stellen Sie sicher, dass passende Lagen für kühle Vormittage und warme Nachmittage eingeplant sind.
4. **Per Chat verfeinern**: Benötigen Sie zusätzliche Optionen? Chatten Sie direkt mit dem Packassistenten (z. B. *„Bequeme Laufschuhe hinzufügen“* oder *„Ein Cocktailkleid fürs Abendessen einplanen“*). Die Checkliste aktualisiert sich dynamisch.
5. **Artikel als gepackt markieren**: Nutzen Sie beim Packen Ihres Gepäcks die interaktiven Kontrollkästchen, um den Überblick darüber zu behalten, was bereits verstaut ist.
6. **Für Offline-Reisen speichern**: Speichern Sie den fertigen Reiseplan für einen schnellen Zugriff auf Ihrem Gerät – selbst während der Reise ohne Internetverbindung.

## Erwartete Ergebnisse
Eine umfassende, wetteroptimierte Gepäck-Checkliste, gegliedert nach Kleidungskategorien (Oberteile, Unterteile, Oberbekleidung, Schuhe, Essentials) – ohne doppelte oder überflüssige Teile.

## Fehlerbehebung
- **Wettervorhersage nicht verfügbar**: Überprüfen Sie die Schreibweise der Zielstadt; versuchen Sie bei abgelegenen Orten, die nächstgelegene größere Stadt anzugeben.
- **Checkliste enthält nur wenige Artikel**: Stellen Sie sicher, dass Sie genügend zur Jahreszeit und den erwarteten Temperaturen passende Kleidungsstücke in Ihren Kleiderschrank hochgeladen haben.
- **Änderungen werden nicht gespeichert**: Vergewissern Sie sich, dass Ihre Netzwerkverbindung aktiv ist, wenn Sie Notizen über den Chat hinzufügen.

## Einschränkungen
- Die automatisierte Wettervorhersage deckt Reisen ab, die bis zu 14 Tage im Voraus geplant sind; weiter in der Zukunft liegende Reisen nutzen historische saisonale Klimadurchschnitte.