# Talenworkflow — Sessielogboek

> Sessielogboek met betrekking tot de aanvullingsinspanningen voor lokale vertalingen en de
> daaropvolgende backend i18n-consolidatie. Gevangen voor overdracht, dus de volgende
> agent (of u) kunt hervatten zonder de context opnieuw af te leiden.

---

## Doel

De DressApp frontend ondersteunt 12 talen via `react-i18next`. Tijdens het testen
in het Hebreeuws en Arabisch ontdekten we dat verschillende localebestanden stil waren
onvolledig - een vorige agent had ze gerapporteerd als "samengevoegd", maar de waarden
waren nog steeds rauw Engels. Deze sessie:

1. Elk localebestand versus `en.json` gecontroleerd om de werkelijke kloof te kwantificeren.
2. Er zijn scripts gebouwd om vertalingen van externe LLM's veilig samen te voegen zonder
   bestaand werk terugdringen.
3. Vertaalde vertalingen via Gemini en DeepSeek voor `de/es/hi/it/pt/zh`.
4. De taalgegevens geconsolideerd in een backend-service, zodat de FastAPI
   server kan inhoud weergeven in de door de gebruiker gekozen taal.

---

## Laatste dekking

| Lokaal | Dekking | Opmerkingen |
|--------|----------|-------|
| `nl` | bron | — |
| `Hoi` | 100,00% | Volledig vertaald. |
| `ar` / `hij` / `ja` / `ru` / `zh` | 99,7–100% | Het residu bestaat uit legitieme verwanten (`GTIN`, `kg`, `cm`, `E-mail`, enz.). |
| `de` / `es` / `it` / `pt` | 96–99% | Het residu is meestal verwant + een handvol grensreeksen (`Admin`, `Trend-Scout`, `Fashion Scout`). |
| `fr` | ~65% | **Uitstekend** — 358 ruw-Engelse sleutels blijven in `fr.json`. Backfill-payload voorbereid, maar nog niet teruggekoppeld via een LLM. |

---

## Tooling gebouwd (bevindt zich onder /app/scripts/ en /app/backend/)

### 1. `/app/scripts/apply_locale_backfill.py`

Voegt op veilige wijze een vertalingspayload samen in `/app/frontend/src/locales/<loc>.json`.

* Detecteert automatisch twee invoervormen:
  * **Starter** — `{_summary, locales: {fr: {strings: {genest...}}}}`
  * **Plat** — `{ "fr": {"nav.experts": "Experts", ...} }`
* Stript UTF-8 BOM (`utf-8-sig`).
* Weigert onbekende sleutels met een waarschuwing (kan geen gehallucineerde sleutel injecteren).
* Waarschuwt voor het afwijken van tijdelijke aanduidingen (`{{count}}` versus `{{n}}` etc.) zonder blokkering.
* Voegt diepgaand samen, behoudt bestaande vertalingen, schrijft JSON met twee spaties en streepjes
  met `ensure_ascii=False` om overeen te komen met de repositoryconventie.
* Creëert `<loc>.json.bak` naast elke schrijfbeurt voor onmiddellijk terugdraaien.
* `--dry-run`, `--only fr,ja`, `--no-backup` vlaggen ondersteund.

Gebruik:

``` bash
python3 /app/scripts/apply_locale_backfill.py /path/to/translations.json --droog uitvoeren
python3 /app/scripts/apply_locale_backfill.py /pad/naar/translations.json
```

### 2. `/app/scripts/fix_json_quotes.py`

Herstelt automatisch de terugkerende LLM-bug van niet-ontsnapte dubbele aanhalingstekens binnenin
JSON-tekenreekswaarden (bijvoorbeeld Gemini die `"…un marcador "día laboral"…"` uitzendt).

* Strips UTF-8 stuklijst.
* Als het bestand al is geparseerd, wordt 0 onaangeroerd afgesloten.
* Anders loopt elke `"key": "value"` regel door en ontsnapt aan elke kale `"`
  binnen het buitenste aanhalingstekenpaar van de waarde.
* Valideert het resultaat opnieuw; indien nog steeds defect, schrijft een gedeeltelijke uitvoer voor
  handmatige inspectie en uitgangen 2.

Gebruik:

``` bash
python3 /app/scripts/fix_json_quotes.py /pad/naar/in.json /pad/naar/uit.json
```

### 3. `/app/backend/app/services/i18n.py`

Back-end i18n-service met één bron van waarheid. Leest de landinstelling van de frontend
JSON-bestanden bij het starten van het proces: geen duplicatie, geen drift.

Openbare API:

```python
van app.services importeer i18n

i18n.t(key, lang="en", **vars) # vertaal een gestippelde sleutel, met interpolatie
i18n.available_linguals() # → ['en','hij','ar','es','fr','de','it','pt','ru','zh','ja','hi']
i18n.has_lingual("fr") # → Waar
i18n.is_rtl("ar") # → Waar
i18n.LANG_NAMES["fr"] # → 'Frans'
i18n.SUPPORTED_LANGUAGES # lijst met {code, native_name, english_name, dir}
i18n.RTL_LANGUAGES # frozenset({'ar', 'hij'})
i18n.lingual_directive("fr") # LLM "OUTPUT LANGUAGE = X" blok
```

Gedrag:

* Loopt gestippelde paden door geneste JSON.
* Valt terug naar Engels als de sleutel ontbreekt/leeg is in de gevraagde landinstelling.
* Retourneert de onbewerkte sleutelreeks als deze in beide ontbreekt (verhoogt nooit).
* Interpoleert tijdelijke aanduidingen voor `{{var}}`, `{var}` en `%(var)s`.
* BOM-tolerante belasting.
* Overschrijven via env var `DRESSAPP_LOCALES_DIR=/some/path` (handig voor Docker).

Bijwerking refactor: `gemini_stylist.py`'s hardgecodeerde `_LANG_NAMES` en inline
`_lingual_directive()` werd vervangen door dunne re-exports die hiernaar delegeerden
module. `stylist_brain.py` pikt het transparant op omdat het al geïmporteerd is
van `gemini_stylist`.

---

## Overdracht van vertaling in behandeling — fr.json

`/app/docs/locale_backfill_fr_only.json` is een geverifieerde payload voor één land
die alle 358 nog steeds Engelse sleutels in `fr.json` omvat.

Auditgaranties (beweerd op het moment van genereren):

* Precies één localeblok ("fr"`) — geen de/es/it/pt/zh-inhoud.
* `payload.fr.keys() == { k ∈ en.json | fr.json[k] == nl.json[k] } \ {merk}`
* Alle waarden zijn niet-lege Engelse brontekenreeksen.
* Tijdelijke aanduidingen intact (`{{label}}`, `{{count}}`, `{{amount}}`, `{{km}}`).
* `_instructions` omvat: uitvoer alleen in het Frans, tijdelijke aanduidingen, geen afbakeningen,
  meervoudsvormen, Franse typografische conventies.
* Tokenbudget: ~4,9K invoer, ~5,5K uitvoer → ~10K totaal. Past bij elke moderne
  GPT-4-klasse model in één keer.

Wanneer het LLM-antwoord arriveert:

``` bash
python3 /app/scripts/fix_json_quotes.py /pad/naar/fr_translated.json /tmp/fr.fixed.json
python3 /app/scripts/apply_locale_backfill.py /tmp/fr.fixed.json --droogdraaien
python3 /app/scripts/apply_locale_backfill.py /tmp/fr.fixed.json
```

---

## Wat ging er mis (en hoe werd het ingedamd)

Tijdens de sessie kwamen drie terugkerende LLM-foutmodi naar voren:

1. **Locale drift** — Gemini, gevraagd om een ladingdekking te vertalen
   `ar/fr/ja/ru/pt`, retourneerde in plaats daarvan `de/es/hi/it/pt/zh` (waarbij de
   gevraagde set, waardoor het `fr`-blok van het bestand wordt uitgebreid naar 6 ongevraagde
   talen). Oplossing: `_purpose`, `_direction`, `_locales_in_this_file`,
   en bewerkte `_examples`-velden werden aan de payload toegevoegd om de
   doel eenduidig.

2. **Truncatie** — elke Gemini-uitvoering wordt midden in de toonsoort afgekapt rond de 1400-toets
   markeren (altijd binnen de laatste landinstelling). Mitigatie: reddingsscript dat
   gooit de afgeknotte staart weg, plus de daaropvolgende "ontbrekende" lading die wordt geregenereerd
   van wat is afgeleverd versus wat nog steeds Engels bloedt.

3. **Onontsnapte innerlijke aanhalingstekens** — DeepSeek / Gemini zendt af en toe rauw uit
   `"día laboral"` binnen JSON-tekenreekswaarden. Oplossing: `fix_json_quotes.py`
   autoreparatiepas vóór de samenvoeging.

4. **Token-beperkt antwoord** — DeepSeek leverde de schoonste 6-locale
   woordenboek; ChatGPT en Claude weigerden beiden / bereikten plafonds voor de gebruiker
   kant. Het door de gebruiker geprefereerde voltooiingspad voor `fr` is daarom een
   onafhankelijke LLM-retour met `locale_backfill_fr_only.json`.

De safe-fill-strategie was overal: **pas alleen een nieuwe vertaling toe als
de huidige landinstelling is woordelijk Engels**. Dit verhinderde een van de
~425 "stilistische overschrijvingen" die Gemini wilde toepassen (bijvoorbeeld het verwisselen van een
geldige Italiaanse vertaling voor een iets andere geldige Italiaanse vertaling)
van het opnieuw procederen over reeds vertaald werk.

---

## Opruimen/restjes

* `.bak`-bestanden werden gemaakt naast elk locale-bestand dat door het script werd aangeraakt
  (`de.json.bak`, `es.json.bak`, enz.). Rol onmiddellijk terug met
  `mv de.json.bak de.json`. Veilig te verwijderen zodra u tevreden bent met het resultaat.
* `/app/docs/locale_backfill_starters.json` (geneste vorm) is verwijderd —
  vervangen door de platte vorm ladingen.
* `/app/docs/locale_backfill_missing.json` (de ar/fr/ja/ru/pt heen- en terugreis
  payload) en `/app/docs/locale_backfill_fr_only.json` (de gefocuste fr
  payload) blijven in `/app/docs/`.

---

## Bestanden aangeraakt

```
/app/scripts/apply_locale_backfill.py gemaakt
/app/scripts/fix_json_quotes.py gemaakt
gemaakt /app/backend/app/services/i18n.py
gemaakt /app/docs/locale_backfill_fr_only.json
/app/docs/locale_backfill_missing.json gemaakt
gemaakt /app/docs/Languages_chat.md (dit bestand)
bewerkt /app/backend/app/services/gemini_stylist.py (ontdubbelde taalkaart + richtlijn)
bewerkt /app/frontend/src/locales/de.json (+19 tot +281 vullingen over 3 rondes)
bewerkt /app/frontend/src/locales/es.json (+12 tot +292 vullingen)
bewerkt /app/frontend/src/locales/hi.json (+6 tot +131 vullingen)
bewerkt /app/frontend/src/locales/it.json (+14 tot +276 vullingen)
bewerkt /app/frontend/src/locales/pt.json (+295 vullingen - grootste deel van het werk)
bewerkt /app/frontend/src/locales/zh.json (+50 vullingen)
```

---

## Volgende stappen als je terugkomt

1. **Voer `locale_backfill_fr_only.json` uit via elk GPT-4-klasse model** — bestand
   is geverifieerd als solide; één retour plus het toepassingsscript sluit `fr` tot
   ~100% dekking.
2. **Opschonen** — zodra u de landinstellingen in de actieve app hebt gecontroleerd,
   verwijder de `.json.bak`-bestanden.
3. **Adopteer `app.services.i18n`** — begin `i18n.t(...)` te gebruiken in elke nieuwe
   backend-code die gebruikersgerichte tekenreeksen produceert (systeem-e-mails, stylist
   prompts, pushmeldingen). Het woordenboek wordt bij het importeren één keer geladen,
   dus bellen is goedkoop.
4. **In behandeling zijnde probleem van de overdracht** — Profielknop "Wijzigingen opslaan".
   altijd actief (P2). Niet gestart in deze sessie.

---

## Sessie 2 — Hardgecodeerde stringaudit + automatische patch

Na de eerste ronde van locale-vullingen waren er nog steeds verschillende UI-schermen zichtbaar
Engelse fragmenten op niet-Engelse landinstellingen (screenshots geleverd door de gebruiker:
Profielberoepsveld, lijstdetailchips, donatiebanner, trendkaarten,
dialoogvenster voor duplicaatdetectie). Oorzaak: **hardgecodeerde Engelse tekenreeksen in JSX/JS
bron die nooit via `react-i18next`** is gegaan.

### Gereedschap toegevoegd

```
/app/scripts/audit_hardcoded_strings.py — vindt gebruikersgericht Engels in /app/frontend/src
/app/scripts/apply_audit_translations.py - voegt LLM-vertaald dictaat terug in de 12 lokale JSON-bestanden
/app/scripts/patch_hardcoded_strings.py — herschrijft JSX/JS om Engelse letterlijke waarden te vervangen door t('key') aanroepen
/app/scripts/inject_use_translation.py - bootstrapt de useTranslation-hook op + import in componenten die deze missen
/app/docs/locale_backfill_untranslated.json — audituitvoer (na het samenvoegen: 0 bevindingen)
/app/docs/code_fixes_needed.md - letterlijke waarden voor modulebereik en raw-enum-bleeds waarvoor handmatig codewerk nodig is
```

De audit detecteert: JSX-tekstinhoud (tolerant voor meerdere regels), HTML-kenmerk
strings (`placeholder`, `title`, `aria-label`, `alt`), toast/alert-oproepen,
`t('key', { defaultValue: 'English' })` patronen waarin de sleutel ontbreekt
en.json en objectletterlijke labels in armatuur-/arraygegevens.

Verwijst naar elke kandidaat met bestaande waarden in `en.json` so
reeds vertaalde tekenreeksen (onbewerkt weergegeven omdat de code een onbewerkte enum
in plaats van `t()`) worden overgeslagen — deze worden vermeld in
`code_fixes_needed.md` voor handmatige oplossingen.

### Vertaalronde

* Controle heeft **154 verschillende Engelse tekenreeksen** gevonden in **68 bestanden**.
* DeepSeek vertaalde alle 154 × 11 talen in één keer – payload gevalideerd
  clean (het script repareerde automatisch 10 escapes tussen aanhalingstekens).
* Toepassen script gedetecteerd **13 `defaultValue` bevindingen** waarvan de bestaande i18n
  sleutel was al gekozen door de ontwikkelaar (bijvoorbeeld `home.trendsRefreshed`) —
  vertalingen zijn geschreven onder de sleutel van de ontwikkelaar, niet onder die van de audit
  synthetische `voorgestelde_sleutel`. Vermijdt dode vertalingen.
* `apply_audit_translations.py` schreef vervolgens 154 × 12 locales = **1.848
  samengevoegde vermeldingen** (geen afwijking van tijdelijke aanduiding).

### Broncode-patchronde

* `patch_hardcoded_strings.py` herschreef elke bevinding op zijn plaats. Twee passen:
  - **Pass 1:** 69 patches toegepast op 8 bestanden.
  - **Geslaagd voor 2** (nadat `inject_use_translation.py` de hook aan vier heeft toegevoegd
    componenten missen het): nog 23 patches voor SwapPickerModal,
    OutfitCanvas, ExtensionConnect, TransactionLanding.
* **In totaal 92 broncodepatches** verdeeld over 12 bestanden.
* Back-ups (`.bak`) geschreven naast elk gewijzigd bestand.
* Witruimte-flexibele JSX-regex met meerdere regels verwerkt `<p>multi-line\nblock</p>`
  patronen automatisch.

### Eindstatus na sessie 2

* **Herhaling van de audit toont 0 hardgecodeerde Engelse tekenreeksen** in het controleerbare bereik.
* Frontend bouwt schoon (`esbuild` geen fouten).
* Alle 12 localebestanden uitgebreid met de 154 nieuwe sleutels.

### Handmatig codewerk is nog steeds vereist (zie code_fixes_needed.md)

* `src/pages/ListingDetail.jsx` — 4 chippatches voor `listing.mode` /
  `listing.category` / `listing.condition` / `listing.size` via hun
  bestaande `taxonomie.*` vertalingen.
* `src/pages/Home.jsx` — herstructureer `FALLBACK_TRENDS` (modulebereik), voeg toe
  `trends.bucket.*` kaart voor Trend-Scout backend-labels.
* `src/components/SeoBase.jsx` — META-kaart op modulebereik, refactor om te gebruiken
  i18n-toetsen.
* `src/lib/countries.js` — gebruik `Intl.DisplayNames` in plaats van te vertalen
  de ISO-landenlijst met 250 vermeldingen via hetzelfde woordenboek.

Geschatte inspanning voor de handmatige oplossingen: **~50 minuten** om de laatste te sluiten
kloof die vertaling alleen niet kan bereiken.

---

## Sessie 3 — Taalwissel UX + resterende TODO

### Toegevoegd: taalschakelaar laadvlotter

De `change()` round-trip van de kiezer kan tot ~20 seconden duren op langzame netwerken
(i18n.changeLanguage + LanguageSync DOM opnieuw schilderen + optioneel `PATCH /me`
profielsynchronisatie). Gebruikers klikten op de kiezer en zagen niets zichtbaars
gebeuren, en ervan uitgaande dat er niets gebeurde.

#### Bestanden toegevoegd/gewijzigd

```
src/components/LanguageSwitchOverlay.jsx gemaakt
bewerkte src/App.js (mount overlay op BrowserRouter root)
bewerkte src/components/LanguagePicker.jsx (verzending start/done-gebeurtenissen)
12 × src/locales/<loc>.json bewerkt (3 nieuwe sleutels: taal.switching,
                                            taal.switchingTo, taal.switchingHint)
```

#### Hoe het werkt

* `LanguagePicker.change(code)` verzendt `dressapp:lang-switch-start`
  *voor* begint het asynchrone werk, met `{ code, nativeName }` dus de
  overlay toont de doellandinstelling in het oorspronkelijke script (bijvoorbeeld `中文`).
* De kiezer verzendt `dressapp:lang-switch-done` in een `eindelijk` blok
  — garandeert dat de overlay sluit, zelfs als `i18n.changeLanguage` of de
  'PATCH /me'-verzoek wordt gegenereerd.
* Aangepaste DOM-gebeurtenissen (geen React-context), zodat de overlay één keer kan worden geactiveerd
  de root en vereist geen provider die elke route inpakt.
* De overlay heeft een veiligheidsnettimer van 30 seconden die zichzelf automatisch sluit als de
  picker zendt nooit de gebeurtenis `done` uit (het netwerk loopt bijvoorbeeld vast).
* Escape-toets verdwijnt onmiddellijk (a11y); `aria-live="beleefd"` kondigt aan
  de staat voor schermlezers; `aria-busy="true"` op de achtergrond.
* Gemonteerd in de `BrowserRouter` root, dus geauthenticeerd **en** uitgelogd
  stromen (Inloggen / Registreren) krijgen de prijs - de kiezer verschijnt in totaal
  drie plaatsen.
* Visueel: 12 px `backdrop-blur` over `bg-background/60`, gecentreerde kaart met
  `rounded-2xl` + `shadow-2xl`, `Loader2` spinner van lucide-react. Nee
  rauwe rood/groene kleuren; maakt gebruik van het ontwerpsysteem-accenttoken.

### TODO — Experts → De vervolgkeuzelijst Beroep is in alle landen alleen in het Engels beschikbaar

Vastgelegd tijdens gebruikers-QA: in `/experts`, de vervolgkeuzelijst Beroepsfilter
geeft door de gebruiker ingevoerde beroepsreeksen woordelijk weer in elke landinstelling.

Oorzaak: `professions` is afgeleid van `p.professional?.profession`
vrije-tekstwaarden opgeslagen in het profiel van elke professional (geen opsomming):

```jsx
// src/pages/ExpertsDirectory.jsx:83
const beroepen = useMemo(() => {
  const set = new Set((items || []).map((p) => p.professional?.profession).filter(Boolean));
  return Array.from(set);
}, [artikelen]);
```

Dit is GEEN vertaalgat in de UI-kopie: het zijn gebruikersgegevens. Het repareren
goed nodig:

1. **Backend** — canoniseer beroepsinzendingen naar een gesloten enum
   (bijvoorbeeld `stylist`, `personal_shopper`, `tailor`, `image_consultant`, …)
   met een ontsnappingsluikje 'beroep_ander' in de vrije tekst.
2. **Taxonomie** — voeg `taxonomie.profession.<slug>` sleutels toe in alle 12 landinstellingen
   bestanden (gaat via dezelfde Gemini/DeepSeek-pijplijn als voorheen).
3. **Frontend** — lees de opsomming, render via
   `t(\`taxonomie.beroep.${item.professional.beroep}\`)`.
4. **Migratie** — eenmalige DB-pas die bestaande waarden voor vrije tekst in kaart brengt
   naar de dichtstbijzijnde enum-slak.

Geschatte inspanning: in totaal ~2-3 uur (meestal backend-schema + migratie).

### Statusmomentopname aan het einde van sessie 3

* Hardgecodeerde Engelse tekenreeksen binnen bereik: **0** (audit opnieuw bevestigd).
* Locale-pariteit: 12/12 locales hebben nu een taalwisselkopie + de 154
  auditfills + de 13 omgeleide `defaultValue`-sleutels + de bulk van sessie 1
  vertaalwerk.
* Frontend bouwt schoon (`esbuild` in 399 ms).
* Uitstekende handmatige codepatches: 4 (zie `code_fixes_needed.md`).
* Uitstekend werk op het gebied van gegevens/taxonomie: 1 (vervolgkeuzelijst beroep deskundigen, hierboven).

---

*Einde van sessie 3.*

---

## Sessie 4 — Twee vervolgacties van QA

### 1. Profielknop "Wijzigingen opslaan" is niet langer altijd actief

**Bestand:** `src/components/ProfileDetailsCard.jsx`

De knop Opslaan was alleen 'disabled={busy}' bedraad, dus er kon op worden geklikt
op het moment dat de pagina werd geladen, zelfs als de gebruiker niets had aangeraakt.

#### Repareren

* Leg een JSON-seriële basislijn van `initial` vast in een `useRef` bij mount.
* Bereken `isDirty = JSON.stringify(form) !== baselineRef.current` per
  render (goedkoop - vorm is duidelijke JSON, deterministische sleutelvolgorde van de
  `gebruikMemo` hierboven).
* Herbaseline binnen `save()` nadat de API-aanroep is gelukt:
  `baselineRef.current = JSON.stringify(formulier)`. Laat de knop terug vallen
  naar de uitgeschakelde status als de gebruiker op de pagina blijft.
* Als `initial` ooit extern opnieuw wordt berekend (bijvoorbeeld `updateUserLocal` van
  een ander tabblad, avatarwijziging elders), houd de basislijn in stap via
  een `lastSeenInitialRef` referentie-identiteitscontrole - externe updates
  worden niet aangezien voor vuil.
* Knop nu `disabled={busy || !isVuil}`.

Randgevallen gedekt:

| Scenario | Knopstatus |
|---|---|
| Pagina geladen, geen bewerkingen | Uitgeschakeld |
| Gebruikerstypen in een veld | Ingeschakeld |
| Gebruiker zet het veld terug naar de geladen waarde | Uitgeschakeld (hercontrole van diepgaande gelijkheid) |
| Gebruiker klikt op Opslaan, slaagt | Uitgeschakeld (basislijn bijgewerkt) |
| Opslaan mislukt (toast.error) | Nog steeds ingeschakeld (basislijn NIET bijgewerkt) |
| Gebruiker navigeert heen en terug | Uitgeschakeld (nieuwe koppeling, nieuwe basislijn) |
| Een ander tabblad werkt de gebruiker bij via context | Uitgeschakeld (basislijntracks `initieel`) |

### 2. "Alles opslaan" → "Opslaan" in de pijplijn Toevoegen aan kast

**Bestanden aangeraakt:** 12 × `src/locales/<loc>.json`

De interne i18n-sleutel werd behouden als `addItem.saveAll` en `common.saveAll`
(beide verwijzen naar dezelfde knop) dus er waren geen JSX/source-bewerkingen nodig -
alleen de weergegeven waarde werd per landinstelling herschreven. Vertalingen komen overeen
het standaard UI-werkwoord voor "Opslaan" in elke taal:

| Lokaal | Oud | Nieuw |
|---|---|---|
| nl | Alles opslaan | Opslaan |
| de | Alle speichern | Speichern |
| es | Bewaker todo | Bewaker |
| fr | Tout inschrijver | Inschrijven |
| het | Salva tutto | Salva |
| pt | Salvar tudo | Salvar |
| ru | Сохранить всё | Сохранить |
| ben | حفظ الكل | حفظ |
| hij | שמור הכל | שמור |
| hallo | Contactgegevens | सहेजें |
| ja | すべて保存 | 保存 |
| z | 全部保存 | 保存 |

Frontend bouwt schoon (`esbuild` in 240 ms), geen JS-lintbevindingen.

---

*Einde van sessie 4.*