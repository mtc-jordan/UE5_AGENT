"""
Texture Generator API Endpoints

Provides REST API for AI-powered PBR texture generation.
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List, Tuple
import logging

from services.texture_generator import get_texture_generator, TextureCategory

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/texture-generator", tags=["Texture Generator"])


class GenerateTextureRequest(BaseModel):
    """Request model for texture generation"""
    prompt: str = Field(..., description="Texture description prompt")
    resolution: Tuple[int, int] = Field(default=(512, 512), description="Output resolution")
    seamless: bool = Field(default=True, description="Make texture seamlessly tileable")
    reference_image: Optional[str] = Field(default=None, description="Base64 reference image")
    custom_params: Optional[Dict[str, float]] = Field(default=None, description="Custom PBR parameters")
    model: Optional[str] = Field(default=None, description="AI model to use for generation")


class AnalyzePromptRequest(BaseModel):
    """Request model for prompt analysis"""
    prompt: str = Field(..., description="Texture description to analyze")
    model: Optional[str] = Field(default=None, description="AI model to use for analysis")


@router.get("/presets")
async def get_presets():
    """
    Get all available material presets.
    
    Returns:
        Dictionary of preset names to preset configurations
    """
    try:
        generator = get_texture_generator()
        presets = generator.get_presets()
        
        # Convert to serializable format
        result = {}
        for name, preset in presets.items():
            result[name] = {
                "category": preset["category"].value if hasattr(preset["category"], 'value') else preset["category"],
                "roughness_base": preset["roughness_base"],
                "metallic_base": preset["metallic_base"],
                "ao_strength": preset["ao_strength"],
                "normal_strength": preset["normal_strength"],
                "keywords": preset["keywords"]
            }
        
        return result
        
    except Exception as e:
        logger.error(f"Failed to get presets: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/categories")
async def get_categories():
    """
    Get all available texture categories.
    
    Returns:
        List of category names
    """
    try:
        generator = get_texture_generator()
        return generator.get_categories()
        
    except Exception as e:
        logger.error(f"Failed to get categories: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analyze")
async def analyze_prompt(request: AnalyzePromptRequest):
    """
    Analyze a texture prompt to determine category and parameters.
    
    Args:
        request: Contains the prompt to analyze and optional model selection
        
    Returns:
        Analysis with category, preset match, and suggested parameters
    """
    try:
        generator = get_texture_generator()
        analysis = await generator.analyze_prompt(request.prompt, model=request.model)
        
        # Add model info to response
        analysis["model_used"] = request.model or generator.default_model
        
        return analysis
        
    except Exception as e:
        logger.error(f"Failed to analyze prompt: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/generate")
async def generate_texture(request: GenerateTextureRequest):
    """
    Generate a complete PBR texture set from a prompt.
    
    Args:
        request: Generation parameters including prompt, resolution, etc.
        
    Returns:
        Generated texture with all PBR maps as base64
    """
    try:
        generator = get_texture_generator()
        
        # Validate resolution
        width, height = request.resolution
        if width < 64 or height < 64:
            raise HTTPException(status_code=400, detail="Resolution must be at least 64x64")
        if width > 4096 or height > 4096:
            raise HTTPException(status_code=400, detail="Resolution cannot exceed 4096x4096")
        
        # Generate texture with specified model
        texture = await generator.generate_texture(
            prompt=request.prompt,
            resolution=request.resolution,
            seamless=request.seamless,
            reference_image=request.reference_image,
            custom_params=request.custom_params,
            model=request.model
        )
        
        return generator.texture_to_dict(texture)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to generate texture: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/texture/{texture_id}")
async def get_texture(texture_id: str):
    """
    Get a previously generated texture by ID.
    
    Args:
        texture_id: The texture ID
        
    Returns:
        The texture data if found
    """
    try:
        generator = get_texture_generator()
        texture = generator.get_texture(texture_id)
        
        if not texture:
            raise HTTPException(status_code=404, detail="Texture not found")
        
        return generator.texture_to_dict(texture)
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get texture: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/texture/{texture_id}/map/{map_type}")
async def get_texture_map(texture_id: str, map_type: str):
    """
    Get a specific map from a generated texture.
    
    Args:
        texture_id: The texture ID
        map_type: One of: albedo, normal, roughness, metallic, ao, height
        
    Returns:
        The map data as base64
    """
    try:
        generator = get_texture_generator()
        texture = generator.get_texture(texture_id)
        
        if not texture:
            raise HTTPException(status_code=404, detail="Texture not found")
        
        valid_maps = ['albedo', 'normal', 'roughness', 'metallic', 'ao', 'height']
        if map_type not in valid_maps:
            raise HTTPException(status_code=400, detail=f"Invalid map type. Must be one of: {valid_maps}")
        
        map_data = getattr(texture.maps, map_type)
        
        return {
            "texture_id": texture_id,
            "map_type": map_type,
            "data": map_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get texture map: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/examples")
async def get_example_prompts():
    """
    Get example prompts for texture generation.
    
    Returns:
        List of example prompts organized by category
    """
    return {
        "metal": [
            "Rusty weathered metal with orange corrosion",
            "Polished chrome with subtle scratches",
            "Brushed stainless steel surface",
            "Hammered copper with patina",
            "Industrial galvanized steel"
        ],
        "wood": [
            "Polished dark wood with visible grain",
            "Rough pine bark texture",
            "Weathered barn wood planks",
            "Bamboo surface with nodes",
            "Lacquered mahogany finish"
        ],
        "stone": [
            "Rough granite with grey speckles",
            "Polished white marble with veins",
            "Mossy cobblestone surface",
            "Sandstone with natural patterns",
            "Volcanic basalt rock"
        ],
        "fabric": [
            "Woven canvas texture",
            "Soft velvet with light reflection",
            "Denim jeans material",
            "Knitted wool pattern",
            "Silk fabric with sheen"
        ],
        "concrete": [
            "Cracked concrete with dirt",
            "Smooth polished concrete floor",
            "Weathered cement wall",
            "Exposed aggregate concrete",
            "Stained industrial concrete"
        ],
        "organic": [
            "Tree bark with moss",
            "Dried leaf texture",
            "Grass lawn surface",
            "Coral reef pattern",
            "Snake skin scales"
        ],
        "ceramic": [
            "Glazed ceramic tiles",
            "Terracotta clay surface",
            "Porcelain with fine cracks",
            "Hand-painted pottery",
            "Bathroom tile mosaic"
        ],
        "leather": [
            "Worn leather with scratches",
            "Crocodile leather pattern",
            "Suede fabric texture",
            "Vintage leather book cover",
            "Motorcycle seat leather"
        ]
    }


@router.post("/regenerate-map/{texture_id}/{map_type}")
async def regenerate_map(
    texture_id: str,
    map_type: str,
    strength: float = 1.0
):
    """
    Regenerate a specific map with different parameters.
    
    Args:
        texture_id: The texture ID
        map_type: The map to regenerate
        strength: Strength parameter for the map
        
    Returns:
        Updated map data
    """
    try:
        generator = get_texture_generator()
        texture = generator.get_texture(texture_id)
        
        if not texture:
            raise HTTPException(status_code=404, detail="Texture not found")
        
        # Get the albedo image
        albedo = generator.base64_to_image(texture.maps.albedo)
        
        # Regenerate the specific map
        if map_type == 'normal':
            new_map = generator.generate_normal_map(albedo, strength)
        elif map_type == 'roughness':
            new_map = generator.generate_roughness_map(albedo, strength * 0.5, 0.3)
        elif map_type == 'metallic':
            new_map = generator.generate_metallic_map(albedo, strength * 0.5)
        elif map_type == 'ao':
            new_map = generator.generate_ao_map(albedo, strength)
        elif map_type == 'height':
            new_map = generator.generate_height_map(albedo)
        else:
            raise HTTPException(status_code=400, detail="Cannot regenerate albedo map")
        
        # Convert to base64
        new_map_base64 = generator.image_to_base64(new_map)
        
        # Update the texture
        setattr(texture.maps, map_type, new_map_base64)
        
        return {
            "texture_id": texture_id,
            "map_type": map_type,
            "data": new_map_base64
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to regenerate map: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/recommended-models")
async def get_recommended_models():
    """
    Get recommended AI models for texture generation tasks.
    
    Returns:
        Dictionary of task types to recommended model lists
    """
    try:
        generator = get_texture_generator()
        
        return {
            "task_types": {
                "prompt_analysis": {
                    "description": "Analyzing texture prompts to determine material properties",
                    "models": generator.get_recommended_models("prompt_analysis"),
                    "default": generator.default_model
                },
                "creative_generation": {
                    "description": "Creative and detailed texture generation",
                    "models": generator.get_recommended_models("creative_generation"),
                    "default": "claude-3-opus"
                },
                "fast_generation": {
                    "description": "Quick texture generation for prototyping",
                    "models": generator.get_recommended_models("fast_generation"),
                    "default": "gpt-4.1-nano"
                }
            },
            "all_supported_models": [
                {"id": "gpt-4.1-mini", "name": "GPT-4.1 Mini", "provider": "openai"},
                {"id": "gpt-4.1-nano", "name": "GPT-4.1 Nano", "provider": "openai"},
                {"id": "gpt-4o", "name": "GPT-4o", "provider": "openai"},
                {"id": "claude-3-5-sonnet", "name": "Claude 3.5 Sonnet", "provider": "anthropic"},
                {"id": "claude-3-opus", "name": "Claude 3 Opus", "provider": "anthropic"},
                {"id": "claude-3-haiku", "name": "Claude 3 Haiku", "provider": "anthropic"},
                {"id": "gemini-2.5-flash", "name": "Gemini 2.5 Flash", "provider": "google"},
                {"id": "gemini-2.0-pro", "name": "Gemini 2.0 Pro", "provider": "google"},
                {"id": "deepseek-v3", "name": "DeepSeek V3", "provider": "deepseek"}
            ]
        }
        
    except Exception as e:
        logger.error(f"Failed to get recommended models: {e}")
        raise HTTPException(status_code=500, detail=str(e))
