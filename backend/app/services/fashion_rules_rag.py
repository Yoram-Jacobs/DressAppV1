"""Fashion Rules Knowledge Base & Lightweight RAG Retrieval Engine.

Loads canonical styling axioms into memory and dynamically retrieves the
top 3-5 relevant ground-truth rules for any styling turn based on:
1. Hard environmental/climate constraints (temperature, rain, snow).
2. Hard cultural/modesty constraints (conservative, orthodox, modest).
3. Event dress code & occasion formality.
4. Closet color palette & texture harmony matching.

Keeps total injected prompt tokens under 150 tokens so on-premises
CPU models (Qwen2.5-VL-3B-Instruct) remain sub-20s in inference latency.
"""
from __future__ import annotations

import json
import logging
from pathlib import Path
import re
from typing import Any


from app.models.fashion_rule import FashionRule

logger = logging.getLogger(__name__)

_RULES_CACHE: list[FashionRule] = []
_RULES_BY_ID: dict[str, FashionRule] = {}


def _load_rules_from_seed() -> list[FashionRule]:
    """Load canonical rules from the seed JSON file."""
    seed_path = Path(__file__).resolve().parent.parent / "data" / "fashion_rules_seed.json"
    if not seed_path.exists():
        logger.warning("Fashion rules seed file not found at %s", seed_path)
        return []

    try:
        with open(seed_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)
        rules = [FashionRule.model_validate(r) for r in raw_data]
        logger.info("Loaded %d canonical fashion rules from seed", len(rules))
        return rules
    except Exception as exc:
        logger.error("Failed to parse fashion rules seed: %s", exc)
        return []


def initialize_rules_cache() -> None:
    """Initialize in-memory cache of fashion rules."""
    global _RULES_CACHE, _RULES_BY_ID
    if _RULES_CACHE:
        return
    _RULES_CACHE = _load_rules_from_seed()
    _RULES_BY_ID = {r.id: r for r in _RULES_CACHE}


async def sync_rules_to_db(db: Any) -> None:
    """Ensure fashion rules collection in MongoDB is seeded and indexed."""
    global _RULES_CACHE, _RULES_BY_ID
    initialize_rules_cache()
    if db is None or not _RULES_CACHE:
        return

    try:
        # Upsert seed rules so new canonical rules are always seeded into MongoDB
        for r in _RULES_CACHE:
            await db.fashion_rules.update_one(
                {"id": r.id},
                {"$set": r.model_dump()},
                upsert=True,
            )

        # Refresh local cache with all rules in the database (seed + admin updates)
        cursor = db.fashion_rules.find({})
        db_rules = []
        async for doc in cursor:
            doc.pop("_id", None)
            db_rules.append(FashionRule.model_validate(doc))
        if db_rules:
            _RULES_CACHE = db_rules
            _RULES_BY_ID = {r.id: r for r in _RULES_CACHE}
    except Exception as exc:
        logger.warning("Could not sync fashion rules with MongoDB: %s", exc)


def get_all_rules() -> list[FashionRule]:
    """Return all cached rules."""
    if not _RULES_CACHE:
        initialize_rules_cache()
    return list(_RULES_CACHE)


def retrieve_fashion_axioms(
    *,
    user_profile: dict[str, Any] | None = None,
    weather: dict[str, Any] | None = None,
    occasion: str | None = None,
    user_text: str | None = None,
    closet_summary: list[dict[str, Any]] | None = None,
    top_k: int = 4,
) -> list[FashionRule]:
    """Dynamically retrieve top-k most relevant fashion rules for this turn."""
    if not _RULES_CACHE:
        initialize_rules_cache()

    user_profile = user_profile or {}
    weather = weather or {}
    text_corpus = f"{occasion or ''} {user_text or ''}".lower()

    selected: list[FashionRule] = []
    selected_ids: set[str] = set()

    def add_rule(r_id: str) -> None:
        if r_id in _RULES_BY_ID and r_id not in selected_ids and len(selected) < top_k:
            selected.append(_RULES_BY_ID[r_id])
            selected_ids.add(r_id)

    # -------------------------------------------------------------
    # 1. Hard Cultural & Modesty Constraints (Highest Priority = 10)
    # -------------------------------------------------------------
    modesty_level = str(user_profile.get("modesty_level") or "").lower().strip()
    if modesty_level in ("conservative", "orthodox", "high", "modest") or any(w in text_corpus for w in ("tzniut", "צניעות", "חרדי", "דתי", "modest")):
        add_rule("rule_cultural_modesty_conservative")
        add_rule("rule_cultural_jewish_tzniut")

    # Jewish Shiva & Mourning
    if any(w in text_corpus for w in ("shiva", "שבעה", "אבל", "אבלים", "לוויה", "הלוויה", "ניחום", "mourning", "funeral", "condolence", "condolences", "bereavement", "عزاء")):
        if any(w in text_corpus for w in ("chinese funeral", "japanese funeral", "korean funeral", "葬礼", "お葬式", "告別式", "장례식")):
            add_rule("rule_cultural_east_asian_funeral")
        elif any(w in text_corpus for w in ("hindu funeral", "antyeshti", "cremation", "अंतिम_संस्कार", "अंतिम संस्कार", "shraddh")):
            add_rule("rule_cultural_hindu_antyeshti")
        else:
            add_rule("rule_cultural_mourning_shiva")

    # Hindu Funerals (Antyeshti)
    if any(w in text_corpus for w in ("antyeshti", "अंतिम_संस्कार", "अंतिम संस्कार", "hindu funeral", "cremation")):
        add_rule("rule_cultural_hindu_antyeshti")

    # Hindu Weddings & Diwali
    if any(w in text_corpus for w in ("hindu wedding", "vivaha", "विवाह", "sangeet", "baraat", "diwali", "दिवाली", "shaadi")):
        add_rule("rule_cultural_hindu_vivaha")

    # Islamic Friday Prayer & Mosque
    if any(w in text_corpus for w in (
        "jumuah", "mosque", "masjid", "friday prayer", "islamic prayer", "salah", "salat", "namaz", "ramadan",
        "جمعة", "مسجد", "صلاة الجمعة", "صلاة", "رمضان",
        "מסגד", "תפילת יום שישי", "תפילה במסגד", "רמדאן", "ג'ומעה",
        "mezquita", "mosquée", "moschee", "moschea", "mesquita", "moskee",
        "мечеть", "пятничная молитва", "清真寺", "主麻", "モスク", "金曜礼拝", "मस्जिद", "नमाज़"
    )):
        add_rule("rule_cultural_islamic_jumuah")

    # Jewish Shabbat & Holidays
    if any(w in text_corpus for w in ("shabbat", "shabbos", "שבת", "yom tov", "חג", "קידוש", "פסח", "ראש השנה", "סוכות")):
        add_rule("rule_cultural_jewish_shabbat")

    # East Asian Funerals
    if any(w in text_corpus for w in ("chinese funeral", "japanese funeral", "korean funeral", "葬礼", "お葬式", "告別式", "장례식")):
        add_rule("rule_cultural_east_asian_funeral")

    # East Asian Weddings
    if any(w in text_corpus for w in ("chinese wedding", "japanese wedding", "korean wedding", "婚礼", "喜酒", "結婚式", "결혼식")):
        add_rule("rule_cultural_east_asian_wedding")

    # Western Ceremonies & Weddings
    if any(w in text_corpus for w in ("wedding", "חתונה", "ceremony", "sacred")) and not any(w in text_corpus for w in ("hindu wedding", "chinese wedding", "japanese wedding", "korean wedding", "vivaha", "婚礼")):
        add_rule("rule_cultural_ceremony_etiquette")

    # Black Tie & Formal Galas
    if any(w in text_corpus for w in ("black tie", "black-tie", "gala", "opera", "tuxedo", "טוקסידו", "ערב חגיגי", "charity ball", "white tie")):
        add_rule("rule_cultural_western_black_tie")

    # Christian Church, Mass & Holy Land Sanctuaries
    if any(w in text_corpus for w in (
        "church", "mass", "bethlehem", "cathedral", "vatican", "basilica",
        "sunday mass", "midnight mass", "holy sepulchre", "nativity",
        "כנסייה", "כנסיית", "מיסה", "בית לחם", "כנסיית המולד", "כנסיית הקבר",
        "كنيسة", "قداس", "بيت لحم"
    )):
        add_rule("rule_cultural_christian_church_mass")

    # Vatican & Papal Audience Protocol
    if any(w in text_corpus for w in (
        "vatican", "papal", "pope", "holy see", "mantilla", "privilege du blanc", "apostolic palace",
        "וותיקן", "פגישה עם האפיפיור", "האפיפיור", "الفاتيكان", "لقاء البابا", "vaticano", "audiencia papal"
    )):
        add_rule("rule_cultural_vatican_papal_audience")

    # Eastern Orthodox & Coptic Sanctuary
    if any(w in text_corpus for w in (
        "eastern orthodox", "orthodox church", "coptic", "greek orthodox", "russian orthodox", "monastery", "mount athos",
        "קופטית", "אורתודוקסית", "כנסייה אורתודוקסית", "מנזר", "كنيسة أرثوذكسية", "قبطية", "دير"
    )):
        add_rule("rule_cultural_christian_eastern_orthodox")

    # Western White Tie Protocol
    if any(w in text_corpus for w in (
        "white tie", "white-tie", "cravate blanche", "tailcoat", "state banquet", "nobel prize",
        "וויט טאי", "עניבה לבנה", "סעודת מדינה", "ربطة عنق بيضاء", "frac"
    )):
        add_rule("rule_cultural_western_white_tie")

    # Synagogue & Kotel Prayer Etiquette
    if any(w in text_corpus for w in (
        "synagogue", "beit knesset", "shul", "kotel", "western wall", "tallit", "kippah",
        "בית כנסת", "כותל", "תפילה", "שחרית", "מנחה", "ערבית", "כיפה", "טלית", "كنيس"
    )):
        add_rule("rule_cultural_jewish_synagogue_prayer")

    # Brit Milah & Jewish Simchas
    if any(w in text_corpus for w in (
        "brit milah", "bris", "simchat bat", "pidyon haben", "baby naming",
        "ברית מילה", "ברית", "שמחת בת", "פדיון הבן", "שמחה משפחתית"
    )):
        add_rule("rule_cultural_jewish_brit_milah_simcha")

    # Tisha B'Av & Yom Kippur Non-Leather Fast
    if any(w in text_corpus for w in (
        "tisha b'av", "tisha bav", "yom kippur", "neilat hasandal",
        "תשעה באב", "יום כיפור", "צום", "איסור נעילת הסנדל", "נעלי בד"
    )):
        add_rule("rule_cultural_jewish_tisha_bav_fast")

    # Islamic Hajj & Umrah Pilgrimage (Ihram)
    if any(w in text_corpus for w in (
        "ihram", "hajj", "umrah", "makkah", "pilgrimage", "tawaf",
        "حج", "عمرة", "إحرام", "مكة المكرمة", "المسجد الحرام", "איחראם", "חאג'", "עומרה"
    )):
        add_rule("rule_cultural_islamic_hajj_umrah_ihram")

    # Islamic Eid al-Fitr & Eid al-Adha
    if any(w in text_corpus for w in (
        "eid", "eid al-fitr", "eid al-adha", "eid mubarak",
        "عيد الفطر", "عيد الأضحى", "ملابس العيد", "עיד אל פיטר", "עיד אל אדחא"
    )):
        add_rule("rule_cultural_islamic_eid_festive")

    # Arabian Gulf Bisht & Formal Protocol
    if any(w in text_corpus for w in (
        "bisht", "kandura", "dishdasha", "shemagh", "ghutra", "agal",
        "بشت", "كندورة", "شماغ", "عقال", "دשדאשה", "خليجي", "בישט", "ת'וב"
    )):
        add_rule("rule_cultural_islamic_regional_gulf_bisht")

    # Arabian Thobe, Kandura & Dishdasha
    if any(w in text_corpus for w in (
        "thobe", "thawb", "kandura", "dishdasha", "ثوب", "كندورة", "דשדאשה", "ת'וב", "קנדורה"
    )):
        add_rule("rule_cultural_thobe_kandura_etiquette")

    # Abaya & Sheila Layering Protocol
    if any(w in text_corpus for w in (
        "abaya", "sheila", "hijab", "عباية", "عبايه", "עבאיה", "שילה", "חיג'אב"
    )):
        add_rule("rule_cultural_abaya_modest_layering")

    # Egyptian & Levantine Galabiya Protocol
    if any(w in text_corpus for w in (
        "galabiya", "jalabiya", "galabeya", "جلابية", "جلابيه", "ג'לביה", "גלבייה"
    )):
        add_rule("rule_cultural_galabiya_etiquette")

    # South Asian Kurta & Sherwani Formal Pairing
    if any(w in text_corpus for w in (
        "kurta", "sherwani", "churidar", "nehru jacket", "bandhgala", "achkan",
        "कुर्ता", "शेरवानी", "קורטה", "שרוואני", "mojari", "jutti"
    )):
        add_rule("rule_cultural_kurta_sherwani_pairing")

    # Kaftan vs. Kurta, Hybrid Kaftan Kurta & Kurti Styling Distinctions
    if any(w in text_corpus for w in (
        "kaftan", "caftan", "kaftan vs kurta", "kurta vs kaftan", "batwing",
        "قفطان", "כפתן", "काफ्तान", "kaftan kurta", "suit kaftan", "kaftan set"
    )):
        add_rule("rule_cultural_kaftan_vs_kurta_distinction")
        add_rule("rule_cultural_kaftan_kurta_hybrid")

    if any(w in text_corpus for w in (
        "kurti", "kurta vs kurti", "kurti vs kurta", "nehru collar", "mandarin collar",
        "anarkali", "angrakha", "कुर्ती", "קורטי", "كورتي"
    )):
        add_rule("rule_cultural_kurta_vs_kurti_styling")

    # Traditional Saree & Lehenga Choli Ensemble
    if any(w in text_corpus for w in (
        "sari", "saree", "lehenga", "lehenga choli", "choli", "dupatta",
        "साड़ी", "लहंगा", "סארי", "להנגה", "kanjeevaram", "banarasi"
    )):
        add_rule("rule_cultural_sari_lehenga_ensemble")

    # North African Djellaba & Babouche
    if any(w in text_corpus for w in (
        "djellaba", "takchita", "babouche", "belgha", "moroccan kaftan", "morocco", "maghreb",
        "جلابة", "قفطان مغربي", "تكشيطة", "بلغة", "ג'לאביה", "כפתן מרוקאי"
    )):
        add_rule("rule_cultural_islamic_regional_maghreb_djellaba")

    # Southeast Asian Batik & Baju Melayu
    if any(w in text_corpus for w in (
        "batik", "baju melayu", "baju kurung", "songkok", "kain samping", "kebaya", "indonesia", "malaysia",
        "باتيك", "باجو ملايو", "באטיק", "אינדונזיה"
    )):
        add_rule("rule_cultural_islamic_regional_se_asia_batik")

    # Hindu Temple Darshan & Non-Leather Sanctum
    if any(w in text_corpus for w in (
        "temple darshan", "darshan", "puja", "mandir", "hindu temple", "no leather",
        "मंदिर", "दर्शन", "पूजा", "מקדש הינדי", "פוג'ה", "דארשאן"
    )):
        add_rule("rule_cultural_hindu_temple_darshan")

    # South Indian Kerala Temple (Mundu)
    if any(w in text_corpus for w in (
        "kerala temple", "mundu", "veshti", "kasavu", "set mundu", "guruvayur", "padmanabhaswamy",
        "കേരളം", "മുണ്ട്", "ക്ഷേത്രം", "मुंडू", "מונדו", "דרום הודו"
    )):
        add_rule("rule_cultural_hindu_kerala_mundu")

    # Buddhist Temple Etiquette & Saffron Taboo
    if any(w in text_corpus for w in (
        "buddhist temple", "wat", "theravada", "mahayana", "saffron taboo", "monk robe",
        "wat phra kaew", "temple of the tooth", "pagoda", "buddha",
        "วัด", "ทำบุญ", "佛寺", "寺庙礼仪", "מקדש בודהיסטי", "בודהיזם"
    )):
        add_rule("rule_cultural_buddhist_temple_etiquette")

    # Buddhist Lay Meditation (White)
    if any(w in text_corpus for w in (
        "buddhist meditation", "vipassana", "uposatha", "chut khao", "upasaka white",
        "ชุดขาว", "白衣居士", "禅修", "מדיטציה בודהיסטית", "לבוש לבן בודהיסטי"
    )):
        add_rule("rule_cultural_buddhist_lay_meditation_white")

    # Sikh Gurdwara Protocol (Rumal & Head Covering)
    if any(w in text_corpus for w in (
        "gurdwara", "sikh", "golden temple", "darbar sahib", "rumal", "dastar", "turban", "amritsar",
        "ਗੁਰਦੁਆਰਾ", "ਰੁਮਾਲ", "ਦਸਤਾਰ", "ਸਿੱਖ", "גורדווארה", "סיקים", "טורבן", "מקדש הזהב"
    )):
        add_rule("rule_cultural_sikh_gurdwara_protocol")

    # Japanese Kimono Collar Rule
    if any(w in text_corpus for w in (
        "kimono", "yukata", "houmongi", "tomesode", "obi", "tabi", "zori", "hidari-mae",
        "着物", "浴衣", "左前", "קימונו", "יוקטה", "כימונו"
    )):
        add_rule("rule_cultural_japanese_kimono_collar_rule")

    # Korean Hanbok Maternal Colors
    if any(w in text_corpus for w in (
        "hanbok", "korean wedding", "jeogori", "chima", "paebaek", "seollal",
        "한복", "혼주한복", "הנבוק", "חתונה קוריאנית"
    )):
        add_rule("rule_cultural_korean_hanbok_wedding_palette")

    # Chinese Green Hat Taboo
    if any(w in text_corpus for w in (
        "green hat", "green cap", "dai lu maozi", "dài lǜ màozi",
        "戴绿帽子", "绿帽子", "כובע ירוק סין", "טאבו סיני"
    )):
        add_rule("rule_cultural_chinese_green_hat_taboo")

    # Yoruba Agbada, Gele & Aso Ebi
    if any(w in text_corpus for w in (
        "agbada", "gele", "aso ebi", "aso-ebi", "aso oke", "yoruba", "fila",
        "أغبادہ", "يوروبا", "אגבאדה", "גלה", "אסו אבי"
    )):
        add_rule("rule_cultural_yoruba_agbada_aso_ebi")

    # Igbo Isiagu & Coral Beads
    if any(w in text_corpus for w in (
        "isiagu", "igbo", "okpu agu", "coral beads", "igba nkwu", "iri ji",
        "איגבו", "איסיאגו", "חרוזי אלמוגים"
    )):
        add_rule("rule_cultural_igbo_isiagu_coral_beads")

    # Ghanaian Ashanti / Akan Kente & Mourning Kobene
    if any(w in text_corpus for w in (
        "kente", "ghana", "ashanti", "akan", "kobene", "kuntunkuni", "adinkra", "durbar",
        "كينتي", "קנטה", "גאנה", "אקאן"
    )):
        add_rule("rule_cultural_ghanaian_kente_protocol")

    # Zulu Shweshwe & Isicholo
    if any(w in text_corpus for w in (
        "zulu", "isicholo", "shweshwe", "south africa", "umabo", "lobola",
        "זולו", "איסיצ'ולו", "דרום אפריקה"
    )):
        add_rule("rule_cultural_zulu_shweshwe_isicholo")

    # Latin American Guayabera de Gala
    if any(w in text_corpus for w in (
        "guayabera", "guayabera de gala", "chacabana", "camisa de yucatan", "tropical formal",
        "cuba", "yucatan", "cartagena", "גואיברה", "חולצה מקסיקנית", "חתונה טרופית", "غوايابيرا"
    )):
        add_rule("rule_cultural_guayabera_formal_protocol")

    # Latin American Quinceañera
    if any(w in text_corpus for w in (
        "quinceanera", "quinceañera", "quince anos", "quince años", "misa quinceanera",
        "קוינסאניירה", "בת מצווה לטינית", "كينسينييرا"
    )):
        add_rule("rule_cultural_latin_quinceanera_guest")

    # Sigd Holiday (Beta Israel Ethiopian Jewish Tradition)
    if any(w in text_corpus for w in (
        "sigd", "חג הסיגד", "חג סיגד", "סיגד", "ביתא ישראל", "beta israel", "habesha kemis", "netela", "kessim"
    )):
        add_rule("rule_cultural_jewish_sigd")

    # Inuit Sinck Tuck & Winter Drum Dancing
    if any(w in text_corpus for w in (
        "sinck tuck", "sink tuck", "sinck-tuck", "sink-tuck", "sincktuck", "sinktuck",
        "inuit", "drum dance", "kamik", "amauti", "atigi", "qaggiq", "אינואיט", "סינק טאק", "סינק טוק"
    )):
        add_rule("rule_cultural_inuit_sinck_tuck")

    # Mimouna (North African Sephardic Celebration)
    if any(w in text_corpus for w in (
        "mimouna", "מימונה", "תרבחו ותסעדו", "מופלטה", "moroccan kaftan", "jellaba"
    )):
        add_rule("rule_cultural_jewish_mimouna")

    # Lag BaOmer & Hillula of Rashbi
    if any(w in text_corpus for w in (
        "lag baomer", "lag b'omer", "ל\"ג בעומר", "לג בעומר", "מירון", "רשב\"י", "מדורה", "upsherin", "אופשערן"
    )):
        add_rule("rule_cultural_jewish_lag_baomer")

    # Tu B'Av White Vineyard Attire
    if any(w in text_corpus for w in (
        "tu b'av", "tu bav", "ט\"ו באב", "טו באב", "חג האהבה", "כרמים"
    )):
        add_rule("rule_cultural_jewish_tu_bav")

    # Songkran Thai Water Festival
    if any(w in text_corpus for w in (
        "songkran", "สงกรานต์", "thai new year", "sua songkran", "water festival", "סונגקראן"
    )):
        add_rule("rule_cultural_thai_songkran")

    # Persian Nowruz Spring Equinox (Nou-Poosh)
    if any(w in text_corpus for w in (
        "nowruz", "norooz", "نوروز", "haft-seen", "nou-poosh", "persian new year", "נוירוז", "ראש השנה הפרסי"
    )):
        add_rule("rule_cultural_persian_nowruz")

    # Korean Chuseok & Seollal
    if any(w in text_corpus for w in (
        "chuseok", "seollal", "추석", "설날", "charye", "sebae", "chuseok-bim", "seol-bim", "צ'וסוק", "סולאל"
    )):
        add_rule("rule_cultural_korean_chuseok_seollal")

    # Hindu Holi Festival of Colors
    if any(w in text_corpus for w in (
        "holi", "होली", "gulal", "festival of colors", "rangwali", "הולי", "פסטיבל הצבעים"
    )):
        add_rule("rule_cultural_hindu_holi")

    # Bavarian & Austrian Oktoberfest / Kirchtag (Trachten & Dirndl)
    if any(w in text_corpus for w in (
        "oktoberfest", "dirndl", "lederhosen", "trachten", "haferlschuhe", "schleife", "אוקטוברפסט", "דירנדל", "לדרהוזן"
    )):
        add_rule("rule_cultural_bavarian_oktoberfest_dirndl")

    # Native American & First Nations Intertribal Powwow
    if any(w in text_corpus for w in (
        "powwow", "pow-wow", "ribbon skirt", "ribbon shirt", "native american regalia", "first nations", "פאו וואו", "חצאית סרטים"
    )):
        add_rule("rule_cultural_native_powwow_ribbonwork")

    # Mexican Día de los Muertos
    if any(w in text_corpus for w in (
        "dia de los muertos", "dia de muertos", "day of the dead", "catrina", "cempasuchil", "calavera", "יום המתים"
    )):
        add_rule("rule_cultural_mexican_dia_de_muertos")

    # Ethiopian Orthodox Timkat & Meskel
    if any(w in text_corpus for w in (
        "timkat", "meskel", "ጥምቀት", "መስቀል", "epiphany ethiopia", "טיםקאת", "טימקאט", "מסקל"
    )):
        add_rule("rule_cultural_ethiopian_timkat_meskel")

    # Scottish Burns Night & Highland Dress
    if any(w in text_corpus for w in (
        "burns night", "burns supper", "highland dress", "prince charlie", "sporran", "sgian-dubh", "ghillie brogues", "סקוטלנד", "קילט", "בירנס נייט"
    )):
        add_rule("rule_cultural_scottish_burns_night")

    # Geopolitical Statutory Camouflage & Military Apparel Bans
    if any(w in text_corpus for w in (
        "barbados", "jamaica", "trinidad", "tobago", "saint lucia", "st lucia", "antigua", "grenada",
        "dominica", "bahamas", "guyana", "nigeria", "uganda", "zimbabwe", "zambia", "ghana", "kenya",
        "philippines", "camouflage", "camo", "ברבדוס", "ג'מייקה", "טרינידד", "ניגריה", "אוגנדה", "זימבבואה", "הסוואה", "מנומר צבאי"
    )):
        add_rule("rule_geopolitical_camouflage_military_ban")

    # Geopolitical State-Mandated Modesty Regimes
    if any(w in text_corpus for w in (
        "iran", "tehran", "isfahan", "shiraz", "mashhad", "qom", "afghanistan", "kabul", "saudi arabia",
        "riyadh", "jeddah", "brunei", "aceh", "maldives", "maafushi", "sharjah", "qatar", "doha", "kuwait",
        "oman", "muscat", "kelantan", "terengganu", "karbala", "najaf", "yemen", "sanaa", "somalia",
        "איראן", "טהרן", "אפגניסטן", "ערב הסעודית", "סעודיה", "ברוניי", "מלדיביים", "קטאר", "דוחא", "עומאן", "כווית", "כארבלא"
    )):
        add_rule("rule_geopolitical_state_modesty_regimes")

    # Geopolitical Secular Face-Covering & Public Laïcité Bans
    if any(w in text_corpus for w in (
        "france", "paris", "switzerland", "zurich", "geneva", "interlaken", "austria", "vienna",
        "belgium", "brussels", "denmark", "copenhagen", "netherlands", "amsterdam", "bulgaria",
        "quebec", "montreal", "niqab", "burqa", "burkini", "צרפת", "פריז", "שווייץ", "אוסטריה", "וינה", "בלגיה", "דנמרק", "קוויבק"
    )):
        add_rule("rule_geopolitical_secular_face_cover_bans")

    # Geopolitical Authoritarian Dress Codes, Lèse-Majesté & Symbol Bans
    if any(w in text_corpus for w in (
        "north korea", "pyongyang", "dprk", "turkmenistan", "ashgabat", "bhutan", "thimphu", "paro",
        "thailand", "bangkok", "grand palace", "wat phra kaew", "ukraine", "kyiv", "poland", "lithuania",
        "latvia", "estonia", "hong kong", "xinjiang", "chechnya", "grozny",
        "צפון קוריאה", "טורקמניסטן", "בהוטן", "תאילנד", "בנגקוק", "אוקראינה", "הונג קונג", "צ'צ'ניה"
    )):
        add_rule("rule_geopolitical_authoritarian_symbol_bans")

    # Geopolitical Gang, Cartel & Territorial Faction Safety
    if any(w in text_corpus for w in (
        "brazil", "rio de janeiro", "salvador", "bahia", "fortaleza", "favela", "el salvador",
        "honduras", "guatemala", "colombia", "medellin", "cali", "mexico", "sinaloa", "culiacan",
        "jalisco", "tamaulipas", "kingston", "haiti", "port-au-prince", "cape flats", "belfast",
        "ברזיל", "ריו דה ז'ניירו", "סלבדור", "פאבלה", "אל סלבדור", "הונדורס", "גואטמלה", "קולומביה", "מדיין", "מקסיקו"
    )):
        add_rule("rule_geopolitical_territorial_gang_cartel_safety")

    # -------------------------------------------------------------
    # 2. Hard Weather & Thermodynamic Constraints
    # -------------------------------------------------------------
    temp = weather.get("temp_c")
    if temp is None:
        temp = weather.get("temperature")
    if temp is None and isinstance(weather.get("main"), dict):
        temp = weather["main"].get("temp")

    is_rain = False
    weather_desc = str(weather.get("condition") or weather.get("description") or "").lower()
    if any(w in weather_desc or w in text_corpus for w in ("rain", "drizzle", "shower", "wet", "גשם")):
        is_rain = True

    if is_rain:
        add_rule("rule_weather_precipitation_protection")

    if temp is not None:
        try:
            temp_val = float(temp)
            if temp_val <= 5.0:
                add_rule("rule_weather_subzero_layering")
            elif 6.0 <= temp_val <= 16.0:
                add_rule("rule_weather_transitional_layering")
            elif temp_val >= 25.0:
                add_rule("rule_weather_summer_breathability")
        except (ValueError, TypeError):
            pass

    # -------------------------------------------------------------
    # 3. Occasion & Dress Code
    # -------------------------------------------------------------
    if any(w in text_corpus for w in ("interview", "business", "formal", "suit", "ראיון", "עבודה", "law", "finance")):
        add_rule("rule_occasion_business_formal")
        add_rule("rule_psychology_warmth_competence_navy")
        add_rule("rule_tailoring_proportions_collar_button")
        add_rule("rule_accessories_leather_hardware_sync")
    elif any(w in text_corpus for w in ("black tie", "black-tie", "tuxedo", "gala", "טוקסידו")):
        add_rule("rule_formal_black_tie_waistband")
        add_rule("rule_accessories_leather_hardware_sync")
    elif any(w in text_corpus for w in ("date", "romantic", "sexy", "cocktail", "יציאה", "דייט", "alluring")):
        add_rule("rule_psychology_singular_reveal")
        add_rule("rule_occasion_smart_casual")
    elif any(w in text_corpus for w in ("kid", "child", "children", "baby", "infant", "toddler", "ילד", "ילדה", "תינוק", "ילדים")):
        add_rule("rule_pediatric_textile_sensory_safety")
    elif any(w in text_corpus for w in ("creative", "tech", "startup", "agency", "nonconformity", "sneaker")):
        add_rule("rule_style_creative_nonconformity")
    elif any(w in text_corpus for w in ("smart-casual", "smart casual", "dinner", "מסעדה")):
        add_rule("rule_occasion_smart_casual")

    # Pattern and season cues
    if any(w in text_corpus for w in ("pattern", "stripes", "checks", "plaid", "דוגמה", "פסים", "משבצות", "print")):
        add_rule("rule_pattern_scale_contrast")
        add_rule("rule_pattern_geometric_contrast")

    if any(w in text_corpus for w in ("season", "palette", "undertone", "12-season", "עונה", "גוון עור", "winter", "autumn", "spring", "summer")):
        add_rule("rule_color_12_season_flow")

    # 3b. Wardrobe Essentials / Missing Basic Items / Closet Audit RAG Rules
    conv_hist = user_profile.get("conversation_history") if isinstance(user_profile, dict) else None
    hist_corpus = ""
    if isinstance(conv_hist, list):
        hist_corpus = " ".join(
            str(m.get("transcript") or "")
            for m in conv_hist[-4:]
            if isinstance(m, dict) and m.get("role") == "user"
        ).lower()
    combined_audit_corpus = f"{text_corpus} {hist_corpus}"
    is_wardrobe_essentials_query = any(
        w in combined_audit_corpus
        for w in (
            "capsule", "basic", "basics", "wardrobe essential", "wardrobe essentials",
            "essential item", "essential items", "missing item", "missing items",
            "what is missing", "what's missing", "complete my wardrobe", "complete the wardrobe",
            "explore my closet", "explore the closet", "audit my closet", "staple", "staples",
            "בסיס", "בסיסי", "בסיסיים", "פריטי בסיס", "פריטים בסיסיים",
            "חיוני", "חיוניים", "פריטים חיוניים", "חסר", "חסרים", "מה חסר",
            "להשלים את המלתחה", "להשלים במלתחה", "לסקור את הארון", "סקירת ארון",
            "מומלץ להוסיף", "מה כדאי לקנות", "أساسيات", "ناقص", "خزانة",
        )
    )
    if is_wardrobe_essentials_query:
        for ess_rule_id in (
            "rule_wardrobe_essentials_formal_tailoring",
            "rule_wardrobe_essentials_smart_casual_core",
            "rule_wardrobe_essentials_outerwear_weather",
            "rule_wardrobe_essentials_footwear_accessories",
        ):
            if ess_rule_id in _RULES_BY_ID and ess_rule_id not in selected_ids:
                selected.append(_RULES_BY_ID[ess_rule_id])
                selected_ids.add(ess_rule_id)
        add_rule("rule_capsule_versatility_density")

    # -------------------------------------------------------------
    # 4. Color Wheel & Texture Harmonies (Foundational Design Axioms)
    # -------------------------------------------------------------
    # Default to 60-30-10 composition anchor if we have space
    add_rule("rule_color_60_30_10")

    # Proportions & Golden Ratio (Rule of Thirds)
    add_rule("rule_proportion_rule_of_thirds")

    # Tactile Texture Contrast
    add_rule("rule_texture_tactile_contrast")

    # Fill remaining slots with visual weight matching or analogous rules
    add_rule("rule_texture_weight_matching")
    add_rule("rule_color_neutral_anchor")

    return selected[: max(top_k, 4 if is_wardrobe_essentials_query else top_k)]


WARDROBE_ESSENTIALS_RULE_IDS: tuple[str, ...] = (
    "rule_wardrobe_essentials_formal_tailoring",
    "rule_wardrobe_essentials_smart_casual_core",
    "rule_wardrobe_essentials_outerwear_weather",
    "rule_wardrobe_essentials_footwear_accessories",
)


def audit_closet_against_rag_essentials(
    closet_items: list[dict[str, Any]] | None,
    user_gender: str | None = None,
    lang: str = "en",
) -> dict[str, Any]:
    """Audit the user's closet inventory against canonical Wardrobe Essentials rules in the RAG knowledge base.

    Reads ``criteria.essential_staples`` from the 4 ``rule_wardrobe_essentials_*`` rules in the RAG
    knowledge base and determines which foundational wardrobe staples are present vs. missing.
    """
    if not _RULES_CACHE:
        initialize_rules_cache()

    base_lang = (lang or "en").lower().strip().split("-")[0].split("_")[0]
    gen_norm = str(user_gender or "").lower().strip()
    is_female = gen_norm in ("female", "woman", "women", "אישה", "נשים")
    is_male = gen_norm in ("male", "man", "men", "גבר", "גברים")

    item_blobs: list[str] = []
    for it in closet_items or []:
        if not isinstance(it, dict):
            continue
        title = str(it.get("title") or it.get("name") or "")
        cat = str(it.get("category") or "")
        sub_cat = str(it.get("sub_category") or "")
        dc = str(it.get("dress_code") or "")
        mat = str(it.get("material") or "")
        pat = str(it.get("pattern") or "")
        tags_str = " ".join(str(t) for t in (it.get("tags") or []))
        colors = it.get("colors") or it.get("color") or []
        c_list: list[str] = []
        if isinstance(colors, list):
            for c in colors:
                c_list.append(str(c.get("name") if isinstance(c, dict) else c))
        elif isinstance(colors, str):
            c_list.append(colors)
        item_blobs.append(f"{title} {cat} {sub_cat} {dc} {mat} {pat} {' '.join(c_list)} {tags_str}".lower())

    missing_by_pillar: list[list[str]] = []
    present_staples: list[str] = []
    active_rule_ids: list[str] = []

    for r_id in WARDROBE_ESSENTIALS_RULE_IDS:
        rule = _RULES_BY_ID.get(r_id)
        if not rule:
            continue
        active_rule_ids.append(r_id)
        pillar_missing: list[str] = []
        staples = getattr(rule.criteria, "essential_staples", None) or []
        for staple in staples:
            if not isinstance(staple, dict):
                continue
            target_gender = str(staple.get("gender") or "all").lower()
            if target_gender == "female" and not is_female:
                continue
            if target_gender == "male" and is_female and not is_male:
                continue

            exclude_kws = [str(x).lower() for x in (staple.get("exclude") or [])]
            match_any = [str(x).lower() for x in (staple.get("match_any") or [])]
            match_all_groups = staple.get("match_all_groups") or []

            is_present = False
            for blob in item_blobs:
                if exclude_kws and any(ex in blob for ex in exclude_kws):
                    continue
                if match_all_groups:
                    if all(
                        any(str(kw).lower() in blob for kw in grp)
                        for grp in match_all_groups
                        if isinstance(grp, list) and grp
                    ):
                        is_present = True
                        break
                elif match_any:
                    if any(kw in blob for kw in match_any):
                        is_present = True
                        break

            spec = str(staple.get("spec_he") if base_lang == "he" else staple.get("spec_en") or "").strip()
            if not spec:
                continue
            if is_present:
                present_staples.append(spec)
            else:
                pillar_missing.append(spec)
        if pillar_missing:
            missing_by_pillar.append(pillar_missing)

    # Interleave round-robin across the 4 RAG Wardrobe Essentials pillars so top results
    # always cover Formal Tailoring, Smart-Casual Core, Outerwear/Weather, and Footwear/Accessories
    missing_staples: list[str] = []
    max_len = max((len(p) for p in missing_by_pillar), default=0)
    for idx in range(max_len):
        for pillar in missing_by_pillar:
            if idx < len(pillar):
                missing_staples.append(pillar[idx])

    return {
        "missing_staples": missing_staples,
        "present_staples": present_staples,
        "active_rag_rule_ids": active_rule_ids,
    }


def format_rules_for_prompt(rules: list[FashionRule], max_chars_per_rule: int = 240) -> str:
    """Format the retrieved rules into a compact prompt string."""
    if not rules:
        return ""

    lines = ["GROUND-TRUTH FASHION DESIGN AXIOMS:"]
    for r in rules:
        stmt = r.rule_statement.strip()
        limit = 450 if r.id in WARDROBE_ESSENTIALS_RULE_IDS else max_chars_per_rule
        if r.negative_constraint and len(stmt) + len(r.negative_constraint) + 12 <= limit:
            line = f"• [{r.title}]: {stmt} (Avoid: {r.negative_constraint})"
        elif len(stmt) > limit:
            line = f"• [{r.title}]: {stmt[:limit - 3].rstrip()}..."
        else:
            line = f"• [{r.title}]: {stmt}"
        lines.append(line)

    return "\n".join(lines)


def filter_modesty_closet_items(
    closet_items: list[dict[str, Any]] | None,
    modesty_level: str | None,
) -> list[dict[str, Any]]:
    """Hybrid modesty filter: Prune unlayerable revealing items while retaining layerable garments."""
    if not closet_items:
        return []
    mod_norm = str(modesty_level or "").lower().strip()
    if mod_norm not in ("conservative", "orthodox", "high", "modest"):
        return closet_items

    # Only prune items that cannot be reasonably layered for everyday modest wear
    EXCLUDED_UNLAYERABLE = {
        "bikini", "swimwear", "cutoffs", "crop top", "bralette", "tube top"
    }

    filtered = []
    for it in closet_items:
        sub = str(it.get("sub_category") or it.get("item_type") or "").lower()
        title = str(it.get("title") or it.get("name") or "").lower()
        tags = [str(t).lower() for t in (it.get("tags") or [])]

        is_unlayerable = any(cut in sub or cut in title for cut in EXCLUDED_UNLAYERABLE)
        is_unlayerable = is_unlayerable or any(t in ("revealing", "sheer", "crop") for t in tags)

        if not is_unlayerable:
            filtered.append(it)
        else:
            logger.info("Hybrid modesty filter pruned unlayerable item: %s (%s)", it.get("id"), title)

    return filtered if filtered else closet_items


FEMALE_GARMENT_RE = re.compile(
    r"\b(skirt|חצאית|בולרו|bolero|heels|עקבים|stiletto|טייץ|טייטס|leggings|tights|jeggings|bikini|ביקיני|גופיית כתפיות)\b"
    r"|\b(?<!dress\s)(?:dress|שמלה)(?!\s*(?:pants|shirt|trousers|shoes|shoe|loafers|loafer|socks|boot|boots|code|vest|watch|חולצה|מכנסיים|נעליים))\b",
    re.IGNORECASE,
)


def filter_gender_closet_items(
    closet_items: list[dict[str, Any]] | None,
    user_gender: str | None,
) -> list[dict[str, Any]]:
    """Prune opposite-gender garments so users are not assigned garments from the opposite gender."""
    if not closet_items:
        return []
    gen_norm = str(user_gender or "").lower().strip()
    is_male = gen_norm in ("male", "man", "men", "גבר")
    is_female = gen_norm in ("female", "woman", "women", "אישה")

    if not is_male and not is_female:
        return closet_items

    filtered = []
    for it in closet_items:
        cat = str(it.get("category") or "").lower()
        sub = str(it.get("sub_category") or it.get("item_type") or "").lower()
        title = str(it.get("title") or it.get("name") or "").lower()
        tags = [str(t).lower() for t in (it.get("tags") or [])]
        all_text = f"{title} {sub} {cat} {' '.join(tags)}"
        g = str(it.get("gender") or it.get("target_gender") or "").lower()

        if is_male:
            if g in ("female", "women", "אישה", "נשים"):
                continue
            if cat in ("dress", "skirt") or sub in ("dress", "skirt", "שמלה", "חצאית", "טייץ", "טייטס", "leggings", "tights"):
                continue
            if FEMALE_GARMENT_RE.search(all_text):
                if not ("men" in title or "גברים" in title or g in ("male", "men")):
                    continue
            if any(w in all_text for w in (
                "ladies", "נשים", "גופיית כתפיות", "בולרו", "bolero", "heels", "עקבים", "stiletto",
                "tube top", "bodycon", "corset", "bra", "חזייה", "חצאית מיני", "mini skirt"
            )):
                if not ("men" in title or "גברים" in title or g in ("male", "men")):
                    continue

        elif is_female:
            if g in ("male", "men", "גבר", "גברים"):
                # Men's-specific garments should not be assigned to female users
                if any(w in all_text for w in ("men's", "mens", "גברים", "גבר", "boxers", "בוקסר", "תחתונים לגבר", "trunks")):
                    continue
                # If explicitly tagged male and not unisex
                if cat in ("bottom", "top", "outerwear", "shoes"):
                    continue

        filtered.append(it)

    return filtered


def retrieve_garment_vision_axioms() -> str:
    """Retrieve canonical cultural & traditional garment taxonomy axioms for GarmentVision."""
    return (
        "CULTURAL TAXONOMY AXIOMS:\n"
        "• Full Body: Galabiya, Kaftan (wide kimono/batwing sleeves, no shoulder seam), Thobe, Abaya, Sari, Lehenga, Hanbok, Kimono, Dirndl (open Abaya/Kaftan/Bisht -> 'Outerwear').\n"
        "• Top: Kurta/Kurti (defined shoulder seams, set-in sleeves, Mandarin collar, side slits), Kaftan Kurta, Guayabera.\n"
        "• Outerwear/Top: Sherwani, Achkan, Bandhgala, Nehru Jacket (standing Mandarin collar, center button placket; NEVER western Blazer/Suit).\n"
        "• Accessories/Headwear: Kippah, Keffiyeh, Turban/Pagri, Hijab, Mitpachat, Shtreimel, Fez."
    )



