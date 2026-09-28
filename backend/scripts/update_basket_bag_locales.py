import json
import os

TRANSLATIONS = {
    "en": {
        "sub_category": {
            "basket_bags": "Basket Bags",
            "basket_bag": "Basket Bag",
        },
        "item_type": {
            "basket_bag": "Basket bag",
            "handbag": "Handbag",
        },
    },
    "he": {
        "sub_category": {
            "basket_bags": "תיקי סל",
            "basket_bag": "תיק סל קש",
        },
        "item_type": {
            "basket_bag": "תיק סל קש",
            "handbag": "תיק יד",
        },
    },
    "ar": {
        "sub_category": {
            "basket_bags": "حقائب سلة",
            "basket_bag": "حقيبة سلة قش",
        },
        "item_type": {
            "basket_bag": "حقيبة سلة قش",
            "handbag": "حقيبة يد",
        },
    },
    "de": {
        "sub_category": {
            "basket_bags": "Korbtaschen",
            "basket_bag": "Korbtasche",
        },
        "item_type": {
            "basket_bag": "Korbtasche",
            "handbag": "Handtasche",
        },
    },
    "es": {
        "sub_category": {
            "basket_bags": "Capazos",
            "basket_bag": "Capazo",
        },
        "item_type": {
            "basket_bag": "Capazo",
            "handbag": "Bolso de mano",
        },
    },
    "fr": {
        "sub_category": {
            "basket_bags": "Sacs paniers",
            "basket_bag": "Sac panier",
        },
        "item_type": {
            "basket_bag": "Sac panier",
            "handbag": "Sac à main",
        },
    },
    "hi": {
        "sub_category": {
            "basket_bags": "बास्केट बैग",
            "basket_bag": "बास्केट बैग",
        },
        "item_type": {
            "basket_bag": "बास्केट बैग",
            "handbag": "हैंडबैग",
        },
    },
    "it": {
        "sub_category": {
            "basket_bags": "Borse a cesto",
            "basket_bag": "Borsa a cesto",
        },
        "item_type": {
            "basket_bag": "Borsa a cesto",
            "handbag": "Borsa a mano",
        },
    },
    "ja": {
        "sub_category": {
            "basket_bags": "かごバッグ",
            "basket_bag": "かごバッグ",
        },
        "item_type": {
            "basket_bag": "かごバッグ",
            "handbag": "ハンドバッグ",
        },
    },
    "nl": {
        "sub_category": {
            "basket_bags": "Mandtassen",
            "basket_bag": "Mandtas",
        },
        "item_type": {
            "basket_bag": "Mandtas",
            "handbag": "Handtas",
        },
    },
    "pt": {
        "sub_category": {
            "basket_bags": "Bolsas de palha",
            "basket_bag": "Bolsa de palha",
        },
        "item_type": {
            "basket_bag": "Bolsa de palha",
            "handbag": "Bolsa de mão",
        },
    },
    "ru": {
        "sub_category": {
            "basket_bags": "Сумки-корзины",
            "basket_bag": "Сумка-корзина",
        },
        "item_type": {
            "basket_bag": "Сумка-корзина",
            "handbag": "Сумка",
        },
    },
    "zh": {
        "sub_category": {
            "basket_bags": "草编包",
            "basket_bag": "草编包",
        },
        "item_type": {
            "basket_bag": "草编包",
            "handbag": "手提包",
        },
    },
}

DIRS = ["apps/web/src/locales", "packages/i18n/locales"]

def update_locales():
    for lang, trans in TRANSLATIONS.items():
        for d in DIRS:
            path = os.path.join(d, f"{lang}.json")
            if not os.path.exists(path):
                print(f"Warning: {path} not found")
                continue
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)

            taxonomy = data.setdefault("taxonomy", {})
            sub_category = taxonomy.setdefault("sub_category", {})
            item_type = taxonomy.setdefault("item_type", {})

            for k, v in trans["sub_category"].items():
                sub_category[k] = v

            for k, v in trans["item_type"].items():
                item_type[k] = v

            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
                f.write("\n")

            print(f"Updated {path} ({lang})")

if __name__ == "__main__":
    update_locales()
