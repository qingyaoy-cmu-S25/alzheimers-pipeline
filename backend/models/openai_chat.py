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

# Get API key and optional base URL from environment variables
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY') or os.getenv('AZURE_OPENAI_API_KEY')
OPENAI_BASE_URL = os.getenv('OPENAI_BASE_URL') or os.getenv('AZURE_OPENAI_ENDPOINT')
OPENAI_DEPLOYMENT = os.getenv('OPENAI_DEPLOYMENT') or os.getenv('AZURE_OPENAI_DEPLOYMENT')

if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY (or AZURE_OPENAI_API_KEY) environment variable is required. Set it in your environment or in backend/.env for local development.")

# Initialize OpenAI client. Support both public OpenAI and Azure OpenAI via BASE_URL.
if OPENAI_BASE_URL:
    # When using Azure OpenAI, set base_url to the Azure endpoint (can include /openai or /openai/v1)
    print(f"Initializing OpenAI client with Azure base URL: {OPENAI_BASE_URL}")
    openai_client = openai.OpenAI(base_url=OPENAI_BASE_URL, api_key=OPENAI_API_KEY)
else:
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

async def get_openai_streaming_response(messages: List[Dict[str, str]], model: str = None):
    """
    Get streaming response from OpenAI API (async version)
    
    Args:
        messages: List of message dictionaries with 'role' and 'content'
        model: OpenAI model to use
    
    Yields:
        str: Content chunks from the streaming response
    """
    try:
        # Determine model/deployment to call. For Azure, prefer OPENAI_DEPLOYMENT env var.
        chosen_model = model or OPENAI_DEPLOYMENT or os.getenv('OPENAI_MODEL') or 'gpt-3.5-turbo'
        print(f"Starting OpenAI stream for model/deployment: {chosen_model}")

        # Create completion request. Azure's deployments sometimes expect a different
        # parameter name for max tokens ('max_completion_tokens') instead of 'max_tokens'.
        # Default params
        request_kwargs = dict(
            model=chosen_model,
            messages=messages,
            stream=True,
        )

        # Temperature: some Azure deployments restrict allowed temperature values.
        # Use default (=1) for Azure endpoints to avoid 'unsupported value' errors.
        if OPENAI_BASE_URL:
            request_kwargs['temperature'] = 1
        else:
            request_kwargs['temperature'] = 0.7

        # If configured with an explicit base URL (likely Azure), use Azure-compatible param
        if OPENAI_BASE_URL:
            request_kwargs['max_completion_tokens'] = 2000
        else:
            request_kwargs['max_tokens'] = 2000

        response = openai_client.chat.completions.create(**request_kwargs)
        
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