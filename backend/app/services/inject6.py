import os

path = r"C:\DressApp_AG\frontend\src\pages\AddItem.jsx"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

# Replace the payload ternary
old_payload = """      const images_base64 = cardsToProcess.map(c => c.base64);
      const payload = cardsToProcess.length === 1
        ? { image_base64: images_base64[0], language: requestLang, multi: false }
        : { images_base64, language: requestLang };"""

new_payload = """      const images_base64 = cardsToProcess.map(c => c.base64);
      const payload = { images_base64, language: requestLang };"""

if old_payload in content:
    content = content.replace(old_payload, new_payload)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Injected successfully")
else:
    print("Could not find the payload ternary block in AddItem.jsx")
