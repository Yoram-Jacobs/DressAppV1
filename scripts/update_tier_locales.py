import json
from pathlib import Path

locales_data = {
    "en": {
        "credits": {
            "exhausted_free": "You've used your free AI reconstructions! Upgrade to Manager for automated access or purchase a credit pack.",
            "exhausted_paid": "You've used your AI reconstructions! Purchase a credit pack to continue.",
        },
        "pricing": {
            "freeCreditsOnboarding": "5 free AI reconstructions",
            "monthlyCreditsDesc": "100 AI credits / month (not cumulative)",
            "creditPacksTitle": "Credit Packs",
            "creditPacksSubtitle": "Purchase credit packs for on-demand AI reconstructions. Paid credits never expire.",
            "pack10": "10 Credits — $3",
            "pack50": "50 Credits — $12",
            "pack100": "100 Credits — $20",
            "bestValue": "Best Value",
            "buyPack": "Buy {{count}} Credits",
            "purchasePackSuccess": "Successfully purchased {{count}} credits!",
            "purchasePackError": "Failed to purchase credit pack.",
        },
    },
    "he": {
        "credits": {
            "exhausted_free": "ניצלת את שחזורי ה-AI החינמיים שלך! שדרג ל-Manager לקבלת גישה אוטומטית או רכוש חבילת קרדיטים.",
            "exhausted_paid": "ניצלת את שחזורי ה-AI שלך! רכוש חבילת קרדיטים כדי להמשיך.",
        },
        "pricing": {
            "freeCreditsOnboarding": "5 שחזורי AI חינם",
            "monthlyCreditsDesc": "100 קרדיטי AI בחודש (לא מצטבר)",
            "creditPacksTitle": "חבילות קרדיטים",
            "creditPacksSubtitle": "רכוש חבילות קרדיטים לשחזורי AI לפי דרישה. קרדיטים שנרכשו אינם פגים לעולם.",
            "pack10": "10 קרדיטים — 3$",
            "pack50": "50 קרדיטים — 12$",
            "pack100": "100 קרדיטים — 20$",
            "bestValue": "המשתלם ביותר",
            "buyPack": "רכוש {{count}} קרדיטים",
            "purchasePackSuccess": "רכשת בהצלחה {{count}} קרדיטים!",
            "purchasePackError": "שגיאה ברכישת חבילת קרדיטים.",
        },
    },
    "ar": {
        "credits": {
            "exhausted_free": "لقد استنفدت عمليات إعادة البناء المجانية بالذكاء الاصطناعي! قم بالترقية إلى Manager للوصول الآلي أو اشترِ حزمة رصيد.",
            "exhausted_paid": "لقد استنفدت عمليات إعادة البناء بالذكاء الاصطناعي! اشترِ حزمة رصيد للمتابعة.",
        },
        "pricing": {
            "freeCreditsOnboarding": "5 عمليات إعادة بناء مجانية بالذكاء الاصطناعي",
            "monthlyCreditsDesc": "100 نقطة ذكاء اصطناعي شهرياً (غير تراكمية)",
            "creditPacksTitle": "حزم الرصيد",
            "creditPacksSubtitle": "اشترِ حزم رصيد لإعادة بناء الصور بالذكاء الاصطناعي عند الطلب. الرصيد المشترى لا تنتهي صلاحيته أبداً.",
            "pack10": "10 نقاط — 3$",
            "pack50": "50 نقطة — 12$",
            "pack100": "100 نقطة — 20$",
            "bestValue": "القيمة الأفضل",
            "buyPack": "شراء {{count}} نقطة",
            "purchasePackSuccess": "تم شراء {{count}} نقطة بنجاح!",
            "purchasePackError": "فشل شراء حزمة الرصيد.",
        },
    },
    "es": {
        "credits": {
            "exhausted_free": "¡Has utilizado tus reconstrucciones gratuitas de IA! Actualiza a Manager para acceso automatizado o compra un paquete de créditos.",
            "exhausted_paid": "¡Has utilizado tus reconstrucciones de IA! Compra un paquete de créditos para continuar.",
        },
        "pricing": {
            "freeCreditsOnboarding": "5 reconstrucciones gratuitas de IA",
            "monthlyCreditsDesc": "100 créditos de IA al mes (no acumulables)",
            "creditPacksTitle": "Paquetes de créditos",
            "creditPacksSubtitle": "Compra paquetes de créditos para reconstrucciones con IA bajo demanda. Los créditos comprados nunca caducan.",
            "pack10": "10 créditos — $3",
            "pack50": "50 créditos — $12",
            "pack100": "100 créditos — $20",
            "bestValue": "Mejor valor",
            "buyPack": "Comprar {{count}} créditos",
            "purchasePackSuccess": "¡Has comprado {{count}} créditos con éxito!",
            "purchasePackError": "Error al comprar el paquete de créditos.",
        },
    },
    "fr": {
        "credits": {
            "exhausted_free": "Vous avez utilisé vos reconstructions IA gratuites ! Passez à Manager pour un accès automatisé ou achetez un pack de crédits.",
            "exhausted_paid": "Vous avez utilisé vos reconstructions IA ! Achetez un pack de crédits pour continuer.",
        },
        "pricing": {
            "freeCreditsOnboarding": "5 reconstructions IA gratuites",
            "monthlyCreditsDesc": "100 crédits IA / mois (non cumulables)",
            "creditPacksTitle": "Packs de crédits",
            "creditPacksSubtitle": "Achetez des packs de crédits pour des reconstructions IA à la demande. Les crédits achetés n'expirent jamais.",
            "pack10": "10 crédits — 3 $",
            "pack50": "50 crédits — 12 $",
            "pack100": "100 crédits — 20 $",
            "bestValue": "Meilleure valeur",
            "buyPack": "Acheter {{count}} crédits",
            "purchasePackSuccess": "{{count}} crédits achetés avec succès !",
            "purchasePackError": "Échec de l'achat du pack de crédits.",
        },
    },
    "de": {
        "credits": {
            "exhausted_free": "Sie haben Ihre kostenlosen KI-Rekonstruktionen aufgebraucht! Upgraden Sie auf Manager für automatisierten Zugriff oder kaufen Sie ein Guthabenpaket.",
            "exhausted_paid": "Sie haben Ihre KI-Rekonstruktionen aufgebraucht! Kaufen Sie ein Guthabenpaket, um fortzufahren.",
        },
        "pricing": {
            "freeCreditsOnboarding": "5 kostenlose KI-Rekonstruktionen",
            "monthlyCreditsDesc": "100 KI-Credits / Monat (nicht kumulativ)",
            "creditPacksTitle": "Guthabenpakete",
            "creditPacksSubtitle": "Kaufen Sie Guthabenpakete für KI-Rekonstruktionen auf Abruf. Gekaufte Credits verfallen nie.",
            "pack10": "10 Credits — 3 $",
            "pack50": "50 Credits — 12 $",
            "pack100": "100 Credits — 20 $",
            "bestValue": "Bestes Angebot",
            "buyPack": "{{count}} Credits kaufen",
            "purchasePackSuccess": "{{count}} Credits erfolgreich gekauft!",
            "purchasePackError": "Kauf des Guthabenpakets fehlgeschlagen.",
        },
    },
    "it": {
        "credits": {
            "exhausted_free": "Hai esaurito le ricostruzioni IA gratuite! Passa a Manager per l'accesso automatizzato o acquista un pacchetto di crediti.",
            "exhausted_paid": "Hai esaurito le ricostruzioni IA! Acquista un pacchetto di crediti per continuare.",
        },
        "pricing": {
            "freeCreditsOnboarding": "5 ricostruzioni IA gratuite",
            "monthlyCreditsDesc": "100 crediti IA al mese (non cumulabili)",
            "creditPacksTitle": "Pacchetti di crediti",
            "creditPacksSubtitle": "Acquista pacchetti di crediti per ricostruzioni IA su richiesta. I crediti acquistati non scadono mai.",
            "pack10": "10 crediti — 3 $",
            "pack50": "50 crediti — 12 $",
            "pack100": "100 crediti — 20 $",
            "bestValue": "Miglior valore",
            "buyPack": "Acquista {{count}} crediti",
            "purchasePackSuccess": "Acquistati {{count}} crediti con successo!",
            "purchasePackError": "Impossibile acquistare il pacchetto di crediti.",
        },
    },
    "pt": {
        "credits": {
            "exhausted_free": "Você utilizou suas reconstruções gratuitas de IA! Faça upgrade para Manager para acesso automatizado ou compre um pacote de créditos.",
            "exhausted_paid": "Você utilizou suas reconstruções de IA! Compre um pacote de créditos para continuar.",
        },
        "pricing": {
            "freeCreditsOnboarding": "5 reconstruções gratuitas de IA",
            "monthlyCreditsDesc": "100 créditos de IA / mês (não cumulativos)",
            "creditPacksTitle": "Pacotes de créditos",
            "creditPacksSubtitle": "Compre pacotes de créditos para reconstruções por IA sob demanda. Os créditos pagos nunca expiram.",
            "pack10": "10 créditos — $3",
            "pack50": "50 créditos — $12",
            "pack100": "100 créditos — $20",
            "bestValue": "Melhor custo-benefício",
            "buyPack": "Comprar {{count}} créditos",
            "purchasePackSuccess": "{{count}} créditos comprados com sucesso!",
            "purchasePackError": "Falha ao comprar pacote de créditos.",
        },
    },
    "ru": {
        "credits": {
            "exhausted_free": "Вы израсходовали бесплатные AI-реконструкции! Перейдите на тариф Manager для автоматического доступа или приобретите пакет кредитов.",
            "exhausted_paid": "Вы израсходовали свои AI-реконструкции! Приобретите пакет кредитов, чтобы продолжить.",
        },
        "pricing": {
            "freeCreditsOnboarding": "5 бесплатных AI-реконструкций",
            "monthlyCreditsDesc": "100 AI-кредитов в месяц (не накапливаются)",
            "creditPacksTitle": "Пакеты кредитов",
            "creditPacksSubtitle": "Приобретайте пакеты кредитов для AI-реконструкций по запросу. Купленные кредиты никогда не сгорают.",
            "pack10": "10 кредитов — $3",
            "pack50": "50 кредитов — $12",
            "pack100": "100 кредитов — $20",
            "bestValue": "Выгоднее всего",
            "buyPack": "Купить {{count}} кредитов",
            "purchasePackSuccess": "Успешно приобретено {{count}} кредитов!",
            "purchasePackError": "Не удалось приобрести пакет кредитов.",
        },
    },
    "zh": {
        "credits": {
            "exhausted_free": "您的免费AI重构次数已用尽！升级至Manager以获得自动访问权限，或购买积分包。",
            "exhausted_paid": "您的AI重构次数已用尽！购买积分包以继续使用。",
        },
        "pricing": {
            "freeCreditsOnboarding": "5次免费AI重构",
            "monthlyCreditsDesc": "每月100点AI积分（不累积）",
            "creditPacksTitle": "积分包",
            "creditPacksSubtitle": "购买积分包按需进行AI重构。已购买积分永不过期。",
            "pack10": "10积分 — $3",
            "pack50": "50积分 — $12",
            "pack100": "100积分 — $20",
            "bestValue": "最划算",
            "buyPack": "购买 {{count}} 点积分",
            "purchasePackSuccess": "成功购买 {{count}} 点积分！",
            "purchasePackError": "购买积分包失败。",
        },
    },
    "ja": {
        "credits": {
            "exhausted_free": "無料のAI再構築を使い切りました！自動アクセスを利用するにはManagerにアップグレードするか、クレジットパックをご購入ください。",
            "exhausted_paid": "AI再構築を使い切りました！続けるにはクレジットパックをご購入ください。",
        },
        "pricing": {
            "freeCreditsOnboarding": "5回の無料AI再構築",
            "monthlyCreditsDesc": "月100 AIクレジット（繰り越しなし）",
            "creditPacksTitle": "クレジットパック",
            "creditPacksSubtitle": "必要な時にAI再構築を利用できるクレジットパックを購入。購入したクレジットは無期限です。",
            "pack10": "10クレジット — $3",
            "pack50": "50クレジット — $12",
            "pack100": "100クレジット — $20",
            "bestValue": "一番お得",
            "buyPack": "{{count}}クレジットを購入",
            "purchasePackSuccess": "{{count}}クレジットを購入しました！",
            "purchasePackError": "クレジットパックの購入に失敗しました。",
        },
    },
    "hi": {
        "credits": {
            "exhausted_free": "आपने अपने निःशुल्क AI पुनर्निर्माण का उपयोग कर लिया है! स्वचालित पहुँच के लिए Manager में अपग्रेड करें या क्रेडिट पैक खरीदें।",
            "exhausted_paid": "आपने अपने AI पुनर्निर्माण का उपयोग कर लिया है! जारी रखने के लिए क्रेडिट पैक खरीदें।",
        },
        "pricing": {
            "freeCreditsOnboarding": "5 निःशुल्क AI पुनर्निर्माण",
            "monthlyCreditsDesc": "100 AI क्रेडिट / माह (संचयी नहीं)",
            "creditPacksTitle": "क्रेडिट पैक",
            "creditPacksSubtitle": "मांग पर AI पुनर्निर्माण के लिए क्रेडिट पैक खरीदें। खरीदे गए क्रेडिट कभी समाप्त नहीं होते।",
            "pack10": "10 क्रेडिट — $3",
            "pack50": "50 क्रेडिट — $12",
            "pack100": "100 क्रेडिट — $20",
            "bestValue": "सर्वश्रेष्ठ मूल्य",
            "buyPack": "{{count}} क्रेडिट खरीदें",
            "purchasePackSuccess": "सफलतापूर्वक {{count}} क्रेडिट खरीदे गए!",
            "purchasePackError": "क्रेडिट पैक खरीदने में विफल।",
        },
    },
    "nl": {
        "credits": {
            "exhausted_free": "Je hebt je gratis AI-reconstructies gebruikt! Upgrade naar Manager voor geautomatiseerde toegang of koop een creditpakket.",
            "exhausted_paid": "Je hebt je AI-reconstructies gebruikt! Koop een creditpakket om door te gaan.",
        },
        "pricing": {
            "freeCreditsOnboarding": "5 gratis AI-reconstructies",
            "monthlyCreditsDesc": "100 AI-credits / maand (niet cumulatief)",
            "creditPacksTitle": "Creditpakketten",
            "creditPacksSubtitle": "Koop creditpakketten voor on-demand AI-reconstructies. Betaalde credits verlopen nooit.",
            "pack10": "10 credits — $3",
            "pack50": "50 credits — $12",
            "pack100": "100 credits — $20",
            "bestValue": "Voordeligste keuze",
            "buyPack": "Koop {{count}} credits",
            "purchasePackSuccess": "{{count}} credits succesvol gekocht!",
            "purchasePackError": "Kan creditpakket niet kopen.",
        },
    },
}

directories = [
    Path("packages/i18n/locales"),
    Path("apps/web/src/locales"),
]

for d in directories:
    for lang, translations in locales_data.items():
        file_path = d / f"{lang}.json"
        if not file_path.exists():
            print(f"Skipping {file_path}, does not exist")
            continue
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        if "credits" not in data:
            data["credits"] = {}
        for k, v in translations["credits"].items():
            data["credits"][k] = v

        if "pricing" not in data:
            data["pricing"] = {}
        for k, v in translations["pricing"].items():
            data["pricing"][k] = v

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
            f.write("\n")
        print(f"Successfully updated {file_path}")
print("Finished updating all locale files.")
