# services/utils.py

import os
from datetime import datetime
import uuid

def save_image(image_bytes: bytes) -> str:
    """Save image to /image folder and return filename"""
    os.makedirs("image", exist_ok=True)  # Ensure directory exists
    filename = f"img_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:4]}.png"
    filepath = os.path.join("image", filename)
    
    with open(filepath, "wb") as f:
        f.write(image_bytes)
    
    return filename