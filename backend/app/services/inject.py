import os

snippet = open(r'C:\DressApp_AG\backend\app\services\garment_vision_snippet.py', 'r').read()
target = open(r'C:\DressApp_AG\backend\app\services\garment_vision.py', 'r').read()

anchor = '        yield {"type": "done", "count": emitted}'
pos = target.find(anchor)
if pos == -1:
    print("Anchor not found")
else:
    pos += len(anchor)
    new_target = target[:pos] + '\n\n' + snippet + target[pos:]
    open(r'C:\DressApp_AG\backend\app\services\garment_vision.py', 'w').write(new_target)
    print("Done")
