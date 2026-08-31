# Gemma 4 E2B — Gids voor kennis en gevolgtrekkingen voor agenten

**Doelgroep:** Toekomstige AI-agenten, beheerders en ML-ingenieurs die werken aan de visiepijplijn van DressApp Eyes.
**Datum:** mei 2026

Dit document bewaart de concrete logica, architectonische eigenaardigheden en gevolgtrekkingsregels die nodig zijn voor het succesvol opzetten en benchmarken van het `google/gemma-4-E2B-it`-model met een LoRA-adapter in het DressApp-ecosysteem.

---

## 1. Architectuurfeiten
- **Modelprofiel:** E2B staat voor *Effectieve 2 miljard* parameters (5,1B totaal). Het maakt gebruik van Per-Layer Embeddings (PLE) om de geheugenvoetafdruk radicaal te verminderen, waardoor het de enige haalbare variant is voor DressApp's Hetzner VPS-omgeving met alleen CPU's.
- **Contextvenster:** Maximaal 128.000 tokens.
- **Natieve multimodaliteit:** Ondersteunt tekst-, beeld- en audio-invoer. Voert tekst uit.
- **Aandachtsmechanisme:** Hybride lokale ‘sliding window’ en mondiale aandacht.

## 2. Afhankelijkheden en hulpmiddelen (cruciaal)
Gemma 4 is een fundamenteel nieuwe familie (uitgebracht in maart-april 2026), GEEN herziening van Gemma-3. Als u deze verkeerd laadt, worden de multimodale projectietensoren beschadigd.
- **Transformers-versie:** `transformers >= 4.57.1` (of `5.5.0+` afhankelijk van de naamgeving van de lokale release). U **moet** gebruik maken van `AutoProcessor` en `AutoModelForMultimodalLM`. Rol 'Gemma4*ForConditionalGeneration' nooit met de hand.
- **Kwantisering:** Gebruik `optimum-quanto` voor CPU-inferentie (int4-kwantisering). `bitsandbytes` is zeer onstabiel/niet ondersteund voor pure x86 CPU-implementaties.
- **LoRA-adapter:** Gebruik `peft` om de getrainde LoRA-adapter aan het basismodel te bevestigen. De basistekstdecoderlagen zijn omwikkeld met rang-16-adapters, terwijl de visie-/audiotorens bevroren blijven.

## 3. Regels voor aanwijzingen en gevolgtrekkingen

### Modaliteit bestellen
Voor optimale aandachtstoewijzing en zero-shot-prestaties moeten **Afbeelding-/audiotokens altijd vóór tekst** staan binnen de structuur van de berichtinhoud.
```python
# Correcte payload-structuur voor de AutoProcessor:
berichten = [
    {"rol": "gebruiker", "inhoud": [
        {"type": "afbeelding"},
        {"type": "text", "text": "Analyseer deze outfit..."}
    ]}
]
```

### Visuele tokenbudgetten
Gemma 4 behandelt niet alle afbeeldingen gelijk. Je beheert de visuele resolutie via een `vision_token_budget` (soms `image_token_budget` of `num_image_tokens` genoemd, afhankelijk van de `transformers` versietak).
- Toegestane budgetten: `70`, `140`, `280`, `560`, `1120`.
- **DressApp-specificaties:** Omdat kledinggrensdetectie en detailextractie hoge precisie vereisen, moet u het 'AutoProcessor'-budget altijd forceren op **1120** (maximale details).

### Denkmodus (redeneren)
Gemma-4 ondersteunt native CoT-redeneringen (Chain-of-Thought).
- **Activering:** Om denken mogelijk te maken, plaatst u het `<|think|>`-token helemaal aan het begin van de systeemprompt.
- **Uitgangskanaalformaat:** Bij het redeneren zendt het model tags uit:
  `<|kanaal>gedachte\n[Interne redenering]<kanaal|>[Eindantwoord]`
- **Uitschakelen:** Als strikte JSON vereist is en latentie van het grootste belang is (zoals in onze `EYES_ONE_PASS` pijplijn), laat dan het `<|think|>` token weg om directe emissie te forceren.
- **Geschiedenisregel:** Verwijder in chats met meerdere beurten de redenering (`<|channel>gedachte...<channel|>`) uit de geschiedenis. Voer alleen het `[Eindantwoord]` terug in de contextbuffer.

### Beste praktijken voor bemonstering
Gebruik geen standaard LLM-temperatuurstandaardwaarden. De expliciete standaard van Google voor Gemma-4-sampling is:
- `temperatuur = 1,0`
- `top_p = 0,95`
- `top_k = 64`

## 4. Opmerkingen over de productieomgeving
- Auth voor gated modellen (`HF_TOKEN`) wordt NIET meegeleverd met de DressApp-runtime. De container is afhankelijk van vooraf gedownloade gewichten en samengevoegde adapters (`/adapter:ro`) die lokaal zijn gemonteerd.
- Houd de vlaglogica van `EYES_ONE_PASS=true` in gedachten: deze omzeilt de oudere SegFormer-clipping door volledig te vertrouwen op de eigen coördinatenuitvoer van Gemma-4 (`response_format=json_schema`).