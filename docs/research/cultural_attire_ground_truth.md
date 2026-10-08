# Global Geo-Specific Cultural & Traditional Attire Ground-Truth Research

**Document ID**: `docs/research/cultural_attire_ground_truth.md`  
**Purpose**: Authoritative Ground-Truth Reference for DressApp Knowledge Base, RAG Axiom Ingestion, and Stylist QA Pre-Filtering across 13 Languages.  
**Author**: DressApp Cultural Grounding & Stylist Core Team  
**Scope**: Christianity, Judaism, Islam, Hinduism, Buddhism, Sikhism, East Asian Traditions, African Traditions, and Latin American Ceremonies.

---

## 1. Executive Summary

DressApp provides culturally grounded styling intelligence across 13 languages. Rather than relying on small-language-model probabilistic guesses—which frequently hallucinate or confuse distinct religious rites—DressApp enforces explicit, human-audited **Ground-Truth Axioms**.

This document captures the fine-grained, geo-specific religious, cultural, and traditional attire, special ceremonial garments, modesty requirements, taboo colors, and negative attire restrictions across global traditions.

---

## 2. Master Ground-Truth Rules Catalog

### Group A: Christianity & Western Formal Traditions

#### Rule 1: `rule_cultural_vatican_papal_audience`
- **Title**: Vatican & Papal Audience Protocol (Privilège du Blanc & Il Protocollo Vaticano)
- **Geographic / Cultural Region**: Vatican City, Holy See, Global Roman Catholic formal audiences.
- **Rule Statement**: For private and special papal audiences at the Apostolic Palace, protocol prescribes dignified, conservative formalwear. Men wear a dark conservative suit (charcoal or navy) or morning coat with subdued silk tie and polished black leather oxford shoes. Women traditionally wear a formal, long-sleeved black dress or tailored skirt suit falling well below the knee, high neckline, and a black lace mantilla (veil).
- **Negative Constraints**: Strictly forbid white, ivory, or off-white dresses for women unless granted the *Privilège du blanc* (a rare hereditary privilege reserved exclusively for reigning Catholic queens and royal princesses). Strictly forbid sleeveless tops, bare shoulders, necklines below the collarbone, hemlines above the knee, open-toed sandals, athletic footwear, loud neon colors, flashy jewelry, or informal headwear (baseball caps, beanies).
- **Search Criteria / RAG Tags**: `vatican`, `papal_audience`, `pope`, `holy_see`, `mantilla`, `privilege_du_blanc`, `וותיקן`, `פגישה_עם_האפיפיור`, `האפיפיור`, `الفاتيكان`, `لقاء_البابا`, `vaticano`, `audiencia_papal`.
- **Example Look Composition**:
  - *Top/Dress*: Modest long-sleeved black crepe midi dress with high jewel neckline and opaque lining.
  - *Layer/Outerwear*: Black tailored wool crepe blazer.
  - *Accessory*: Traditional black Spanish lace mantilla and pearl stud earrings.
  - *Footwear*: Polished closed-toe black leather pumps with modest 40mm block heel.

#### Rule 2: `rule_cultural_christian_eastern_orthodox`
- **Title**: Eastern Orthodox & Coptic Church Etiquette (Ορθόδοξη Εκκλησία / الكنيسة القبطية)
- **Geographic / Cultural Region**: Greece, Cyprus, Eastern Europe, Russia, Levant, Egypt (Coptic), Global Orthodox parishes and holy monasteries (e.g. Mount Athos, Saint Catherine's Sinai).
- **Rule Statement**: Attire inside Orthodox and Coptic sanctuaries must demonstrate deep reverence and physical modesty. Men wear long tailored trousers or neat chinos with a pressed button-down collared shirt or fine-gauge knit; men must remove all headwear upon entering. Women wear below-the-knee modest skirts or dresses with covered shoulders and chest; in many traditional Orthodox parishes and monasteries, women cover their hair with a lightweight foulard or scarf. In Coptic Holy of Holies / altar spaces, worshippers remove shoes.
- **Negative Constraints**: Strictly forbid women from wearing pants/trousers inside traditional Eastern Orthodox monasteries and strict parishes (monasteries enforce skirts only). Strictly forbid shorts, short skirts, sleeveless or strap tops, plunging necklines, sheer textiles, or graphic prints. Men are strictly forbidden from wearing caps or hats inside.
- **Search Criteria / RAG Tags**: `orthodox`, `eastern_orthodox`, `coptic`, `greek_orthodox`, `russian_orthodox`, `monastery`, `mount_athos`, `קופטית`, `אורתודוקסית`, `מנזר`, `ארתודוקסי`, `كنيسة_أرثوذكسية`, `قبطية`, `دير`, `ortodoxa`.
- **Example Look Composition**:
  - *Top*: Long-sleeved pleated georgette blouse in dusty blue with high collar.
  - *Bottom*: Modest charcoal A-line pleated wool-blend midi skirt extending mid-calf.
  - *Accessory*: Lightweight silk-chiffon floral scarf draped loosely over hair/shoulders.
  - *Footwear*: Closed-toe black leather Chelsea boots or modest ballet flats.

#### Rule 3: `rule_cultural_western_white_tie`
- **Title**: Western White Tie & State Banquet Protocol (Cravate Blanche / שחור ולבן רשמי)
- **Geographic / Cultural Region**: Global ultra-formal: State banquets, royal coronations, Nobel Prize ceremonies, diplomatic balls, high-society galas.
- **Rule Statement**: White Tie is the apex of formal dress. Men strictly wear a black wool tailcoat (coatee) cut short in front with dual swallowtail skirts behind, worn unbuttoned; matching black trousers featuring a double stripe of satin/braid along outer seams; crisp white marcella piqué stiff-front wing-collar dress shirt with shirt studs; white marcella piqué low-cut waistcoat; hand-tied white cotton piqué bow tie; and black patent leather court pumps with grosgrain bows or highly polished patent oxford shoes. Women strictly wear formal, floor-length evening ball gowns, accompanied by evening opera gloves, high jewelry, and an evening clutch.
- **Negative Constraints**: Strictly forbid standard tuxedos, dinner jackets, black bow ties (black bow tie with tailcoat is reserved for headwaiters), colored waistcoats, standard business suits, daytime neckties, soft turn-down collars, belt loops (braces/suspenders only), wristwatches (pocket watch on chain only), or short cocktail dresses.
- **Search Criteria / RAG Tags**: `white_tie`, `cravate_blanche`, `tailcoat`, `state_banquet`, `nobel_prize`, `וויט_טאי`, `עניבה_לבנה`, `סעודת_מדינה`, `فستان_سهرة_ملكي`, `ربطة_عنق_بيضاء`, `frac`, `gran_gala`.
- **Example Look Composition**:
  - *Top*: Crisp white stiff-front marcella wing-collar evening shirt with mother-of-pearl studs.
  - *Outerwear*: Heavy black wool Barathea tailcoat with silk grosgrain peak lapels.
  - *Waistcoat*: White piqué double-breasted low-cut formal waistcoat.
  - *Bottom*: Matching black wool trousers with dual satin side braids and interior brace buttons.
  - *Accessories*: White hand-tied piqué bow tie and white silk pocket square.
  - *Footwear*: Black patent leather formal oxford shoes with silk grosgrain laces.

---

### Group B: Jewish Sacred & Life-Cycle Traditions

#### Rule 4: `rule_cultural_jewish_synagogue_prayer`
- **Title**: Synagogue Worship & Prayer Etiquette (בית כנסת ותפילה)
- **Geographic / Cultural Region**: Global Jewish communities, Ashkenazi, Sephardi, and Mizrahi synagogues, Western Wall (Kotel).
- **Rule Statement**: Attire for synagogue services must reflect sanctity and dignity (*Kavod HaTzibbur*). Men wear long tailored trousers or smart chinos, a clean collared button-down shirt or blazer, closed shoes, and must cover the head with a Kippah (Yarmulke). For morning prayers (*Shacharit*), Jewish men wear Tzitzit / Tallit. Women wear modest dresses or skirts covering knees, tops covering elbows and collarbone.
- **Negative Constraints**: Strictly forbid shorts, sleeveless shirts, gym wear, graphic tees, distressed/ripped denim, beach flip-flops, or entering bareheaded for men. Forbid short skirts, low-cut tops, or bare midriffs for women.
- **Search Criteria / RAG Tags**: `synagogue`, `beit_knesset`, `shul`, `kotel`, `western_wall`, `kippah`, `yarmulke`, `tallit`, `בית_כנסת`, `כותל`, `תפילה`, `שחרית`, `כיפה`, `טלית`, `כניסה_לבית_כנסת`, `كنس`, `كنيس_يهودي`, `sinagoga`.
- **Example Look Composition**:
  - *Top*: Light blue micro-check poplin button-down shirt.
  - *Outerwear*: Unstructured navy hopsack wool blazer.
  - *Bottom*: Medium-grey tailored wool trousers.
  - *Headwear*: Navy suede Kippah with silver rim embroidery.
  - *Footwear*: Dark brown suede Chukka boots or polished leather loafers.

#### Rule 5: `rule_cultural_jewish_brit_milah_simcha`
- **Title**: Brit Milah, Simchat Bat & Family Simchas (ברית מילה, שמחת בת ושמחות)
- **Geographic / Cultural Region**: Global Jewish communities, family celebrations.
- **Rule Statement**: Attire for circumcisions (Brit Milah), baby namings (Simchat Bat), and Pidyon HaBen is elevated, joyful, smart-formal or cocktail. Colors should celebrate new life: soft pastels, sky blue, cream, sage, floral patterns, festive navy. Men wear crisp dress shirts, sports jackets/blazers, and dress trousers. Women wear celebratory modest midi dresses or elegant pant suits (in non-orthodox venues) or skirt ensembles.
- **Negative Constraints**: Avoid somber, grim mourning black suits and black ties. Forbid casual athletic attire, denim, t-shirts, or workout sneakers. At orthodox ceremonies, maintain Tzniut modesty standards (no pants or sleeveless for women).
- **Search Criteria / RAG Tags**: `brit_milah`, `bris`, `simchat_bat`, `pidyon_haben`, `simcha`, `baby_naming`, `ברית`, `ברית_מילה`, `שמחת_בת`, `פדיון_הבן`, `שמחה_משפחתית`, `ختان_يهودي`, `circuncision_judia`.
- **Example Look Composition**:
  - *Top*: Crisp white spread-collar dress shirt paired with a soft lavender woven silk tie.
  - *Outerwear*: Light grey wool-linen blend tailored sports jacket.
  - *Bottom*: Dark navy tailored trousers with leather dress belt.
  - *Footwear*: Polished cognac brown leather Derby shoes.

#### Rule 6: `rule_cultural_jewish_chuppah_wedding`
- **Title**: Jewish Wedding & Chuppah Etiquette (חתונה יהודית וחופה)
- **Geographic / Cultural Region**: Global Jewish weddings (Orthodox, Traditional, Conservative, Reform).
- **Rule Statement**: Jewish weddings are joyful, high-energy formal celebrations. Guests wear elegant formal suits, festive cocktail dresses, or floor-length gowns. In Orthodox weddings with a Mechitzah (separate dancing), women adhere to Tzniut modesty (elbows, collarbones, below-knee hems).
- **Negative Constraints**: Strictly forbid plain solid white or ivory gowns for female guests (white is strictly reserved for the Kallah / bride; Ashkenazi grooms wear a white Kittel under their suit during Chuppah). Avoid all-black somber funeral attire.
- **Search Criteria / RAG Tags**: `chuppah`, `jewish_wedding`, `kallah`, `chatan`, `חתונה`, `חופה`, `כלה`, `חתן`, `חתונה_דתית`, `חתונה_אורתודוקסית`, `حفل_زفاف_يهودي`, `boda_judia`.
- **Example Look Composition**:
  - *Dress*: Emerald green pleated satin midi dress with long flutter sleeves and jewel neckline.
  - *Accessories*: Gold metallic drop earrings and champagne satin clutch.
  - *Footwear*: Strappy gold metallic mid-heel sandals or closed-toe almond pumps.

#### Rule 7: `rule_cultural_jewish_tisha_bav_fast`
- **Title**: Tisha B'Av & Yom Kippur Footwear Protocol (תשעה באב ויום כיפור - איסור נעילת הסנדל)
- **Geographic / Cultural Region**: Global Jewish observances for Yom Kippur and the fast of Tisha B'Av.
- **Rule Statement**: Halakha strictly prohibits wearing leather shoes (*Ne'ilat HaSandal*) on Yom Kippur and Tisha B'Av. Worshippers must wear non-leather footwear made exclusively of canvas, rubber, cotton, or synthetic materials. Clothing on Yom Kippur is traditionally white (symbolizing purity and angelic detachment); clothing on Tisha B'Av is somber, subdued, plain mourning attire.
- **Negative Constraints**: STRICTLY FORBID LEATHER FOOTWEAR: Shoes, boots, sandals, or clogs containing any real leather or suede are forbidden. Avoid flashy luxury accessories, gold jewelry, or ornate embellishments.
- **Search Criteria / RAG Tags**: `tisha_bav`, `yom_kippur`, `fast_day`, `non_leather_shoes`, `תשעה_באב`, `יום_כיפור`, `צום`, `נעלי_בד`, `איסור_נעילת_הסנדל`, `يوم_الغفران`, `ذكرى_خراب_الهيكل`.
- **Example Look Composition (Yom Kippur)**:
  - *Top*: Clean unadorned white linen-cotton tunic or white button-down shirt.
  - *Bottom*: Relaxed white or light stone cotton trousers.
  - *Footwear*: Plain white non-leather canvas slip-ons or fabric sneakers (100% rubber and textile construction).

---

### Group C: Islamic Sacred & Regional Traditions

#### Rule 8: `rule_cultural_islamic_hajj_umrah_ihram`
- **Title**: Hajj & Umrah Pilgrimage Etiquette (الإحرام ومناسك الحج والعمرة)
- **Geographic / Cultural Region**: Makkah, Madinah, Kingdom of Saudi Arabia, Sacred Precincts (Haram).
- **Rule Statement**: For men in the sacred state of Ihram, clothing consists strictly of two seamless, unhemmed, unstitched sheets of white terrycloth or cotton: the *Izar* (wrapped around the waist covering from navel to below knees) and the *Rida* (draped over shoulders, with right shoulder uncovered during Tawaf - *Idtiba*). Footwear must leave the ankles and the bridge of the foot uncovered (simple sandals). Women wear ordinary, loose-fitting, fully modest clothing (abaya in neutral white, black, or earthy tones) covering the entire body except the face and hands.
- **Negative Constraints**: For men in Ihram: STRICTLY FORBID ANY STITCHED OR TAILORED GARMENTS (no underwear, briefs, trousers, shirts, jackets, or socks). Forbid any head covering (caps, ghutras, umbrellas resting on head). Forbid scented textiles or closed shoes covering ankles/instep. For women in Ihram: STRICTLY FORBID THE NIQAB (face veil) AND GLOVES; the face and hands must remain uncovered.
- **Search Criteria / RAG Tags**: `ihram`, `hajj`, `umrah`, `makkah`, `pilgrimage`, `حج`, `عمرة`, `إحرام`, `مكة_المكرمة`, `المسجد_الحرام`, `رداء`, `إزار`, `חאג'`, `עומרה`, `איחראם`, `peregrinacion_meca`.
- **Example Look Composition (Men)**:
  - *Garment*: Two sheets of unstitched pure white combed cotton waffle-weave towels (Rida and Izar) secured with an unstitched travel waist belt.
  - *Footwear*: Non-stitched white rubber and leather-free flip-flop sandals leaving the upper foot bridge and ankle completely exposed.

#### Rule 9: `rule_cultural_islamic_eid_festive`
- **Title**: Eid al-Fitr & Eid al-Adha Festive Splendor (عيد الفطر وعيد الأضحى المبارك)
- **Geographic / Cultural Region**: Global Muslim world, MENA, South Asia, Central Asia, Southeast Asia.
- **Rule Statement**: Following the prophetic tradition (Sunnah), Muslims wear their finest, cleanest, and often newly purchased clothing for Eid prayer (*Salat al-Eid*) and family banquets. Attire combines high elegance with Islamic modesty. Men wear pristine white or jewel-toned Thobes/Kanduras, embroidered Kurtas, or tailored suits with festive fragrances (*'Oud*). Women wear celebratory embroidered Abayas, Kaftans, Anarkalis, or elevated modest dresses adorned with intricate gold/silver embroidery and coordinating luxury hijabs.
- **Negative Constraints**: Strictly forbid worn-out, stained, distressed casualwear (ripped jeans, faded t-shirts, gym sneakers). Prohibit revealing cuts (mini hemlines, low necklines, sheer textiles without slips).
- **Search Criteria / RAG Tags**: `eid`, `eid_al_fitr`, `eid_al_adha`, `eid_mubarak`, `عيد_الفطر`, `عيد_الأضحى`, `ملابس_العيد`, `تكبيرات_العيد`, `עיד_אל_פיטר`, `עיד_אל_אדחא`, `fiesta_del_cordero`, `fete_de_laid`.
- **Example Look Composition**:
  - *Dress*: Opulent emerald green silk-crepe Kaftan with gold Zari hand-embroidery along the neckline and cuffs.
  - *Hijab*: Champagne gold chiffon-silk wrap scarf.
  - *Accessories*: Delicate gold cuff bracelet and metallic structured minaudière.
  - *Footwear*: Pointed-toe gold metallic leather kitten heels.

#### Rule 10: `rule_cultural_islamic_regional_gulf_bisht`
- **Title**: Arabian Gulf Formal Protocol & Bisht (البشت والكندورة الخليجية)
- **Geographic / Cultural Region**: Gulf Cooperation Council (Saudi Arabia, UAE, Qatar, Kuwait, Bahrain, Oman).
- **Rule Statement**: The quintessential formal, diplomatic, and wedding attire for Gulf Arab men consists of a crisp, tailored, floor-length Thobe (or Kandura/Dishdasha) in bright white (for summer) or heavy dark wool (charcoal, navy, camel for winter); topped by the Ghutra/Shemagh (headscarf) held in place with the Agal (black cord). For high-state functions, weddings, and Eid, men drape a **Bisht** (a flowing cloak woven of sheer camel hair or wool trimmed with gold *Zari* embroidery) over the shoulders. Women wear haute-couture tailored Abayas with matching Sheila and luxury footwear.
- **Negative Constraints**: Strictly forbid wearing a Bisht with sportswear, denim, or casual open t-shirts. Forbid ill-fitting, wrinkled, or soiled Thobes. Forbid wearing an Agal crooked or without a foundational Ghutra.
- **Search Criteria / RAG Tags**: `gulf`, `bisht`, `thobe`, `kandura`, `shemagh`, `ghutra`, `agal`, `بشت`, `ثوب`, `كندورة`, `شماغ`, `عقال`, `دشداشة`, `خليجي`, `שמאג'`, `בישט`, `ת'וב`.
- **Example Look Composition**:
  - *Base*: Crisp snow-white superfine cotton bespoke Thobe with Mandarin collar and mother-of-pearl buttons.
  - *Outerwear*: Sheer black wool Bisht with handcrafted Saudi royal gold *Zari* embroidery along borders.
  - *Headwear*: Crisp white Ghutra secured with a double-ring black wool Agal.
  - *Footwear*: Handcrafted dark brown ostrich leather traditional Gulf sandals (*Na'al*).

#### Rule 11: `rule_cultural_islamic_regional_maghreb_djellaba`
- **Title**: Maghrebi Djellaba, Kaftan & Babouche Etiquette (الجلابة والقفطان المغربي)
- **Geographic / Cultural Region**: Morocco, Algeria, Tunisia, Mauritania (North Africa).
- **Rule Statement**: In North African traditions, the national formal and ceremonial attire centers on the Djellaba (long loose robe with full sleeves and a conical hood called a *Qob*), the Gandora (sleeveless lightweight tunic), and the ceremonial women's Moroccan Kaftan / Takchita (ornate multi-layered silk gown cinched with a gold *Mdamma* belt). Footwear is traditionally the handcrafted leather **Babouche** (or *Belgha*) slipper: pointed in Moroccan cities, rounded in the south.
- **Negative Constraints**: Avoid synthetic ill-fitting knockoffs with cheap printed plastic trims. Do not wear worn rubber slippers or dirty sneakers with a ceremonial silk Djellaba.
- **Search Criteria / RAG Tags**: `djellaba`, `kaftan`, `takchita`, `babouche`, `belgha`, `morocco`, `maghreb`, `جلابة`, `قفطان_مغربي`, `تكشيطة`, `بلغة`, `شربيل`, `مغاربي`, `ג'לאביה`, `כפתן_מרוקאי`, `chilaba`, `caftan_marroqui`.
- **Example Look Composition**:
  - *Garment*: Olive green fine-wool woven men's Djellaba featuring handcrafted silk *Sfifa* and *Aakad* buttons down the chest.
  - *Inner*: White cotton Gandora base.
  - *Footwear*: Hand-stitched natural yellow calfskin Belgha slippers with soft leather soles.

#### Rule 12: `rule_cultural_islamic_regional_se_asia_batik`
- **Title**: Southeast Asian Batik & Baju Melayu Protocol (Batik & Baju Melayu Nusantara)
- **Geographic / Cultural Region**: Indonesia, Malaysia, Singapore, Brunei, Southern Thailand.
- **Rule Statement**: In Indonesia and Malaysia, authentic handcrafted **Batik** (wax-resist dyed shirts in silk or fine cotton) is officially recognized as presidential, diplomatic, and formal business attire substituting for Western suits. For Islamic holidays, weddings, and Friday prayer, men wear the **Baju Melayu** (long-sleeved tunic and trousers) accompanied by a **Songket Kain Samping** (woven gold-thread sarong wrapped around the waist) and a black velvet **Songkok** cap. Women wear the **Baju Kurung** or **Baju Kebaya** with a coordinating **Tudung** (hijab).
- **Negative Constraints**: Strictly forbid short-sleeved informal tourist print Hawaiian shirts in place of formal long-sleeved silk Batik. Do not wear a Baju Melayu without the Kain Samping at formal ceremonial events.
- **Search Criteria / RAG Tags**: `batik`, `baju_melayu`, `baju_kurung`, `songkok`, `kain_samping`, `kebaya`, `indonesia`, `malaysia`, `tudung`, `باتيك`, `باجو_ملايو`, `سونغكوك`, `אינדונזיה`, `מלזיה`, `באטיק`.
- **Example Look Composition**:
  - *Top*: Long-sleeved handcrafted silk Batik shirt in deep indigo and bronze Javanese *Parang* motif.
  - *Bottom*: Tailored black formal wool trousers.
  - *Footwear*: Polished black leather Derby dress shoes.

---

### Group D: Hindu Ceremonial & Sacred Temple Codes

#### Rule 13: `rule_cultural_hindu_temple_darshan`
- **Title**: Hindu Temple Darshan & Non-Leather Sanctum Protocol (मंदिर दर्शन एवं पूजा)
- **Geographic / Cultural Region**: India, Nepal, Bali, global Hindu diaspora temples.
- **Rule Statement**: Entering a Hindu Mandir for Darshan and Puja requires purity, modesty, and reverence. Men wear traditional unstitched or loose cotton/silk garments: Kurta with Pyjama, Dhoti, or Kurta with formal trousers. Women wear Sarees, Salwar Kameez with Dupatta covering the chest, or Anarkali suits. Shoulders and knees must be fully covered. All footwear must be removed outside at the temple step (*Charan Paduka*).
- **Negative Constraints**: STRICTLY FORBID ALL LEATHER ARTICLES: Belts, shoes, watch straps, wallets, or handbags made of real cow/animal leather are strictly forbidden inside the sanctum (*Garbhagriha*) as they represent ritual impurity and violence (*Ahimsa*). Strictly forbid shorts, mini skirts, low-cut tops, bare shoulders, or distressed jeans.
- **Search Criteria / RAG Tags**: `temple_darshan`, `puja`, `mandir`, `hindu_temple`, `no_leather`, `dhoti`, `saree`, `kurta`, `मंदिर`, `दर्शन`, `पूजा`, `बिना_चमड़ा`, `धोती`, `साड़ी`, `מקדש_הינדי`, `פוג'ה`, `דארשאן`, `templo_hindu`.
- **Example Look Composition**:
  - *Top*: Saffron-gold pure raw silk Kurta with fine Mandarin collar and thread buttons.
  - *Bottom*: Off-white cotton-linen churidar trousers secured with a drawstring (no leather belt).
  - *Accessories*: Cotton Angavastram (stole) draped over the left shoulder.
  - *Footwear*: Fabric slip-on slippers (removed immediately before the temple threshold).

#### Rule 14: `rule_cultural_hindu_kerala_mundu`
- **Title**: South Indian Kerala Temple Attire (കേരള ക്ഷേത്ര വസ്ത്രധാരണം - Mundu & Veshti)
- **Geographic / Cultural Region**: Kerala, Tamil Nadu, Karnataka (e.g. Guruvayur, Padmanabhaswamy Temple).
- **Rule Statement**: Traditional South Indian temples (particularly in Kerala) enforce ancient Vedic dress codes: Hindu men must enter the temple premises bare-chested (removing shirts, vests, and modern outerwear) and wear a pristine white or cream **Mundu** (cotton sarong with gold *Kasavu* border) tied at the waist, sometimes accompanied by a folded *Melmundu* draped across the waist or shoulder. Women wear the traditional cream-and-gold **Kasavu Saree** (or two-piece *Set Mundu* / *Mundum Neriyathum*).
- **Negative Constraints**: Strictly forbid stitched shirts, t-shirts, vests, trousers, jeans, or shorts for men inside orthodox Kerala temple inner courtyards. Forbid synthetic colors, dark mourning black (except for Sabarimala Ayyappa pilgrims wearing black/blue during the 41-day Vrata), or Western casual attire.
- **Search Criteria / RAG Tags**: `kerala_temple`, `mundu`, `veshti`, `kasavu`, `set_mundu`, `south_indian_temple`, `കേരളം`, `മുണ്ട്`, `ക്ഷേത്രം`, `मुंडू`, `केरल_मंदिर`, `דרום_הודו`, `מונדו`.
- **Example Look Composition**:
  - *Garment*: Traditional handwoven Kerala double-Mundu in off-white organic cotton with a 3-inch pure gold zari border (*Kasavu*).
  - *Shoulder*: Folded matching cotton Melmundu draped over the arm.
  - *Footwear*: Barefoot inside temple boundaries.

---

### Group E: Buddhist Monastic Respect & Sacred Sites

#### Rule 15: `rule_cultural_buddhist_temple_etiquette`
- **Title**: Buddhist Temple Visitation & Sacred Site Etiquette (วัดวาอาราม / 佛寺礼仪)
- **Geographic / Cultural Region**: Thailand, Myanmar, Sri Lanka, Cambodia, Laos (Theravada); Japan, China, Korea, Vietnam (Mahayana); Tibet, Bhutan, Himalayas (Vajrayana).
- **Rule Statement**: When visiting Buddhist temples, stupas, and monasteries (e.g. Wat Phra Kaew in Bangkok, Temple of the Tooth in Kandy, Jokhang in Lhasa), attire must demonstrate calm, modesty, and modesty. Clothing must cover shoulders, upper arms, chest, and extend well below the knees (ankle-length is ideal). Fabrics should be loose, comfortable, and quiet. Footwear and socks/hats must be removed before stepping into the central shrine room (*Vihara* / *Ubosot*).
- **Negative Constraints**: STRICTLY FORBID CLOTHING RESEMBLING MONASTIC ROBES: Laypersons must NEVER wear solid saffron, golden-orange, ochre, or Tibetan maroon robes, which are exclusively reserved for ordained Buddhist monks (*Bhikkhus*). Strictly forbid sleeveless tank tops, spaghetti straps, crop tops, short shorts, sheer blouses, ripped denim, or clothing bearing irreverent graphics or Buddha prints on trousers/shoes (disrespect to Buddha's image is a criminal offense in several Buddhist countries).
- **Search Criteria / RAG Tags**: `buddhist_temple`, `monastery`, `wat`, `theravada`, `mahayana`, `saffron_taboo`, `temple_dress_code`, `วัด`, `ทำบุญ`, `佛寺`, `寺庙礼仪`, `מקדש_בודהיסטי`, `בודהיזם`, `templo_budista`, `pagoda`.
- **Example Look Composition**:
  - *Top*: Loose-fitting, airy cream cotton-linen long-sleeved tunic shirt.
  - *Bottom*: Wide-leg khaki or navy lightweight linen trousers reaching past the ankles.
  - *Footwear*: Slip-on canvas espadrilles or loafers (easily removed and carried at temple steps).

#### Rule 16: `rule_cultural_buddhist_lay_meditation_white`
- **Title**: Buddhist Lay Meditation & Precept Observance (ชุดขาวปฏิบัติธรรม / Upāsaka White)
- **Geographic / Cultural Region**: Theravada Buddhist retreat centers, Sri Lanka, Thailand, Myanmar, global Vipassana centers.
- **Rule Statement**: When lay devotees attend temple on holy observance days (Uposatha, Vesak) or participate in silent meditation retreats observing the Eight Precepts (*Atthasila*), the canonical attire is **entirely pure solid white** (*Chut Khao*). White signifies simplicity, mental purity, renunciation of vanity, and equality before the Dharma.
- **Negative Constraints**: Strictly forbid bright, multicolored, saturated garments. Avoid jewelry, makeup, perfumes, loud patterns, tight activewear leggings, or luxurious logos.
- **Search Criteria / RAG Tags**: `buddhist_meditation`, `vipassana`, `uposatha`, `white_clothing_buddhism`, `ชุดขาว`, `ชุดปฏิบัติธรรม`, `白衣居士`, `禅修服装`, `מדיטציה_בודהיסטית`, `לבוש_לבן_בודהיסטי`, `meditacion_budista`.
- **Example Look Composition**:
  - *Top*: Plain, unadorned white cotton peasant blouse or loose button-front meditation tunic.
  - *Bottom*: Loose white fisherman pants or drawstring wide-leg white cotton trousers.
  - *Footwear*: Barefoot or simple white cotton socks.

---

### Group F: Sikh Sacred Gurdwara Protocol

#### Rule 17: `rule_cultural_sikh_gurdwara_protocol`
- **Title**: Sikh Gurdwara Etiquette & Head Covering (ਗੁਰਦੁਆਰਾ ਸਾਹਿਬ ਮਰਯਾਦਾ)
- **Geographic / Cultural Region**: Punjab, Golden Temple (Amritsar), global Sikh Gurdwaras.
- **Rule Statement**: Entering a Sikh Gurdwara to pay homage to the Guru Granth Sahib requires strict adherence to humility, equality, and reverence. **MANDATORY HEAD COVERING**: Every person (regardless of gender, religion, or background) MUST cover their head entirely before entering the Gurdwara grounds using a **Rumāl** (cloth scarf), **Patka**, **Dastar** (turban), or **Dupatta/Chunni**. Feet must be bare: shoes and socks are removed at the *Joda Ghar*, and feet must be cleansed in the water pool (*Charanamrit*) before entering the prayer hall (*Darbar Sahib*). Clothing must be loose, modest, and comfortable for sitting cross-legged on the carpeted floor for long periods.
- **Negative Constraints**: STRICTLY FORBID HATS AND CAPS: Baseball caps, beanies, fedoras, flat caps, or sunhats are strictly forbidden as head coverings inside a Gurdwara. Strictly forbid bare heads. Strictly forbid shorts, mini skirts, sleeveless tops, or bare shoulders. STRICTLY FORBID TOBACCO, SMOKING MATERIALS, ALCOHOL, OR MEAT ANYWHERE ON THE PREMISES.
- **Search Criteria / RAG Tags**: `gurdwara`, `sikh`, `golden_temple`, `rumal`, `dastar`, `turban`, `head_covering`, `amritsar`, `ਗੁਰਦੁਆਰਾ`, `ਰੁਮਾਲ`, `ਦਸਤਾਰ`, `ਸਿੱਖ`, `גורדווארה`, `סיקים`, `טורבן`, `מקדש_הזהב`, `templo_sikh`.
- **Example Look Composition**:
  - *Top*: Breathable sky-blue or cream cotton Kurta tunic with long sleeves.
  - *Bottom*: Loose white cotton Pyjama pants or Salwar allowing easy cross-legged seated posture.
  - *Headwear*: Vibrant orange or royal blue triangular cotton Rumāl tied securely covering all hair.
  - *Footwear*: Slip-on leather Kolhapuris (deposited safely in the shoe sanctuary).

---

### Group G: East Asian Ceremonial & Cultural Nuances

#### Rule 18: `rule_cultural_japanese_kimono_collar_rule`
- **Title**: Japanese Kimono & Yukata Protocol: The Sacred Left-Over-Right Rule (着物の左前・右前)
- **Geographic / Cultural Region**: Japan, global Japanese cultural events, tea ceremonies, festivals.
- **Rule Statement**: When wearing traditional Japanese garments—including Kimono, Yukata, Haori, and Jinbei—the wearer must ALWAYS wrap the **left collar over the right collar** (*Yae* / *Hidari-mae* from the viewer's perspective, right-under-left from the wearer's). In traditional Japanese formal ceremonies (tea ceremonies, weddings), women wear elegant silk Houmongi or Tomesode with an authentic Obi sash and white Tabi socks with Zōri sandals.
- **Negative Constraints**: STRICTLY FORBID WRAPPING THE RIGHT COLLAR OVER THE LEFT COLLAR: Right-over-left wrapping (*Migi-mae* / *Kitasou*) is exclusively and strictly reserved for dressing deceased corpses in Buddhist coffins for cremation. Crossing right-over-left on a living person is considered an appalling omen of impending death and bad luck. Forbid bare feet with formal Kimono (must wear white split-toe Tabi socks).
- **Search Criteria / RAG Tags**: `kimono`, `yukata`, `japanese_attire`, `collar_rule`, `obi`, `tabi`, `zori`, `着物`, `浴衣`, `左前`, `右前の禁忌`, `和服`, `קימונו`, `יוקטה`, `יפן`, `כימונו`, `traje_japones`.
- **Example Look Composition**:
  - *Garment*: Traditional silk Houmongi kimono in muted sage-green with delicate cherry blossom hand-painted crest, crossed **left collar over right collar**.
  - *Waist*: Stiff woven gold and silver brocade Fukuro Obi tied in an elegant Otaiko knot.
  - *Footwear*: Pristine white split-toe Tabi cotton socks with traditional lacquer Zōri sandals.

#### Rule 19: `rule_cultural_korean_hanbok_wedding_palette`
- **Title**: Korean Hanbok Wedding Palette & Maternal Etiquette (혼주 한복 색상 규정)
- **Geographic / Cultural Region**: South Korea, traditional Korean weddings (*Paebaek*), Lunar New Year (*Seollal*).
- **Rule Statement**: The traditional Korean **Hanbok** consists of the *Jeogori* (short jacket) and *Chima* (high-waisted full skirt) for women, and *Baji* (trousers) with *Jeogori* and *Durumagi* (overcoat) for men. At Korean weddings, centuries-old Confucian chromatic protocol dictates the mother-of-the-couple colors: **The Mother of the Bride strictly wears warm tones** (pink, coral, peach, or soft red *Chima* or *Jeogori*); **The Mother of the Groom strictly wears cool tones** (sky blue, indigo, navy, jade green, or cyan).
- **Negative Constraints**: Mothers must never swap or mix up the maternal color codes (groom's mother wearing pink or bride's mother wearing blue causes immense confusion and social disrespect). Guests must avoid wearing bridal white or overly loud saturated neon colors.
- **Search Criteria / RAG Tags**: `hanbok`, `korean_wedding`, `jeogori`, `chima`, `paebaek`, `seollal`, `한복`, `혼주한복`, `신부어머니한복`, `신랑어머니한복`, `결혼식한복`, `הנבוק`, `קוריאה`, `חתונה_קוריאנית`.
- **Example Look Composition (Mother of the Groom)**:
  - *Top*: Ivory silk *Jeogori* with delicate blue embroidery along the sleeve cuffs and collar band, tied with a navy silk *Otgoreum* ribbon.
  - *Bottom*: Billowing sky-blue raw silk *Chima* falling to the floor.
  - *Footwear*: Traditional Korean white padded socks (*Beoseon*) with curved silk floral shoes (*Kkotsin*).

#### Rule 20: `rule_cultural_chinese_green_hat_taboo`
- **Title**: Chinese Cultural Green Hat Taboo (戴绿帽子 - Dài Lǜ Màozi)
- **Geographic / Cultural Region**: China, Taiwan, Hong Kong, global Chinese diaspora.
- **Rule Statement**: In Chinese society, headwear for men should feature neutral, dark, or tasteful styling colors (black, navy, grey, charcoal, brown, beige).
- **Negative Constraints**: STRICTLY PROHIBIT MEN FROM WEARING GREEN HATS OR CAPS: In Chinese culture, the idiom "wearing a green hat" (*dài lǜ màozi* / 戴绿帽子) signifies that a man's wife or partner has been unfaithful and committed adultery. Giving a man a green cap, green beanie, green fedora, or recommending a green baseball cap is an extreme cultural faux pas, insult, and source of intense ridicule.
- **Search Criteria / RAG Tags**: `green_hat_taboo`, `chinese_taboo`, `dai_lu_maozi`, `戴绿帽子`, `绿帽子`, `中国文化禁忌`, `כובע_ירוק_סין`, `טאבו_סיני`, `sombrero_verde_china`.
- **Example Look Composition**:
  - *Top*: Tailored charcoal grey cashmere mock-neck sweater.
  - *Outerwear*: Camel wool trench coat.
  - *Headwear*: Classic midnight navy or black wool beanie (strictly non-green).
  - *Bottom*: Dark raw selvedge denim jeans.
  - *Footwear*: Polished black leather Chelsea boots.

---

### Group H: African Ceremonial & Traditional Heritage

#### Rule 21: `rule_cultural_yoruba_agbada_aso_ebi`
- **Title**: Yoruba Ceremonial Agbada, Gele & Aso Ebi (Àgbàdá, Gèlè àti Aṣọ Ẹbí)
- **Geographic / Cultural Region**: Nigeria, Benin, West Africa, global Yoruba diaspora.
- **Rule Statement**: For major celebrations, weddings, and chieftaincy events, Yoruba attire represents majestic grandeur and community cohesion (*Aso Ebi* — the coordinated uniform fabric chosen by celebrants). Men wear the grand **Agbada**: a luxurious 3-piece ensemble featuring an inner tunic (*Buba*), drawstring trousers (*Sokoto*), and a massive flowing, heavily embroidered wide-sleeved outer robe (*Agbada*) draped over shoulders, crowned by an embroidered **Fila** cap (tilted stylishly to one side). Women wear an opulent matching *Buba* (blouse), *Iro* (wrap skirt), an intricately tied **Gele** (head-tie sculpted like architectural art from Aso Oke or Damask), and an *Ipele* (shoulder sash).
- **Negative Constraints**: Strictly forbid wearing an Agbada without the Fila cap (an Agbada without a cap is considered incomplete and disrespectful). Do not let the Agbada sleeves drag on the floor; they must be folded and rested cleanly over the shoulders. Avoid breaking the designated Aso Ebi color palette assigned by wedding hosts.
- **Search Criteria / RAG Tags**: `agbada`, `gele`, `aso_ebi`, `aso_oke`, `yoruba`, `nigerian_wedding`, `fila`, `buba`, `iro`, `أغبادہ`, `يوروبا`, `نيجيريا`, `אגבאדה`, `גלה`, `אסו_אבי`, `ניגריה`, `traje_yoruba`.
- **Example Look Composition**:
  - *Ensemble*: Royal purple handwoven Aso Oke 3-piece Agbada with intricate gold geometric embroidery across the chest plate and shoulders.
  - *Headwear*: Matching royal purple stiff-fabric Fila Gobi cap creased and angled to the left.
  - *Accessories*: Natural amber wrist beads and polished leather horsehair flywhisk (*Irukere*).
  - *Footwear*: Custom embroidered velvet slippers or polished dark leather loafers.

#### Rule 22: `rule_cultural_igbo_isiagu_coral_beads`
- **Title**: Igbo Chieftaincy Isiagu & Coral Regalia (Ịsị Àgụ na Ọkpụ Àgụ)
- **Geographic / Cultural Region**: Southeastern Nigeria, Igbo traditional weddings (*Igba Nkwu*), New Yam Festival (*Iri Ji*).
- **Rule Statement**: The **Isiagu** (literally "Head of the Leopard", featuring embroidered lion or leopard heads on velvet, brocade, or heavy cotton) is the sovereign formal garment for Igbo men, traditionally signifying accomplishment, title, or groom status. It is cut as a long tunic shirt, paired with plain black or dark trousers, an **Okpu Agu** (leopard-pattern knit hat) or red chieftaincy cap, and accessorized with authentic heavy cylindrical coral neck beads (*Ijele*). Women wear luxurious George fabric wrappers, embroidered blouses, and lavish tiers of royal coral beads.
- **Negative Constraints**: Forbid wearing an Isiagu with patterned or clashing bottoms (bottoms must be plain black or dark solid trousers to anchor the statement lion print). Non-titled men should not wear the solid red chief's cap (*Okpu Ozo*) unless conferred. Avoid cheap plastic imitation beads at formal traditional nuptials.
- **Search Criteria / RAG Tags**: `isiagu`, `igbo`, `igba_nkwu`, `okpu_agu`, `coral_beads`, `iri_ji`, `nigeria`, `إيجبو`, `إيسياغو`, `איגבו`, `איסיאגו`, `חרוזי_אלמוגים`, `traje_igbo`.
- **Example Look Composition**:
  - *Top*: Jet-black heavy velvet Isiagu tunic featuring gold and bronze woven lion-head medallions.
  - *Bottom*: Tailored solid black wool slacks.
  - *Accessories*: Double strand of genuine cylindrical African royal coral beads and carved ivory wrist cuff.
  - *Headwear*: Traditional Igbo red and black knit Okpu Agu cap.
  - *Footwear*: Polished black patent leather loafers.

#### Rule 23: `rule_cultural_ghanaian_kente_protocol`
- **Title**: Ghanaian Ashanti / Akan Kente & Mourning Etiquette (Kente & Kobene)
- **Geographic / Cultural Region**: Ghana, Côte d'Ivoire, Ashanti Kingdom, Akan ceremonies.
- **Rule Statement**: Authentic handwoven **Kente** is sacred heraldry woven on strip looms. Color symbolism is paramount: Gold/Yellow denotes royalty, wealth, and fertility; Blue represents peace and sky; Green represents spiritual growth. For joyous weddings, durbars, and coronations, men drape a large, multi-yard piece of Kente toga-style: wrapped around the torso, draped over the left shoulder, leaving the right arm bare. Women wear Kente tailored into a 3-piece *Kaba* (blouse), *Slit* (long wrap skirt), and waistband.  
  **FUNERAL PROTOCOL**: At Ghanaian Akan funerals, joyful multicolored Kente is strictly forbidden. Mourners wear **Kobene** (deep fiery red/vermilion cloth) for close family members grieving immediate tragedy, or **Kuntunkuni** / **Brisi** (dark brown/black indigo-dyed mourning cloth). If celebrating the long life of an elder aged 70+, mourners wear celebratory pure **White Adinkra** or white Kente (*Hyire*).
- **Negative Constraints**: STRICTLY FORBID JOYOUS GOLD/MULTICOLORED KENTE AT FUNERALS. Strictly forbid draping the male Kente toga over the right shoulder (must always rest on the left shoulder, leaving the dominant right hand uninhibited). Avoid machine-printed fake polyester knockoffs for royal durbars.
- **Search Criteria / RAG Tags**: `kente`, `ghana`, `ashanti`, `akan`, `kobene`, `kuntunkuni`, `adinkra`, `كينتي`, `غانا`, `كوبيني`, `קנטה`, `גאנה`, `אקאן`, `kente_ghana`.
- **Example Look Composition (Celebration/Wedding)**:
  - *Garment*: Master handwoven "Adweneasa" Akan royal Kente cloth featuring vibrant gold, royal emerald, and crimson warp threads, wrapped meticulously over the left shoulder.
  - *Footwear*: Handcrafted Ashanti royal leather sandals (*Ahenema*) with stamped geometric motifs.
  - *Accessories*: Beaded gold wrist talisman.

#### Rule 24: `rule_cultural_zulu_shweshwe_isicholo`
- **Title**: Zulu & South African Heritage Etiquette (Isicholo, Ibheshu & Shweshwe)
- **Geographic / Cultural Region**: South Africa, KwaZulu-Natal, Eswatini, Lesotho.
- **Rule Statement**: Traditional South African ceremonies (such as Zulu *Umabo* wedding rites and heritage gatherings) feature distinct cultural milestones. Married Zulu women proudly wear the **Isicholo** (a wide, flared, cone-shaped circular hat woven of grass and cotton thread, dyed red or ochre) symbolizing marital status and respect (*Hlonipha*), paired with beaded capes and aprons. In modern semi-formal contexts, garments crafted from authentic indigo-discharge printed **Shweshwe** cotton fabric are the standard for celebratory fashion across southern Africa.
- **Negative Constraints**: Unmarried young women do not wear the Isicholo (reserved for married matriarchs). Prohibit casual denim, activewear, or plain Western loungewear at traditional lobola or umabo ceremonies.
- **Search Criteria / RAG Tags**: `zulu`, `isicholo`, `shweshwe`, `south_africa`, `umabo`, `lobola`, `زوولو`, `شويشوي`, `زولو`, `איסיצ'ולו`, `דרום_אפריקה`, `traje_zulu`.
- **Example Look Composition**:
  - *Dress*: Indigo-blue geometric printed authentic Three Cats Shweshwe A-line midi dress with tiered ruffled hem.
  - *Headwear*: Crimson red flared woven Isicholo hat.
  - *Accessories*: Multi-tiered handcrafted Zulu glass beadwork collar necklace (*Umgexo*).
  - *Footwear*: Midnight navy block-heel closed-toe leather pumps.

---

### Group I: Latin American & Catholic Ceremonial Traditions

#### Rule 25: `rule_cultural_guayabera_formal_protocol`
- **Title**: Formal Guayabera Protocol & Caribbean Black Tie Substitute (Guayabera de Gala)
- **Geographic / Cultural Region**: Mexico (Yucatán), Cuba, Dominican Republic, Colombia (Cartagena), Panama, Puerto Rico, Caribbean, Central America.
- **Rule Statement**: In tropical Latin America and the Hispanic Caribbean, the **Guayabera de gala** (formal long-sleeved Guayabera) is legally and culturally recognized as full formalwear, substituting directly for a dark suit or tuxedo at diplomatic receptions, weddings, and galas. An authentic formal Guayabera must feature: 100% crisp fine linen or Irish linen-cotton; 4 functional front pockets; two vertical bands of tiny tucks/pleats (*alforzas*) running down the front and three bands down the back; side vents fastened with buttons; and a straight finished hem designed specifically to be **worn untucked**. Paired with tailored linen or lightweight wool dress trousers (navy, charcoal, or dark taupe) and polished leather loafers/dress shoes.
- **Negative Constraints**: STRICTLY FORBID TUCKING IN A GUAYABERA: Tucking a Guayabera into trousers is universally considered an amateur sartorial blunder that destroys the garment's functional vents and structural pleats. Forbid short-sleeved casual Guayaberas at formal evening weddings (formal protocol mandates long sleeves with French or buttoned cuffs). Forbid athletic sneakers, rubber flip-flops, or denim jeans in formal Guayabera settings.
- **Search Criteria / RAG Tags**: `guayabera`, `guayabera_de_gala`, `chacabana`, `camisa_yucatan`, `tropical_formal`, `cuba`, `mexico`, `caribbean_formal`, `גואיברה`, `חולצה_מקסיקנית`, `חתונה_טרופית`, `غوايابيرا`, `guayabera`.
- **Example Look Composition**:
  - *Top*: Long-sleeved crisp optic-white 100% Irish linen Guayabera de gala with 4 pockets, hand-stitched fine alforzas, and mother-of-pearl buttons, worn **untucked**.
  - *Bottom*: Tailored dark charcoal or navy tropical-weight wool dress trousers with no break.
  - *Footwear*: Polished dark brown or cognac woven leather Belgian loafers (*espadrilles* or sneakers strictly prohibited).

#### Rule 26: `rule_cultural_latin_quinceanera_guest`
- **Title**: Latin American Quinceañera & Catholic Milestone Etiquette (Quince Años & Misa)
- **Geographic / Cultural Region**: Latin America (Mexico, Colombia, Central America), Hispanic USA.
- **Rule Statement**: A Quinceañera is a dual sacred and celebratory milestone beginning with a Catholic Mass of Thanksgiving (*Misa de acción de gracias*) followed by a grand evening reception. Attire is elevated semi-formal to black-tie gala. Men wear tailored suits (navy, dark grey) with neckties. Female guests wear elegant formal cocktail dresses or festive midi/maxi dresses with covered shoulders during the church liturgy.
- **Negative Constraints**: STRICTLY FORBID OUTSHINING OR COPYING THE QUINCEAÑERA: Female guests must NEVER wear a voluminous ball gown, tiara, or the signature celebration color theme chosen by the birthday celebrant (often blush pink, emerald, lilac, or royal blue). Strictly forbid wearing solid white or ivory gowns (reserved for the celebrant's symbolic transition). Maintain Catholic church modesty during the preliminary Mass (no plunging necklines, bare shoulders, or micro-minis inside the church).
- **Search Criteria / RAG Tags**: `quinceanera`, `quince_anos`, `misa_quinceanera`, `latin_milestone`, `קוינסאניירה`, `בת_מצווה_לטינית`, `كينسينييرا`, `quinceanera_protocol`.
- **Example Look Composition**:
  - *Dress*: Navy blue pleated chiffon A-line midi dress with jewel neckline and flutter cap sleeves.
  - *Layer*: Matching lightweight navy pashmina shawl for the church service.
  - *Accessories*: Silver metallic leather clutch and pearl earrings.
  - *Footwear*: Strappy navy suede 50mm block heels.

---

## 3. Engineering Implementation Matrix

| Canonical Rule ID | RAG Triggers (`fashion_rules_rag.py`) | QA Negative Filter Action (`stylist_qa_engine.py`) |
| :--- | :--- | :--- |
| `rule_cultural_vatican_papal_audience` | `vatican`, `papal`, `pope`, `holy_see`, `mantilla`, `privilege_du_blanc`, `וותיקן`, `האפיפיור`, `الفاتيكان` | Drop white dresses for women; drop sleeveless; drop open-toe sandals |
| `rule_cultural_christian_eastern_orthodox` | `orthodox`, `eastern_orthodox`, `coptic`, `greek_orthodox`, `russian_orthodox`, `monastery`, `קופטית`, `מנזר`, `كنيسة_أرثوذكسية` | In monasteries: drop pants/shorts for women; drop caps/hats for men |
| `rule_cultural_western_white_tie` | `white_tie`, `cravate_blanche`, `tailcoat`, `וויט_טאי`, `עניבה_לבנה`, `סעודת_מדינה` | Purge standard business suits, daytime neckties, casual shoes, tuxedos with black bow tie |
| `rule_cultural_jewish_synagogue_prayer` | `synagogue`, `beit_knesset`, `shul`, `kotel`, `tallit`, `kippah`, `בית_כנסת`, `כותל`, `תפילה`, `שחרית`, `כיפה` | Purge shorts, gym wear, graphic tees, beach flip-flops, sleeveless tops |
| `rule_cultural_jewish_brit_milah_simcha` | `brit_milah`, `bris`, `simchat_bat`, `pidyon_haben`, `simcha`, `ברית`, `ברית_מילה`, `שמחת_בת` | Purge all-black funeral attire and casual gym clothes |
| `rule_cultural_jewish_chuppah_wedding` | `chuppah`, `kallah`, `chatan`, `חתוana`, `חופה`, `כלה`, `חתן`, `חתונה_דתית` | Purge solid white/ivory dresses for guests |
| `rule_cultural_jewish_tisha_bav_fast` | `tisha_bav`, `yom_kippur`, `fast_day`, `תשעה_באב`, `יום_כיפור`, `צום`, `איסור_נעילת_הסנדל` | **STRICTLY PURGE ALL LEATHER & SUEDE FOOTWEAR/BELTS** |
| `rule_cultural_islamic_hajj_umrah_ihram` | `ihram`, `hajj`, `umrah`, `makkah`, `pilgrimage`, `حج`, `عمرة`, `إحرام`, `مكة_المكرمة`, `איחראם`, `חאג'` | Purge stitched garments, underwear, socks, closed shoes covering ankles for men; purge niqab for women |
| `rule_cultural_islamic_eid_festive` | `eid`, `eid_al_fitr`, `eid_al_adha`, `عيد_الفطر`, `عيد_الأضحى`, `עיד_אל_פיטר` | Purge distressed/faded denim, athletic wear, worn casual tees |
| `rule_cultural_islamic_regional_gulf_bisht` | `gulf`, `bisht`, `thobe`, `kandura`, `shemagh`, `ghutra`, `agal`, `بשת`, `ثوب`, `كندورة`, `בישט`, `ת'וב` | Purge casual t-shirts and denim paired with ceremonial Bisht |
| `rule_cultural_islamic_regional_maghreb_djellaba` | `djellaba`, `kaftan`, `takchita`, `babouche`, `belgha`, `morocco`, `جلابة`, `قفطان_מרוקאי`, `ג'לאביה` | Purge rubber beach slides and cheap plastic shoes with silk Djellaba |
| `rule_cultural_islamic_regional_se_asia_batik` | `batik`, `baju_melayu`, `songkok`, `kain_samping`, `kebaya`, `indonesia`, `malaysia`, `באטיק`, `אינדונזיה` | Purge short-sleeved casual Hawaiian tourist shirts at formal events |
| `rule_cultural_hindu_temple_darshan` | `temple_darshan`, `puja`, `mandir`, `hindu_temple`, `no_leather`, `मंदिर`, `दर्शन`, `पूजा`, `מקדש_הינדי`, `פוג'ה` | **STRICTLY PURGE ALL LEATHER GOODS (shoes, belts, wallets, bags)** |
| `rule_cultural_hindu_kerala_mundu` | `kerala_temple`, `mundu`, `veshti`, `kasavu`, `south_indian_temple`, `കേരളം`, `മുണ്ട്`, `מונדו` | Purge stitched shirts/t-shirts/trousers for men inside inner sanctums |
| `rule_cultural_buddhist_temple_etiquette` | `buddhist_temple`, `wat`, `theravada`, `mahayana`, `saffron_taboo`, `วัด`, `佛寺`, `מקדש_בודהיסטי`, `בודהיזם` | **STRICTLY FORBID SAFFRON/ORANGE/OCHRE/MAROON ROBES FOR LAYPERSONS**; drop sleeveless, shorts, Buddha graphics |
| `rule_cultural_buddhist_lay_meditation_white` | `buddhist_meditation`, `vipassana`, `uposatha`, `chut_khao`, `ชุดขาว`, `מדיטציה_בודהיסטית` | Enforce pure solid white; drop loud/saturated colors and bold patterns |
| `rule_cultural_sikh_gurdwara_protocol` | `gurdwara`, `sikh`, `golden_temple`, `rumal`, `dastar`, `amritsar`, `ਗੁਰਦੁਆਰਾ`, `רੁמאל`, `גורדווארה`, `סיקים` | **MANDATORY HEAD COVERING (RUMAL/DASTAR); STRICTLY FORBID CAPS, FEDORAS, BEANIES**; drop shorts |
| `rule_cultural_japanese_kimono_collar_rule` | `kimono`, `yukata`, `obi`, `tabi`, `zori`, `着物`, `浴衣`, `左前`, `קימונו`, `יוקטה` | Validate left-over-right; prohibit right-over-left (death taboo); require split-toe Tabi |
| `rule_cultural_korean_hanbok_wedding_palette` | `hanbok`, `korean_wedding`, `jeogori`, `chima`, `paebaek`, `한복`, `혼주한복`, `הנבוק` | Validate maternal wedding palettes: bride's mother=warm/pink, groom's mother=cool/blue |
| `rule_cultural_chinese_green_hat_taboo` | `chinese_hat`, `green_hat_taboo`, `dai_lu_maozi`, `戴绿帽子`, `绿帽子`, `כובע_ירוק_סין` | **STRICTLY PURGE GREEN HEADWEAR FOR MEN** |
| `rule_cultural_yoruba_agbada_aso_ebi` | `agbada`, `gele`, `aso_ebi`, `aso_oke`, `yoruba`, `fila`, `أغبادہ`, `אגבאדה`, `אסו_אבי` | Require Fila cap with Agbada; drop uncoordinated clashing colors |
| `rule_cultural_igbo_isiagu_coral_beads` | `isiagu`, `igbo`, `okpu_agu`, `coral_beads`, `איגבו`, `איסיאגו` | Drop patterned/clashing trousers with statement leopard/lion Isiagu tunic |
| `rule_cultural_ghanaian_kente_protocol` | `kente`, `ghana`, `ashanti`, `akan`, `kobene`, `קנטה`, `גאנה` | **STRICTLY FORBID JOYOUS MULTICOLORED KENTE AT FUNERALS** (enforce Kobene red / Kuntunkuni dark) |
| `rule_cultural_zulu_shweshwe_isicholo` | `zulu`, `isicholo`, `shweshwe`, `south_africa`, `זולו`, `איסיצ'ולו` | Drop casual sportswear or denim at traditional Umabo ceremonies |
| `rule_cultural_guayabera_formal_protocol` | `guayabera`, `guayabera_de_gala`, `chacabana`, `tropical_formal`, `גואיברה` | **ENFORCE UNTUCKED**; drop short sleeves at gala; drop sneakers/flip-flops |
| `rule_cultural_latin_quinceanera_guest` | `quinceanera`, `quince_anos`, `misa_quinceanera`, `קוינסאניירה` | Purge white/ivory ball gowns and tiaras for guests; ensure church modesty |
