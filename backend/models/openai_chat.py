import openai
from typing import List, Dict, Generator, Optional
import json
import os
from dotenv import load_dotenv
import pathlib

# Try loading .env from current working directory first, then explicitly
# attempt backend/.env (handles running scripts from repository root)
# Handle encoding issues gracefully
try:
    load_dotenv(encoding='utf-8')
except UnicodeDecodeError:
    try:
        load_dotenv()
    except Exception:
        pass
except Exception:
    pass

# Explicit fallback: load backend/.env relative to this file
try:
    base_dir = pathlib.Path(__file__).resolve().parent.parent  # backend/
    dotenv_path = base_dir / '.env'
    if dotenv_path.exists():
        try:
            load_dotenv(dotenv_path, encoding='utf-8')
        except UnicodeDecodeError:
            try:
                load_dotenv(dotenv_path)
            except Exception:
                pass
        except Exception:
            pass
except Exception:
    # ignore errors here, we'll check env var below
    pass

# Get API key from environment variable
OPENAI_API_KEY = "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"
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable is required. Set it in your environment or put it into backend/.env for local development.")

# Initialize OpenAI client
openai_client = openai.OpenAI(api_key=OPENAI_API_KEY)

def safe_extract_content(chunk) -> Optional[str]:
    """Safely extract content from OpenAI streaming response chunk"""
    try:
        if hasattr(chunk, 'choices') and len(chunk.choices) > 0:
            delta = chunk.choices[0].delta
            if hasattr(delta, 'content') and delta.content is not None:
                return delta.content
        return None
    except Exception as e:
        print(f"Error extracting content: {e}")
        return None

async def get_openai_streaming_response(messages: List[Dict[str, str]], model: str = "gpt-3.5-turbo"):
    """
    Get streaming response from OpenAI API (async version)
    
    Args:
        messages: List of message dictionaries with 'role' and 'content'
        model: OpenAI model to use
    
    Yields:
        str: Content chunks from the streaming response
    """
    try:
        print(f"Starting OpenAI stream for model: {model}")
        response = openai_client.chat.completions.create(
            model=model,
            messages=messages,
            temperature=0.7,
            max_tokens=2000,
            stream=True
        )
        
        chunk_count = 0
        for chunk in response:
            content = safe_extract_content(chunk)
            if content is not None:
                chunk_count += 1
                print(f"Chunk {chunk_count}: '{content}'")  # Debug log
                yield content
        
        print(f"Stream completed. Total chunks: {chunk_count}")
                
    except Exception as e:
        print(f"OpenAI API Error: {e}")
        yield f"Error: {str(e)}"

def format_messages(user_input: str, chat_history: List[Dict] = None) -> List[Dict[str, str]]:
    """
    Format messages for OpenAI API
    
    Args:
        user_input: Current user message
        chat_history: Previous conversation history
    
    Returns:
        List of formatted messages
    """
    messages = []
    
    # Add system message
    messages.append({
        "role": "system",
        "content": "You are a helpful AI assistant. Provide clear, accurate, and helpful responses."
    })
    
    # Add chat history if provided
    if chat_history:
        for msg in chat_history:
            if msg.get('role') in ['user', 'assistant']:
                messages.append({
                    "role": msg['role'],
                    "content": msg['content']
                })
    
    # Add current user message
    messages.append({
        "role": "user",
        "content": user_input
    })
    
    return messages