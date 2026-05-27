import pathlib

src_path = pathlib.Path(r"C:\DressApp_AG\scripts\build_eyes_benchmark_v4_notebook.py")
dest_path = pathlib.Path(r"C:\DressApp_AG\scripts\build_eyes_benchmark_flat_notebook.py")

content = src_path.read_text(encoding="utf-8")

# 1. Update output notebook path
content = content.replace('OUT = Path("C:/DressApp_AG/docs/notebooks/Eyes_Benchmark_v4_Gemma4.ipynb")',
                          'OUT = Path("C:/DressApp_AG/docs/notebooks/Eyes_Benchmark_Flat_Gemma4.ipynb")')

# 2. Update MD Title
content = content.replace('# Eyes v4 — Gemma-4 E2B Batch Benchmark',
                          '# Eyes Flat — Gemma-4 E2B Flat Garment Benchmark')

# 3. Update the Base Model Path to the local Drive output of the training script
content = content.replace("BASE_MODEL = 'google/gemma-4-E2B-it'",
                          "BASE_MODEL = '/content/drive/MyDrive/DressApp_Gemma4_E2B_Training/Eyes_v4_Flat_Gemma4_merged'")
content = content.replace("processor = AutoProcessor.from_pretrained('google/gemma-4-E2B-it')",
                          "processor = AutoProcessor.from_pretrained(BASE_MODEL)")

dest_path.write_text(content, encoding="utf-8")
print("Written", dest_path)
