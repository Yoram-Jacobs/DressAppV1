# GarmentVisionWaste — De regressie en het herstel van mei 2026

> **Raam bedekt:** 16 mei 2026 01:14 → 17 mei 2026 (deze sessie).  
> **Onderwerp:** Hoe de `garment_vision` pijplijn beschadigd raakte door een al te gretige refactor, wat het kostte, en hoe het herbouwd werd — chirurgisch, waarbij de werkende `AddItem.jsx` van de gebruiker onaangeroerd bleef.  
> **Waarom dit bestand bestaat:** Toekomstige agenten moeten weten dat "het herstructureren van `AddItem.jsx` om de GOLD-pijplijn te delen" een gedocumenteerde foutmodus is. Herhaal het niet.

---

## 1. De regressie

Een eerdere agent (tussen 16 mei 01:14 uur en het harde resetpunt) werd gevraagd om de **GOLD batched pipeline** (2-5 foto's met progressieve NDJSON-streaming) te delen met de camera-, enkele foto- en batch-uploadstromen in `AddItem.jsx`. In plaats van een chirurgische verandering, zal de agent:

* refactored de monolithische `AddItem.jsx` (~2 265 LoC), waardoor het werkende GOUD-pad werd doorbroken,
* "vergiftigd" `plan.md` en `CONCRETE_FACTS.md` met uitgestrekte patchlogs,
* cosmetische frontend-wijzigingen geïntroduceerd waar de gebruiker niet om had gevraagd, en
* heeft **niet** de symptomen verholpen die de gebruiker feitelijk had gemeld (lekken van gezicht/lichaam in kledingstukken, fantoomlege kaarten, gevallen accessoires).

De gebruiker eiste – zichtbaar uit geduld – een **harde reset om `fe45ba9`** vast te leggen, waarbij elke wijziging die de agent had aangebracht werd gewist en de originele AddItem.jsx + de documenten van vóór de corruptie werden hersteld.

Vanaf dat uitgangspunt zijn de herstelwerkzaamheden begonnen. **De frontend is tijdens het herstel nooit meer aangeraakt**. Elke oplossing was een chirurgische wijziging in de backend van `garment_vision.py` / `clothing_parser.py`.

---

## 2. Samenvatting van de terugvordering (één paragraaf)

Na de harde reset rapporteerde de gebruiker zes onafhankelijke symptomen in de AddItem-pijplijn, meestal zichtbaar in het kastraster: (1) huid/gezicht/haar lekt in kledinggewassen; (2) fantoom lege kaarten (witte tegels) opgeslagen in de kast toen rembg niets teruggaf; (3) kleine schoenen/accessoires die geruisloos door een absolute pixelvloer worden neergezet; (4) tassen die in twee kaarten uiteenvallen omdat hun maskers waren losgekoppeld; (5) de limiet van 6 items laat legitieme accessoires vallen in plaats van één item per soort te behouden; en ten slotte (6) bijsnijdgroottes die enorm variabel zijn in het kastraster — soms kleine puntjes, soms overlopend — omdat `crop_base64` de backend op de onbewerkte rembg-resolutie liet staan. Elk werd aangepakt met een enkele, gerichte backend-patch (oplossingen voor A-D, geometrische hoofduitsluiting, categoriebewuste percentagevloeren, overbrugging van maskerfragmenten, categoriebewuste cap-ordening en ten slotte `_fit_crop_to_card`). Lint bleef de hele tijd schoon, de backend werd bij elke iteratie netjes opnieuw opgestart en de frontend bleef onaangeroerd.

---

## 3. Tijdlijn en actietabel

> Tijden zijn bij benadering (chatbereiken, geen logtijdstempels). Elke rij komt overeen met één gebruikersprompt + het antwoord van de agent.

| Tijdlijn (ongeveer) | Gebruikersprompt (letterlijk of geparafraseerd) | Actie ondernomen |
|---|---|---|
| 16 mei, 01:14 → ~02:00 | "Deel de GOLD 2-5 batchpijplijn met de Camera / Single-photo / Batch-stromen in `AddItem.jsx`." (aan eerdere agent) | Vorige agent heeft `AddItem.jsx` te veel aangepast, het GOUD-pad verbroken en `plan.md` / `CONCRETE_FACTS.md` opgeblazen met patchlogboeken. |
| ~02:00–03:00 | "Je hebt de frontend en de documenten beschadigd. Voer een harde reset van de repository uit naar `fe45ba9`." | **Harde reset naar `fe45ba9`.** Frontend + documenten hersteld. Agent erkende de les: alleen chirurgische veranderingen; geen documenten zwellen zonder toestemming. |
| ~03:00 | "Gezichten en ledematen lekken in kledingstukken. Er verschijnen steeds fantoom-lege kaarten. Corrigeer eerst de uitlijning." | **Fix A** — gecorrigeerde masker/bbox-uitlijning in `_bbox_crop_useful`: het SegFormer-masker wordt nu gesneden uit de **exacte** rechthoek waarin de JPEG is geknipt (`box_px`) in plaats van een afzonderlijk berekende bbox. Tot 5% verschuiving bij categorieën met asymmetrische vulling geëlimineerd. |
| ~03:30 | "Er verschijnen nog steeds lege witte kaarten in de kast." | **Fix B** — een **5% solid-alpha fantoombescherming** toegevoegd in `_matte_crops`. De uiteindelijke alfa-≥-128-verhouding van RGBA-mat wordt gemeten; indien `< 5 %`, wordt de detectie volledig verwijderd. Lege kaart UX verdwenen. |
| ~04:00 | "Twee gelaagde toppen vallen samen in één bbox. Splits ze." | **Fix C** — splitsen van verbonden componenten: detecties van dezelfde klasse zijn ruimtelijk gegroepeerd (via maskerverbonden componenten); één detectie uitgezonden per ruimtelijke groep. Twee zwarte T-shirts naast elkaar smelten niet meer samen. |
| ~04:30 | "Gezichten/haar/armen lekken nog steeds in kledingzaken." | **Fix D** — bouwde een expliciet menselijk huid-/haar-/gezichtsmasker uit de persoonsklassen van SegFormer, verwijdde het en **afgetrokken** het van het zachte masker na de dilatatie in `apply_alpha_intersection`. Goedkoop als het aanwezig is, geen operatie als het afwezig is. |
| ~05:00 | "Eén afbeelding toont nog steeds het gezicht + de zonnebril op een bovenste kaart." | **Geometrische hoofduitsluiting** toegevoegd voor tops/bovenkleding/jurken: de band boven de geschatte schouderlijn wordt gedwongen naar alpha=0, ongeacht waar SegFormer/rembg het over eens zijn. Het resterende gezichtslek is verdwenen. |
| ~05:30 | "Schoenen en kleine accessoires blijven vallen." | **De absolute pixelvloer** in `_crop_to_bbox` vervangen door een **categoriebewust percentage korte-randvloer** (`_resolve_min_short_edge_pct_for_category`). Schoenen/accessoires overleven op 8% van de korte termijn; toppen vereisen 18%. Resolutie-invariant: een schoen met 8% van het frame wordt geaccepteerd, ongeacht of de upload 550 px of 4 K is. |
| ~06:00 | "Deze tas kwam terug als twee afzonderlijke kaarten." | **Maskerfragmentoverbrugging** voor accessoires/tassen: morfologische sluiting + convexe rompbrug om losgekoppelde maskercomponenten opnieuw te verbinden binnen de bbox van dezelfde detectie. Body + bandje nu één item. |
| ~06:30 | "De pet met zes items laat de legitieme schoenen vallen. Waarom?" | **Categoriebewust bestellen** vóór de limiet: `_filter_useful_detections` garandeert nu dat één item per soort overleeft voordat de resterende slots worden gevuld met de op één na grootste kandidaten in de gebiedsranglijst. Schoenen worden niet langer uitgezet door drie tops. |
| 17 mei, ~start huidige sessie | "Bijsnijden van kleine items worden opgeschaald door backend-verwerking en breken de gebruikersinterface van de frontend-kaart omdat de frontend niet downscalet. Voeg een functie toe om opgeschaalde crops op te vangen, opnieuw te schalen en te centreren zodat ze in het kaartvenster passen." | **`_fit_crop_to_card(crop_bytes, crop_mime)`** toegevoegd in `garment_vision.py`. Initiële implementatie: opschalen of verkleinen, nooit opschalen; gecentreerd op een canvas van 900×1200 (3:4). Bekabeld op alle 5 base64-emitterende locaties. Unit-geverifieerd (6 gevallen) en backend opnieuw opgestart. |
| 17 mei, ~30 minuten later | "Nu hebben we het tegenovergestelde probleem: items verschijnen als kleine puntjes in de kast. Pas de functie aan om OMHOOG te schalen zodat deze in het kaartvenster past. Bijvoorbeeld schoen 25×120 → 250×1200, en dan gecentreerd." | `_fit_crop_to_card` bijgewerkt: **de luxe cap van `, 1.0` verwijderd** zodat de helper nu elke uitsnede schaalt zodat deze in beide richtingen op het canvas past. Opnieuw geverifieerd met het exacte voorbeeld van 25×120 → 250×1200 van de gebruiker (10× luxer, gecentreerd op x=325). Alle 6 testgevallen slagen nog steeds. Backend is schoon opnieuw opgestart. |
| 17 mei, deze prompt | "Deze fase is afgerond. (1) Update de documentatie. (2) Maak `GarmentVision.md`. (3) Maak `GarmentVisionWaste.md` met een tijdlijn/prompt/actietabel.' | `docs/GarmentVision.md` (volledige pijplijnreferentie), `docs/GarmentVisionWaste.md` (dit bestand) gemaakt, een beknopt herstelitem toegevoegd aan `plan.md` en een release-opmerking aan `CHANGELOG.md`. |

---

## 4. Kosten van de regressie (wat werd verspild)

| Bron | Ongeveer. kosten |
|---|---|
| Wandklok | ~5 uur herstelwerk dat niet nodig zou zijn geweest als de vorige agent de gevraagde chirurgische verandering had aangebracht. |
| Code | Eén volledige harde reset (geen herstel): elke regel die de vorige agent tussen 01:14 uur en de reset heeft geschreven, is verwijderd. |
| Vertrouwen | De gebruiker heeft expliciet een vangrail toegevoegd: toekomstige agenten mogen `AddItem.jsx` niet overmatig refactoren, mogen `plan.md` / `CONCRETE_FACTS.md` niet opvullen met uitgebreide logboeken, en moeten de wijzigingen op de backend gericht houden, tenzij expliciet anders aangegeven. |
| Kans | Het Vertex AI Try-On-werk (Phase T1) en de CCP-benchmark-remap (Phase Eyes / Eval) bleven de hele tijd geblokkeerd omdat de backend-bandbreedte bij herstel werd verbrand. |

---

## 5. Wat de hele tijd schoon bleef

* **`frontend/src/pages/AddItem.jsx`** — niet aangeraakt na de harde reset. De GOLD-pijplijn die de gebruiker had laten werken, bleef intact.
* **`plan.md`** — geen log-bloat. Alleen deze korte herstelinvoer wordt toegevoegd.
* **`CONCRETE_FACTS.md`** — niet bewerkt. De expliciete instructie van de gebruiker werd gehonoreerd.
* **Ruff lint + backend-servicestatus** — groen na elke patch.
* **Testrapporten** — elke oplossing had een `/tmp/test_*.py` pythonverificatie (geen testagentceremonie, volgens de voorkeur van de gebruiker voor snelle chirurgische iteraties).

---

## 6. Lessen (bindend voor toekomstige agenten)

1. **Chirurgisch boven vegen.** Elk probleem in de herstellijst werd opgelost door één bestand (`garment_vision.py` of `clothing_parser.py`) te bewerken, geen handtekeningwijzigingen, geen nieuwe bedrading tussen modules. Voorkeur voor de kleinst mogelijke diff die het symptoom oplost.
2. **`AddItem.jsx` is dragend.** De gebruiker heeft ten minste één refactor ervan expliciet teruggedraaid. Behandel het als alleen-lezen, tenzij de gebruiker het bestand en de wijziging een naam geeft. Als een backend-fix een frontend-wijziging kan vervangen, geef dan de voorkeur aan de backend-fix.
3. **Vul `plan.md` niet in.** Patchlogs horen thuis in codecommentaar en CHANGELOG. `plan.md` is een strategische blauwdruk, geen dagboek.
4. **`/api/v1/closet/analyze` is het knelpunt voor elk toegangspad naar de kast.** Camera, enkele upload, batch-upload, Chrome-extensie: ze lopen er allemaal doorheen. Een backend-wijziging bereikt daar elke UI-stroom.
5. **Handmatige python-verificatie verslaat zware testruns voor chirurgische patches.** Een `python -c` of een kort script dat de helper direct oefent, is sneller dan Playwright opstarten voor een wijziging van één regel.