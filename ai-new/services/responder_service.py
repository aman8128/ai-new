import requests
from datetime import datetime
from pymongo import MongoClient
from duckduckgo_search import DDGS
import base64
from bson.binary import Binary
from io import BytesIO
import uuid
from PIL import Image
from bson import ObjectId
import os
from tempfile import NamedTemporaryFile
from typing import Union
import tempfile
from services.utils import save_image
import bcrypt
from google.oauth2 import id_token
from google.auth.transport import requests as google_requests

# Configuration
GROQ_API_KEY = "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"
STABILITY_API_KEY = "sk-3UnY9eVsTHi0V0NCCa5mVY61FwL4djjKakG7V3ePqs9vorgi"
API_URL = "https://api.groq.com/openai/v1/chat/completions"
STABILITY_API_URL = (
    "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image"
)

# MongoDB setup
client = MongoClient("mongodb://localhost:27017/")
db = client["ai_new"]


uploaded_images_collection = db["uploaded_images"]
users_collection = db["users"]

user_info_collection = db["user_info"] 

def get_generated_images_collection():
    return db["uploaded_images"]

def save_uploaded_image(image_data: Union[bytes, str], user_id: str) -> str:
    """Save uploaded image (either bytes or base64) and return file path"""
    try:
        # Create user-specific directory if it doesn't exist
        user_dir = os.path.join(IMAGE_UPLOAD_DIR, user_id)
        os.makedirs(user_dir, exist_ok=True)

        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"upload_{timestamp}_{uuid.uuid4().hex[:8]}.png"
        filepath = os.path.join(user_dir, filename)

        # Handle both base64 and raw bytes
        if isinstance(image_data, str):
            # Assume it's base64 if it's a string
            if image_data.startswith("data:image"):
                # Strip data URL prefix if present
                image_data = image_data.split(",", 1)[1]
            image_bytes = base64.b64decode(image_data)
        else:
            image_bytes = image_data

        # Save the image
        with open(filepath, "wb") as f:
            f.write(image_bytes)

        return filepath
    except Exception as e:
        print(f"Error saving uploaded image: {e}")
        raise

def process_image_with_llm(
    image_paths: list[str], prompt: str = None, history: list = None
) -> str:
    print("📤 Sending multiple images to LLM with prompt:", prompt)

    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    # Encode images
    image_parts = [
        {
            "type": "image_url",
            "image_url": {
                "url": f"data:image/png;base64,{base64.b64encode(open(p, 'rb').read()).decode('utf-8')}"
            },
        }
        for p in image_paths
    ]

    # Convert previous text + image history
    llm_messages = []
    if history:
        for msg in history:
            if msg.get("is_image", False):
                llm_messages.append(
                    {
                        "role": "user",
                        "content": f"(Image Upload)\nPrompt: {msg['prompt']}",
                    }
                )
                llm_messages.append(
                    {
                        "role": "assistant",
                        "content": f"(Image-based response)\n{msg['response'].replace('IMAGE:', '')}",
                    }
                )
            else:
                llm_messages.append({"role": "user", "content": msg["prompt"]})
                llm_messages.append({"role": "assistant", "content": msg["response"]})

    # Add current image + prompt
    llm_messages.append(
        {"role": "user", "content": [{"type": "text", "text": prompt}] + image_parts}
    )

    data = {
        "model": "meta-llama/llama-4-scout-17b-16e-instruct",
        "messages": llm_messages,
        "max_tokens": 1500,
    }

    try:
        print("⏳ Requesting LLM...")
        response = requests.post(API_URL, headers=headers, json=data, timeout=60)
        print("✅ Response status:", response.status_code)
        response.raise_for_status()
        return response.json()["choices"][0]["message"]["content"]
    except Exception as e:
        print(f"❌ Error in LLM call: {e}")
        raise

def signup_user(data: dict, is_google: bool = False) -> dict:
    try:
        if is_google:
            token = data.get("token")
            if not token:
                return {"status": "error", "message": "Missing Google token"}

            try:
                idinfo = id_token.verify_oauth2_token(token, google_requests.Request())
                
                # Check if user already exists by google_id or email
                existing = user_info_collection.find_one({
                    "$or": [
                        {"google_id": idinfo.get("sub")},
                        {"email": idinfo.get("email")}
                    ]
                })
                
                if existing:
                    # Update last login time
                    user_info_collection.update_one(
                        {"_id": existing["_id"]},
                        {"$set": {"last_login": datetime.utcnow()}}
                    )
                    return {
                        "status": "success", 
                        "message": "User already exists", 
                        "user_id": str(existing["_id"]),
                        "profile_data": existing.get("google_profile", {})
                    }

                # Create new user only if doesn't exist
                google_profile_data = {
                    "email": idinfo.get("email"),
                    "username": idinfo.get("name"),
                    "given_name": idinfo.get("given_name"),
                    "family_name": idinfo.get("family_name"),
                    "locale": idinfo.get("locale"),
                    "picture_url": idinfo.get("picture"),
                    "email_verified": idinfo.get("email_verified", False),
                    "google_id": idinfo.get("sub")
                }

                user_doc = {
                    "username": google_profile_data["username"],
                    "email": google_profile_data["email"],
                    "auth_type": "google",
                    "google_profile": google_profile_data,
                    "google_id": idinfo.get("sub"),
                    "created_at": datetime.utcnow(),
                    "last_login": datetime.utcnow()
                }
                
                inserted = user_info_collection.insert_one(user_doc)
                return {
                    "status": "success", 
                    "user_id": str(inserted.inserted_id),
                    "profile_data": google_profile_data
                }

            except Exception as e:
                return {"status": "error", "message": f"Invalid Google token: {str(e)}"}

        else:
            # Normal signup case (unchanged)
            username = data.get("username")
            email = data.get("email")
            password = data.get("password")

            if not all([username, email, password]):
                return {"status": "error", "message": "Missing fields"}

            if user_info_collection.find_one({"email": email}):
                return {"status": "error", "message": "Email already registered"}
            
            user_doc = {
                "username": username,
                "email": email,
                "password": password,
                "auth_type": "manual",
                "created_at": datetime.utcnow(),
                "last_login": datetime.utcnow()
            }
            inserted = user_info_collection.insert_one(user_doc)
            return {"status": "success", "user_id": str(inserted.inserted_id)}

    except Exception as e:
        print(f"Signup error: {e}")
        return {"status": "error", "message": str(e)}
    
def login_user(data: dict, is_google: bool = False) -> dict:
    try:
        if is_google:
            token = data.get("token")
            if not token:
                return {"status": "error", "message": "Missing Google token"}

            try:
                idinfo = id_token.verify_oauth2_token(token, google_requests.Request())

                # First check by google_id
                existing = user_info_collection.find_one({"google_id": idinfo.get("sub")})
                if existing:
                    # Update last login time
                    user_info_collection.update_one(
                        {"_id": existing["_id"]},
                        {"$set": {"last_login": datetime.utcnow()}}
                    )
                    return {
                        "status": "success",
                        "message": "Login successful",
                        "user_id": str(existing["_id"]),
                        "profile_data": existing.get("google_profile", {})
                    }

                # If not found by google_id, check by email
                existing = user_info_collection.find_one({"email": idinfo.get("email")})
                if existing:
                    # Update with google info if not already linked
                    user_info_collection.update_one(
                        {"_id": existing["_id"]},
                        {
                            "$set": {
                                "google_id": idinfo.get("sub"),
                                "google_profile": {
                                    "email": idinfo.get("email"),
                                    "username": idinfo.get("name"),
                                    "given_name": idinfo.get("given_name"),
                                    "family_name": idinfo.get("family_name"),
                                    "locale": idinfo.get("locale"),
                                    "picture_url": idinfo.get("picture"),
                                    "email_verified": idinfo.get("email_verified", False),
                                    "google_id": idinfo.get("sub")
                                },
                                "last_login": datetime.utcnow()
                            }
                        }
                    )
                    return {
                        "status": "success",
                        "message": "Login successful (account linked)",
                        "user_id": str(existing["_id"]),
                        "profile_data": existing.get("google_profile", {})
                    }

                # If no existing user, create new one
                google_profile_data = {
                    "email": idinfo.get("email"),
                    "username": idinfo.get("name"),
                    "given_name": idinfo.get("given_name"),
                    "family_name": idinfo.get("family_name"),
                    "locale": idinfo.get("locale"),
                    "picture_url": idinfo.get("picture"),
                    "email_verified": idinfo.get("email_verified", False),
                    "google_id": idinfo.get("sub")
                }

                user_doc = {
                    "username": google_profile_data["username"],
                    "email": google_profile_data["email"],
                    "auth_type": "google",
                    "google_profile": google_profile_data,
                    "google_id": idinfo.get("sub"),
                    "created_at": datetime.utcnow(),
                    "last_login": datetime.utcnow()
                }

                inserted = user_info_collection.insert_one(user_doc)
                return {
                    "status": "success",
                    "message": "New Google user created",
                    "user_id": str(inserted.inserted_id),
                    "profile_data": google_profile_data
                }

            except Exception as e:
                return {"status": "error", "message": f"Invalid Google token: {str(e)}"}

        else:
            # Manual login (existing code remains same)
            email = data.get("email")
            password = data.get("password")

            if not all([email, password]):
                return {"status": "error", "message": "Missing fields"}

            user = user_info_collection.find_one({"email": email, "auth_type": "manual"})
            if not user:
                return {"status": "error", "message": "User not found"}

            if user["password"] != password:
                return {"status": "error", "message": "Incorrect password"}

            # Update last login time
            user_info_collection.update_one(
                {"_id": user["_id"]},
                {"$set": {"last_login": datetime.utcnow()}}
            )

            return {
                "status": "success",
                "message": "Login successful",
                "user_id": str(user["_id"]),
                "profile_data": {
                    "email": user["email"],
                    "username": user["username"],
                }
            }

    except Exception as e:
        return {"status": "error", "message": str(e)}

def handle_image_upload(image_data_list, user_id, chat_id, prompt=None):
    try:
        image_urls = []
        image_ids = []
        image_binaries = []
        temp_file_paths = []

        # Save and collect info
        for image_data in image_data_list:
            filename = save_image(image_data)
            image_url = f"/image/{filename}"
            image_urls.append(image_url)
            image_ids.append(str(uuid.uuid4()))
            image_binaries.append(Binary(image_data))

            # Save temp file for LLM
            with tempfile.NamedTemporaryFile(delete=False, suffix=".png") as tmp_file:
                tmp_file.write(image_data)
                temp_file_paths.append(tmp_file.name)

        # Process with LLM if prompt exists
        llm_response = None
        if prompt:
            try:
                history_messages = get_chat_history(user_id, chat_id)
                llm_response = process_image_with_llm(
                    temp_file_paths, prompt, history=history_messages
                )
            except Exception as e:
                print(f"Error processing image with LLM: {str(e)}")
                llm_response = f"Error analyzing images: {str(e)}"

        # Clean up temp files
        for path in temp_file_paths:
            try:
                os.remove(path)
            except:
                pass

        # Save to uploaded_images collection
        image_doc = {
            "user_id": user_id,
            "chat_id": chat_id,
            "prompt": prompt,
            "image_data": image_binaries,
            "image_urls": image_urls,
            "image_ids": image_ids,
            "llm_response": llm_response,
            "created_at": datetime.utcnow(),
        }
        uploaded_images_collection.insert_one(image_doc)

        # Prepare success response
        response_data = {
            "status": "success",
            "image_ids": image_ids,
            "image_urls": image_urls,
            "message": "Images uploaded successfully",
            "llm_response": llm_response,
            "response": llm_response  # For backward compatibility
        }

        # Save to user's chat collection
        user_chats_col = get_user_conversations_collection(user_id)
        chat_doc = {
            "message_id": str(ObjectId()),
            "user_id": user_id,
            "chat_id": chat_id,
            "type": "image-upload",
            "prompt": prompt or "",
            "image_urls": image_urls,
            "response": llm_response or "Images received",
            "timestamp": datetime.utcnow()
        }
        
        # Update or create chat document
        user_chats_col.update_one(
            {"chat_id": chat_id},
            {
                "$setOnInsert": {
                    "title": prompt[:50] + "..." if prompt else "Image Upload",
                    "created_at": datetime.utcnow()
                },
                "$push": {"messages": chat_doc},
                "$set": {"updated_at": datetime.utcnow()}
            },
            upsert=True
        )

        return response_data

    except Exception as e:
        error_msg = f"Error uploading images: {str(e)}"
        print(error_msg)
        return {
            "status": "error",
            "error": str(e),
            "message": error_msg,
            "response": error_msg  # Ensure this exists
        }

def get_user_conversations_collection(user_id: str):
    """Get or create a conversations collection for a specific user"""
    return db[f"{user_id}"]

def users_info(user_id: str):
    chats_collection = get_user_conversations_collection(user_id)
    
    chat_docs = chats_collection.find({}, {"chat_id": 1, "title": 1, "created_at": 1,"messages":1})
    
    return chat_docs


def get_generated_images_collection():
    """Get the global generated images collection"""
    return db["generated_images"]


def search_web(query: str) -> str:
    print("Searching the web for: ", query)
    results = []
    with DDGS() as ddgs:
        for r in ddgs.text(query, max_results=10):
            snippet = f"{r['title']}: {r['body']}"
            results.append(snippet)
    return "\n".join(results)


def should_generate_image(prompt: str) -> bool:
    """Use the LLM to determine if the prompt is requesting an image generation"""
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    decision_prompt = f"""
    Analyze the following user prompt to determine if the user is requesting an image to be generated.

    User Prompt: "{prompt}"

    Respond ONLY with 'YES' or 'NO' and nothing else.
    """

    data = {
        "model": "meta-llama/llama-4-scout-17b-16e-instruct",
        "messages": [{"role": "user", "content": decision_prompt}],
        "temperature": 0.5,
        "max_tokens": 3,
    }

    try:
        response = requests.post(API_URL, headers=headers, json=data, timeout=10)
        response.raise_for_status()
        result = response.json()
        decision = result["choices"][0]["message"]["content"].strip().upper()
        return decision == "YES"
    except Exception as e:
        print(f"Error determining image generation need: {e}")
        return False

def generate_image(prompt: str, user_id: str) -> dict:
    """Generate an image using Stability AI's API"""
    print(f"Generating image for prompt: {prompt}")
    
    headers = {
        "Authorization": f"Bearer {STABILITY_API_KEY}",
        "Content-Type": "application/json"
    }
    
    data = {
        "text_prompts": [{"text": prompt, "weight": 1}],
        "cfg_scale": 7,
        "height": 1024,
        "width": 1024,
        "samples": 1,
        "steps": 30,
    }
    
    try:
        response = requests.post(STABILITY_API_URL, headers=headers, json=data, timeout=30)
        response.raise_for_status()
        response_data = response.json()
        
        if not response_data.get("artifacts"):
            raise Exception("No image artifacts in response")
            
        image_data = response_data["artifacts"][0]["base64"]
        image_bytes = base64.b64decode(image_data)
        
        # Save image information to the global images collection
        images_col = get_generated_images_collection()
        image_doc = {
            "user_id": user_id,
            "prompt": prompt,
            "generated_at": datetime.utcnow(),
            "model": "stable-diffusion-xl-1024-v1-0",
            "image_data": image_data  # Storing base64 for simplicity
        }
        image_id = images_col.insert_one(image_doc).inserted_id
        
        return {
            "type": "image",
            "image_bytes": image_bytes,
            "description": f"Generated image based on: '{prompt}'",
            "image_id": str(image_id)
        }
    except Exception as e:
        print(f"Image generation failed: {e}")
        raise

def should_perform_search(prompt: str, model_response: str) -> bool:
    """Determine if a web search is truly needed for this prompt"""
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json",
    }

    decision_prompt = f"""
    Analyze the user's prompt and decide if a web search is ABSOLUTELY NECESSARY to answer correctly.
    Web search should ONLY be performed if:
    1. The question is about very recent events (last few days/weeks)
    2. The question requires real-time data (stock prices, sports scores, etc.)
    3. Your initial response indicates you don't know the answer
    4. The question is about specific facts not in your training data (after 2023)

    User Prompt: "{prompt}"
    Your Initial Response: "{model_response}"

    If any of the above conditions are met, respond with 'YES'.
    Otherwise, respond with 'NO'.

    Respond ONLY with 'YES' or 'NO' and nothing else.
    """

    data = {
        "model": "meta-llama/llama-4-scout-17b-16e-instruct",
        "messages": [{"role": "user", "content": decision_prompt}],
        "temperature": 0.1,  # Lower temperature for more deterministic responses
        "max_tokens": 3,
    }

    try:
        response = requests.post(API_URL, headers=headers, json=data, timeout=10)
        response.raise_for_status()
        result = response.json()
        decision = result["choices"][0]["message"]["content"].strip().upper()
        return decision == "YES"
    except Exception as e:
        print(f"Error determining search need: {e}")
        return False  # Default to no search if there's an error


def save_conversation(
    user_id: str,
    chat_id: str,
    prompt: str,
    response: str,
    title: str = None,
    is_image: bool = False,
):
    """Save conversation with title handling"""
    conversations_col = get_user_conversations_collection(user_id)

    chat = conversations_col.find_one({"chat_id": chat_id})

    if not chat:
        # New chat - use provided title or generate from prompt
        chat_title = (
            title
            if title
            else f"Chat: {prompt[:30]}..." if len(prompt) > 30 else f"Chat: {prompt}"
        )
        chat_doc = {
            "chat_id": chat_id,
            "user_id": user_id,
            "title": chat_title,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "messages": [],
        }
        conversations_col.insert_one(chat_doc)

    # Add message
    message = {
        "message_id": str(ObjectId()),
        "prompt": prompt,
        "response": response if not is_image else f"IMAGE:{response}",
        "is_image": is_image,
        "timestamp": datetime.utcnow(),
    }

    conversations_col.update_one(
        {"chat_id": chat_id},
        {"$push": {"messages": message}, "$set": {"updated_at": datetime.utcnow()}},
    )

    print(f"Saved conversation for user {user_id} in chat {chat_id}")


def get_chat_history(user_id: str, chat_id: str, limit: int = 15):
    """Get the conversation history for a specific chat"""
    conversations_col = get_user_conversations_collection(user_id)
    chat = conversations_col.find_one({"chat_id": chat_id})

    if not chat or "messages" not in chat:
        return []

    # Return the most recent messages up to the limit
    return chat["messages"][-limit:]

def get_user_chats(user_id: str):
    conversations_col = get_user_conversations_collection(user_id)
    return list(
        conversations_col.find(
            {}, {"chat_id": 1, "title": 1, "created_at": 1, "updated_at": 1, "messages": 1}
        )
    )
    
def get_user_info(user_id: str):
    user_info = user_info_collection.find_one({"_id": ObjectId(user_id)})
    if not user_info:
        return None

    # Convert Mongo ObjectId to string for JSON serialization
    user_info["_id"] = str(user_info["_id"])
    
    # Return only necessary fields
    return {
        "user_id": user_info["_id"],
        "username": user_info.get("username"),
        "email": user_info.get("email"),
        "created_at": user_info.get("created_at").isoformat(),
        "last_login": user_info.get("last_login").isoformat(),
        "auth_type": user_info.get("auth_type"),
        "google_profile": user_info.get("google_profile", {})
    }

def rename_chat(user_id: str, chat_id: str, new_title: str):
    """Rename a chat"""
    conversations_col = get_user_conversations_collection(user_id)
    conversations_col.update_one(
        {"chat_id": chat_id},
        {"$set": {"title": new_title, "updated_at": datetime.utcnow()}},
    )


def delete_chat(user_id: str, chat_id: str):
    """Delete a chat and its messages"""
    conversations_col = get_user_conversations_collection(user_id)
    conversations_col.delete_one({"chat_id": chat_id})


def generate_response(
    prompt: str, user_id: str = "guest", chat_id: str = "default", title: str = None
):
    print(f"Processing prompt for user {user_id} in chat {chat_id}: {prompt}")
    
    try:
        # Image generation logic
        if should_generate_image(prompt):
            try:
                image_result = generate_image(prompt, user_id)
                save_conversation(user_id, chat_id, prompt, image_result["image_id"], title=title, is_image=True)
                return {
                    "type": "image",
                    "image_bytes": image_result["image_bytes"],
                    "description": image_result.get("description", ""),
                    "image_id": image_result["image_id"],
                    "content": image_result.get("description", ""),
                    "response": image_result.get("description", "")  # Ensure this exists
                }
            except Exception as e:
                error_msg = f"Failed to generate image. Error: {str(e)}"
                return {
                    "type": "text",
                    "content": error_msg,
                    "response": error_msg
                }
                
        # Normal text response flow
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }

        history_messages = get_chat_history(user_id, chat_id)
        llm_messages = []

        # Prepare message history
        for msg in history_messages:
            content = msg.get("prompt", "") if msg.get("sender") == "user" else msg.get("response", "")
            if not content:
                continue
                
            if msg.get("is_image", False) or msg.get("type") == "image-upload":
                if msg.get("sender") == "user":
                    llm_messages.append({
                        "role": "user",
                        "content": f"(Image Upload)\nPrompt: {msg.get('prompt', '')}",
                    })
                else:
                    llm_messages.append({
                        "role": "assistant",
                        "content": f"(Image-based response)\n{msg.get('response', '').replace('IMAGE:', '')}",
                    })
            else:
                role = "user" if msg.get("sender") == "user" else "assistant"
                llm_messages.append({
                    "role": role,
                    "content": content
                })

        # Add current prompt
        llm_messages.append({
            "role": "user",
            "content": prompt,
        })

        try:
            # Initial LLM request
            response = requests.post(
                API_URL,
                headers=headers,
                json={
                    "model": "meta-llama/llama-4-scout-17b-16e-instruct",
                    "messages": llm_messages,
                    "temperature": 0.3,
                    "max_tokens": 2048,
                },
                timeout=30
            )
            response.raise_for_status()
            response_data = response.json()
            reply = response_data["choices"][0]["message"]["content"]

            save_conversation(user_id, chat_id, prompt, reply, title=title)
            return {
                "type": "text",
                "content": reply,
                "response": reply  # Ensure this exists
            }

        except Exception as e:
            error_msg = f"Error processing your request: {str(e)}"
            print(f"API Error: {error_msg}")
            return {
                "type": "text",
                "content": error_msg,
                "response": error_msg
            }

    except Exception as e:
        error_msg = f"Unexpected error: {str(e)}"
        print(f"General Error: {error_msg}")
        return {
            "type": "text",
            "content": error_msg,
            "response": error_msg
        }