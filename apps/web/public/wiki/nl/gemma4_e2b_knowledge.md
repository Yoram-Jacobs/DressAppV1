# Gemma 4 E4B / E2B — Agent Kennis- & Inferentiegids

**Doelgroep:** Toekomstige AI-agenten, beheerders en ML-engineers die werken aan de DressApp Eyes vision- en stylingpipeline.  
**Datum:** September 2026  
**Status:** Actief in productie (`gemma-4-E4B-it-Q3_K_M.gguf` + `mmproj-BF16.gguf`)

Dit document beschrijft de concrete architectuur, specificaties en inferentieregels voor het `gemma-4-E4B-it` model binnen DressApp.

---

## 1. Architectuurfeiten
- **Modelprofiel:** Google Gemma-4-E4B is een multimodaal visie-taalmodel met effectief 4 miljard parameters (~4.5B totaal) dat gebruikmaakt van Per-Layer Embeddings (PLE). In productie is het gekwantiseerd naar `Q3_K_M` (~2.7 GB schijfruimte, ~2.85 GB werkgeheugen), wat zorgt voor uitstekende prestaties op de CPU van de Hetzner Cloud CPX32 VPS (4 AMD vCPUs).
- **Contextvenster:** Tot 128K tokens (geconfigureerd op 4.096 tokens in `dressapp-eyes` voor optimale reactietijd).
- **Multimodale invoer:** Ondersteuning voor afbeeldingen, audio en tekst via `mmproj-BF16.gguf`.
- **Productieserver:** Draait `llama-server` op poort 7860 in de `dressapp-eyes` Docker-container, beveiligd met FastAPI (`EYES_API_TOKEN`).

## 2. Productierollen & Multi-Tier Routering
1. **Kern van het gratis account**: Verwerkt interactieve stylingsessies en attribuutextractie voor gebruikers zonder eigen API-sleutel.
2. **Achtergrond-cronjobs**: Voert dagelijkse kledingindexering en ochtendadviezen uit zonder externe API-kosten.
3. **Veilige quotum-fallback**: Vangt rate-limits (`429`) of `RESOURCE_EXHAUSTED` van externe API's direct op en schakelt naadloos over naar het lokale Gemma-model zonder foutmelding voor de gebruiker.
4. **Plafond per niveau**: Geavanceerde generatieve functies (Trend Scout en Nano Banana fotoreconstructie) vereisen een door de gebruiker verstrekte API-sleutel.
