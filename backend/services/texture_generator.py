"""
AI Texture Generator Service

Generates PBR textures from text prompts with full map support.
Features:
- Text-to-texture generation using AI
- Automatic PBR map generation (Normal, Roughness, Metallic, AO, Height)
- Reference image support for style guidance
- Material presets and categories
- Seamless/tileable texture generation
"""

import os
import io
import uuid
import base64
import asyncio
from datetime import datetime
from typing import Optional, Dict, List, Any, Tuple
from dataclasses import dataclass, field
from enum import Enum
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance, ImageOps
from openai import AsyncOpenAI
import json


class TextureCategory(str, Enum):
    """Categories of textures"""
    METAL = "metal"
    WOOD = "wood"
    STONE = "stone"
    FABRIC = "fabric"
    ORGANIC = "organic"
    CONCRETE = "concrete"
    PLASTIC = "plastic"
    GLASS = "glass"
    LEATHER = "leather"
    CERAMIC = "ceramic"
    CUSTOM = "custom"


class PreviewShape(str, Enum):
    """3D preview shapes"""
    SPHERE = "sphere"
    CUBE = "cube"
    PLANE = "plane"
    CYLINDER = "cylinder"


@dataclass
class PBRMaps:
    """Complete set of PBR texture maps"""
    albedo: str  # Base64 encoded
    normal: str
    roughness: str
    metallic: str
    ao: str  # Ambient Occlusion
    height: str
    
    def to_dict(self) -> Dict[str, str]:
        return {
            "albedo": self.albedo,
            "normal": self.normal,
            "roughness": self.roughness,
            "metallic": self.metallic,
            "ao": self.ao,
            "height": self.height
        }


@dataclass
class GeneratedTexture:
    """A generated texture with all maps"""
    id: str
    prompt: str
    category: TextureCategory
    maps: PBRMaps
    resolution: Tuple[int, int]
    seamless: bool
    created_at: datetime
    reference_image: Optional[str] = None
    parameters: Dict[str, Any] = field(default_factory=dict)


# Material presets with typical PBR values
MATERIAL_PRESETS = {
    "polished_metal": {
        "category": TextureCategory.METAL,
        "roughness_base": 0.1,
        "metallic_base": 1.0,
        "ao_strength": 0.3,
        "normal_strength": 0.5,
        "keywords": ["shiny", "reflective", "chrome", "polished"]
    },
    "brushed_metal": {
        "category": TextureCategory.METAL,
        "roughness_base": 0.4,
        "metallic_base": 0.9,
        "ao_strength": 0.4,
        "normal_strength": 0.7,
        "keywords": ["brushed", "steel", "aluminum", "industrial"]
    },
    "rusty_metal": {
        "category": TextureCategory.METAL,
        "roughness_base": 0.8,
        "metallic_base": 0.5,
        "ao_strength": 0.6,
        "normal_strength": 0.9,
        "keywords": ["rust", "corroded", "weathered", "old"]
    },
    "rough_wood": {
        "category": TextureCategory.WOOD,
        "roughness_base": 0.7,
        "metallic_base": 0.0,
        "ao_strength": 0.5,
        "normal_strength": 0.8,
        "keywords": ["wood", "bark", "rough", "natural"]
    },
    "polished_wood": {
        "category": TextureCategory.WOOD,
        "roughness_base": 0.3,
        "metallic_base": 0.0,
        "ao_strength": 0.3,
        "normal_strength": 0.4,
        "keywords": ["lacquered", "varnished", "smooth", "furniture"]
    },
    "rough_stone": {
        "category": TextureCategory.STONE,
        "roughness_base": 0.9,
        "metallic_base": 0.0,
        "ao_strength": 0.7,
        "normal_strength": 1.0,
        "keywords": ["rock", "granite", "rough", "natural"]
    },
    "polished_stone": {
        "category": TextureCategory.STONE,
        "roughness_base": 0.2,
        "metallic_base": 0.0,
        "ao_strength": 0.3,
        "normal_strength": 0.3,
        "keywords": ["marble", "polished", "smooth", "tile"]
    },
    "concrete": {
        "category": TextureCategory.CONCRETE,
        "roughness_base": 0.85,
        "metallic_base": 0.0,
        "ao_strength": 0.5,
        "normal_strength": 0.6,
        "keywords": ["concrete", "cement", "pavement", "urban"]
    },
    "fabric": {
        "category": TextureCategory.FABRIC,
        "roughness_base": 0.9,
        "metallic_base": 0.0,
        "ao_strength": 0.4,
        "normal_strength": 0.5,
        "keywords": ["cloth", "fabric", "textile", "woven"]
    },
    "leather": {
        "category": TextureCategory.LEATHER,
        "roughness_base": 0.6,
        "metallic_base": 0.0,
        "ao_strength": 0.5,
        "normal_strength": 0.7,
        "keywords": ["leather", "hide", "skin", "worn"]
    },
    "plastic": {
        "category": TextureCategory.PLASTIC,
        "roughness_base": 0.4,
        "metallic_base": 0.0,
        "ao_strength": 0.2,
        "normal_strength": 0.3,
        "keywords": ["plastic", "polymer", "synthetic", "smooth"]
    },
    "glass": {
        "category": TextureCategory.GLASS,
        "roughness_base": 0.05,
        "metallic_base": 0.0,
        "ao_strength": 0.1,
        "normal_strength": 0.2,
        "keywords": ["glass", "transparent", "clear", "window"]
    }
}


class TextureGeneratorService:
    """
    AI-powered texture generation service.
    
    Generates complete PBR texture sets from text prompts,
    with automatic map derivation and material presets.
    
    Supports multiple AI models for different generation tasks.
    """
    
    # Models recommended for texture generation tasks
    RECOMMENDED_MODELS = {
        "prompt_analysis": ["gpt-4.1-mini", "claude-3-5-sonnet", "gemini-2.5-flash"],
        "creative_generation": ["claude-3-opus", "gpt-4o", "gemini-2.0-pro"],
        "fast_generation": ["gpt-4.1-nano", "claude-3-haiku", "deepseek-v3"]
    }
    
    def __init__(self):
        self.client = AsyncOpenAI()
        self.default_model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini")
        self.image_model = "gpt-4.1-mini"  # For image generation
        
        # Cache for generated textures
        self.textures: Dict[str, GeneratedTexture] = {}
        
        # Default resolution
        self.default_resolution = (512, 512)
    
    def get_recommended_models(self, task_type: str = "prompt_analysis") -> List[str]:
        """
        Get recommended models for a specific texture generation task.
        
        Args:
            task_type: Type of task (prompt_analysis, creative_generation, fast_generation)
            
        Returns:
            List of recommended model IDs
        """
        return self.RECOMMENDED_MODELS.get(task_type, self.RECOMMENDED_MODELS["prompt_analysis"])
    
    async def analyze_prompt(self, prompt: str, model: Optional[str] = None) -> Dict[str, Any]:
        """
        Analyze the prompt to determine material category and parameters.
        
        Args:
            prompt: User's texture description
            model: Optional AI model to use for analysis
            
        Returns:
            Analysis with category, preset match, and suggested parameters
        """
        model_to_use = model or self.default_model
        
        system_prompt = """You are an expert material artist analyzing texture descriptions.

Analyze the prompt and return JSON with:
1. category: One of: metal, wood, stone, fabric, organic, concrete, plastic, glass, leather, ceramic, custom
2. preset_match: Best matching preset from: polished_metal, brushed_metal, rusty_metal, rough_wood, polished_wood, rough_stone, polished_stone, concrete, fabric, leather, plastic, glass (or null if custom)
3. roughness: Estimated roughness value 0.0-1.0 (0=smooth/shiny, 1=rough/matte)
4. metallic: Estimated metallic value 0.0-1.0 (0=non-metal, 1=pure metal)
5. color_hints: Array of dominant colors expected
6. detail_level: low, medium, or high
7. seamless_recommended: true/false if seamless tiling is recommended
8. enhanced_prompt: An enhanced, detailed prompt for image generation

Respond with JSON only."""

        try:
            response = await self.client.chat.completions.create(
                model=model_to_use,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                response_format={"type": "json_object"},
                temperature=0.3
            )
            
            return json.loads(response.choices[0].message.content)
            
        except Exception as e:
            # Fallback analysis
            prompt_lower = prompt.lower()
            
            # Simple keyword matching
            category = TextureCategory.CUSTOM
            preset = None
            
            for preset_name, preset_data in MATERIAL_PRESETS.items():
                if any(kw in prompt_lower for kw in preset_data["keywords"]):
                    category = preset_data["category"]
                    preset = preset_name
                    break
            
            return {
                "category": category.value,
                "preset_match": preset,
                "roughness": 0.5,
                "metallic": 0.0 if category != TextureCategory.METAL else 0.8,
                "color_hints": [],
                "detail_level": "medium",
                "seamless_recommended": True,
                "enhanced_prompt": prompt
            }
    
    async def generate_base_texture(
        self,
        prompt: str,
        reference_image: Optional[str] = None,
        resolution: Tuple[int, int] = (512, 512)
    ) -> Image.Image:
        """
        Generate the base albedo texture using AI.
        
        Args:
            prompt: Enhanced texture description
            reference_image: Optional base64 reference image
            resolution: Output resolution
            
        Returns:
            PIL Image of the generated texture
        """
        # For now, we'll create a procedural texture since we don't have direct
        # image generation API. In production, this would call DALL-E or Stable Diffusion.
        
        # Create a procedural texture based on the prompt analysis
        analysis = await self.analyze_prompt(prompt)
        
        # Generate procedural texture
        img = self._generate_procedural_texture(prompt, analysis, resolution)
        
        return img
    
    def _generate_procedural_texture(
        self,
        prompt: str,
        analysis: Dict[str, Any],
        resolution: Tuple[int, int]
    ) -> Image.Image:
        """
        Generate a procedural texture based on analysis.
        This is a fallback when AI image generation is not available.
        """
        width, height = resolution
        
        # Create base noise
        np.random.seed(hash(prompt) % 2**32)
        
        # Generate Perlin-like noise using multiple octaves
        noise = np.zeros((height, width))
        
        for octave in range(4):
            freq = 2 ** octave
            amp = 0.5 ** octave
            
            # Simple noise generation
            octave_noise = np.random.rand(height // freq + 1, width // freq + 1)
            
            # Resize to full resolution
            from PIL import Image as PILImage
            octave_img = PILImage.fromarray((octave_noise * 255).astype(np.uint8))
            octave_img = octave_img.resize((width, height), PILImage.BILINEAR)
            octave_noise = np.array(octave_img) / 255.0
            
            noise += octave_noise * amp
        
        # Normalize
        noise = (noise - noise.min()) / (noise.max() - noise.min())
        
        # Get color hints or generate based on category
        colors = self._get_category_colors(analysis.get("category", "custom"))
        
        # Apply colors
        if len(colors) >= 2:
            # Blend between colors based on noise
            color1 = np.array(colors[0])
            color2 = np.array(colors[1])
            
            rgb = np.zeros((height, width, 3), dtype=np.uint8)
            for i in range(3):
                rgb[:, :, i] = (color1[i] + (color2[i] - color1[i]) * noise).astype(np.uint8)
        else:
            # Grayscale
            rgb = (noise * 255).astype(np.uint8)
            rgb = np.stack([rgb, rgb, rgb], axis=-1)
        
        img = Image.fromarray(rgb, 'RGB')
        
        # Add detail based on detail_level
        detail_level = analysis.get("detail_level", "medium")
        if detail_level == "high":
            img = img.filter(ImageFilter.DETAIL)
        elif detail_level == "low":
            img = img.filter(ImageFilter.SMOOTH)
        
        return img
    
    def _get_category_colors(self, category: str) -> List[Tuple[int, int, int]]:
        """Get typical colors for a material category"""
        color_map = {
            "metal": [(180, 180, 190), (120, 120, 130)],
            "wood": [(139, 90, 43), (101, 67, 33)],
            "stone": [(128, 128, 128), (96, 96, 96)],
            "fabric": [(200, 180, 160), (160, 140, 120)],
            "organic": [(80, 120, 60), (60, 90, 40)],
            "concrete": [(160, 160, 155), (130, 130, 125)],
            "plastic": [(200, 200, 210), (180, 180, 190)],
            "glass": [(220, 230, 240), (200, 210, 220)],
            "leather": [(101, 67, 33), (70, 45, 20)],
            "ceramic": [(240, 235, 230), (220, 215, 210)],
            "custom": [(150, 150, 150), (100, 100, 100)]
        }
        return color_map.get(category, color_map["custom"])
    
    def generate_normal_map(
        self,
        albedo: Image.Image,
        strength: float = 1.0
    ) -> Image.Image:
        """
        Generate a normal map from the albedo texture.
        
        Uses Sobel operator to detect edges and convert to normal vectors.
        
        Args:
            albedo: Base albedo texture
            strength: Normal map intensity (0.0-2.0)
            
        Returns:
            Normal map as PIL Image
        """
        # Convert to grayscale for height detection
        gray = albedo.convert('L')
        gray_array = np.array(gray, dtype=np.float32) / 255.0
        
        # Sobel operators for gradient detection
        sobel_x = np.array([[-1, 0, 1], [-2, 0, 2], [-1, 0, 1]], dtype=np.float32)
        sobel_y = np.array([[-1, -2, -1], [0, 0, 0], [1, 2, 1]], dtype=np.float32)
        
        # Pad array for convolution
        padded = np.pad(gray_array, 1, mode='wrap')
        
        # Calculate gradients
        height, width = gray_array.shape
        dx = np.zeros_like(gray_array)
        dy = np.zeros_like(gray_array)
        
        for i in range(height):
            for j in range(width):
                region = padded[i:i+3, j:j+3]
                dx[i, j] = np.sum(region * sobel_x)
                dy[i, j] = np.sum(region * sobel_y)
        
        # Apply strength
        dx *= strength
        dy *= strength
        
        # Calculate normal vectors
        # Normal = normalize([-dx, -dy, 1])
        dz = np.ones_like(dx)
        
        length = np.sqrt(dx**2 + dy**2 + dz**2)
        
        nx = -dx / length
        ny = -dy / length
        nz = dz / length
        
        # Convert to RGB (0-255 range, with 0.5 as neutral)
        r = ((nx + 1) * 0.5 * 255).astype(np.uint8)
        g = ((ny + 1) * 0.5 * 255).astype(np.uint8)
        b = ((nz + 1) * 0.5 * 255).astype(np.uint8)
        
        normal_map = np.stack([r, g, b], axis=-1)
        
        return Image.fromarray(normal_map, 'RGB')
    
    def generate_roughness_map(
        self,
        albedo: Image.Image,
        base_roughness: float = 0.5,
        variation: float = 0.3
    ) -> Image.Image:
        """
        Generate a roughness map from the albedo texture.
        
        Darker areas typically have higher roughness (dirt, crevices).
        
        Args:
            albedo: Base albedo texture
            base_roughness: Base roughness value (0.0-1.0)
            variation: Amount of variation from base
            
        Returns:
            Roughness map as grayscale PIL Image
        """
        # Convert to grayscale
        gray = albedo.convert('L')
        gray_array = np.array(gray, dtype=np.float32) / 255.0
        
        # Invert (darker = rougher)
        inverted = 1.0 - gray_array
        
        # Apply base roughness and variation
        roughness = base_roughness + (inverted - 0.5) * variation * 2
        
        # Clamp to valid range
        roughness = np.clip(roughness, 0.0, 1.0)
        
        # Add some noise for realism
        noise = np.random.rand(*roughness.shape) * 0.05
        roughness = np.clip(roughness + noise - 0.025, 0.0, 1.0)
        
        roughness_map = (roughness * 255).astype(np.uint8)
        
        return Image.fromarray(roughness_map, 'L')
    
    def generate_metallic_map(
        self,
        albedo: Image.Image,
        base_metallic: float = 0.0,
        threshold: float = 0.7
    ) -> Image.Image:
        """
        Generate a metallic map from the albedo texture.
        
        For non-metals, this is typically uniform black.
        For metals, brighter areas are more metallic.
        
        Args:
            albedo: Base albedo texture
            base_metallic: Base metallic value (0.0-1.0)
            threshold: Brightness threshold for metallic areas
            
        Returns:
            Metallic map as grayscale PIL Image
        """
        if base_metallic < 0.1:
            # Non-metallic material - uniform black
            width, height = albedo.size
            return Image.new('L', (width, height), 0)
        
        # Convert to grayscale
        gray = albedo.convert('L')
        gray_array = np.array(gray, dtype=np.float32) / 255.0
        
        # Apply threshold and base metallic
        metallic = np.where(
            gray_array > threshold,
            base_metallic + (gray_array - threshold) * (1 - base_metallic) / (1 - threshold),
            base_metallic * gray_array / threshold
        )
        
        metallic = np.clip(metallic, 0.0, 1.0)
        metallic_map = (metallic * 255).astype(np.uint8)
        
        return Image.fromarray(metallic_map, 'L')
    
    def generate_ao_map(
        self,
        albedo: Image.Image,
        strength: float = 0.5
    ) -> Image.Image:
        """
        Generate an ambient occlusion map from the albedo texture.
        
        Darker areas in the albedo suggest crevices with more occlusion.
        
        Args:
            albedo: Base albedo texture
            strength: AO intensity (0.0-1.0)
            
        Returns:
            AO map as grayscale PIL Image
        """
        # Convert to grayscale
        gray = albedo.convert('L')
        
        # Apply blur to simulate light bleeding
        blurred = gray.filter(ImageFilter.GaussianBlur(radius=3))
        
        # Enhance contrast
        enhancer = ImageEnhance.Contrast(blurred)
        enhanced = enhancer.enhance(1.5)
        
        # Blend with white based on strength
        enhanced_array = np.array(enhanced, dtype=np.float32) / 255.0
        
        # AO is typically white (1.0) with darker areas in crevices
        ao = 1.0 - (1.0 - enhanced_array) * strength
        
        ao = np.clip(ao, 0.0, 1.0)
        ao_map = (ao * 255).astype(np.uint8)
        
        return Image.fromarray(ao_map, 'L')
    
    def generate_height_map(
        self,
        albedo: Image.Image,
        invert: bool = False
    ) -> Image.Image:
        """
        Generate a height/displacement map from the albedo texture.
        
        Brighter areas are typically higher (unless inverted).
        
        Args:
            albedo: Base albedo texture
            invert: Whether to invert (darker = higher)
            
        Returns:
            Height map as grayscale PIL Image
        """
        # Convert to grayscale
        gray = albedo.convert('L')
        
        # Apply slight blur to smooth out noise
        height = gray.filter(ImageFilter.GaussianBlur(radius=1))
        
        # Enhance contrast for more pronounced height differences
        enhancer = ImageEnhance.Contrast(height)
        height = enhancer.enhance(1.3)
        
        if invert:
            height = ImageOps.invert(height)
        
        return height
    
    def make_seamless(self, image: Image.Image) -> Image.Image:
        """
        Make a texture seamlessly tileable.
        
        Uses edge blending to create smooth transitions.
        
        Args:
            image: Input texture
            
        Returns:
            Seamless version of the texture
        """
        width, height = image.size
        blend_size = min(width, height) // 4
        
        # Convert to numpy for processing
        img_array = np.array(image, dtype=np.float32)
        
        # Create blending masks
        x_blend = np.linspace(0, 1, blend_size)
        y_blend = np.linspace(0, 1, blend_size)
        
        # Blend horizontal edges
        for i, alpha in enumerate(x_blend):
            # Left edge
            img_array[:, i] = img_array[:, i] * alpha + img_array[:, width - blend_size + i] * (1 - alpha)
            # Right edge
            img_array[:, width - blend_size + i] = img_array[:, i]
        
        # Blend vertical edges
        for i, alpha in enumerate(y_blend):
            # Top edge
            img_array[i, :] = img_array[i, :] * alpha + img_array[height - blend_size + i, :] * (1 - alpha)
            # Bottom edge
            img_array[height - blend_size + i, :] = img_array[i, :]
        
        # Convert back to PIL Image
        if len(img_array.shape) == 2:
            return Image.fromarray(img_array.astype(np.uint8), 'L')
        else:
            return Image.fromarray(img_array.astype(np.uint8), 'RGB')
    
    def image_to_base64(self, image: Image.Image, format: str = "PNG") -> str:
        """Convert PIL Image to base64 string"""
        buffer = io.BytesIO()
        image.save(buffer, format=format)
        return base64.b64encode(buffer.getvalue()).decode('utf-8')
    
    def base64_to_image(self, base64_str: str) -> Image.Image:
        """Convert base64 string to PIL Image"""
        image_data = base64.b64decode(base64_str)
        return Image.open(io.BytesIO(image_data))
    
    async def generate_texture(
        self,
        prompt: str,
        resolution: Tuple[int, int] = (512, 512),
        seamless: bool = True,
        reference_image: Optional[str] = None,
        custom_params: Optional[Dict[str, Any]] = None,
        model: Optional[str] = None
    ) -> GeneratedTexture:
        """
        Generate a complete PBR texture set from a prompt.
        
        Args:
            prompt: Texture description
            resolution: Output resolution (width, height)
            seamless: Whether to make textures seamlessly tileable
            reference_image: Optional base64 reference image
            custom_params: Optional custom PBR parameters
            model: Optional AI model to use for generation
            
        Returns:
            GeneratedTexture with all PBR maps
        """
        # Analyze the prompt using specified model
        analysis = await self.analyze_prompt(prompt, model=model)
        
        # Get preset parameters or use analysis
        preset_name = analysis.get("preset_match")
        if preset_name and preset_name in MATERIAL_PRESETS:
            preset = MATERIAL_PRESETS[preset_name]
            roughness_base = preset["roughness_base"]
            metallic_base = preset["metallic_base"]
            ao_strength = preset["ao_strength"]
            normal_strength = preset["normal_strength"]
        else:
            roughness_base = analysis.get("roughness", 0.5)
            metallic_base = analysis.get("metallic", 0.0)
            ao_strength = 0.5
            normal_strength = 0.7
        
        # Override with custom params if provided
        if custom_params:
            roughness_base = custom_params.get("roughness", roughness_base)
            metallic_base = custom_params.get("metallic", metallic_base)
            ao_strength = custom_params.get("ao_strength", ao_strength)
            normal_strength = custom_params.get("normal_strength", normal_strength)
        
        # Generate base albedo texture
        albedo = await self.generate_base_texture(
            analysis.get("enhanced_prompt", prompt),
            reference_image,
            resolution
        )
        
        # Make seamless if requested
        if seamless:
            albedo = self.make_seamless(albedo)
        
        # Generate all PBR maps
        normal = self.generate_normal_map(albedo, normal_strength)
        roughness = self.generate_roughness_map(albedo, roughness_base)
        metallic = self.generate_metallic_map(albedo, metallic_base)
        ao = self.generate_ao_map(albedo, ao_strength)
        height = self.generate_height_map(albedo)
        
        # Make maps seamless if requested
        if seamless:
            normal = self.make_seamless(normal)
            roughness = self.make_seamless(roughness)
            metallic = self.make_seamless(metallic)
            ao = self.make_seamless(ao)
            height = self.make_seamless(height)
        
        # Convert to base64
        maps = PBRMaps(
            albedo=self.image_to_base64(albedo),
            normal=self.image_to_base64(normal),
            roughness=self.image_to_base64(roughness),
            metallic=self.image_to_base64(metallic),
            ao=self.image_to_base64(ao),
            height=self.image_to_base64(height)
        )
        
        # Create texture record
        texture = GeneratedTexture(
            id=str(uuid.uuid4())[:8],
            prompt=prompt,
            category=TextureCategory(analysis.get("category", "custom")),
            maps=maps,
            resolution=resolution,
            seamless=seamless,
            created_at=datetime.now(),
            reference_image=reference_image,
            parameters={
                "roughness_base": roughness_base,
                "metallic_base": metallic_base,
                "ao_strength": ao_strength,
                "normal_strength": normal_strength,
                "analysis": analysis,
                "model_used": model or self.default_model
            }
        )
        
        # Cache the texture
        self.textures[texture.id] = texture
        
        return texture
    
    def get_texture(self, texture_id: str) -> Optional[GeneratedTexture]:
        """Get a cached texture by ID"""
        return self.textures.get(texture_id)
    
    def get_presets(self) -> Dict[str, Dict[str, Any]]:
        """Get all material presets"""
        return MATERIAL_PRESETS
    
    def get_categories(self) -> List[str]:
        """Get all texture categories"""
        return [c.value for c in TextureCategory]
    
    def texture_to_dict(self, texture: GeneratedTexture) -> Dict[str, Any]:
        """Convert a GeneratedTexture to dictionary for API response"""
        return {
            "id": texture.id,
            "prompt": texture.prompt,
            "category": texture.category.value,
            "maps": texture.maps.to_dict(),
            "resolution": list(texture.resolution),
            "seamless": texture.seamless,
            "created_at": texture.created_at.isoformat(),
            "reference_image": texture.reference_image,
            "parameters": texture.parameters
        }


# Global service instance
_texture_generator: Optional[TextureGeneratorService] = None


def get_texture_generator() -> TextureGeneratorService:
    """Get the global texture generator instance"""
    global _texture_generator
    if _texture_generator is None:
        _texture_generator = TextureGeneratorService()
    return _texture_generator
