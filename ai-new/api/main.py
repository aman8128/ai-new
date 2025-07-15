from fastapi import FastAPI, HTTPException
from pydantic import BaseModel,EmailStr
from services.responder_service import generate_response, rename_chat, delete_chat, get_user_chats, get_chat_history,handle_image_upload,signup_user,login_user,get_user_info
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
import base64
import os
from datetime import datetime
import uuid
from fastapi import UploadFile, File, Form
from typing import Annotated
from fastapi.staticfiles import StaticFiles
from typing import Optional,List

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
    
class ImagePromptRequest(BaseModel):
    prompt: Optional[str] = None
    user_id: str
    chat_id: str

class ManualSignupRequest(BaseModel):
    username: str
    email: EmailStr
    password: str

class GoogleSignupRequest(BaseModel):
    token: str  # Google ID token

class ManualLoginRequest(BaseModel):
    email: EmailStr
    password: str

class GoogleLoginRequest(BaseModel):
    token: str

@app.post("/login")
async def login_manual(request: ManualLoginRequest):
    result = login_user(request.dict(), is_google=False)
    if result["status"] == "success":
        return JSONResponse({
            "access_token": "dummy_token",  # optional: JWT later
            "user_data": result
        })
    raise HTTPException(status_code=401, detail=result["message"])

@app.post("/login/google")
async def login_google(request: GoogleLoginRequest):
    result = login_user(request.dict(), is_google=True)
    if result["status"] == "success":
        return JSONResponse({
            "access_token": "dummy_token",  # optional: JWT later
            "user_data": result
        })
    else:
        raise HTTPException(status_code=401, detail=result["message"])
    
@app.post("/signup")
async def signup_manual(request: ManualSignupRequest):
    result = signup_user(request.dict(), is_google=False)
    if result["status"] == "success":
        return JSONResponse(result)
    else:
        raise HTTPException(status_code=400, detail=result["message"])

@app.post("/signup/google")
async def signup_google(request: GoogleSignupRequest):
    result = signup_user(request.dict(), is_google=True)
    if result["status"] == "success":
        return {
            "status": "success",
            "user_id": result["user_id"],
            "profile_data": result["profile_data"],
            "auth_type": "google"
        }
    raise HTTPException(status_code=400, detail=result["message"])
    
@app.post("/upload-image")
async def upload_image(
    images: List[UploadFile] = File(...),
    user_id: str = Form(...),
    chat_id: str = Form(...),
    prompt: Optional[str] = Form(None),
):
    try:
        image_data_list = []
        for image in images:
            image_data = await image.read()
            image_data_list.append(image_data)

        result = handle_image_upload(
            image_data_list=image_data_list,
            user_id=user_id,
            chat_id=chat_id,
            prompt=prompt
        )

        return JSONResponse({
            "status": "success",
            "image_ids": result.get("image_ids", []),
            "image_urls": result.get("image_urls", []),
            "llm_responses": [result.get("llm_response", "")]
        })

    except Exception as e:
        import traceback
        print("Upload image error traceback:", traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))

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
def get_user_chats_endpoint(user_id: str):
    try:
        chats = get_user_chats(user_id)

        # Convert Mongo ObjectId and datetime to JSON serializable
        for chat in chats:
            if "_id" in chat:
                chat["_id"] = str(chat["_id"])
            if "created_at" in chat:
                chat["created_at"] = chat["created_at"].isoformat()
            if "updated_at" in chat:
                chat["updated_at"] = chat["updated_at"].isoformat()
            if "messages" in chat:
                for message in chat["messages"]:
                    if "timestamp" in message and isinstance(message["timestamp"], datetime):
                        message["timestamp"] = message["timestamp"].isoformat()
        
        return JSONResponse(content={"chats": chats}, status_code=200)
    except Exception as e:
        print("💥 Error in get_user_chats_endpoint:", e)
        return JSONResponse(content={"detail": "Failed to fetch chats"}, status_code=500)

@app.get("/get_user_info/{user_id}")  # Changed from @app.post
async def get_user_info_endpoint(user_id: str):
    try:
        user_info = get_user_info(user_id)
        if not user_info:
            raise HTTPException(status_code=404, detail="User not found")
        return JSONResponse(content=user_info, status_code=200)
    except Exception as e:
        print("💥 Error in get_user_info_endpoint:", e)
        raise HTTPException(status_code=500, detail=str(e))
    
@app.post("/get_chat_history")
async def get_chat_history_endpoint(request: ChatHistoryRequest):
    try:
        history = get_chat_history(request.user_id, request.chat_id, request.limit)
        return JSONResponse({"history": history})
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))