/**
 * Command Templates & Workflow Presets
 * 
 * Features:
 * - Saveable command templates with customizable parameters
 * - Workflow presets for common tasks
 * - Parameter history remembering frequently used values
 * - One-click workflow execution
 * - Import/Export workflows
 */

import React, { useState, useEffect } from 'react';
import {
  FileText, Play, Plus, Edit2, Trash2, Download, Upload,
  ChevronDown, ChevronRight, Star, StarOff, Search,
  Clock, Zap,
  ArrowRight, Layers, History
} from 'lucide-react';

// Types
interface TemplateParameter {
  id: string;
  name: string;
  type: 'string' | 'number' | 'boolean' | 'select' | 'position' | 'color';
  defaultValue: any;
  options?: string[]; // For select type
  min?: number; // For number type
  max?: number;
  step?: number;
  description?: string;
  required?: boolean;
}

interface CommandTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  command: string; // Template string with {{param}} placeholders
  parameters: TemplateParameter[];
  tags: string[];
  isFavorite: boolean;
  usageCount: number;
  lastUsed?: Date;
  createdAt: Date;
  isBuiltIn: boolean;
}

interface WorkflowStep {
  id: string;
  templateId: string;
  templateName: string;
  parameters: Record<string, any>;
  condition?: string; // Optional condition for execution
  delay?: number; // Delay before execution in ms
}

interface WorkflowPreset {
  id: string;
  name: string;
  description: string;
  category: string;
  steps: WorkflowStep[];
  tags: string[];
  isFavorite: boolean;
  usageCount: number;
  lastUsed?: Date;
  createdAt: Date;
  isBuiltIn: boolean;
  estimatedDuration?: number;
}

interface ParameterHistory {
  parameterId: string;
  values: any[];
  lastUsed: Date;
}

interface CommandTemplatesProps {
  onExecuteTemplate: (command: string, parameters: Record<string, any>) => void;
  onExecuteWorkflow: (steps: WorkflowStep[]) => void;
  isConnected: boolean;
  isExecuting: boolean;
}

// Glass Card Component
const GlassCard: React.FC<{
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}> = ({ children, className = '', hover = true }) => (
  <div className={`
    bg-white/5 backdrop-blur-xl rounded-2xl border border-white/10
    ${hover ? 'hover:bg-white/[0.07] hover:border-white/20' : ''}
    transition-all duration-300 ${className}
  `}>
    {children}
  </div>
);

// Built-in templates
const BUILT_IN_TEMPLATES: CommandTemplate[] = [
  {
    id: 'spawn-actor',
    name: 'Spawn Actor',
    description: 'Spawn an actor at a specific location',
    category: 'Scene',
    command: 'Spawn a {{actorType}} at position ({{x}}, {{y}}, {{z}}) with name "{{name}}"',
    parameters: [
      { id: 'actorType', name: 'Actor Type', type: 'select', defaultValue: 'Cube', options: ['Cube', 'Sphere', 'Cylinder', 'Cone', 'Plane', 'PointLight', 'SpotLight'], required: true },
      { id: 'name', name: 'Actor Name', type: 'string', defaultValue: 'NewActor', required: true },
      { id: 'x', name: 'X Position', type: 'number', defaultValue: 0, step: 10 },
      { id: 'y', name: 'Y Position', type: 'number', defaultValue: 0, step: 10 },
      { id: 'z', name: 'Z Position', type: 'number', defaultValue: 100, step: 10 },
    ],
    tags: ['spawn', 'actor', 'create'],
    isFavorite: false,
    usageCount: 0,
    createdAt: new Date(),
    isBuiltIn: true,
  },
  {
    id: 'create-material',
    name: 'Create Material',
    description: 'Create a new material with specified properties',
    category: 'Materials',
    command: 'Create a {{materialType}} material named "{{name}}" with base color {{color}}',
    parameters: [
      { id: 'name', name: 'Material Name', type: 'string', defaultValue: 'M_NewMaterial', required: true },
      { id: 'materialType', name: 'Material Type', type: 'select', defaultValue: 'Standard', options: ['Standard', 'Metallic', 'Glass', 'Emissive', 'Subsurface'], required: true },
      { id: 'color', name: 'Base Color', type: 'color', defaultValue: '#808080' },
    ],
    tags: ['material', 'create', 'shader'],
    isFavorite: false,
    usageCount: 0,
    createdAt: new Date(),
    isBuiltIn: true,
  },
  {
    id: 'set-transform',
    name: 'Set Transform',
    description: 'Set the transform of a selected actor',
    category: 'Transform',
    command: 'Set {{property}} of selected actor to ({{x}}, {{y}}, {{z}})',
    parameters: [
      { id: 'property', name: 'Property', type: 'select', defaultValue: 'Location', options: ['Location', 'Rotation', 'Scale'], required: true },
      { id: 'x', name: 'X', type: 'number', defaultValue: 0, step: 1 },
      { id: 'y', name: 'Y', type: 'number', defaultValue: 0, step: 1 },
      { id: 'z', name: 'Z', type: 'number', defaultValue: 0, step: 1 },
    ],
    tags: ['transform', 'move', 'rotate', 'scale'],
    isFavorite: false,
    usageCount: 0,
    createdAt: new Date(),
    isBuiltIn: true,
  },
  {
    id: 'add-light',
    name: 'Add Light',
    description: 'Add a light to the scene',
    category: 'Lighting',
    command: 'Add a {{lightType}} light at position ({{x}}, {{y}}, {{z}}) with intensity {{intensity}} and color {{color}}',
    parameters: [
      { id: 'lightType', name: 'Light Type', type: 'select', defaultValue: 'Point', options: ['Point', 'Spot', 'Directional', 'Rect', 'Sky'], required: true },
      { id: 'x', name: 'X Position', type: 'number', defaultValue: 0, step: 10 },
      { id: 'y', name: 'Y Position', type: 'number', defaultValue: 0, step: 10 },
      { id: 'z', name: 'Z Position', type: 'number', defaultValue: 300, step: 10 },
      { id: 'intensity', name: 'Intensity', type: 'number', defaultValue: 5000, min: 0, max: 100000, step: 100 },
      { id: 'color', name: 'Light Color', type: 'color', defaultValue: '#FFFFFF' },
    ],
    tags: ['light', 'lighting', 'illumination'],
    isFavorite: false,
    usageCount: 0,
    createdAt: new Date(),
    isBuiltIn: true,
  },
  {
    id: 'play-animation',
    name: 'Play Animation',
    description: 'Play an animation on selected actor',
    category: 'Animation',
    command: 'Play animation "{{animationName}}" on selected actor with speed {{speed}} and {{looping}}',
    parameters: [
      { id: 'animationName', name: 'Animation', type: 'select', defaultValue: 'Idle', options: ['Idle', 'Walk', 'Run', 'Jump', 'Attack', 'Death'], required: true },
      { id: 'speed', name: 'Playback Speed', type: 'number', defaultValue: 1, min: 0.1, max: 5, step: 0.1 },
      { id: 'looping', name: 'Looping', type: 'select', defaultValue: 'loop', options: ['loop', 'once', 'ping-pong'] },
    ],
    tags: ['animation', 'play', 'sequence'],
    isFavorite: false,
    usageCount: 0,
    createdAt: new Date(),
    isBuiltIn: true,
  },
];

// Built-in workflow presets
const BUILT_IN_WORKFLOWS: WorkflowPreset[] = [
  {
    id: 'level-setup',
    name: 'Basic Level Setup',
    description: 'Set up a basic level with floor, lighting, and player start',
    category: 'Level Design',
    steps: [
      { id: '1', templateId: 'spawn-actor', templateName: 'Spawn Actor', parameters: { actorType: 'Plane', name: 'Floor', x: 0, y: 0, z: 0 } },
      { id: '2', templateId: 'add-light', templateName: 'Add Light', parameters: { lightType: 'Directional', x: 0, y: 0, z: 1000, intensity: 10000, color: '#FFF5E0' }, delay: 500 },
      { id: '3', templateId: 'add-light', templateName: 'Add Light', parameters: { lightType: 'Sky', x: 0, y: 0, z: 0, intensity: 1, color: '#87CEEB' }, delay: 500 },
    ],
    tags: ['setup', 'level', 'basic'],
    isFavorite: false,
    usageCount: 0,
    createdAt: new Date(),
    isBuiltIn: true,
    estimatedDuration: 3000,
  },
  {
    id: 'three-point-lighting',
    name: 'Three-Point Lighting',
    description: 'Professional three-point lighting setup',
    category: 'Lighting',
    steps: [
      { id: '1', templateId: 'add-light', templateName: 'Key Light', parameters: { lightType: 'Spot', x: 500, y: -300, z: 400, intensity: 15000, color: '#FFF8F0' } },
      { id: '2', templateId: 'add-light', templateName: 'Fill Light', parameters: { lightType: 'Point', x: -400, y: 200, z: 300, intensity: 5000, color: '#E8F0FF' }, delay: 300 },
      { id: '3', templateId: 'add-light', templateName: 'Back Light', parameters: { lightType: 'Spot', x: 0, y: 500, z: 400, intensity: 8000, color: '#FFFFFF' }, delay: 300 },
    ],
    tags: ['lighting', 'professional', 'studio'],
    isFavorite: false,
    usageCount: 0,
    createdAt: new Date(),
    isBuiltIn: true,
    estimatedDuration: 2000,
  },
  {
    id: 'prop-scatter',
    name: 'Prop Scatter',
    description: 'Scatter multiple props in the scene',
    category: 'Scene',
    steps: [
      { id: '1', templateId: 'spawn-actor', templateName: 'Spawn Actor', parameters: { actorType: 'Cube', name: 'Prop_1', x: -200, y: 100, z: 50 } },
      { id: '2', templateId: 'spawn-actor', templateName: 'Spawn Actor', parameters: { actorType: 'Sphere', name: 'Prop_2', x: 150, y: -80, z: 50 }, delay: 200 },
      { id: '3', templateId: 'spawn-actor', templateName: 'Spawn Actor', parameters: { actorType: 'Cylinder', name: 'Prop_3', x: -50, y: 200, z: 50 }, delay: 200 },
      { id: '4', templateId: 'spawn-actor', templateName: 'Spawn Actor', parameters: { actorType: 'Cone', name: 'Prop_4', x: 300, y: 150, z: 50 }, delay: 200 },
    ],
    tags: ['props', 'scatter', 'populate'],
    isFavorite: false,
    usageCount: 0,
    createdAt: new Date(),
    isBuiltIn: true,
    estimatedDuration: 1500,
  },
];

// Parameter Input Component
const ParameterInput: React.FC<{
  parameter: TemplateParameter;
  value: any;
  onChange: (value: any) => void;
  history?: any[];
}> = ({ parameter, value, onChange, history }) => {
  const [showHistory, setShowHistory] = useState(false);

  const renderInput = () => {
    switch (parameter.type) {
      case 'string':
        return (
          <input
            type="text"
            value={value || ''}
            onChange={(e) => onChange(e.target.value)}
            placeholder={parameter.defaultValue}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
          />
        );
      case 'number':
        return (
          <input
            type="number"
            value={value ?? parameter.defaultValue}
            onChange={(e) => onChange(Number(e.target.value))}
            min={parameter.min}
            max={parameter.max}
            step={parameter.step}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/50"
          />
        );
      case 'boolean':
        return (
          <button
            onClick={() => onChange(!value)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              value ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-white/5 text-gray-400 border border-white/10'
            }`}
          >
            {value ? 'Yes' : 'No'}
          </button>
        );
      case 'select':
        return (
          <select
            value={value || parameter.defaultValue}
            onChange={(e) => onChange(e.target.value)}
            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-cyan-500/50"
          >
            {parameter.options?.map((option) => (
              <option key={option} value={option} className="bg-gray-900">
                {option}
              </option>
            ))}
          </select>
        );
      case 'color':
        return (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={value || parameter.defaultValue}
              onChange={(e) => onChange(e.target.value)}
              className="w-10 h-10 rounded-lg cursor-pointer border-0"
            />
            <input
              type="text"
              value={value || parameter.defaultValue}
              onChange={(e) => onChange(e.target.value)}
              className="flex-1 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white font-mono text-sm focus:outline-none focus:border-cyan-500/50"
            />
          </div>
        );
      case 'position':
        return (
          <div className="grid grid-cols-3 gap-2">
            {['X', 'Y', 'Z'].map((axis, index) => (
              <div key={axis}>
                <label className="text-xs text-gray-500 mb-1 block">{axis}</label>
                <input
                  type="number"
                  value={value?.[index] ?? 0}
                  onChange={(e) => {
                    const newValue = [...(value || [0, 0, 0])];
                    newValue[index] = Number(e.target.value);
                    onChange(newValue);
                  }}
                  className="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500/50"
                />
              </div>
            ))}
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <label className="text-sm text-gray-300">
          {parameter.name}
          {parameter.required && <span className="text-red-400 ml-1">*</span>}
        </label>
        {history && history.length > 0 && (
          <button
            onClick={() => setShowHistory(!showHistory)}
            className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1"
          >
            <History className="w-3 h-3" />
            History
          </button>
        )}
      </div>
      {parameter.description && (
        <p className="text-xs text-gray-500">{parameter.description}</p>
      )}
      {renderInput()}
      {showHistory && history && history.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {history.slice(0, 5).map((histValue, index) => (
            <button
              key={index}
              onClick={() => {
                onChange(histValue);
                setShowHistory(false);
              }}
              className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-xs text-gray-400 hover:text-white transition-colors"
            >
              {typeof histValue === 'object' ? JSON.stringify(histValue) : String(histValue)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// Template Card Component
const TemplateCard: React.FC<{
  template: CommandTemplate;
  onExecute: (template: CommandTemplate, parameters: Record<string, any>) => void;
  onEdit?: (template: CommandTemplate) => void;
  onDelete?: (templateId: string) => void;
  onToggleFavorite: (templateId: string) => void;
  isExecuting: boolean;
  parameterHistory: ParameterHistory[];
}> = ({ template, onExecute, onEdit, onDelete, onToggleFavorite, isExecuting, parameterHistory }) => {
  const [expanded, setExpanded] = useState(false);
  const [parameters, setParameters] = useState<Record<string, any>>(() => {
    const initial: Record<string, any> = {};
    template.parameters.forEach((p) => {
      initial[p.id] = p.defaultValue;
    });
    return initial;
  });

  const handleExecute = () => {
    onExecute(template, parameters);
  };

  const getHistoryForParameter = (parameterId: string): any[] => {
    const history = parameterHistory.find((h) => h.parameterId === `${template.id}-${parameterId}`);
    return history?.values || [];
  };

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden hover:border-white/20 transition-colors">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-white">{template.name}</h4>
              {template.isBuiltIn && (
                <span className="px-1.5 py-0.5 bg-cyan-500/20 text-cyan-400 text-xs rounded">Built-in</span>
              )}
            </div>
            <p className="text-sm text-gray-400 mt-1">{template.description}</p>
          </div>
          <button
            onClick={() => onToggleFavorite(template.id)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            {template.isFavorite ? (
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            ) : (
              <StarOff className="w-4 h-4 text-gray-500" />
            )}
          </button>
        </div>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mt-2">
          {template.tags.map((tag) => (
            <span key={tag} className="px-2 py-0.5 bg-white/5 text-gray-400 text-xs rounded-full">
              {tag}
            </span>
          ))}
        </div>

        {/* Usage stats */}
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            Used {template.usageCount}x
          </span>
          {template.lastUsed && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {template.lastUsed.toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      {/* Expand/Collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 bg-white/5 flex items-center justify-between text-sm text-gray-400 hover:text-white transition-colors"
      >
        <span>{expanded ? 'Hide Parameters' : 'Configure & Execute'}</span>
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* Parameters */}
      {expanded && (
        <div className="p-4 border-t border-white/10 space-y-4">
          {template.parameters.map((param) => (
            <ParameterInput
              key={param.id}
              parameter={param}
              value={parameters[param.id]}
              onChange={(value) => setParameters({ ...parameters, [param.id]: value })}
              history={getHistoryForParameter(param.id)}
            />
          ))}

          {/* Preview */}
          <div className="p-3 bg-black/30 rounded-lg">
            <p className="text-xs text-gray-500 mb-1">Command Preview:</p>
            <p className="text-sm text-cyan-400 font-mono">
              {template.command.replace(/\{\{(\w+)\}\}/g, (_, key) => parameters[key] ?? `{{${key}}}`)}
            </p>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleExecute}
              disabled={isExecuting}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-violet-500 to-cyan-500 hover:from-violet-600 hover:to-cyan-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-all flex items-center justify-center gap-2"
            >
              {isExecuting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Executing...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Execute
                </>
              )}
            </button>
            {!template.isBuiltIn && onEdit && (
              <button
                onClick={() => onEdit(template)}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Edit2 className="w-4 h-4 text-gray-400" />
              </button>
            )}
            {!template.isBuiltIn && onDelete && (
              <button
                onClick={() => onDelete(template.id)}
                className="p-2 bg-white/5 hover:bg-red-500/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Workflow Card Component
const WorkflowCard: React.FC<{
  workflow: WorkflowPreset;
  onExecute: (workflow: WorkflowPreset) => void;
  onEdit?: (workflow: WorkflowPreset) => void;
  onDelete?: (workflowId: string) => void;
  onToggleFavorite: (workflowId: string) => void;
  onExport: (workflow: WorkflowPreset) => void;
  isExecuting: boolean;
}> = ({ workflow, onExecute, onEdit, onDelete, onToggleFavorite, onExport, isExecuting }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-white/5 rounded-xl border border-white/10 overflow-hidden hover:border-white/20 transition-colors">
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-medium text-white">{workflow.name}</h4>
              {workflow.isBuiltIn && (
                <span className="px-1.5 py-0.5 bg-green-500/20 text-green-400 text-xs rounded">Preset</span>
              )}
            </div>
            <p className="text-sm text-gray-400 mt-1">{workflow.description}</p>
          </div>
          <button
            onClick={() => onToggleFavorite(workflow.id)}
            className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          >
            {workflow.isFavorite ? (
              <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
            ) : (
              <StarOff className="w-4 h-4 text-gray-500" />
            )}
          </button>
        </div>

        {/* Steps preview */}
        <div className="flex items-center gap-1 mt-3">
          {workflow.steps.slice(0, 4).map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="px-2 py-1 bg-white/5 rounded text-xs text-gray-400 truncate max-w-[80px]">
                {step.templateName}
              </div>
              {index < Math.min(workflow.steps.length - 1, 3) && (
                <ArrowRight className="w-3 h-3 text-gray-600 flex-shrink-0" />
              )}
            </React.Fragment>
          ))}
          {workflow.steps.length > 4 && (
            <span className="text-xs text-gray-500">+{workflow.steps.length - 4} more</span>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Layers className="w-3 h-3" />
            {workflow.steps.length} steps
          </span>
          {workflow.estimatedDuration && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              ~{(workflow.estimatedDuration / 1000).toFixed(1)}s
            </span>
          )}
          <span className="flex items-center gap-1">
            <Zap className="w-3 h-3" />
            Used {workflow.usageCount}x
          </span>
        </div>
      </div>

      {/* Expand/Collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-4 py-2 bg-white/5 flex items-center justify-between text-sm text-gray-400 hover:text-white transition-colors"
      >
        <span>{expanded ? 'Hide Steps' : 'View Steps'}</span>
        {expanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
      </button>

      {/* Steps detail */}
      {expanded && (
        <div className="p-4 border-t border-white/10 space-y-3">
          {workflow.steps.map((step, index) => (
            <div key={step.id} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-gray-400 flex-shrink-0">
                {index + 1}
              </div>
              <div className="flex-1">
                <p className="text-sm text-white">{step.templateName}</p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {Object.entries(step.parameters).map(([key, value]) => (
                    <span key={key} className="px-1.5 py-0.5 bg-white/5 text-xs text-gray-400 rounded">
                      {key}: {String(value)}
                    </span>
                  ))}
                </div>
                {step.delay && (
                  <span className="text-xs text-gray-500 mt-1 block">Delay: {step.delay}ms</span>
                )}
              </div>
            </div>
          ))}

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={() => onExecute(workflow)}
              disabled={isExecuting}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white font-medium transition-all flex items-center justify-center gap-2"
            >
              {isExecuting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run Workflow
                </>
              )}
            </button>
            <button
              onClick={() => onExport(workflow)}
              className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
              title="Export Workflow"
            >
              <Download className="w-4 h-4 text-gray-400" />
            </button>
            {!workflow.isBuiltIn && onEdit && (
              <button
                onClick={() => onEdit(workflow)}
                className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
              >
                <Edit2 className="w-4 h-4 text-gray-400" />
              </button>
            )}
            {!workflow.isBuiltIn && onDelete && (
              <button
                onClick={() => onDelete(workflow.id)}
                className="p-2 bg-white/5 hover:bg-red-500/20 rounded-lg transition-colors"
              >
                <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// Main Command Templates Component
const CommandTemplates: React.FC<CommandTemplatesProps> = ({
  onExecuteTemplate,
  onExecuteWorkflow,
  isConnected,
  isExecuting
}) => {
  const [activeTab, setActiveTab] = useState<'templates' | 'workflows'>('templates');
  const [templates, setTemplates] = useState<CommandTemplate[]>(BUILT_IN_TEMPLATES);
  const [workflows, setWorkflows] = useState<WorkflowPreset[]>(BUILT_IN_WORKFLOWS);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [parameterHistory, setParameterHistory] = useState<ParameterHistory[]>([]);

  // Load saved data from localStorage
  useEffect(() => {
    const savedTemplates = localStorage.getItem('ue5_command_templates');
    const savedWorkflows = localStorage.getItem('ue5_workflow_presets');
    const savedHistory = localStorage.getItem('ue5_parameter_history');

    if (savedTemplates) {
      const parsed = JSON.parse(savedTemplates);
      setTemplates([...BUILT_IN_TEMPLATES, ...parsed.filter((t: CommandTemplate) => !t.isBuiltIn)]);
    }
    if (savedWorkflows) {
      const parsed = JSON.parse(savedWorkflows);
      setWorkflows([...BUILT_IN_WORKFLOWS, ...parsed.filter((w: WorkflowPreset) => !w.isBuiltIn)]);
    }
    if (savedHistory) {
      setParameterHistory(JSON.parse(savedHistory));
    }
  }, []);

  // Save to localStorage
  useEffect(() => {
    localStorage.setItem('ue5_command_templates', JSON.stringify(templates.filter((t) => !t.isBuiltIn)));
    localStorage.setItem('ue5_workflow_presets', JSON.stringify(workflows.filter((w) => !w.isBuiltIn)));
    localStorage.setItem('ue5_parameter_history', JSON.stringify(parameterHistory));
  }, [templates, workflows, parameterHistory]);

  // Get unique categories
  const templateCategories = [...new Set(templates.map((t) => t.category))];
  const workflowCategories = [...new Set(workflows.map((w) => w.category))];
  const categories = activeTab === 'templates' ? templateCategories : workflowCategories;

  // Filter items
  const filteredTemplates = templates.filter((t) => {
    const matchesSearch = t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = !selectedCategory || t.category === selectedCategory;
    const matchesFavorite = !showFavoritesOnly || t.isFavorite;
    return matchesSearch && matchesCategory && matchesFavorite;
  });

  const filteredWorkflows = workflows.filter((w) => {
    const matchesSearch = w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = !selectedCategory || w.category === selectedCategory;
    const matchesFavorite = !showFavoritesOnly || w.isFavorite;
    return matchesSearch && matchesCategory && matchesFavorite;
  });

  // Handlers
  const handleExecuteTemplate = (template: CommandTemplate, parameters: Record<string, any>) => {
    const command = template.command.replace(/\{\{(\w+)\}\}/g, (_, key) => parameters[key] ?? '');
    onExecuteTemplate(command, parameters);

    // Update usage stats
    setTemplates((prev) =>
      prev.map((t) =>
        t.id === template.id
          ? { ...t, usageCount: t.usageCount + 1, lastUsed: new Date() }
          : t
      )
    );

    // Update parameter history
    Object.entries(parameters).forEach(([key, value]) => {
      const historyId = `${template.id}-${key}`;
      setParameterHistory((prev) => {
        const existing = prev.find((h) => h.parameterId === historyId);
        if (existing) {
          const newValues = [value, ...existing.values.filter((v) => v !== value)].slice(0, 10);
          return prev.map((h) =>
            h.parameterId === historyId ? { ...h, values: newValues, lastUsed: new Date() } : h
          );
        }
        return [...prev, { parameterId: historyId, values: [value], lastUsed: new Date() }];
      });
    });
  };

  const handleExecuteWorkflow = (workflow: WorkflowPreset) => {
    onExecuteWorkflow(workflow.steps);

    // Update usage stats
    setWorkflows((prev) =>
      prev.map((w) =>
        w.id === workflow.id
          ? { ...w, usageCount: w.usageCount + 1, lastUsed: new Date() }
          : w
      )
    );
  };

  const handleToggleTemplateFavorite = (templateId: string) => {
    setTemplates((prev) =>
      prev.map((t) => (t.id === templateId ? { ...t, isFavorite: !t.isFavorite } : t))
    );
  };

  const handleToggleWorkflowFavorite = (workflowId: string) => {
    setWorkflows((prev) =>
      prev.map((w) => (w.id === workflowId ? { ...w, isFavorite: !w.isFavorite } : w))
    );
  };

  const handleExportWorkflow = (workflow: WorkflowPreset) => {
    const data = JSON.stringify(workflow, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-${workflow.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportWorkflow = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target?.result as string) as WorkflowPreset;
        imported.id = `imported-${Date.now()}`;
        imported.isBuiltIn = false;
        imported.usageCount = 0;
        imported.createdAt = new Date();
        setWorkflows((prev) => [...prev, imported]);
      } catch (error) {
        console.error('Failed to import workflow:', error);
      }
    };
    reader.readAsText(file);
  };

  return (
    <GlassCard className="p-5" hover={false}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
            <FileText className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white">Command Templates & Workflows</h3>
            <p className="text-xs text-gray-400">Save time with reusable commands</p>
          </div>
        </div>
        {!isConnected && (
          <span className="px-2 py-1 bg-red-500/20 text-red-400 text-xs rounded-lg">Disconnected</span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-white/5 rounded-xl mb-4">
        <button
          onClick={() => {
            setActiveTab('templates');
            setSelectedCategory(null);
          }}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'templates'
              ? 'bg-gradient-to-r from-violet-500 to-purple-500 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Templates ({templates.length})
        </button>
        <button
          onClick={() => {
            setActiveTab('workflows');
            setSelectedCategory(null);
          }}
          className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            activeTab === 'workflows'
              ? 'bg-gradient-to-r from-green-500 to-emerald-500 text-white'
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Workflows ({workflows.length})
        </button>
      </div>

      {/* Search and filters */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={`Search ${activeTab}...`}
            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/50"
          />
        </div>
        <button
          onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
          className={`p-2 rounded-lg transition-colors ${
            showFavoritesOnly ? 'bg-yellow-500/20 text-yellow-400' : 'bg-white/5 text-gray-400 hover:text-white'
          }`}
          title="Show favorites only"
        >
          <Star className="w-5 h-5" />
        </button>
        {activeTab === 'workflows' && (
          <label className="p-2 bg-white/5 hover:bg-white/10 rounded-lg cursor-pointer transition-colors">
            <Upload className="w-5 h-5 text-gray-400" />
            <input
              type="file"
              accept=".json"
              onChange={handleImportWorkflow}
              className="hidden"
            />
          </label>
        )}
        <button
          onClick={() => setShowCreateModal(true)}
          className="p-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
          title={`Create new ${activeTab === 'templates' ? 'template' : 'workflow'}`}
        >
          <Plus className="w-5 h-5 text-gray-400" />
        </button>
      </div>

      {/* Category filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <button
          onClick={() => setSelectedCategory(null)}
          className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
            !selectedCategory
              ? 'bg-white/20 text-white'
              : 'bg-white/5 text-gray-400 hover:text-white'
          }`}
        >
          All
        </button>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => setSelectedCategory(category)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              selectedCategory === category
                ? 'bg-white/20 text-white'
                : 'bg-white/5 text-gray-400 hover:text-white'
            }`}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {activeTab === 'templates' ? (
          filteredTemplates.length > 0 ? (
            filteredTemplates.map((template) => (
              <TemplateCard
                key={template.id}
                template={template}
                onExecute={handleExecuteTemplate}
                onToggleFavorite={handleToggleTemplateFavorite}
                isExecuting={isExecuting}
                parameterHistory={parameterHistory}
              />
            ))
          ) : (
            <div className="text-center py-8 text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p>No templates found</p>
            </div>
          )
        ) : filteredWorkflows.length > 0 ? (
          filteredWorkflows.map((workflow) => (
            <WorkflowCard
              key={workflow.id}
              workflow={workflow}
              onExecute={handleExecuteWorkflow}
              onToggleFavorite={handleToggleWorkflowFavorite}
              onExport={handleExportWorkflow}
              isExecuting={isExecuting}
            />
          ))
        ) : (
          <div className="text-center py-8 text-gray-400">
            <Layers className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>No workflows found</p>
          </div>
        )}
      </div>
    </GlassCard>
  );
};

export default CommandTemplates;
export type { CommandTemplate, WorkflowPreset, WorkflowStep, TemplateParameter };
