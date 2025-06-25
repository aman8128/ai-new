import requests
from datetime import datetime
from pymongo import MongoClient
from duckduckgo_search import DDGS
import base64
from io import BytesIO
from PIL import Image
from bson import ObjectId

# Configuration
GROQ_API_KEY = "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"
STABILITY_API_KEY = "sk-3UnY9eVsTHi0V0NCCa5mVY61FwL4djjKakG7V3ePqs9vorgi"
API_URL = "https://api.groq.com/openai/v1/chat/completions"
STABILITY_API_URL = "https://api.stability.ai/v1/generation/stable-diffusion-xl-1024-v1-0/text-to-image"

# MongoDB setup
client = MongoClient("mongodb://localhost:27017/")
db = client["ai_new"]

def get_user_conversations_collection(user_id: str):
    """Get or create a conversations collection for a specific user"""
    return db[f"{user_id}"]

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
        "Content-Type": "application/json"
    }
    
    decision_prompt = f"""
    Analyze the following user prompt to determine if the user is requesting an image to be generated.

    User Prompt: "{prompt}"

    Respond ONLY with 'YES' or 'NO' and nothing else.
    """
    
    data = {
        "model": "meta-llama/llama-4-maverick-17b-128e-instruct",
        "messages": [{"role": "user", "content": decision_prompt}],
        "temperature": 0.7,
        "max_tokens": 3
    }
    
    try:
        response = requests.post(API_URL, headers=headers, json=data, timeout=10)
        response.raise_for_status()
        result = response.json()
        decision = result['choices'][0]['message']['content'].strip().upper()
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
    """Let the model decide if it needs web search"""
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    
    decision_prompt = f"""
    Should I perform a web search to improve this response?

    User Prompt: {prompt}
    Initial Response: {model_response}

    Respond ONLY with 'YES' or 'NO' and nothing else.
    """
    
    data = {
        "model": "meta-llama/llama-4-maverick-17b-128e-instruct",
        "messages": [{"role": "user", "content": decision_prompt}],
        "temperature": 0.2,
        "max_tokens": 3
    }
    
    response = requests.post(API_URL, headers=headers, json=data)
    result = response.json()
    decision = result['choices'][0]['message']['content'].strip().upper()
    
    return decision == "YES"

def save_conversation(user_id: str, chat_id: str, prompt: str, response: str, title: str = None, is_image: bool = False):
    """Save conversation with title handling"""
    conversations_col = get_user_conversations_collection(user_id)
    
    chat = conversations_col.find_one({"chat_id": chat_id})
    
    if not chat:
        # New chat - use provided title or generate from prompt
        chat_title = title if title else f"Chat: {prompt[:30]}..." if len(prompt) > 30 else f"Chat: {prompt}"
        chat_doc = {
            "chat_id": chat_id,
            "user_id": user_id,
            "title": chat_title,
            "created_at": datetime.utcnow(),
            "updated_at": datetime.utcnow(),
            "messages": []
        }
        conversations_col.insert_one(chat_doc)
    
    # Add message
    message = {
        "message_id": str(ObjectId()),
        "prompt": prompt,
        "response": response if not is_image else f"IMAGE:{response}",
        "is_image": is_image,
        "timestamp": datetime.utcnow()
    }
    
    conversations_col.update_one(
        {"chat_id": chat_id},
        {
            "$push": {"messages": message},
            "$set": {"updated_at": datetime.utcnow()}
        }
    )
    
    print(f"Saved conversation for user {user_id} in chat {chat_id}")

def get_chat_history(user_id: str, chat_id: str, limit: int = 20):
    """Get the conversation history for a specific chat"""
    conversations_col = get_user_conversations_collection(user_id)
    chat = conversations_col.find_one({"chat_id": chat_id})
    
    if not chat or "messages" not in chat:
        return []
    
    # Return the most recent messages up to the limit
    return chat["messages"][-limit:]

def get_user_chats(user_id: str):
    """Get all chat summaries for a user"""
    conversations_col = get_user_conversations_collection(user_id)
    return list(conversations_col.find({}, {"chat_id": 1, "title": 1, "created_at": 1, "updated_at": 1}))

def rename_chat(user_id: str, chat_id: str, new_title: str):
    """Rename a chat"""
    conversations_col = get_user_conversations_collection(user_id)
    conversations_col.update_one(
        {"chat_id": chat_id},
        {"$set": {"title": new_title, "updated_at": datetime.utcnow()}}
    )

def delete_chat(user_id: str, chat_id: str):
    """Delete a chat and its messages"""
    conversations_col = get_user_conversations_collection(user_id)
    conversations_col.delete_one({"chat_id": chat_id})

def generate_response(prompt: str, user_id: str = "guest", chat_id: str = "default", title: str = None):
    print(f"Processing prompt for user {user_id} in chat {chat_id}: {prompt}")
    
    try:
        # Image generation logic (same as before)
        if should_generate_image(prompt):
            try:
                image_result = generate_image(prompt, user_id)
                save_conversation(user_id, chat_id, prompt, image_result["image_id"], title=title, is_image=True)
                return image_result
            except Exception as e:
                return {
                    "type": "text",
                    "content": f"Failed to generate image. Error: {str(e)}"
                }
                
        # Normal text response flow
        headers = {
            "Authorization": f"Bearer {GROQ_API_KEY}",
            "Content-Type": "application/json"
        }

        # Get the conversation history
        history_messages = get_chat_history(user_id, chat_id)
        
        # Prepare the message history for the LLM
        llm_messages = []
        for msg in history_messages:
            if not msg.get("is_image", False):
                llm_messages.append({"role": "user", "content": msg["prompt"]})
                llm_messages.append({"role": "assistant", "content": msg["response"]})
        
        # Add the current prompt
        llm_messages.append({"role": "user", "content": prompt})

        initial_data = {
            "model": "meta-llama/llama-4-maverick-17b-128e-instruct",
            "messages": llm_messages,
            "temperature": 0.7,
            "max_tokens": 2048
        }

        initial_response = requests.post(API_URL, headers=headers, json=initial_data, timeout=30)
        initial_response.raise_for_status()
        initial_result = initial_response.json()
        initial_reply = initial_result['choices'][0]['message']['content']
        
        if should_perform_search(prompt, initial_reply):
            web_data = search_web(prompt)
            enhanced_prompt = f"{prompt}\n\n[Web search context]:\n{web_data}"
            
            enhanced_history = llm_messages.copy()
            enhanced_history[-1]["content"] = enhanced_prompt
            
            enhanced_response = requests.post(API_URL, headers=headers, json={
                "model": "meta-llama/llama-4-maverick-17b-128e-instruct",
                "messages": enhanced_history,
                "temperature": 0.3,
                "max_tokens": 2048
            }, timeout=30)
            enhanced_response.raise_for_status()
            final_reply = enhanced_response.json()['choices'][0]['message']['content']
        else:
            final_reply = initial_reply

        save_conversation(user_id, chat_id, prompt, final_reply, title=title)
        return {
            "type": "text",
            "content": final_reply
        }

    except Exception as e:
        print(f"Error in text generation: {e}")
        return {
            "type": "text",
            "content": f"Sorry, I encountered an error: {str(e)}"
        }