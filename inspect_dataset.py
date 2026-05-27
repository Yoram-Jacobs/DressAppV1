import sys
try:
    from datasets import load_dataset
except ImportError:
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "datasets", "Pillow", "pyarrow"])
    from datasets import load_dataset

ds = load_dataset('ghoumrassi/clothes_sample', split='train')
print(ds)
print("Keys:", ds[0].keys())
print("Types:", {k: type(v) for k, v in ds[0].items()})
if 'text' in ds[0]:
    print("Sample text:", ds[0]['text'])
elif 'caption' in ds[0]:
    print("Sample caption:", ds[0]['caption'])
elif 'label' in ds[0]:
    print("Sample label:", ds[0]['label'])
