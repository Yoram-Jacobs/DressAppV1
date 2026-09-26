# Dialogbasierter KI-Stylist

Interagieren Sie mit einem intelligenten persönlichen Stylisten, der Ihre Garderobe, das Wetter und Ihren Tagesablauf kennt.

## Übersicht
Der AI Stylist ist Ihr persönlicher Modebegleiter. Sie können per Texteingabe oder ganz natürlich per Sprachbefehl wie mit einem Freund chatten. Der Stylist prüft Ihre lokale Wettervorhersage, wirft einen Blick auf Ihre Termine im Google Kalender und schlägt vollständige, stilvolle Outfits vor, die direkt aus Kleidungsstücken zusammengestellt werden, die Sie bereits besitzen.

Das Styling-Gehirn von DressApp basiert auf einer resilienten mehrstufigen Intelligenz-Architektur:
- **Primäre Produktions-Engine (Google Gemini 3.5 Flash-Lite)**: Treibt alle zentralen Styling-Gespräche standardmäßig über `llm_gateway.py` an. Sie liefert blitzschnelle Antworten (unter 350 ms TTFT) ohne anfängliche Konfiguration und ohne Hürden – keine persönlichen API-Schlüssel erforderlich, um mit dem Styling zu beginnen!
- **On-Premises-VPS-Eyes (`gemma-4-E4B`) – Free Tier & Quoten-Sicherheitsnetz**: Ein dediziertes, feingetuntes `gemma-4-E4B`-Modell, das lokal im `dressapp-eyes`-Container auf Port 7860 des Hetzner-CPX32-VPS ausgeführt wird. Es bietet eine Basis ohne variable Kosten für Free-Tier-Konten und dient als transparenter Fallback. Treten Begrenzungen der Google Gemini API (`429` / `RESOURCE_EXHAUSTED`) auf, werden Anfragen automatisch an das lokale Gemma weitergeleitet, ohne fehlzuschlagen oder 500-Fehler auszulösen.
- **Tester-Gruppenprogramm**: Freigeschaltete Tester genießen kostenlosen Zugang zum **Professional Tier** inklusive unbegrenzter Garderobenkapazität, Trend-Scout-Radar-Feeds, täglicher Styling-Planung und 100 Credits pro Zyklus.
- **Benutzerdefinierte BYOK-Cloud-Modelle**: Benutzer können in den Profileinstellungen optional ihren eigenen Google Gemini API-Schlüssel hinterlegen, um auf höherwertige Modelle (`gemini-2.5-pro`) zuzugreifen oder erweiterte generative Tools (Nano Banana Fotorekonstruktion) freizuschalten.

## Voraussetzungen
- Mindestens ein Oberteil, ein Unterteil und ein Paar Schuhe im Kleiderschrank hochgeladen.
- Aktivierte Mikrofonberechtigung, falls Sie freihändiges Sprach-Styling nutzen möchten.
- *(Optional)* Verknüpfter Google Kalender, damit Outfit-Vorschläge anlassbezogen erfolgen können.
- *(Optional)* Persönlicher Google Gemini API-Schlüssel, falls Sie Ihr eigenes Cloud-Entwicklerkontingent nutzen möchten.

## Schritt-für-Schritt-Anleitung
1. **Stylisten öffnen**: Tippen Sie in der unteren Navigationsleiste auf den Reiter **AI Stylist**.
2. **Sprechen oder tippen**: Tippen Sie auf das **Mikrofonsymbol** und fragen Sie, was Sie anziehen sollen (z. B. *„Was soll ich für ein Mittagessen an einem regnerischen Nachmittag tragen?“* oder *„Schlage einen schicken Business-Look vor“*).
3. **Gesprochenen Ratschlag anhören**: Der Stylist antwortet mit individuellen Empfehlungen und zeigt passende Outfit-Karten an. Tippen Sie auf **Play reply** (Antwort abspielen), um den Audio-Ratschlag jederzeit erneut anzuhören.
4. **Das Shuffle-Tool ausprobieren**: Lust auf spontane Inspiration? Tippen Sie auf den Reiter **Shuffle**, um Ihren Kleiderschrank durchzuwürfeln und frische Kombinationen zu entdecken, an die Sie vielleicht noch nicht gedacht haben!
5. **Im Dialog verfeinern**: Bitten Sie den Stylisten in einem fortlaufenden Gesprächsfluss darum, Schuhe zu wechseln, eine Jacke auszutauschen oder sich an Temperaturänderungen anzupassen.
6. **Favoriten speichern**: Tippen Sie auf **Save to Diary** (Im Kalender speichern), um den Look in Ihrem persönlichen Garderobenkalender festzuhalten.

## Erwartete Ergebnisse
Personalisierte, wettergerechte Outfit-Vorschläge auf Ihrem Bildschirm, komplett mit gesprochenen Begründungen, warum die Teile zusammenpassen. Sollten externe API-Quoten vorübergehend erschöpft sein, weist ein Informationsbanner darauf hin, dass der integrierte On-Premises-Stylist Ihre Anfrage nahtlos übernommen hat.

## Fehlerbehebung
- **Mikrofon erfasst keine Worte**: Überprüfen Sie Ihre Browser- oder Geräteberechtigungen und stellen Sie sicher, dass DressApp auf das Mikrofon zugreifen darf.
- **Stylist schlägt zu oft dieselben Outfits vor**: Tragen Sie Ihre täglichen Outfits im Kalender ein, damit der Stylist weiß, was Sie kürzlich getragen haben, und ungetragene Kleidung bevorzugt.
- **Banner „Using Platform Stylist (Quota Fallback)“**: Dies erscheint, wenn Ratenbegrenzungen der externen API erreicht werden. Die App hat Ihre Frage reibungslos über die integrierte On-Prem-Gemma-Engine von DressApp beantwortet, ohne dass Ihr Gespräch unterbrochen wurde.

## Einschränkungen
- Der Stylist arbeitet ausschließlich mit Artikeln in Ihrem Kleiderschrank; er kann keine Teile empfehlen, die Sie noch nicht hochgeladen haben.
- Nutzer des Free Tier erhalten kostenlose Styling-Credits, die sich automatisch erneuern, während Pro- und Tester-Konten von höheren monatlichen Kontingenten profitieren.
