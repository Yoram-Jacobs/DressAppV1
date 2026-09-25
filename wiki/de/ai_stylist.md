# Konversationeller KI-Stylist

Sprechen Sie mit einem intelligenten Stylisten, der Ihren Kleiderschrank, das Wetter und Ihren Terminkalender genau kennt.

## Übersicht
Der KI-Stylist ist Ihr persönlicher Modeberater in DressApp. Sie können sich per Text oder gesprochener Sprache wie mit einem Freund austauschen. Der Stylist prüft die lokale Wettervorhersage, wirft einen Blick auf Ihre Google Kalender-Ereignisse und empfiehlt vollständige, stilvolle Outfits aus Ihrer eigenen Garderobe.

DressApps Styling-Engine basiert auf einem lokal auf dem Server gehosteten, feinabgestimmten **Gemma-4-E4B**-Modell, das für alle kostenlosen Konten ohne API-Schlüssel einsatzbereit ist. Für Nutzer mit eigenem Google Gemini API-Schlüssel bietet DressApp einen automatischen **Quota Fallback**: Sollte Ihr persönlicher Schlüssel das Kontingent oder die Ratenbegrenzung überschreiten, leitet das System Ihre Anfrage nahtlos an das integrierte Gemma-Modell weiter und blendet einen Hinweis ein, sodass Ihre Styling-Sitzung niemals abbricht.

## Voraussetzungen
- Mindestens ein Oberteil, ein Unterteil und ein Paar Schuhe im Kleiderschrank.
- Aktivierte Mikrofonberechtigung für freihändige Sprachbedienung.
- *(Optional)* Verknüpfter Google Kalender für anlassbezogene Vorschläge.
- *(Optional)* Eigener Google Gemini API-Schlüssel für persönliche Cloud-Kontingente.

## Schritt-für-Schritt-Anleitung
1. **Stylist öffnen**: Tippen Sie in der unteren Navigationsleiste auf **AI Stylist**.
2. **Sprechen oder Tippen**: Tippen Sie auf das **Mikrofonsymbol** und fragen Sie nach Outfit-Ideen (z. B.: *"Was trage ich am besten zu einem regnerischen Mittagessen?"* oder *"Schlage mir einen schicken Business-Look vor"*).
3. **Sprachantwort anhören**: Der Stylist antwortet mit maßgeschneiderten Ratschlägen und passenden Outfitkarten. Tippen Sie auf **Antwort abspielen**, um die Sprachnachricht erneut anzuhören.
4. **Shuffle-Funktion**: Lust auf spontane Inspiration? Tippen Sie auf **Shuffle**, um neue Kombinationen aus Ihrem Schrank zu entdecken!
5. **Im Tagebuch speichern**: Tippen Sie auf **Im Tagebuch speichern**, um den Look für Ihren Tag einzuplanen.

## Erwartete Ergebnisse
Personalisierte, wettergerechte Outfit-Vorschläge auf Ihrem Bildschirm mit gesprochener Begründung. Sollte Ihr API-Schlüssel erschöpft sein, informiert ein Banner darüber, dass der integrierte Stylist nahtlos eingesprungen ist.

## Fehlerbehebung
- **Mikrofon nimmt keine Sprache auf**: Überprüfen Sie Ihre Browser- oder Geräteeinstellungen, um den Zugriff zu gestatten.
- **Stylist schlägt zu oft dieselben Outfits vor**: Tragen Sie Ihre getragenen Looks im Kalender ein, damit der Stylist ungetragene Kleidung priorisiert.
- **Banner "Plattform-Stylist verwendet (Quota Fallback)"**: Erscheint, wenn Ihr persönlicher Schlüssel überlastet ist. Ihre Anfrage wurde fehlerfrei über die integrierte KI beantwortet.

## Einschränkungen
- Der Stylist empfiehlt nur Kleidungsstücke, die sich bereits in Ihrem digitalen Schrank befinden.
- Nutzer der kostenlosen Stufe erhalten täglich 10 Styling-Credits, die sich alle 24 Stunden erneuern.
