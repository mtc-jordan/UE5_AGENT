"""
API Keys Management Endpoints
Securely store and manage API keys for various AI providers
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional, Dict
import os
import json
import hashlib
from pathlib import Path
import httpx

router = APIRouter(prefix="/settings/api-keys", tags=["API Keys"])

# Secure storage path for API keys
API_KEYS_FILE = Path("/home/ubuntu/UE5_AGENT/backend/.api_keys.json")

class ApiKeyRequest(BaseModel):
    provider: str
    key: str

class ApiKeyResponse(BaseModel):
    valid: bool
    error: Optional[str] = None

def load_api_keys() -> Dict[str, str]:
    """Load API keys from secure storage"""
    if API_KEYS_FILE.exists():
        try:
            with open(API_KEYS_FILE, 'r') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_api_keys(keys: Dict[str, str]):
    """Save API keys to secure storage"""
    API_KEYS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(API_KEYS_FILE, 'w') as f:
        json.dump(keys, f)
    # Set restrictive permissions
    os.chmod(API_KEYS_FILE, 0o600)

def mask_key(key: str) -> str:
    """Mask an API key for display"""
    if len(key) <= 8:
        return "••••••••"
    return key[:4] + "••••••••" + key[-4:]

async def validate_openai_key(key: str) -> tuple[bool, Optional[str]]:
    """Validate OpenAI API key"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.openai.com/v1/models",
                headers={"Authorization": f"Bearer {key}"},
                timeout=10.0
            )
            if response.status_code == 200:
                return True, None
            elif response.status_code == 401:
                return False, "Invalid API key"
            else:
                return False, f"API error: {response.status_code}"
    except Exception as e:
        return False, str(e)

async def validate_deepseek_key(key: str) -> tuple[bool, Optional[str]]:
    """Validate DeepSeek API key"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.deepseek.com/v1/models",
                headers={"Authorization": f"Bearer {key}"},
                timeout=10.0
            )
            if response.status_code == 200:
                return True, None
            elif response.status_code == 401:
                return False, "Invalid API key"
            else:
                # DeepSeek might return different status codes
                return True, None  # Assume valid if not 401
    except Exception as e:
        # If we can't reach the API, assume the key format is valid
        if key.startswith("sk-"):
            return True, None
        return False, str(e)

async def validate_anthropic_key(key: str) -> tuple[bool, Optional[str]]:
    """Validate Anthropic API key"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                "https://api.anthropic.com/v1/models",
                headers={
                    "x-api-key": key,
                    "anthropic-version": "2023-06-01"
                },
                timeout=10.0
            )
            if response.status_code == 200:
                return True, None
            elif response.status_code == 401:
                return False, "Invalid API key"
            else:
                # Anthropic might return different status codes
                return True, None
    except Exception as e:
        # If we can't reach the API, assume the key format is valid
        if key.startswith("sk-ant-"):
            return True, None
        return False, str(e)

async def validate_google_key(key: str) -> tuple[bool, Optional[str]]:
    """Validate Google Gemini API key"""
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"https://generativelanguage.googleapis.com/v1/models?key={key}",
                timeout=10.0
            )
            if response.status_code == 200:
                return True, None
            elif response.status_code == 400 or response.status_code == 403:
                return False, "Invalid API key"
            else:
                return False, f"API error: {response.status_code}"
    except Exception as e:
        return False, str(e)

@router.get("")
async def get_api_keys_status():
    """Get the status of configured API keys (without exposing the actual keys)"""
    keys = load_api_keys()
    
    # Also check environment variables as fallback
    env_keys = {
        'openai': os.getenv('OPENAI_API_KEY'),
        'deepseek': os.getenv('DEEPSEEK_API_KEY'),
        'anthropic': os.getenv('ANTHROPIC_API_KEY'),
        'google': os.getenv('GOOGLE_API_KEY')
    }
    
    return {
        'openai': bool(keys.get('openai') or env_keys['openai']),
        'deepseek': bool(keys.get('deepseek') or env_keys['deepseek']),
        'anthropic': bool(keys.get('anthropic') or env_keys['anthropic']),
        'google': bool(keys.get('google') or env_keys['google'])
    }

@router.post("")
async def save_api_key(request: ApiKeyRequest) -> ApiKeyResponse:
    """Save and validate an API key"""
    provider = request.provider.lower()
    key = request.key.strip()
    
    if provider not in ['openai', 'deepseek', 'anthropic', 'google']:
        raise HTTPException(status_code=400, detail="Invalid provider")
    
    if not key:
        raise HTTPException(status_code=400, detail="API key is required")
    
    # Validate the key
    validators = {
        'openai': validate_openai_key,
        'deepseek': validate_deepseek_key,
        'anthropic': validate_anthropic_key,
        'google': validate_google_key
    }
    
    valid, error = await validators[provider](key)
    
    if valid:
        # Save the key
        keys = load_api_keys()
        keys[provider] = key
        save_api_keys(keys)
        
        # Also set as environment variable for immediate use
        env_var_names = {
            'openai': 'OPENAI_API_KEY',
            'deepseek': 'DEEPSEEK_API_KEY',
            'anthropic': 'ANTHROPIC_API_KEY',
            'google': 'GOOGLE_API_KEY'
        }
        os.environ[env_var_names[provider]] = key
        
        return ApiKeyResponse(valid=True)
    else:
        return ApiKeyResponse(valid=False, error=error)

@router.delete("/{provider}")
async def delete_api_key(provider: str):
    """Delete an API key"""
    provider = provider.lower()
    
    if provider not in ['openai', 'deepseek', 'anthropic', 'google']:
        raise HTTPException(status_code=400, detail="Invalid provider")
    
    keys = load_api_keys()
    if provider in keys:
        del keys[provider]
        save_api_keys(keys)
    
    # Also remove from environment
    env_var_names = {
        'openai': 'OPENAI_API_KEY',
        'deepseek': 'DEEPSEEK_API_KEY',
        'anthropic': 'ANTHROPIC_API_KEY',
        'google': 'GOOGLE_API_KEY'
    }
    if env_var_names[provider] in os.environ:
        del os.environ[env_var_names[provider]]
    
    return {"success": True}

@router.get("/test/{provider}")
async def test_api_key(provider: str):
    """Test if an API key is working"""
    provider = provider.lower()
    
    if provider not in ['openai', 'deepseek', 'anthropic', 'google']:
        raise HTTPException(status_code=400, detail="Invalid provider")
    
    keys = load_api_keys()
    key = keys.get(provider) or os.getenv({
        'openai': 'OPENAI_API_KEY',
        'deepseek': 'DEEPSEEK_API_KEY',
        'anthropic': 'ANTHROPIC_API_KEY',
        'google': 'GOOGLE_API_KEY'
    }[provider])
    
    if not key:
        return {"valid": False, "error": "No API key configured"}
    
    validators = {
        'openai': validate_openai_key,
        'deepseek': validate_deepseek_key,
        'anthropic': validate_anthropic_key,
        'google': validate_google_key
    }
    
    valid, error = await validators[provider](key)
    return {"valid": valid, "error": error}


def get_api_key(provider: str) -> Optional[str]:
    """
    Get an API key for a provider.
    First checks stored keys, then falls back to environment variables.
    This function can be imported and used by other services.
    """
    keys = load_api_keys()
    
    env_var_names = {
        'openai': 'OPENAI_API_KEY',
        'deepseek': 'DEEPSEEK_API_KEY',
        'anthropic': 'ANTHROPIC_API_KEY',
        'google': 'GOOGLE_API_KEY'
    }
    
    # First check stored keys
    if provider in keys and keys[provider]:
        return keys[provider]
    
    # Fall back to environment variable
    return os.getenv(env_var_names.get(provider, ''))
