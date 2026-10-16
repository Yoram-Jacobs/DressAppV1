# Dialogbasierter KI-Stylist

Interagieren Sie mit einem intelligenten persönlichen Stylisten, der Ihre Garderobe, das Wetter und Ihren Tagesablauf kennt.

## Übersicht
Der KI-Stylist (AI Stylist) ist Ihr persönlicher Modebegleiter. Sie können per Texteingabe oder ganz natürlich per Sprachbefehl wie mit einem Freund mit ihm chatten. Der Stylist prüft Ihre lokale Wettervorhersage, wirft einen Blick auf Ihre Termine im Google Kalender und schlägt vollständige, stilvolle Outfits vor, die direkt aus Kleidungsstücken zusammengestellt werden, die Sie bereits besitzen.

Das Styling-Gehirn von DressApp basiert auf einer ausfallsicheren, mehrstufigen Zero-BYOK-Intelligenzarchitektur:
- **Manager- & Professional-Tarife — Schnelles Cloud-Modell (Google Gemini 3.5 Flash)**: Abonnenten der Tarife **Manager** und **Professional** genießen vorrangiges Routing zum schnellen Cloud-KI-Modell (derzeit **Google Gemini 3.5 Flash** über `llm_gateway.py`), das blitzschnelle Antworten (unter 350 ms TTFT) ohne jeglichen Konfigurationsaufwand liefert.
- **Kostenloser Tarif (Free Tier) — Lokale On-Premises-Eyes (`Qwen 2.5 VL 3B`) & Quoten-Sicherheitsnetz**: Nutzer des kostenlosen Tarifs werden von dem dedizierten, feinabgestimmten **Qwen 2.5 VL 3B**-Modell von DressApp bedient, das lokal im `dressapp-eyes`-Container auf Port 7860 des Hetzner-CPX32-VPS ausgeführt wird. Es dient zudem als transparenter Sicherheits-Fallback für kostenpflichtige Tarife: Treten Ratenbegrenzungen der Cloud-API (`429` / `RESOURCE_EXHAUSTED`) auf, werden Anfragen automatisch an die lokale Eyes-Engine weitergeleitet, ohne fehlzuschlagen oder 500-Fehler auszulösen.

## Voraussetzungen
- Mindestens ein Oberteil, ein Unterteil und ein Paar Schuhe im Kleiderschrank hochgeladen.
- Aktivierte Mikrofonberechtigung, falls Sie freihändiges Sprach-Styling nutzen möchten.
- *(Optional)* Verknüpfter Google Kalender, damit Outfit-Vorschläge passend zum Anlass erstellt werden können.

## Schritt-für-Schritt-Anleitung
1. **Stylisten öffnen**: Tippen Sie in der unteren Navigationsleiste auf den Reiter **AI Stylist**.
2. **Sprechen oder tippen**: Tippen Sie auf das **Mikrofonsymbol** und fragen Sie, was Sie anziehen sollen (z. B. *„Was soll ich für ein Mittagessen an einem regnerischen Nachmittag tragen?"* oder *„Schlage einen schicken Business-Look vor"*).
3. **Gesprochenen Ratschlag anhören**: Der Stylist antwortet mit maßgeschneiderten Empfehlungen und zeigt passende Outfit-Karten an. Tippen Sie auf **Play reply** (Antwort abspielen), um den Audio-Ratschlag jederzeit erneut anzuhören.
4. **Das Shuffle-Tool ausprobieren**: Lust auf spontane Inspiration? Tippen Sie auf den Reiter **Shuffle**, um Ihren Kleiderschrank durchzuwürfeln und frische Kombinationen zu entdecken, an die Sie vielleicht noch nicht gedacht haben!
5. **Im Dialog verfeinern**: Bitten Sie den Stylisten in einem fortlaufenden Gesprächsfluss darum, Schuhe zu wechseln, eine Jacke auszutauschen oder das Outfit an Temperaturänderungen anzupassen.
6. **Favoriten speichern**: Tippen Sie auf **Save to Diary** (Im Kalender speichern), um den Look in Ihrem persönlichen Garderobenkalender einzuplanen.

## Erwartete Ergebnisse
Personalisierte, wettergerechte Outfit-Vorschläge auf Ihrem Bildschirm, komplett mit gesprochenen Begründungen, warum die Teile zusammenpassen. Sollten externe Cloud-API-Kontingente vorübergehend erschöpft sein, weist ein Informationsbanner darauf hin, dass der integrierte lokale Eyes-Stylist Ihre Anfrage nahtlos übernommen hat.

## Fehlerbehebung
- **Mikrofon erfasst keine Worte**: Überprüfen Sie Ihre Browser- oder Geräteberechtigungen und stellen Sie sicher, dass DressApp auf das Mikrofon zugreifen darf.
- **Stylist schlägt zu oft dieselben Outfits vor**: Tragen Sie Ihre täglichen Outfits im Kalender ein, damit der Stylist weiß, was Sie kürzlich getragen haben, und ungetragene Kleidung bevorzugt.
- **Banner „Using Platform Stylist (Quota Fallback)"**: Dies erscheint, wenn Ratenbegrenzungen der externen Cloud-API erreicht werden. Die App hat Ihre Frage reibungslos über die integrierte lokale Eyes-Engine (`Qwen 2.5 VL 3B`) von DressApp beantwortet, ohne dass Ihr Gespräch unterbrochen wurde.

## Einschränkungen
- Der Stylist arbeitet ausschließlich mit Artikeln in Ihrem Kleiderschrank; er kann keine Teile empfehlen, die Sie noch nicht hochgeladen haben.
- Nutzer des kostenlosen Tarifs (Free Tier) nutzen das lokale Eyes-Modell mit kostenlosen Styling-Credits, die sich automatisch erneuern, während Manager- und Professional-Konten vom schnellen Cloud-Modell (`Gemini 3.5 Flash`) und erhöhten monatlichen Kontingenten profitieren.
