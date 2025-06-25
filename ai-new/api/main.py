from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from services.responder_service import generate_response, rename_chat, delete_chat, get_user_chats, get_chat_history
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import base64
import os
from datetime import datetime
import uuid
from fastapi.staticfiles import StaticFiles
from typing import Optional

app = FastAPI()

# Create image directory if it doesn't exist
os.makedirs("image", exist_ok=True)

# Serve static files from the image directory
app.mount("/image", StaticFiles(directory="image"), name="images")

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class PromptRequest(BaseModel):
    prompt: str
    user_id: str
    chat_id: str
    title: Optional[str] = None

class ChatRenameRequest(BaseModel):
    user_id: str
    chat_id: str
    new_title: str

class ChatDeleteRequest(BaseModel):
    user_id: str
    chat_id: str

class ChatHistoryRequest(BaseModel):
    user_id: str
    chat_id: str
    limit: Optional[int] = 20

def save_image(image_bytes: bytes) -> str:
    """Save image to /image folder and return filename"""
    filename = f"img_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:4]}.png"
    filepath = os.path.join("image", filename)
    
    with open(filepath, "wb") as f:
        f.write(image_bytes)
    
    return filename

@app.post("/chat")
async def chat(request: PromptRequest):
    try:
        response = generate_response(
            prompt=request.prompt,
            user_id=request.user_id,
            chat_id=request.chat_id,
            title=request.title
        )
        
        if response.get("type") == "image":
            if response.get("error") == "rate_limit":
                return JSONResponse({
                    "type": "text",
                    "content": "I'm getting rate limited by the image generation service. Please try again in a little while."
                })
            
            filename = save_image(response["image_bytes"])
            image_url = f"/image/{filename}"
            
            return JSONResponse({
                "type": "image",
                "image_url": image_url,
                "description": response.get("description", "Generated image"),
                "image_id": response.get("image_id", "")
            })
        else:
            return JSONResponse({
                "type": "text",
                "content": response["content"]
            })
            
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/rename-chat")
async def rename_chat_endpoint(request: ChatRenameRequest):
    try:
        rename_chat(request.user_id, request.chat_id, request.new_title)
        return JSONResponse({"status": "success"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/delete-chat")
async def delete_chat_endpoint(request: ChatDeleteRequest):
    try:
        delete_chat(request.user_id, request.chat_id)
        return JSONResponse({"status": "success"})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/get_user_chats/{user_id}")
async def get_user_chats_endpoint(user_id: str):
    try:
        chats = get_user_chats(user_id)
        # Convert ObjectId to string for JSON serialization
        for chat in chats:
            chat["_id"] = str(chat["_id"])
        return JSONResponse({"chats": chats})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/get_chat_history")
async def get_chat_history_endpoint(request: ChatHistoryRequest):
    try:
        history = get_chat_history(request.user_id, request.chat_id, request.limit)
        return JSONResponse({"history": history})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))