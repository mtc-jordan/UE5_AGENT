import React, { useState, useRef, useEffect, useCallback } from 'react';
import ModelSelector from './ModelSelector';

// Types
interface PBRMaps {
  albedo: string;
  normal: string;
  roughness: string;
  metallic: string;
  ao: string;
  height: string;
}

interface GeneratedTexture {
  id: string;
  prompt: string;
  category: string;
  maps: PBRMaps;
  resolution: [number, number];
  seamless: boolean;
  created_at: string;
  parameters: {
    roughness_base: number;
    metallic_base: number;
    ao_strength: number;
    normal_strength: number;
    analysis?: {
      category: string;
      preset_match: string | null;
      color_hints: string[];
      detail_level: string;
      enhanced_prompt: string;
    };
  };
}

interface MaterialPreset {
  category: string;
  roughness_base: number;
  metallic_base: number;
  ao_strength: number;
  normal_strength: number;
  keywords: string[];
}

type PreviewShape = 'sphere' | 'cube' | 'plane' | 'cylinder';
type MapType = 'albedo' | 'normal' | 'roughness' | 'metallic' | 'ao' | 'height';

interface TextureGeneratorProps {
  onTextureGenerated?: (texture: GeneratedTexture) => void;
  onApplyToActor?: (texture: GeneratedTexture, actorName: string) => void;
}

const API_BASE = '/api';

// Material preset icons
const presetIcons: Record<string, string> = {
  polished_metal: '🔩',
  brushed_metal: '🔧',
  rusty_metal: '🦀',
  rough_wood: '🪵',
  polished_wood: '🪑',
  rough_stone: '🪨',
  polished_stone: '💎',
  concrete: '🧱',
  fabric: '🧵',
  leather: '👜',
  plastic: '🧴',
  glass: '🪟'
};

// Example prompts
const examplePrompts = [
  "Rusty weathered metal with orange corrosion",
  "Polished dark wood with visible grain",
  "Rough granite stone with grey speckles",
  "Worn leather with scratches and creases",
  "Brushed stainless steel surface",
  "Mossy cobblestone with green patches",
  "Cracked concrete with dirt in crevices",
  "Woven fabric with blue and white pattern",
  "Frosted glass with subtle texture",
  "Ceramic tiles with glossy finish"
];

export const TextureGenerator: React.FC<TextureGeneratorProps> = ({
  onTextureGenerated,
  onApplyToActor
}) => {
  // State
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTexture, setGeneratedTexture] = useState<GeneratedTexture | null>(null);
  const [presets, setPresets] = useState<Record<string, MaterialPreset>>({});
  const [selectedPreset, setSelectedPreset] = useState<string | null>(null);
  const [previewShape, setPreviewShape] = useState<PreviewShape>('sphere');
  const [activeMap, setActiveMap] = useState<MapType>('albedo');
  const [resolution, setResolution] = useState<[number, number]>([512, 512]);
  const [seamless, setSeamless] = useState(true);
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customParams, setCustomParams] = useState({
    roughness: 0.5,
    metallic: 0.0,
    ao_strength: 0.5,
    normal_strength: 0.7
  });
  const [history, setHistory] = useState<GeneratedTexture[]>([]);
  const [lightingMode, setLightingMode] = useState<'studio' | 'outdoor' | 'night'>('studio');
  const [rotation, setRotation] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState<string | null>(null);
  
  // Model selection state
  const [selectedModel, setSelectedModel] = useState('deepseek-chat');
  const [autoSelectModel, setAutoSelectModel] = useState(false);
  const [modelUsed, setModelUsed] = useState<string | null>(null);
  
  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isDragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  // Load presets on mount
  useEffect(() => {
    loadPresets();
  }, []);

  // Render 3D preview when texture changes
  useEffect(() => {
    if (generatedTexture) {
      render3DPreview();
    }
  }, [generatedTexture, previewShape, activeMap, lightingMode, rotation, zoom]);

  const loadPresets = async () => {
    try {
      const response = await fetch(`${API_BASE}/texture-generator/presets`);
      if (response.ok) {
        const data = await response.json();
        setPresets(data);
      }
    } catch (err) {
      console.error('Failed to load presets:', err);
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a texture description');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/texture-generator/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          resolution,
          seamless,
          reference_image: referenceImage,
          custom_params: showAdvanced ? customParams : undefined,
          model: autoSelectModel ? null : selectedModel
        })
      });

      if (!response.ok) {
        throw new Error('Failed to generate texture');
      }

      const texture = await response.json();
      setGeneratedTexture(texture);
      setHistory(prev => [texture, ...prev.slice(0, 9)]);
      
      // Track which model was used
      if (texture.parameters?.model_used) {
        setModelUsed(texture.parameters.model_used);
      }
      
      if (onTextureGenerated) {
        onTextureGenerated(texture);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePresetClick = (presetName: string) => {
    setSelectedPreset(presetName);
    const preset = presets[presetName];
    if (preset) {
      setCustomParams({
        roughness: preset.roughness_base,
        metallic: preset.metallic_base,
        ao_strength: preset.ao_strength,
        normal_strength: preset.normal_strength
      });
      // Add preset keywords to prompt
      const keywords = preset.keywords.slice(0, 2).join(' ');
      if (!prompt.includes(keywords)) {
        setPrompt(prev => prev ? `${prev} ${keywords}` : keywords);
      }
    }
  };

  const handleReferenceUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        setReferenceImage(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleExampleClick = (example: string) => {
    setPrompt(example);
  };

  const handleDownloadMap = (mapType: MapType) => {
    if (!generatedTexture) return;
    
    const mapData = generatedTexture.maps[mapType];
    const link = document.createElement('a');
    link.href = `data:image/png;base64,${mapData}`;
    link.download = `${generatedTexture.prompt.replace(/\s+/g, '_')}_${mapType}.png`;
    link.click();
  };

  const handleDownloadAll = () => {
    if (!generatedTexture) return;
    
    const maps: MapType[] = ['albedo', 'normal', 'roughness', 'metallic', 'ao', 'height'];
    maps.forEach((mapType, index) => {
      setTimeout(() => handleDownloadMap(mapType), index * 200);
    });
  };

  // 3D Preview rendering using Canvas 2D (simplified)
  const render3DPreview = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !generatedTexture) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    // Clear canvas
    ctx.fillStyle = lightingMode === 'night' ? '#1a1a2e' : lightingMode === 'outdoor' ? '#87ceeb' : '#2a2a3a';
    ctx.fillRect(0, 0, width, height);

    // Load and draw texture
    const img = new Image();
    img.onload = () => {
      const centerX = width / 2;
      const centerY = height / 2;
      const size = Math.min(width, height) * 0.7 * zoom;

      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation.y * Math.PI / 180);

      switch (previewShape) {
        case 'sphere':
          drawSphere(ctx, img, size);
          break;
        case 'cube':
          drawCube(ctx, img, size);
          break;
        case 'plane':
          drawPlane(ctx, img, size);
          break;
        case 'cylinder':
          drawCylinder(ctx, img, size);
          break;
      }

      ctx.restore();

      // Draw lighting indicator
      drawLightingIndicator(ctx, width, height);
    };
    
    img.src = `data:image/png;base64,${generatedTexture.maps[activeMap]}`;
  }, [generatedTexture, previewShape, activeMap, lightingMode, rotation, zoom]);

  const drawSphere = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, size: number) => {
    const radius = size / 2;
    
    // Create circular clip
    ctx.beginPath();
    ctx.arc(0, 0, radius, 0, Math.PI * 2);
    ctx.clip();

    // Draw texture with spherical distortion simulation
    ctx.drawImage(img, -radius, -radius, size, size);

    // Add shading for 3D effect
    const gradient = ctx.createRadialGradient(-radius * 0.3, -radius * 0.3, 0, 0, 0, radius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');
    
    ctx.fillStyle = gradient;
    ctx.fill();
  };

  const drawCube = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, size: number) => {
    const halfSize = size / 2;
    const depth = size * 0.3;

    // Front face
    ctx.drawImage(img, -halfSize, -halfSize, size, size);

    // Top face (with perspective)
    ctx.save();
    ctx.transform(1, -0.3, 0, 0.5, 0, -halfSize);
    ctx.globalAlpha = 0.8;
    ctx.drawImage(img, -halfSize, -depth, size, depth * 2);
    ctx.restore();

    // Right face (with perspective)
    ctx.save();
    ctx.transform(0.5, 0.3, 0, 1, halfSize, 0);
    ctx.globalAlpha = 0.6;
    ctx.drawImage(img, 0, -halfSize, depth, size);
    ctx.restore();
  };

  const drawPlane = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, size: number) => {
    // Draw with perspective transform
    ctx.save();
    ctx.transform(1, 0, -0.3, 0.7, 0, 0);
    ctx.drawImage(img, -size / 2, -size / 2, size, size);
    ctx.restore();

    // Add grid lines for tiling preview
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.lineWidth = 1;
    const gridSize = size / 4;
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(i * gridSize - size * 0.15, -size / 2);
      ctx.lineTo(i * gridSize - size * 0.15, size / 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-size / 2, i * gridSize * 0.7);
      ctx.lineTo(size / 2, i * gridSize * 0.7);
      ctx.stroke();
    }
  };

  const drawCylinder = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, size: number) => {
    const width = size;
    const height = size * 0.8;

    // Draw main body
    ctx.drawImage(img, -width / 2, -height / 2, width, height);

    // Add curved shading
    const gradient = ctx.createLinearGradient(-width / 2, 0, width / 2, 0);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.4)');
    gradient.addColorStop(0.3, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
    gradient.addColorStop(0.7, 'rgba(0, 0, 0, 0)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0.4)');

    ctx.fillStyle = gradient;
    ctx.fillRect(-width / 2, -height / 2, width, height);

    // Draw top ellipse
    ctx.beginPath();
    ctx.ellipse(0, -height / 2, width / 2, width / 6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(100, 100, 100, 0.5)';
    ctx.fill();
  };

  const drawLightingIndicator = (ctx: CanvasRenderingContext2D, width: number, height: number) => {
    const icons = { studio: '💡', outdoor: '☀️', night: '🌙' };
    ctx.font = '20px Arial';
    ctx.fillText(icons[lightingMode], width - 30, 30);
  };

  // Mouse handlers for rotation
  const handleMouseDown = (e: React.MouseEvent) => {
    isDragging.current = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current) return;
    
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    
    setRotation(prev => ({
      x: prev.x + dy * 0.5,
      y: prev.y + dx * 0.5
    }));
    
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    isDragging.current = false;
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(prev => Math.max(0.5, Math.min(2, prev - e.deltaY * 0.001)));
  };

  // Map type labels
  const mapLabels: Record<MapType, { label: string; icon: string; description: string }> = {
    albedo: { label: 'Albedo', icon: '🎨', description: 'Base color/diffuse' },
    normal: { label: 'Normal', icon: '📐', description: 'Surface detail' },
    roughness: { label: 'Roughness', icon: '🔲', description: 'Surface smoothness' },
    metallic: { label: 'Metallic', icon: '✨', description: 'Metal vs non-metal' },
    ao: { label: 'AO', icon: '🌑', description: 'Ambient occlusion' },
    height: { label: 'Height', icon: '📊', description: 'Displacement' }
  };

  return (
    <div className="bg-gray-900/50 backdrop-blur-sm rounded-xl border border-purple-500/20 overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b border-purple-500/20 bg-gradient-to-r from-purple-900/30 to-blue-900/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <span className="text-xl">🎨</span>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">AI Texture Generator</h3>
              <p className="text-xs text-gray-400">Generate PBR textures from text prompts</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-2 py-1 text-xs bg-green-500/20 text-green-400 rounded-full">
              PBR Ready
            </span>
            {/* Model Selector */}
            <ModelSelector
              selectedModel={selectedModel}
              onModelChange={setSelectedModel}
              autoSelect={autoSelectModel}
              onAutoSelectChange={setAutoSelectModel}
              disabled={isGenerating}
              compact={true}
            />
          </div>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {/* Model Used Badge */}
        {modelUsed && generatedTexture && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 rounded-lg">
            <span className="text-xs text-gray-400">Generated with:</span>
            <span className="text-xs text-purple-400 font-medium">{modelUsed}</span>
          </div>
        )}
        
        {/* Prompt Input */}
        <div className="space-y-2">
          <label className="text-sm text-gray-400">Describe your texture</label>
          <div className="relative">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., Rusty weathered metal with orange corrosion..."
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-purple-500 resize-none"
              rows={2}
            />
            <button
              onClick={() => setPrompt('')}
              className="absolute top-2 right-2 p-1 text-gray-500 hover:text-white"
            >
              ✕
            </button>
          </div>
          
          {/* Example prompts */}
          <div className="flex flex-wrap gap-2">
            {examplePrompts.slice(0, 4).map((example, i) => (
              <button
                key={i}
                onClick={() => handleExampleClick(example)}
                className="px-2 py-1 text-xs bg-gray-800 text-gray-400 rounded hover:bg-gray-700 hover:text-white transition-colors"
              >
                {example.slice(0, 25)}...
              </button>
            ))}
          </div>
        </div>

        {/* Material Presets */}
        <div className="space-y-2">
          <label className="text-sm text-gray-400">Material Presets</label>
          <div className="grid grid-cols-6 gap-2">
            {Object.entries(presets).slice(0, 12).map(([name, preset]) => (
              <button
                key={name}
                onClick={() => handlePresetClick(name)}
                className={`p-2 rounded-lg border transition-all ${
                  selectedPreset === name
                    ? 'border-purple-500 bg-purple-500/20'
                    : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                }`}
                title={name.replace(/_/g, ' ')}
              >
                <div className="text-xl text-center">{presetIcons[name] || '📦'}</div>
                <div className="text-[10px] text-gray-400 text-center truncate mt-1">
                  {name.replace(/_/g, ' ')}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Options Row */}
        <div className="flex items-center gap-4 flex-wrap">
          {/* Resolution */}
          <div className="flex items-center gap-2">
            <label className="text-sm text-gray-400">Resolution:</label>
            <select
              value={`${resolution[0]}x${resolution[1]}`}
              onChange={(e) => {
                const [w, h] = e.target.value.split('x').map(Number);
                setResolution([w, h]);
              }}
              className="px-2 py-1 bg-gray-800 border border-gray-700 rounded text-white text-sm"
            >
              <option value="256x256">256×256</option>
              <option value="512x512">512×512</option>
              <option value="1024x1024">1024×1024</option>
              <option value="2048x2048">2048×2048</option>
            </select>
          </div>

          {/* Seamless Toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={seamless}
              onChange={(e) => setSeamless(e.target.checked)}
              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-purple-500 focus:ring-purple-500"
            />
            <span className="text-sm text-gray-400">Seamless Tiling</span>
          </label>

          {/* Reference Image */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className={`px-3 py-1 text-sm rounded border transition-colors ${
              referenceImage
                ? 'border-green-500 bg-green-500/20 text-green-400'
                : 'border-gray-700 bg-gray-800 text-gray-400 hover:border-gray-600'
            }`}
          >
            {referenceImage ? '✓ Reference Added' : '+ Reference Image'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleReferenceUpload}
            className="hidden"
          />

          {/* Advanced Toggle */}
          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="px-3 py-1 text-sm border border-gray-700 bg-gray-800 text-gray-400 rounded hover:border-gray-600"
          >
            {showAdvanced ? '▼ Hide Advanced' : '▶ Advanced'}
          </button>
        </div>

        {/* Advanced Parameters */}
        {showAdvanced && (
          <div className="p-3 bg-gray-800/50 rounded-lg border border-gray-700 space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400">Roughness: {customParams.roughness.toFixed(2)}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={customParams.roughness}
                  onChange={(e) => setCustomParams(p => ({ ...p, roughness: parseFloat(e.target.value) }))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Metallic: {customParams.metallic.toFixed(2)}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={customParams.metallic}
                  onChange={(e) => setCustomParams(p => ({ ...p, metallic: parseFloat(e.target.value) }))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">AO Strength: {customParams.ao_strength.toFixed(2)}</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={customParams.ao_strength}
                  onChange={(e) => setCustomParams(p => ({ ...p, ao_strength: parseFloat(e.target.value) }))}
                  className="w-full"
                />
              </div>
              <div>
                <label className="text-xs text-gray-400">Normal Strength: {customParams.normal_strength.toFixed(2)}</label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={customParams.normal_strength}
                  onChange={(e) => setCustomParams(p => ({ ...p, normal_strength: parseFloat(e.target.value) }))}
                  className="w-full"
                />
              </div>
            </div>
          </div>
        )}

        {/* Generate Button */}
        <button
          onClick={handleGenerate}
          disabled={isGenerating || !prompt.trim()}
          className={`w-full py-3 rounded-lg font-medium transition-all ${
            isGenerating || !prompt.trim()
              ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
              : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-500/25'
          }`}
        >
          {isGenerating ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Generating PBR Maps...
            </span>
          ) : (
            '🎨 Generate Texture'
          )}
        </button>

        {/* Error Message */}
        {error && (
          <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Generated Texture Preview */}
        {generatedTexture && (
          <div className="space-y-4 pt-4 border-t border-gray-700">
            {/* 3D Preview */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm text-gray-400">3D Preview</label>
                <div className="flex items-center gap-2">
                  {/* Shape selector */}
                  {(['sphere', 'cube', 'plane', 'cylinder'] as PreviewShape[]).map(shape => (
                    <button
                      key={shape}
                      onClick={() => setPreviewShape(shape)}
                      className={`px-2 py-1 text-xs rounded ${
                        previewShape === shape
                          ? 'bg-purple-500 text-white'
                          : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {shape === 'sphere' ? '⚪' : shape === 'cube' ? '🔲' : shape === 'plane' ? '▭' : '⬭'}
                    </button>
                  ))}
                  
                  {/* Lighting selector */}
                  <select
                    value={lightingMode}
                    onChange={(e) => setLightingMode(e.target.value as 'studio' | 'outdoor' | 'night')}
                    className="px-2 py-1 text-xs bg-gray-800 border border-gray-700 rounded text-white"
                  >
                    <option value="studio">💡 Studio</option>
                    <option value="outdoor">☀️ Outdoor</option>
                    <option value="night">🌙 Night</option>
                  </select>
                </div>
              </div>
              
              <div 
                className="relative bg-gray-800 rounded-lg overflow-hidden"
                style={{ height: '300px' }}
              >
                <canvas
                  ref={canvasRef}
                  width={400}
                  height={300}
                  className="w-full h-full cursor-grab active:cursor-grabbing"
                  onMouseDown={handleMouseDown}
                  onMouseMove={handleMouseMove}
                  onMouseUp={handleMouseUp}
                  onMouseLeave={handleMouseUp}
                  onWheel={handleWheel}
                />
                
                {/* Controls overlay */}
                <div className="absolute bottom-2 left-2 text-xs text-gray-500">
                  Drag to rotate • Scroll to zoom
                </div>
                
                {/* Reset button */}
                <button
                  onClick={() => { setRotation({ x: 0, y: 0 }); setZoom(1); }}
                  className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-900/80 text-gray-400 rounded hover:text-white"
                >
                  Reset View
                </button>
              </div>
            </div>

            {/* Map Selector */}
            <div className="space-y-2">
              <label className="text-sm text-gray-400">PBR Maps</label>
              <div className="grid grid-cols-6 gap-2">
                {(Object.keys(mapLabels) as MapType[]).map(mapType => (
                  <button
                    key={mapType}
                    onClick={() => setActiveMap(mapType)}
                    className={`p-2 rounded-lg border transition-all ${
                      activeMap === mapType
                        ? 'border-purple-500 bg-purple-500/20'
                        : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
                    }`}
                  >
                    <div className="text-lg text-center">{mapLabels[mapType].icon}</div>
                    <div className="text-[10px] text-gray-400 text-center">{mapLabels[mapType].label}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Map Thumbnails */}
            <div className="grid grid-cols-6 gap-2">
              {(Object.keys(generatedTexture.maps) as MapType[]).map(mapType => (
                <div
                  key={mapType}
                  className={`relative group cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                    activeMap === mapType ? 'border-purple-500' : 'border-transparent'
                  }`}
                  onClick={() => setActiveMap(mapType)}
                >
                  <img
                    src={`data:image/png;base64,${generatedTexture.maps[mapType]}`}
                    alt={mapType}
                    className="w-full aspect-square object-cover"
                  />
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDownloadMap(mapType); }}
                      className="p-1 bg-white/20 rounded"
                    >
                      ⬇️
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownloadAll}
                className="flex-1 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg font-medium transition-colors"
              >
                ⬇️ Download All Maps
              </button>
              {onApplyToActor && (
                <button
                  onClick={() => onApplyToActor(generatedTexture, '')}
                  className="flex-1 py-2 bg-green-600 hover:bg-green-500 text-white rounded-lg font-medium transition-colors"
                >
                  ✓ Apply to Actor
                </button>
              )}
            </div>

            {/* Texture Info */}
            <div className="p-3 bg-gray-800/50 rounded-lg text-xs text-gray-400 space-y-1">
              <div className="flex justify-between">
                <span>Category:</span>
                <span className="text-white capitalize">{generatedTexture.category}</span>
              </div>
              <div className="flex justify-between">
                <span>Resolution:</span>
                <span className="text-white">{generatedTexture.resolution.join('×')}</span>
              </div>
              <div className="flex justify-between">
                <span>Seamless:</span>
                <span className="text-white">{generatedTexture.seamless ? 'Yes' : 'No'}</span>
              </div>
              <div className="flex justify-between">
                <span>Roughness:</span>
                <span className="text-white">{generatedTexture.parameters.roughness_base.toFixed(2)}</span>
              </div>
              <div className="flex justify-between">
                <span>Metallic:</span>
                <span className="text-white">{generatedTexture.parameters.metallic_base.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* History */}
        {history.length > 0 && (
          <div className="space-y-2 pt-4 border-t border-gray-700">
            <label className="text-sm text-gray-400">Recent Textures</label>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {history.map(tex => (
                <button
                  key={tex.id}
                  onClick={() => setGeneratedTexture(tex)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                    generatedTexture?.id === tex.id ? 'border-purple-500' : 'border-transparent hover:border-gray-600'
                  }`}
                >
                  <img
                    src={`data:image/png;base64,${tex.maps.albedo}`}
                    alt={tex.prompt}
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TextureGenerator;
