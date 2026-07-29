from cryptography.hazmat.primitives.asymmetric import ec
from cryptography.hazmat.primitives import serialization
import base64

def generate_vapid_keys():
    private_key = ec.generate_private_key(ec.SECP256R1())
    
    # Private key in PEM format
    private_pem = private_key.private_bytes(
        encoding=serialization.Encoding.PEM,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption()
    ).decode('utf-8')
    
    # Public key in uncompressed point format
    public_key = private_key.public_key()
    public_bytes = public_key.public_bytes(
        encoding=serialization.Encoding.X962,
        format=serialization.PublicFormat.UncompressedPoint
    )
    
    # base64url encode the public key
    public_b64url = base64.urlsafe_b64encode(public_bytes).decode('utf-8').rstrip('=')
    
    print("VAPID_PRIVATE_KEY:")
    # Print as a single-line string with literal \n characters so we can copy-paste easily
    print(private_pem.replace("\n", "\\n"))
    
    print("VAPID_PUBLIC_KEY:")
    print(public_b64url)

if __name__ == "__main__":
    generate_vapid_keys()
