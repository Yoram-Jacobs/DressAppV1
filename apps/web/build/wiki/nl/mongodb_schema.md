# DressApp — MongoDB-schema (Fase 1)

> Alle documenten gebruiken `id: UUID (string)` als publieke identificatie. De native `_id` wordt uitgesloten van API-reacties.  
> Tijdstempels zijn ISO-8601-tekenreeksen (niet 'BSON Date') om de klassieke valkuil 'datetime not JSON serializable' te vermijden.  
> Alle geldbedragen worden opgeslagen als **cent/kleine eenheden** (gehele getallen) om float-drift te voorkomen.

---

## Verzamelingen en indexen

| Collectie | Doel | Sleutelindexen |
|------------------|------------------------------------------------|---- -----------------------------------------------------------------------|
| `gebruikers` | Auth + profiel + stijlvoorkeuren + OAuth-tokens | `email` (uniek), `stripe_account_id` |
| `closet_items` | Kledingkastartikelen van de gebruiker | `user_id`, `source`, `category`, tekstindex op `tags` |
| `vermeldingen` | Marktplaatsitems (subset van closet_items of retail) | `source`, `status`, `seller_id`, `category`, 2dsphere op `location` |
| `transacties` | Geldgrootboek voor verkoop op marktplaats | `buyer_id`, `seller_id`, `listing_id`, `status`, `stripe_checkout_session_id` |
| `stylist_sessies` | Agentgeheugen per gebruiker (equivalent van duurzaam object) | `user_id` (uniek) |
| `stylist_berichten` | Gesprek verandert binnen een sessie | `(sessie_id, aangemaakt_at)` samenstelling |
| `inbedding` | Vectorwinkel voor items/outfits/tekstquery's | `entiteit_type`, `entiteit_id`; **Atlas Vector Zoeken** op `vector` |
| `culturele_regels` | Regionale/religieuze/gelegenheidsbeperkingen | `(regio, religie, gelegenheid)` samenstelling |
| `trendrapporten` | Dagelijkse Trend-Scout-samenvattingen | `datum`, `categorie` |
| `outfits` | Door AI gegenereerde outfits opgeslagen voor later hergebruik | `user_id`, `created_at` |

---

## 1. `gebruikers`

```Json
{
  "id": "uuid",
  "e-mail": "gebruiker@voorbeeld.com",
  "password_hash": "bcrypt$...", // null als alleen OAuth
  "display_name": "Alex",
  "avatar_url": "https://...",
  "locale": "en-VS",
  "preferred_lingual": "nl", // Whisper / Deepgram / Gemini-taal
  "preferred_voice_id": "aura-2-thalia-en",// Deepgram Aura-2 stem
  "home_location": { "lat": 40.7128, "lng": -74.0060, "city": "New York" },
  "stijl_profiel": {
    "esthetiek": ["minimalistisch", "smart-casual"],
    "color_palette": ["marineblauw", "ivoor", "olijf"],
    "avoid": ["neon", "logo's"],
    "body_notes": "lang, atletisch",
    "budget_monthly_cents": 15000
  },
  "culturele_context": {
    "regio": "VS",
    "religie": nul,
    "dress_conservativeness": "gematigd"
  },
  "google_oauth": {//alleen opgeslagen na /oauth/google/callback
    "access_token": "...",
    "refresh_token": "...",
    "expires_at": "2025-01-01T00:00:00Z",
    "scopes": ["https://www.googleapis.com/auth/calendar.readonly"]
  },
  "stripe_account_id": "acct_xxx", // Stripe Connect Express (verkoperzijde)
  "stripe_onboarding_complete": false,
  "roles": ["user"], // 'admin' voor backoffice
  "created_at": "2025-01-01T00:00:00Z",
  "update_at": "2025-01-01T00:00:00Z"
}
```

---

## 2. `kast_items`

```Json
{
  "id": "uuid",
  "user_id": "uuid",
  "source": "Privé", // BRONTAG: 'Privé' | 'Gedeeld' | 'Detailhandel'
  "categorie": "top", // top | onderkant | bovenkleding | schoenen | accessoire | jurk | volledige_outfit
  "sub_category": "overhemd",
  "title": "Wit Oxford-overhemd",
  "brand": "Uniqlo",
  "maat": "M",
  "kleur": "wit",
  "materiaal": "katoen",
  "patroon": "vast",
  "seizoen": ["lente", "zomer", "herfst"],
  "formaliteit": "smart-casual", // casual | smart-casual | zakelijk | formeel
  "cultural_tags": [], // bijv. ['bescheiden', 'hijab-vriendelijk']
  "tags": ["oxford", "kantoor", "laagbaar"],
  "original_image_url": "s3://.../raw.jpg",
  "gesegmenteerde_image_url": "s3://.../gesegmenteerde.png",
  "embedding_id": "uuid", // FK → embeddings.id
  "aankoopprijs_cent": 3500,
  "purchase_currency": "USD",
  "purchase_date": "2024-03-01",
  "wear_count": 14,
  "last_worn_at": "2024-12-20T08:00:00Z",
  "opmerkingen": "Iets klein in de schouders",
  "retail_metadata": null, // ingevuld wanneer source='Retail'
  "created_at": "2025-01-01T00:00:00Z",
  "update_at": "2025-01-01T00:00:00Z"
}
```

`retail_metadata` (alleen als `source = 'Retail'`):

```Json
{
  "retailer_name": "Zara",
  "product_url": "https://...",
  "sku": "...",
  "list_price_cents": 4500,
  "valuta": "USD",
  "beschikbaarheid": "op voorraad"
}
```

---

## 3. "vermeldingen".

Advertenties zijn marktgerichte projecties van een 'closet_item'. Privé-items kunnen alleen worden vermeld als Gedeeld/Retail.

```Json
{
  "id": "uuid",
  "closet_item_id": "uuid", // nullable als puur dropship voor de detailhandel
  "seller_id": "uuid", // gebruikers.id
  "source": "Gedeeld", // 'Gedeeld' | 'Retail' (nooit 'Privé')
  "mode": "verkopen", // verkopen | ruilen | doneren
  "title": "Wit Oxford overhemd — twee keer gedragen",
  "description": "Nauwelijks gedragen, uit rookvrij huis.",
  "categorie": "boven",
  "maat": "M",
  "condition": "like_new", // nieuw | like_new | goed | eerlijk
  "afbeeldingen": ["s3://..."],
  "locatie": { "type": "Punt", "coördinaten": [-74.006, 40.7128] },
  "ships_to": ["VS", "CA"],
  "financial_metadata": {// FINANCIËLE METADATA — vereist
    "list_price_cents": 2500,
    "valuta": "USD",
    "platform_fee_percent": 7,
    "platform_fee_applied_after": "stripe_processing_fee",
    "stripe_processing_fee_percent": 2,9,
    "stripe_processing_fee_fixed_cents": 30,
    "geschatte_seller_net_cents": 2224 // vooraf berekend voorbeeld voor UI
  },
  "status": "actief", // concept | actief | gereserveerd | verkocht | verwijderd
  "weergaven": 0,
  "favorieten": 0,
  "created_at": "2025-01-01T00:00:00Z",
  "update_at": "2025-01-01T00:00:00Z"
}
```

---

## 4. "transacties".

Eén document per marktplaatsbetaling. Bruto-, Stripe-kosten, platformkosten en verkopersnetto worden expliciet opgeslagen, zodat het beheerdersdashboard nooit opnieuw hoeft te berekenen.

```Json
{
  "id": "uuid",
  "listing_id": "uuid",
  "buyer_id": "uuid",
  "seller_id": "uuid",
  "valuta": "USD",
  "financial": {// FINANCIËLE METADATA (onveranderlijk grootboek)
    "bruto_cent": 2500,
    "stripe_fee_cents": 103, // rond(2500*0,029 + 30) = 103
    "net_after_stripe_cents": 2397,
    "platform_fee_percent": 7,
    "platform_fee_cents": 168, // rond(2397 * 0,07) = 168
    "verkoper_net_cent": 2229,
    "platform_fee_applied_after": "stripe_processing_fee"
  },
  "streep": {
    "checkout_session_id": "cs_...",
    "betaling_intent_id": "pi_...",
    "transfer_id": "tr_...",
    "destination_account": "acct_xxx" // Stripe Connect-account van de verkoper
  },
  "status": "betaald", // in behandeling | betaald | terugbetaald | mislukt | betwist
  "paid_at": "2025-01-01T00:00:00Z",
  "refunded_at": null,
  "created_at": "2025-01-01T00:00:00Z"
}
```

---

## 5. `stylist_sessions` (equivalent van duurzaam object)

Eén per gebruiker: bevat persistent agentgeheugen.

```Json
{
  "id": "uuid",
  "user_id": "uuid", // unieke index
  "active_conversation_id": "uuid",
  "geheugen": {
    "long_term_preferences": ["geeft de voorkeur aan laagjes", "houdt niet van pastelkleuren"],
    "recente_outfits": [
      { "outfit_id": "uuid", "rating": 5, "occasion": "date night" }
    ],
    "feedback_signalen": {
      "liked_tags": { "minimalist": 12, "linnen": 7 },
      "disliked_tags": { "neon": 3 }
    }
  },
  "draait": 42,
  "last_active_at": "2025-01-01T00:00:00Z",
  "created_at": "2025-01-01T00:00:00Z",
  "update_at": "2025-01-01T00:00:00Z"
}
```

### `stylist_berichten`

```Json
{
  "id": "uuid",
  "session_id": "uuid",
  "role": "gebruiker", // gebruiker | assistent | gereedschap
  "input_modality": "beeld+stem", // tekst | stem | afbeelding | afbeelding+tekst | beeld+stem
  "transcript": "Wat moet ik morgen dragen naar de klantbijeenkomst?",
  "image_refs": ["s3://.../img.jpg"],
  "context": {
    "weer": { "temp_c": 6, "conditie": "regen" },
    "calendar": [{ "title": "Klantpitch", "start": "...", "formality_hint": "business" }]
  },
  "assistent_payload": {
    "outfit_aanbevelingen": [
      {
        "name": "Marineblauw pak + lichtblauwe oxford",
        "artikelen": [
          { "closet_item_id": "uuid", "rol": "top" },
          { "closet_item_id": "uuid", "rol": "bottom" }
        ],
        "why": "Het weer vraagt om lagen; de agenda heeft om 10.00 uur een klantpitch."
      }
    ],
    "reasoning_summary": "...",
    "winkelsuggesties": [],
    "do_dont": []
  },
  "tts_audio_ref": "s3://.../antwoord.mp3",
  "latency_ms": { "whisper": 420, "sam": 650, "gemini": 1800, "deepgram": 210 },
  "created_at": "2025-01-01T00:00:00Z"
}
```

---

## 6. `inbedding` (equivalent vectoriseren)

```Json
{
  "id": "uuid",
  "entity_type": "closet_item", // closet_item | vermelding | outfit | vraag
  "entity_id": "uuid",
  "model": "clip-vit-l-14", // of zin-transformatoren/all-MiniLM-L6-v2 voor tekst
  "vector": [0,012, -0,034, ...], // 512 of 768 dimmen
  "metagegevens": {
    "categorie": "boven",
    "kleur": "wit",
    "user_id": "uuid"
  },
  "created_at": "2025-01-01T00:00:00Z"
}
```

**Atlas Vector Search-index** (aan te maken in fase 2):

```Json
{
  "toewijzingen": {
    "dynamisch": onwaar,
    "velden": {
      "vector": { "type": "knnVector", "afmetingen": 512, "similarity": "cosinus" },
      "entity_type": { "type": "token" },
      "metadata.user_id": { "type": "token" }
    }
  }
}
```

Fallback (als Atlas Vector Search niet beschikbaar is op de MongoDB-instantie): cosinus-overeenkomst wordt tijdens het proces berekend met een kleine FAISS-index die wordt gehydrateerd bij het opstarten.

---

## 7. `culturele_regels`

```Json
{
  "id": "uuid",
  "regio": "SA",
  "religie": "islam",
  "gelegenheid": "moskee",
  "regels": {
    "vereist": ["cover_schouders", "cover_knees", "no_sheer_fabric"],
    "recommended": ["loose_fit", "neutrale_kleuren"],
    "disallowed": ["korte broek", "mouwloos"]
  },
  "bron": "redacteur",
  "prioriteit": 10,
  "created_at": "2025-01-01T00:00:00Z"
}
```

De stylistenprompt voegt de 'culturele_context' van de gebruiker samen met bijpassende 'culturele_regels' als harde beperkingen.

---

## 8. `trendrapporten`

```Json
{
  "id": "uuid",
  "datum": "2025-01-01",
  "category": "dames_ss25",
  "headline": "Botergeel domineert Milaan",
  "summary_md": "...",
  "bronnen": ["https://vogue.com/...", "https://bof.com/..."],
  "key_items": [
    { "name": "botergele getailleerde blazer", "expected_price_band": "mid" }
  ],
  "generated_by": "trend-scout-agent@1.0",
  "created_at": "2025-01-01T06:00:00Z"
}
```

---

## 9. 'outfits'

```Json
{
  "id": "uuid",
  "user_id": "uuid",
  "title": "Klantbijeenkomst op regenachtige dinsdag",
  "artikelen": [
    { "closet_item_id": "uuid", "rol": "top" },
    { "closet_item_id": "uuid", "rol": "bottom" },
    { "closet_item_id": "uuid", "role": "bovenkleding" }
  ],
  "source": "stylist_agent",
  "context_at_creation": {
    "weer": { "temp_c": 6, "conditie": "regen" },
    "calendar": [{ "title": "Klantpitch", "formality_hint": "business" }]
  },
  "user_rating": 5,
  "worn_on": ["08-01-2025"],
  "created_at": "2025-01-01T00:00:00Z"
}
```

---

## 10. Indexcreatie (idempotente bootstrap bij het opstarten van FastAPI)

```python
wacht op db.users.create_index("email", uniek=True)
wacht op db.users.create_index("stripe_account_id")
wacht op db.closet_items.create_index([("user_id", 1), ("bron", 1), ("categorie", 1)])
wacht op db.closet_items.create_index([("tags", "tekst"), ("titel", "tekst"), ("merk", "tekst")])
wacht op db.listings.create_index([("bron", 1), ("status", 1), ("categorie", 1)])
wacht op db.listings.create_index([("locatie", "2dsphere")])
wacht op db.transactions.create_index([("buyer_id", 1), ("created_at", -1)])
wacht op db.transactions.create_index([("seller_id", 1), ("created_at", -1)])
wacht op db.transactions.create_index("stripe.checkout_session_id", uniek=Waar, sparse=Waar)
wacht op db.stylist_sessions.create_index("user_id", uniek=True)
wacht op db.stylist_messages.create_index([("session_id", 1), ("created_at", -1)])
wacht op db.embeddings.create_index([("entity_type", 1), ("entity_id", 1)], uniek=True)
wacht op db.cultural_rules.create_index([("regio", 1), ("religie", 1), ("gelegenheid", 1)])
wacht op db.trend_reports.create_index([("datum", -1), ("categorie", 1)])
```