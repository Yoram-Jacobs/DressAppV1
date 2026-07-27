#!/usr/bin/env python3
"""Simple translation script for import_wardrobe.md"""

import os

# Read the English content
with open("wiki/en/import_wardrobe.md", "r", encoding="utf-8") as f:
    content = f.read()

# Languages to translate (all except English)
languages = ["ar", "de", "es", "fr", "he", "hi", "it", "ja", "nl", "pt", "ru", "zh"]

# Helper function to translate basic content
def translate_content(text, lang):
    """Translate English content to target language"""
    
    # Replace key terms based on language
    if lang == "ar":
        # Arabic translations
        text = text.replace(
            "Import Your Wardrobe - Detailed Guide",
            "استيراد خزانة الملابس - دليل مفصل",
        )
        text = text.replace("Overview", "نظرة عامة")
        text = text.replace("Closet", "الخزانة")
        text = text.replace("Import", "استيراد")
        text = text.replace(
            "Step-by-Step Import Guide",
            "دليل الاستيراد خطوة بخطوة",
        )
        text = text.replace("What Gets Imported", "ما الذي يتم استيراده")
        text = text.replace("Troubleshooting", "حل المشاكل")
        text = text.replace(
            "Already have your wardrobe tracked in another app",
            "لديك بالفعل خزانتك في تطبيق آخر",
        )
        text = text.replace(
            "DressApp makes it easy to import your existing wardrobe data",
            "يجعل DressApp من السهل استيراد بيانات خزانتك",
        )
        text = text.replace(
            "we support imports from a wide range of popular wardrobe and outfit planning apps",
            "ندعم استيراد البيانات من مجموعة واسعة من تطبيقات تنظيم الملابس وتنسيق الملابس الشهيرة",
        )
        text = text.replace(
            "Supported Import Sources",
            "مصادر الاستيراد المدعومة",
        )
        text = text.replace(
            "Step 1: Open Closet Page",
            "الخطوة 1: افتح صفحة الخزانة",
        )
        text = text.replace(
            "Step 2: Access Import Feature",
            "الخطوة 2: الوصول إلى ميزة الاستيراد",
        )
        text = text.replace(
            "Step 3: Select Source App",
            "الخطوة 3: اختر مصدر التطبيق",
        )
        text = text.replace(
            "Step 4: Export Data from Old App",
            "الخطوة 4: قم بتصدير البيانات من التطبيق القديم",
        )
        text = text.replace(
            "Step 5: Upload to DressApp",
            "الخطوة 5: قم بتحميل إلى DressApp",
        )
        text = text.replace(
            "Step 6: Review and Adjust",
            "الخطوة 6: المراجعة والتعديل",
        )
        text = text.replace("Need Help?", "هل تحتاج إلى مساعدة؟")
        text = text.replace(
            "If you run into issues with importing",
            "إذا واجهت مشاكل أثناء الاستيراد",
        )
        # Technical terms that should stay the same (preserve case)
        return text
        
    elif lang == "de":
        # German translations
        text = text.replace(
            "Import Your Wardrobe - Detailed Guide",
            "Eigene Garderobe importieren - Detaillierte Anleitung",
        )
        text = text.replace("Overview", "Übersicht")
        text = text.replace("Closet", "Garderobe")
        text = text.replace("Import", "Importieren")
        text = text.replace(
            "Step-by-Step Import Guide",
            "Schritt-für-Schritt-Import-Anleitung",
        )
        text = text.replace("What Gets Imported", "Was importiert wird")
        text = text.replace("Troubleshooting", "Fehlerbehebung")
        return text
    
    elif lang == "es":
        # Spanish translations
        text = text.replace(
            "Import Your Wardrobe - Detailed Guide",
            "Importa tu armario - Guía detallada",
        )
        text = text.replace("Overview", "Resumen")
        text = text.replace("Closet", "Armario")
        text = text.replace("Import", "Importar")
        text = text.replace(
            "Step-by-Step Import Guide",
            "Guía de importación paso a paso",
        )
        text = text.replace("What Gets Imported", "Qué se importa")
        text = text.replace("Troubleshooting", "Solución de problemas")
        return text
    
    elif lang == "fr":
        # French translations
        text = text.replace(
            "Import Your Wardrobe - Detailed Guide",
            "Importer votre garde-robe - Guide détaillé",
        )
        text = text.replace("Overview", "Vue d'ensemble")
        text = text.replace("Closet", "Garde-robe")
        text = text.replace("Import", "Importer")
        text = text.replace(
            "Step-by-Step Import Guide",
            "Guide d'importation étape par étape",
        )
        text = text.replace("What Gets Imported", "Ce qui est importé")
        text = text.replace("Troubleshooting", "Dépannage")
        return text
    
    elif lang == "he":
        # Hebrew translations
        text = text.replace(
            "Import Your Wardrobe - Detailed Guide",
            "ייבוא המלתחה שלך - מדריך מפורט",
        )
        text = text.replace("Overview", "סקירה כללית")
        text = text.replace("Closet", "מלתחה")
        text = text.replace("Import", "ייבוא")
        text = text.replace(
            "Step-by-Step Import Guide",
            "מדריך ייבוא מפורט",
        )
        text = text.replace("What Gets Imported", "מה ייקח לקחת")
        text = text.replace("Troubleshooting", "פתרון בעיות")
        return text
    
    elif lang == "hi":
        # Hindi translations
        text = text.replace(
            "Import Your Wardrobe - Detailed Guide",
            "अपना वार्डरोब इंपोर्ट करें - विस्तृत गाइड",
        )
        text = text.replace("Overview", "अवलोकन")
        text = text.replace("Closet", "वार्डरोब")
        text = text.replace("Import", "इंपोर्ट")
        text = text.replace(
            "Step-by-Step Import Guide",
            "स्टेप-बाय-स्टेप इम्पोर्ट गाइड",
        )
        text = text.replace("What Gets Imported", "क्या इंपोर्ट होता है")
        text = text.replace("Troubleshooting", "ट्रबलशूटिंग")
        return text
    
    elif lang == "it":
        # Italian translations
        text = text.replace(
            "Import Your Wardrobe - Detailed Guide",
            "Importa il tuo Guardaroba - Guida Dettagliata",
        )
        text = text.replace("Overview", "Panoramica")
        text = text.replace("Closet", "Guardaroba")
        text = text.replace("Import", "Importa")
        text = text.replace(
            "Step-by-Step Import Guide",
            "Guida passo-passo per l'importazione",
        )
        text = text.replace("What Gets Imported", "Cosa viene importato")
        text = text.replace("Troubleshooting", "Risoluzione problemi")
        return text
    
    elif lang == "ja":
        # Japanese translations
        text = text.replace(
            "Import Your Wardrobe - Detailed Guide",
            "ワードローブをインポートする - 詳細ガイド",
        )
        text = text.replace("Overview", "概要")
        text = text.replace("Closet", "クローゼット")
        text = text.replace("Import", "インポート")
        text = text.replace(
            "Step-by-Step Import Guide",
            "ステップ・バイ・ステップのインポートガイド",
        )
        text = text.replace("What Gets Imported", "インポートされるもの")
        text = text.replace("Troubleshooting", "トラブルシューティング")
        return text
    
    elif lang == "nl":
        # Dutch translations
        text = text.replace(
            "Import Your Wardrobe - Detailed Guide",
            "Importeer je Garderobe - Gedetailleerde Gids",
        )
        text = text.replace("Overview", "Overzicht")
        text = text.replace("Closet", "Garderobe")
        text = text.replace("Import", "Importeren")
        text = text.replace(
            "Step-by-Step Import Guide",
            "Stapsgewijze importgids",
        )
        text = text.replace("What Gets Imported", "Wat wordt geïmporteerd")
        text = text.replace("Troubleshooting", "Probleemoplossing")
        return text
    
    elif lang == "pt":
        # Portuguese translations
        text = text.replace(
            "Import Your Wardrobe - Detailed Guide",
            "Importe seu Guarda-Roupa - Guia Detalhado",
        )
        text = text.replace("Overview", "Visão geral")
        text = text.replace("Closet", "Guarda-Roupa")
        text = text.replace("Import", "Importar")
        text = text.replace(
            "Step-by-Step Import Guide",
            "Guia passo a passo para importar",
        )
        text = text.replace("What Gets Imported", "O que é importado")
        text = text.replace("Troubleshooting", "Solução de problemas")
        return text
    
    elif lang == "ru":
        # Russian translations
        text = text.replace(
            "Import Your Wardrobe - Detailed Guide",
            "Импорт вашего гардероба - Подробное руководство",
        )
        text = text.replace("Overview", "Обзор")
        text = text.replace("Closet", "Гардероб")
        text = text.replace("Import", "Импорт")
        text = text.replace(
            "Step-by-Step Import Guide",
            "Пошаговое руководство по импорту",
        )
        text = text.replace("What Gets Imported", "Что импортируется")
        text = text.replace("Troubleshooting", "Решение проблем")
        return text
    
    elif lang == "zh":
        # Chinese translations
        text = text.replace(
            "Import Your Wardrobe - Detailed Guide",
            "导入您的衣橱 - 详细指南",
        )
        text = text.replace("Overview", "概述")
        text = text.replace("Closet", "衣橱")
        text = text.replace("Import", "导入")
        text = text.replace(
            "Step-by-Step Import Guide",
            "详细的导入指南",
        )
        text = text.replace("What Gets Imported", "什么会被导入")
        text = text.replace("Troubleshooting", "故障排除")
        return text
    
    # Return unchanged for other languages
    return text

# Create wiki directories
for lang in languages:
    os.makedirs(f"wiki/{lang}", exist_ok=True)
    os.makedirs(f"frontend/public/wiki/{lang}", exist_ok=True)

# Create translations for each language
for lang in languages:
    translated = translate_content(content, lang)
    
    # Write wiki translation
    with open(f"wiki/{lang}/import_wardrobe.md", "w", encoding="utf-8") as f:
        f.write(translated)
    
    # Write frontend public translation
    with open(f"frontend/public/wiki/{lang}/import_wardrobe.md", "w", encoding="utf-8") as f:
        f.write(translated)
    
    print(f"Created: wiki/{lang}/import_wardrobe.md and frontend/public/wiki/{lang}/import_wardrobe.md")

print("Translation process completed!")
