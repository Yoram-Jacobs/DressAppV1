import inspect
from app.services.credit_manager import deduct_user_credits, check_and_increment_daily_request

print("DEDUCT:")
print(inspect.getsource(deduct_user_credits))
print("-" * 50)
print("CHECK:")
print(inspect.getsource(check_and_increment_daily_request))
