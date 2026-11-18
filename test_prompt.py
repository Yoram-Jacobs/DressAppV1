import json
import httpx
import asyncio

async def main():
    async with httpx.AsyncClient(timeout=60.0) as client:
        # Request 1: Camouflage Pants
        p1 = {
            "model": "local",
            "messages": [
                {
                    "role": "system",
                    "content": "Output raw JSON only ({...} or [{...}]). No markdown/intro.\n"
                               "• name & title: Short, unique (2-4 words) extracting the visible garment cut and attributes [Color] [Material/Cut] [Type]. Strictly reflect pixels in this image; NEVER hallucinate or copy items from other crops.\n"
                               "• sub_category: Specific cut ('T-Shirt','Sweater','Jeans','Pants','Skirt','Shoes','Sneakers','Sandals','Boots','Loafers','Sunglasses','Handbag'). Never 'Top'/'Bottom'/'Footwear'.\n"
                               "• caption: <=12 words fluent sentence in requested language. End with period."
                },
                {
                    "role": "user",
                    "content": "**OUTPUT LANGUAGE: Hebrew (עברית)**\n"
                               "כל שדות הטקסט (name, title, caption, item_type, sub_category) חייבים להיכתב בעברית שוטפת בלבד. שמות מפתחות וערכי enum בלבד באנגלית. אפס מילים באנגלית בערכים.\n"
                               "• name & title: מבנה: [צבע עיקרי] [גזרה/חומר] [סוג הפריט].\n"
                               "תאר מכנסי דגמ\"ח צבאיים בהסוואה ירוק-חום."
                }
            ],
            "id_slot": 0,
            "max_tokens": 150,
            "temperature": 0.1,
        }
        r1 = await client.post("http://127.0.0.1:8080/v1/chat/completions", json=p1)
        print("R1 (Camouflage Pants):", r1.json()["choices"][0]["message"]["content"])

        # Request 2: Red Windbreaker Jacket with hood
        p2 = {
            "model": "local",
            "messages": [
                {
                    "role": "system",
                    "content": "Output raw JSON only ({...} or [{...}]). No markdown/intro.\n"
                               "• name & title: Short, unique (2-4 words) extracting the visible garment cut and attributes [Color] [Material/Cut] [Type]. Strictly reflect pixels in this image; NEVER hallucinate or copy items from other crops.\n"
                               "• sub_category: Specific cut ('T-Shirt','Sweater','Jeans','Pants','Skirt','Shoes','Sneakers','Sandals','Boots','Loafers','Sunglasses','Handbag'). Never 'Top'/'Bottom'/'Footwear'.\n"
                               "• caption: <=12 words fluent sentence in requested language. End with period."
                },
                {
                    "role": "user",
                    "content": "**OUTPUT LANGUAGE: Hebrew (עברית)**\n"
                               "כל שדות הטקסט (name, title, caption, item_type, sub_category) חייבים להיכתב בעברית שוטפת בלבד. שמות מפתחות וערכי enum בלבד באנגלית. אפס מילים באנגלית בערכים.\n"
                               "• name & title: מבנה: [צבע עיקרי] [גזרה/חומר] [סוג הפריט].\n"
                               "תאר ז'קט אדום עם רוכסן וברדס."
                }
            ],
            "id_slot": 1,
            "max_tokens": 150,
            "temperature": 0.1,
        }
        r2 = await client.post("http://127.0.0.1:8080/v1/chat/completions", json=p2)
        print("R2 (Red Jacket with id_slot=1):", r2.json()["choices"][0]["message"]["content"])

if __name__ == "__main__":
    asyncio.run(main())
