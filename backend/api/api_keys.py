"""
API Keys Management Endpoints
Securely store and manage API keys for various AI providers with usage tracking
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional, Dict, List
from datetime import datetime
import os
import json
import hashlib
from pathlib import Path
import httpx

from services.auth import get_current_user
from models.user import User

router = APIRouter(prefix="/settings/api-keys", tags=["API Keys"])

# Secure storage path for API keys
API_KEYS_FILE = Path("/home/ubuntu/UE5_AGENT/backend/.api_keys.json")
API_KEYS_USAGE_FILE = Path("/home/ubuntu/UE5_AGENT/backend/.api_keys_usage.json")

class ApiKeyRequest(BaseModel):
    provider: str
    key: str

class ApiKeyResponse(BaseModel):
    valid: bool
    error: Optional[str] = None
    masked_key: Optional[str] = None

class ApiKeyInfo(BaseModel):
    provider: str
    configured: bool
    masked_key: Optional[str] = None
    valid: Optional[bool] = None
    last_tested: Optional[str] = None
    usage_count: int = 0
    last_used: Optional[str] = None

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

def load_usage_stats() -> Dict[str, Dict]:
    """Load API key usage statistics"""
    if API_KEYS_USAGE_FILE.exists():
        try:
            with open(API_KEYS_USAGE_FILE, 'r') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_usage_stats(stats: Dict[str, Dict]):
    """Save API key usage statistics"""
    API_KEYS_USAGE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(API_KEYS_USAGE_FILE, 'w') as f:
        json.dump(stats, f)
    os.chmod(API_KEYS_USAGE_FILE, 0o600)

def update_usage(provider: str):
    """Update usage statistics for a provider"""
    stats = load_usage_stats()
    if provider not in stats:
        stats[provider] = {"usage_count": 0, "last_used": None}
    
    stats[provider]["usage_count"] = stats[provider].get("usage_count", 0) + 1
    stats[provider]["last_used"] = datetime.utcnow().isoformat()
    save_usage_stats(stats)

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

@router.get("", response_model=List[ApiKeyInfo])
async def get_api_keys_status(current_user: User = Depends(get_current_user)):
    """Get the status of all configured API keys with usage stats"""
    keys = load_api_keys()
    usage_stats = load_usage_stats()
    
    # Also check environment variables as fallback
    env_keys = {
        'openai': os.getenv('OPENAI_API_KEY'),
        'deepseek': os.getenv('DEEPSEEK_API_KEY'),
        'anthropic': os.getenv('ANTHROPIC_API_KEY'),
        'google': os.getenv('GOOGLE_API_KEY')
    }
    
    providers = ['openai', 'deepseek', 'anthropic', 'google']
    result = []
    
    for provider in providers:
        key = keys.get(provider) or env_keys[provider]
        configured = bool(key)
        stats = usage_stats.get(provider, {})
        
        result.append(ApiKeyInfo(
            provider=provider,
            configured=configured,
            masked_key=mask_key(key) if key else None,
            usage_count=stats.get("usage_count", 0),
            last_used=stats.get("last_used")
        ))
    
    return result

@router.get("/{provider}", response_model=ApiKeyInfo)
async def get_api_key_info(
    provider: str,
    current_user: User = Depends(get_current_user)
):
    """Get information about a specific API key"""
    provider = provider.lower()
    
    if provider not in ['openai', 'deepseek', 'anthropic', 'google']:
        raise HTTPException(status_code=400, detail="Invalid provider")
    
    keys = load_api_keys()
    usage_stats = load_usage_stats()
    
    env_var_names = {
        'openai': 'OPENAI_API_KEY',
        'deepseek': 'DEEPSEEK_API_KEY',
        'anthropic': 'ANTHROPIC_API_KEY',
        'google': 'GOOGLE_API_KEY'
    }
    
    key = keys.get(provider) or os.getenv(env_var_names[provider])
    configured = bool(key)
    stats = usage_stats.get(provider, {})
    
    return ApiKeyInfo(
        provider=provider,
        configured=configured,
        masked_key=mask_key(key) if key else None,
        usage_count=stats.get("usage_count", 0),
        last_used=stats.get("last_used")
    )

@router.post("", response_model=ApiKeyResponse)
async def save_api_key(
    request: ApiKeyRequest,
    current_user: User = Depends(get_current_user)
):
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
        
        # Update usage stats with validation timestamp
        stats = load_usage_stats()
        if provider not in stats:
            stats[provider] = {"usage_count": 0}
        stats[provider]["last_tested"] = datetime.utcnow().isoformat()
        stats[provider]["valid"] = True
        save_usage_stats(stats)
        
        # Also set as environment variable for immediate use
        env_var_names = {
            'openai': 'OPENAI_API_KEY',
            'deepseek': 'DEEPSEEK_API_KEY',
            'anthropic': 'ANTHROPIC_API_KEY',
            'google': 'GOOGLE_API_KEY'
        }
        os.environ[env_var_names[provider]] = key
        
        return ApiKeyResponse(valid=True, masked_key=mask_key(key))
    else:
        return ApiKeyResponse(valid=False, error=error)

@router.put("/{provider}", response_model=ApiKeyResponse)
async def update_api_key(
    provider: str,
    request: ApiKeyRequest,
    current_user: User = Depends(get_current_user)
):
    """Update an existing API key (alias for save)"""
    request.provider = provider
    return await save_api_key(request, current_user)

@router.delete("/{provider}")
async def delete_api_key(
    provider: str,
    current_user: User = Depends(get_current_user)
):
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
    
    return {"success": True, "message": f"{provider} API key deleted"}

@router.post("/{provider}/test")
async def test_api_key(
    provider: str,
    current_user: User = Depends(get_current_user)
):
    """Test if an API key is working and return available models"""
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
        return {"valid": False, "error": "No API key configured", "models": []}
    
    # Test connection and get models
    models = []
    valid = False
    error = None
    
    try:
        async with httpx.AsyncClient() as client:
            if provider == 'openai':
                response = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {key}"},
                    timeout=15.0
                )
                if response.status_code == 200:
                    valid = True
                    data = response.json()
                    models = [m['id'] for m in data.get('data', [])[:10]]
                elif response.status_code == 401:
                    error = "Invalid API key"
                else:
                    error = f"API error: {response.status_code}"
                    
            elif provider == 'deepseek':
                response = await client.get(
                    "https://api.deepseek.com/v1/models",
                    headers={"Authorization": f"Bearer {key}"},
                    timeout=15.0
                )
                if response.status_code == 200:
                    valid = True
                    data = response.json()
                    models = [m['id'] for m in data.get('data', [])[:10]]
                elif response.status_code == 401:
                    error = "Invalid API key"
                else:
                    valid = True  # Assume valid if not 401
                    models = ['deepseek-chat', 'deepseek-reasoner', 'deepseek-coder']
                    
            elif provider == 'anthropic':
                response = await client.get(
                    "https://api.anthropic.com/v1/models",
                    headers={
                        "x-api-key": key,
                        "anthropic-version": "2023-06-01"
                    },
                    timeout=15.0
                )
                if response.status_code == 200:
                    valid = True
                    data = response.json()
                    models = [m.get('id', m.get('name', '')) for m in data.get('data', data.get('models', []))[:10]]
                elif response.status_code == 401:
                    error = "Invalid API key"
                else:
                    valid = True  # Assume valid if not 401
                    models = ['claude-sonnet-4-5-20250929', 'claude-opus-4-5-20251101', 'claude-haiku-4-5-20251001']
                    
            elif provider == 'google':
                response = await client.get(
                    f"https://generativelanguage.googleapis.com/v1/models?key={key}",
                    timeout=15.0
                )
                if response.status_code == 200:
                    valid = True
                    data = response.json()
                    models = [m.get('name', '').replace('models/', '') for m in data.get('models', [])[:10]]
                elif response.status_code in [400, 403]:
                    error = "Invalid API key"
                else:
                    error = f"API error: {response.status_code}"
        
        # Update usage stats with test results
        if valid:
            stats = load_usage_stats()
            if provider not in stats:
                stats[provider] = {"usage_count": 0}
            stats[provider]["last_tested"] = datetime.utcnow().isoformat()
            stats[provider]["valid"] = True
            save_usage_stats(stats)
                    
    except Exception as e:
        error = f"Connection error: {str(e)}"
    
    return {"valid": valid, "error": error, "models": models, "masked_key": mask_key(key)}

@router.get("/{provider}/usage")
async def get_api_key_usage(
    provider: str,
    current_user: User = Depends(get_current_user)
):
    """Get usage statistics for an API key"""
    provider = provider.lower()
    
    if provider not in ['openai', 'deepseek', 'anthropic', 'google']:
        raise HTTPException(status_code=400, detail="Invalid provider")
    
    usage_stats = load_usage_stats()
    stats = usage_stats.get(provider, {})
    
    return {
        "provider": provider,
        "usage_count": stats.get("usage_count", 0),
        "last_used": stats.get("last_used"),
        "last_tested": stats.get("last_tested"),
        "valid": stats.get("valid")
    }


def get_api_key(provider: str) -> Optional[str]:
    """
    Get an API key for a provider.
    First checks stored keys, then falls back to environment variables.
    This function can be imported and used by other services.
    Also updates usage statistics.
    """
    keys = load_api_keys()
    
    env_var_names = {
        'openai': 'OPENAI_API_KEY',
        'deepseek': 'DEEPSEEK_API_KEY',
        'anthropic': 'ANTHROPIC_API_KEY',
        'google': 'GOOGLE_API_KEY'
    }
    
    # First check stored keys
    key = None
    if provider in keys and keys[provider]:
        key = keys[provider]
    else:
        # Fall back to environment variable
        key = os.getenv(env_var_names.get(provider, ''))
    
    # Update usage if key exists
    if key:
        update_usage(provider)
    
    return key
