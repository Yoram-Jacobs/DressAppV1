<<<<<<< HEAD
# अपना वार्डरोब इंपोर्ट करें - विस्तृत गाइड

## अवलोकन

क्या आपके पास पहले से ही कोई ऐसा ऐप है जिसमें आपके वार्डरोब को ट्रैक किया गया है? कोई समस्या नहीं!DressApp आपके मौजूदा वार्डरोब डेटा को इम्पोर्ट करना आसान बनाता है ताकि आपको शुरू करने के लिए पहली बार से न शुरू करना पड़े.हम कई लोकप्रिय वार्डरोब और आउटफिट प्लानिंग ऐप्स से इम्पोर्ट को सपोर्ट करते हैं.

## सपोर्टेड इम्पोर्ट सोर्सेज

- **Cladwell** - Export your Cladwell wardrobe and import directly into DressApp
- **Stylebook** - Transfer your Stylebook inventory with ease
- **Acloset** - Import your Acloset items and outfits
- **SmartCloset** - Migrate your SmartCloset wardrobe data
- **CSV Files** - Import from any app that supports CSV export (generic format)
- **Other Apps** - Many other wardrobe apps support CSV export which DressApp can import

## स्टेप-बाय-स्टेप इम्पोर्ट गाइड

### स्टेप 1: क्लोजेट पेज खोलें
Navigate to your **Closet** page in DressApp. This is where all your imported items will appear.

### स्टेप 2: इम्पोर्ट फीचर तक पहुँचें
Look for the **Import** button on the Closet page. It's usually in the top-right corner or in the menu options.

### स्टेप 3: सोर्स ऐप चुनें
Choose the app you're importing from from the list of supported apps. If your app isn't listed, select **CSV File** for a generic import option.

### स्टेप 4: पुराने ऐप से डेटा एक्सपोर्ट करें
Follow the instructions for your specific app:
- **Cladwell**: Go to Settings > Export Data > Download CSV
- **Stylebook**: Open Menu > Export > Choose CSV format
- **Acloset**: Navigate to Profile > Export Wardrobe > Download
- **SmartCloset**: Go to Settings > Data Management > Export
- **CSV Export**: Look for an export or download option in your app's settings

### स्टेप 5: DressApp में अपलोड करें
Upload the exported file to DressApp. The system will automatically:
- Parse the data and map fields to DressApp's format
- Categorize items based on their type (tops, bottoms, dresses, etc.)
- Organize colors and sizes
- Import images if available in the export

### स्टेप 6: रिव्यू और एडजस्ट करें
After import completes:
- Review your items on the Closet page
- Fix any miscategorized items
- Add missing details (brand, price, purchase date)
- Remove any duplicates or test items

## क्या इंपोर्ट होता है

Depending on the source app, the following data may be imported:
- Item names and descriptions
- Categories and subcategories
- Colors and patterns
- Sizes and measurements
- Brand information
- Purchase dates and prices
- Item images (if included in export)
- Wear history (if supported)

## ट्रबलशूटिंग

### Import Failed
- Check that the file format is correct (CSV, JSON, or app-specific format)
- Ensure the file isn't corrupted or too large
- Try exporting again from the source app

### Missing Items After Import
- Some fields may not have mapped correctly
- Check the import results page for warnings
- Manually add missing items if needed

### Images Not Imported
- Not all apps include images in their export files
- You can add images manually to imported items later
- Use the camera or upload function on the item detail page

## मदद चाहिए?

If you run into issues with importing:
- Check the troubleshooting section above
- Contact support through the Help menu
- Join our community forum for tips from other users

---

*अंतिम अपडेट: जुलाई 2026*
=======
# अन्य ऐप्स से अपनी अलमारी आयात करें (प्रतिस्पर्धी माइग्रेशन)

## सिंहावलोकन (Overview)
यदि आपकी अलमारी पहले से ही किसी अन्य वार्डरोब ऐप (जैसे Whering, Acloset, या Stylebook) में कैटलॉग की गई है, तो आपको शुरुआत से शुरू करने की आवश्यकता नहीं है। DressApp में एक स्मार्ट **Desktop Wardrobe Migration Agent** (ब्राउज़र बुकमार्कलेट के माध्यम से) है जो आपकी पुरानी अलमारी के पेज को क्रॉल करता है, आपके कपड़ों के कार्ड कैप्चर करता है, और उन्हें स्वचालित रूप से DressApp पर अपलोड करता है। इसके बाद हमारी AI बैकग्राउंड में काम करती है ताकि आपके कपड़ों के रंग, ब्रांड, फैब्रिक और कैटेगरी की स्वचालित रूप से पहचान की जा सके।

## पूर्वापेक्षाएँ (Prerequisites)
- **डेस्कटॉप कंप्यूटर**: माइग्रेशन बुकमार्कलेट के लिए डेस्कटॉप ब्राउज़र क्षमताओं (Chrome, Edge, या Safari) की आवश्यकता होती है। यह मोबाइल उपकरणों या टैबलेट पर समर्थित नहीं है।
- **सक्रिय खाते**: आपको एक ही ब्राउज़र में अपने DressApp खाते और अपने प्रतिस्पर्धी वार्डरोब खाते दोनों में लॉग इन होना चाहिए।
- **बुकमार्क बार**: आपके ब्राउज़र का बुकमार्क बार दृश्यमान होना चाहिए (Windows पर Ctrl+Shift+B, macOS पर Cmd+Shift+B)।

## चरण-दर-चरण निर्देश
1. अपने डेस्कटॉप कंप्यूटर पर अपना DressApp **Profile** पेज खोलें और **Import Wardrobe** पर क्लिक करें।
2. सूची से अपना पुराना ऐप चुनें (Whering, Acloset, Stylebook, Smartli, BeautyAI, आदि) या एक कस्टम नाम दर्ज करें।
3. स्क्रीन से **Share & Start Agent** बुकमार्कलेट बटन को सीधे अपने ब्राउज़र के बुकमार्क बार पर खींचें (drag करें)।
4. एक नया टैब खोलें, अपने पुराने वार्डरोब ऐप के वेब संस्करण पर जाएं और लॉग इन करें। उस पेज पर जाएं जहां आपके सभी कपड़े एक ग्रिड में प्रदर्शित होते हैं।
5. अपने बुकमार्क बार में **Share & Start Agent** बुकमार्कलेट पर क्लिक करें।
6. एजेंट स्क्रॉल करना शुरू कर देगा, कपड़ों की छवियों का पता लगाएगा और उन्हें 15-15 के बैच में DressApp पर स्ट्रीम करेगा। इस प्रक्रिया के दौरान DressApp टैब को बंद न करें।
7. एक बार स्ट्रीमिंग पूरी हो जाने पर, अपना DressApp Closet पेज देखें। कपड़ों की विशेषताओं को स्वचालित रूप से भरने के लिए AI Stylist बैकग्राउंड में काम करेगा।

## अपेक्षित परिणाम
- कपड़ों के कार्ड तुरंत आपके DressApp क्लोजेट ग्रिड में दिखाई देंगे।
- बैकग्राउंड स्वचालित रूप से हटा दिए जाते हैं, जिससे साफ पारदर्शी थंबनेल रह जाते हैं।
- आयात के कुछ ही मिनटों के भीतर टैग फ़ील्ड (श्रेणी, रंग, फिट, फैब्रिक) स्वचालित रूप से भर जाएंगे।

## समस्या निवारण (Troubleshooting)
- **बुकमार्कलेट इंस्टॉल नहीं हो रहा है**: सुनिश्चित करें कि आपके ब्राउज़र का बुकमार्क बार सक्षम है। यदि सुरक्षा सेटिंग्स ड्रैगिंग को ब्लॉक करती हैं, तो बटन पर राइट-क्लिक करें, "Copy Link Address" चुनें, मैन्युअल रूप से एक नया बुकमार्क बनाएं और URL फ़ील्ड में कोड पेस्ट करें।
- **एजेंट स्क्रॉल करना बंद कर देता है**: सुनिश्चित करें कि प्रतिस्पर्धी वार्डरोब पेज सक्रिय है और मिनिमाइज नहीं है। यदि यह रुक जाता है, तो प्रतिस्पर्धी पेज को रीफ्रेश करें और बुकमार्कलेट पर दोबारा क्लिक करें।
- **डुप्लिकेट आइटम**: आयातक स्वचालित रूप से डुप्लिकेट अपलोड को फ़िल्टर करने के लिए छवि हस्ताक्षरों (dHash) की जांच करता है।

## सीमाएँ
- **केवल डेस्कटॉप**: API प्रतिबंधों के कारण इसे मोबाइल ब्राउज़र पर नहीं चलाया जा सकता है।
- **दृश्य स्पष्टता**: प्रतिस्पर्धी ऐप पर अत्यधिक विकृत, अंधेरे, या ओवरलैपिंग कपड़ों के लेआउट दृश्य क्रॉप निष्कर्षण में विफल हो सकते हैं और बाद में मैन्युअल फोटो समायोजन की आवश्यकता हो सकती है।
>>>>>>> 227ad69b4d375d333b9fc7004aded4a49d2e2aad
