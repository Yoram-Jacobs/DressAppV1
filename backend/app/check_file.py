import app.services.scheduler as s
import inspect
print("Source file:", inspect.getsourcefile(s))
print("Source code:")
print(inspect.getsource(s._generate_fallback_advice)[:1000])
