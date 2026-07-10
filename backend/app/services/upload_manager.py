import os
import aiofiles
from datetime import datetime
import uuid
import base64

# Simulating an Object Storage Bucket (e.g. S3) via local disk for now
# This makes migration to real S3 later as simple as rewriting this one class.

BUCKET_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "static", "uploads")
os.makedirs(BUCKET_DIR, exist_ok=True)

class UploadManager:
    @staticmethod
    async def upload_bytes(file_bytes: bytes, mime_type: str, extension: str) -> str:
        """
        Uploads raw bytes to the object storage bucket and returns the public CDN URL.
        """
        # Generate a unique key for the file
        file_id = str(uuid.uuid4())
        date_prefix = datetime.utcnow().strftime("%Y/%m/%d")
        file_name = f"{file_id}.{extension}"
        
        # S3 Key equivalent
        s3_key = f"{date_prefix}/{file_name}"
        
        # Local path
        local_dir = os.path.join(BUCKET_DIR, date_prefix)
        os.makedirs(local_dir, exist_ok=True)
        local_path = os.path.join(local_dir, file_name)
        
        async with aiofiles.open(local_path, "wb") as f:
            await f.write(file_bytes)
            
        # Return a mock CDN URL pointing to the backend's static file server
        # e.g., http://localhost:8000/static/uploads/2026/07/10/uuid.webp
        # In production, this would be an S3 or R2 URL: https://cdn.dressapp.io/...
        return f"/static/uploads/{s3_key}"
        
    @staticmethod
    def get_public_url(s3_key: str) -> str:
        return f"/static/uploads/{s3_key}"

