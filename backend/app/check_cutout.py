import asyncio
from app.services.clothing_parser import parse_garments

target_file = '/app/backend/static/uploads/items/2026/10/13/927ce88ae7934464882d6865eb11ba49.png'
with open(target_file, 'rb') as f:
    data = f.read()

items = asyncio.run(parse_garments(data))
print('Parsed garments:', len(items))
for i, it in enumerate(items):
    mask = it.get('mask')
    px = int(mask.sum()) if mask is not None else 0
    print(f'[{i}] label={it[\ label\]} category={it[\category\]} bbox={it[\bbox\]} px={px}')

