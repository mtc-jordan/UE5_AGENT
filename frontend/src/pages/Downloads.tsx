/**
 * Downloads Page - UE5 AI Studio
 * 
 * Comprehensive download and setup page for:
 * - UE5 AI Studio Agent (Electron desktop app)
 * - UE5 MCP Bridge Plugin (UE5 C++ plugin)
 * 
 * Features:
 * - Download cards with version info
 * - Step-by-step installation guides
 * - System requirements
 * - Troubleshooting section
 * - Version checking
 */

import React, { useState, useEffect } from 'react';
import {
  Download,
  Package,
  Monitor,
  Cpu,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Copy,
  Check,
  RefreshCw,
  Settings,
  Plug,
  Terminal,
  FileCode,
  Zap,
  Shield,
  HelpCircle,
  BookOpen,
  ArrowRight,
  Loader2,
  AlertTriangle,
  Info} from 'lucide-react';

// Types
interface DownloadItem {
  filename: string;
  name: string;
  version: string;
  description: string;
  size: string;
  category: 'agent' | 'plugin';
  platform: string[];
  available: boolean;
  download_url: string | null;
}

interface DownloadsResponse {
  downloads: DownloadItem[];
}

// API functions
const API_BASE = '/api';

async function fetchDownloads(): Promise<DownloadsResponse> {
  const response = await fetch(`${API_BASE}/downloads`);
  if (!response.ok) throw new Error('Failed to fetch downloads');
  return response.json();
}

// Copy to clipboard hook
function useCopyToClipboard() {
  const [copied, setCopied] = useState<string | null>(null);

  const copy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  return { copied, copy };
}

// Collapsible Section Component
function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false}: {
  title: string;
  icon: React.ElementType;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border border-gray-700 rounded-lg overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 bg-gray-800/50 hover:bg-gray-800 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Icon className="w-5 h-5 text-blue-400" />
          <span className="font-medium text-white">{title}</span>
        </div>
        {isOpen ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>
      {isOpen && <div className="p-4 bg-gray-900/50">{children}</div>}
    </div>
  );
}

// Code Block Component
function CodeBlock({ code, language = 'bash' }: { code: string; language?: string }) {
  const { copied, copy } = useCopyToClipboard();
  const id = `code-${code.slice(0, 20)}`;

  return (
    <div className="relative group">
      <pre className="bg-gray-950 border border-gray-700 rounded-lg p-4 overflow-x-auto">
        <code className="text-sm text-gray-300 font-mono">{code}</code>
      </pre>
      <button
        onClick={() => copy(code, id)}
        className="absolute top-2 right-2 p-2 bg-gray-800 rounded-md opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-700"
        title="Copy to clipboard"
      >
        {copied === id ? (
          <Check className="w-4 h-4 text-green-400" />
        ) : (
          <Copy className="w-4 h-4 text-gray-400" />
        )}
      </button>
    </div>
  );
}

// Step Component
function Step({
  number,
  title,
  children}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-sm">
        {number}
      </div>
      <div className="flex-1 pb-6">
        <h4 className="font-medium text-white mb-2">{title}</h4>
        <div className="text-gray-400 text-sm space-y-2">{children}</div>
      </div>
    </div>
  );
}

// Download Card Component
function DownloadCard({
  item,
  onDownload,
  isDownloading}: {
  item: DownloadItem;
  onDownload: (item: DownloadItem) => void;
  isDownloading: boolean;
}) {
  const isAgent = item.category === 'agent';
  const Icon = isAgent ? Monitor : Plug;
  const gradientClass = isAgent
    ? 'from-blue-600 to-purple-600'
    : 'from-green-600 to-teal-600';

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden hover:border-gray-600 transition-all">
      {/* Header */}
      <div className={`bg-gradient-to-r ${gradientClass} p-6`}>
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 rounded-xl flex items-center justify-center">
            <Icon className="w-8 h-8 text-white" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">{item.name}</h3>
            <p className="text-white/80 text-sm">Version {item.version}</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4">
        <p className="text-gray-300">{item.description}</p>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="flex items-center gap-2 text-gray-400">
            <Package className="w-4 h-4" />
            <span>Size: {item.size}</span>
          </div>
          <div className="flex items-center gap-2 text-gray-400">
            <Cpu className="w-4 h-4" />
            <span>{item.platform.join(', ')}</span>
          </div>
        </div>

        {/* Status */}
        <div className="flex items-center gap-2">
          {item.available ? (
            <>
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-green-400 text-sm">Available for download</span>
            </>
          ) : (
            <>
              <AlertCircle className="w-4 h-4 text-yellow-400" />
              <span className="text-yellow-400 text-sm">Coming soon</span>
            </>
          )}
        </div>

        {/* Download Button */}
        <button
          onClick={() => onDownload(item)}
          disabled={!item.available || isDownloading}
          className={`w-full py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all ${
            item.available
              ? `bg-gradient-to-r ${gradientClass} hover:opacity-90 text-white`
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isDownloading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Downloading...</span>
            </>
          ) : (
            <>
              <Download className="w-5 h-5" />
              <span>Download {item.category === 'agent' ? 'Agent' : 'Plugin'}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// System Requirements Component
function SystemRequirements() {
  return (
    <div className="grid md:grid-cols-2 gap-6">
      {/* Agent Requirements */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Monitor className="w-6 h-6 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Desktop Agent Requirements</h3>
        </div>
        <ul className="space-y-3 text-gray-300 text-sm">
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span><strong>OS:</strong> Windows 10/11, macOS 10.15+, or Ubuntu 20.04+</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span><strong>RAM:</strong> 4GB minimum, 8GB recommended</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span><strong>Storage:</strong> 200MB free space</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span><strong>Network:</strong> Internet connection required</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span><strong>Dependencies:</strong> Node.js 18+ (bundled)</span>
          </li>
        </ul>
      </div>

      {/* Plugin Requirements */}
      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-3 mb-4">
          <Plug className="w-6 h-6 text-green-400" />
          <h3 className="text-lg font-semibold text-white">MCP Bridge Plugin Requirements</h3>
        </div>
        <ul className="space-y-3 text-gray-300 text-sm">
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span><strong>Engine:</strong> Unreal Engine 5.1, 5.2, 5.3, or 5.4</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span><strong>OS:</strong> Windows 10/11 or macOS 12+</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span><strong>Visual Studio:</strong> 2019 or 2022 (Windows)</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span><strong>Xcode:</strong> 14+ (macOS)</span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
            <span><strong>Project Type:</strong> C++ or Blueprint (with C++ enabled)</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

// Agent Installation Guide
function AgentInstallationGuide() {
  return (
    <div className="space-y-6">
      {/* Windows */}
      <CollapsibleSection title="Windows Installation" icon={Monitor} defaultOpen>
        <div className="space-y-4">
          <Step number={1} title="Download and Extract">
            <p>Download the ZIP file and extract it to a folder of your choice (e.g., <code className="bg-gray-800 px-2 py-1 rounded">C:\UE5-AI-Studio-Agent</code>)</p>
          </Step>
          <Step number={2} title="Install Dependencies">
            <p>Open Command Prompt in the extracted folder and run:</p>
            <CodeBlock code="npm install" />
          </Step>
          <Step number={3} title="Configure Connection">
            <p>Edit the <code className="bg-gray-800 px-2 py-1 rounded">config.json</code> file with your platform URL:</p>
            <CodeBlock code={`{
  "platformUrl": "https://your-ue5-ai-studio-url.com",
  "mcpPort": 3000,
  "autoConnect": true
}`} />
          </Step>
          <Step number={4} title="Start the Agent">
            <p>Run the agent using:</p>
            <CodeBlock code="npm start" />
            <p className="mt-2">Or double-click <code className="bg-gray-800 px-2 py-1 rounded">UE5-AI-Studio-Agent.exe</code> if using the pre-built version.</p>
          </Step>
        </div>
      </CollapsibleSection>

      {/* macOS */}
      <CollapsibleSection title="macOS Installation" icon={Monitor}>
        <div className="space-y-4">
          <Step number={1} title="Download and Extract">
            <p>Download the ZIP file and extract it:</p>
            <CodeBlock code="unzip UE5-AI-Studio-Agent-1.2.0.zip -d ~/Applications/UE5-AI-Studio-Agent" />
          </Step>
          <Step number={2} title="Install Dependencies">
            <p>Open Terminal and navigate to the folder:</p>
            <CodeBlock code={`cd ~/Applications/UE5-AI-Studio-Agent
npm install`} />
          </Step>
          <Step number={3} title="Configure and Start">
            <p>Edit config.json and start the agent:</p>
            <CodeBlock code="npm start" />
          </Step>
        </div>
      </CollapsibleSection>

      {/* Linux */}
      <CollapsibleSection title="Linux Installation" icon={Terminal}>
        <div className="space-y-4">
          <Step number={1} title="Download and Extract">
            <CodeBlock code={`wget https://your-platform/downloads/UE5-AI-Studio-Agent-1.2.0.zip
unzip UE5-AI-Studio-Agent-1.2.0.zip -d ~/ue5-ai-agent
cd ~/ue5-ai-agent`} />
          </Step>
          <Step number={2} title="Install and Run">
            <CodeBlock code={`npm install
npm start`} />
          </Step>
        </div>
      </CollapsibleSection>
    </div>
  );
}

// Plugin Installation Guide
function PluginInstallationGuide() {
  return (
    <div className="space-y-6">
      <CollapsibleSection title="Plugin Installation Steps" icon={Plug} defaultOpen>
        <div className="space-y-4">
          <Step number={1} title="Download and Extract the Plugin">
            <p>Download the MCP Bridge Plugin ZIP file and extract it.</p>
          </Step>
          <Step number={2} title="Copy to Your Project">
            <p>Copy the <code className="bg-gray-800 px-2 py-1 rounded">UE5MCPBridge</code> folder to your project's Plugins directory:</p>
            <CodeBlock code={`YourProject/
├── Content/
├── Source/
└── Plugins/
    └── UE5MCPBridge/    <-- Copy here
        ├── Source/
        ├── Resources/
        └── UE5MCPBridge.uplugin`} />
          </Step>
          <Step number={3} title="Regenerate Project Files">
            <p><strong>Windows:</strong> Right-click your .uproject file and select "Generate Visual Studio project files"</p>
            <p><strong>macOS:</strong> Right-click your .uproject file and select "Generate Xcode project files"</p>
          </Step>
          <Step number={4} title="Build and Enable the Plugin">
            <p>Open your project in Unreal Engine. Go to <strong>Edit → Plugins</strong>, search for "MCP Bridge" and enable it.</p>
            <p>Restart the editor when prompted.</p>
          </Step>
          <Step number={5} title="Configure MCP Settings">
            <p>Go to <strong>Edit → Project Settings → Plugins → MCP Bridge</strong> and configure:</p>
            <ul className="list-disc list-inside ml-4 mt-2 space-y-1">
              <li>MCP Server Port (default: 3000)</li>
              <li>Auto-start server on editor launch</li>
              <li>Enable/disable specific tool categories</li>
            </ul>
          </Step>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Engine Plugin Installation (Alternative)" icon={Settings}>
        <div className="space-y-4">
          <p className="text-gray-300">For use across multiple projects, install as an engine plugin:</p>
          <Step number={1} title="Locate Engine Plugins Folder">
            <CodeBlock code={`# Windows
C:\\Program Files\\Epic Games\\UE_5.x\\Engine\\Plugins\\

# macOS
/Users/Shared/Epic Games/UE_5.x/Engine/Plugins/`} />
          </Step>
          <Step number={2} title="Copy Plugin">
            <p>Copy the <code className="bg-gray-800 px-2 py-1 rounded">UE5MCPBridge</code> folder to the Engine Plugins directory.</p>
          </Step>
          <Step number={3} title="Rebuild Engine">
            <p>The plugin will be available in all projects after the next engine restart.</p>
          </Step>
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Available MCP Tools (101 Tools)" icon={Zap}>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { name: 'Actor Tools', count: 12, desc: 'Spawn, transform, delete actors' },
            { name: 'Selection Tools', count: 8, desc: 'Select, filter, group objects' },
            { name: 'Viewport Tools', count: 7, desc: 'Camera, focus, screenshot' },
            { name: 'Level Tools', count: 9, desc: 'Load, save, streaming' },
            { name: 'PIE Tools', count: 5, desc: 'Play, pause, stop simulation' },
            { name: 'Asset Tools', count: 11, desc: 'Import, export, manage assets' },
            { name: 'Blueprint Tools', count: 10, desc: 'Create, compile, edit BPs' },
            { name: 'Material Tools', count: 8, desc: 'Create, edit materials' },
            { name: 'Physics Tools', count: 6, desc: 'Collision, physics simulation' },
            { name: 'Editor Tools', count: 7, desc: 'Undo, redo, notifications' },
            { name: 'Bookmark Tools', count: 4, desc: 'Save, load view bookmarks' },
            { name: 'Component Tools', count: 6, desc: 'Add, remove, modify components' },
            { name: 'Animation Tools', count: 5, desc: 'Play, blend animations' },
            { name: 'Audio Tools', count: 4, desc: 'Sound, music controls' },
            { name: 'Landscape Tools', count: 9, desc: 'Terrain, foliage editing' },
          ].map((cat) => (
            <div key={cat.name} className="bg-gray-800 rounded-lg p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-white font-medium text-sm">{cat.name}</span>
                <span className="text-xs bg-blue-600 px-2 py-0.5 rounded-full">{cat.count}</span>
              </div>
              <p className="text-gray-400 text-xs">{cat.desc}</p>
            </div>
          ))}
        </div>
      </CollapsibleSection>
    </div>
  );
}

// Troubleshooting Section
function TroubleshootingSection() {
  const issues = [
    {
      title: 'Agent cannot connect to the platform',
      solutions: [
        'Verify the platformUrl in config.json is correct',
        'Check if the platform server is running and accessible',
        'Ensure your firewall allows outbound connections on port 443',
        'Try disabling VPN if you\'re using one',
      ]},
    {
      title: 'MCP Bridge plugin not appearing in UE5',
      solutions: [
        'Ensure the plugin is in the correct Plugins folder',
        'Regenerate project files after adding the plugin',
        'Check the Output Log for any plugin loading errors',
        'Verify you\'re using a compatible UE5 version (5.1-5.4)',
      ]},
    {
      title: 'Agent shows "Connection Lost" frequently',
      solutions: [
        'Check your internet connection stability',
        'Increase the reconnection timeout in config.json',
        'Enable "autoReconnect" option in settings',
        'Check if the platform server has rate limiting enabled',
      ]},
    {
      title: 'MCP tools not executing in UE5',
      solutions: [
        'Ensure the MCP server is running (check status in plugin settings)',
        'Verify the agent is connected to both platform and UE5',
        'Check if the specific tool category is enabled',
        'Look for error messages in the UE5 Output Log',
      ]},
    {
      title: 'Plugin compilation errors',
      solutions: [
        'Ensure you have the correct Visual Studio/Xcode version installed',
        'Clean and rebuild the project',
        'Check if all plugin dependencies are present',
        'Verify your project is a C++ project (not Blueprint-only)',
      ]},
  ];

  return (
    <div className="space-y-4">
      {issues.map((issue, index) => (
        <CollapsibleSection key={index} title={issue.title} icon={AlertTriangle}>
          <ul className="space-y-2">
            {issue.solutions.map((solution, sIndex) => (
              <li key={sIndex} className="flex items-start gap-2 text-gray-300 text-sm">
                <ArrowRight className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <span>{solution}</span>
              </li>
            ))}
          </ul>
        </CollapsibleSection>
      ))}
    </div>
  );
}

// Quick Start Guide
function QuickStartGuide() {
  return (
    <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-700/50 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <Zap className="w-6 h-6 text-yellow-400" />
        <h3 className="text-lg font-semibold text-white">Quick Start Guide</h3>
      </div>
      <div className="grid md:grid-cols-4 gap-4">
        <div className="text-center p-4">
          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold">1</span>
          </div>
          <h4 className="text-white font-medium mb-1">Download</h4>
          <p className="text-gray-400 text-sm">Get both the Agent and Plugin</p>
        </div>
        <div className="text-center p-4">
          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold">2</span>
          </div>
          <h4 className="text-white font-medium mb-1">Install Plugin</h4>
          <p className="text-gray-400 text-sm">Add MCP Bridge to your UE5 project</p>
        </div>
        <div className="text-center p-4">
          <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-white font-bold">3</span>
          </div>
          <h4 className="text-white font-medium mb-1">Run Agent</h4>
          <p className="text-gray-400 text-sm">Start the desktop agent</p>
        </div>
        <div className="text-center p-4">
          <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-3">
            <CheckCircle className="w-6 h-6 text-white" />
          </div>
          <h4 className="text-white font-medium mb-1">Connect</h4>
          <p className="text-gray-400 text-sm">Use AI to control UE5!</p>
        </div>
      </div>
    </div>
  );
}

// Main Downloads Page Component
export default function DownloadsPage() {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'downloads' | 'agent-guide' | 'plugin-guide' | 'troubleshooting'>('downloads');

  // Fetch downloads on mount
  useEffect(() => {
    loadDownloads();
  }, []);

  const loadDownloads = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchDownloads();
      setDownloads(data.downloads);
    } catch (err) {
      setError('Failed to load downloads. Please try again.');
      console.error('Error loading downloads:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (item: DownloadItem) => {
    if (!item.download_url) return;

    try {
      setDownloading(item.filename);
      
      // Create a link and trigger download
      const link = document.createElement('a');
      link.href = item.download_url;
      link.download = item.filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      // Simulate download delay for UX
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (err) {
      console.error('Download error:', err);
    } finally {
      setDownloading(null);
    }
  };

  const tabs = [
    { id: 'downloads', label: 'Downloads', icon: Download },
    { id: 'agent-guide', label: 'Agent Setup', icon: Monitor },
    { id: 'plugin-guide', label: 'Plugin Setup', icon: Plug },
    { id: 'troubleshooting', label: 'Troubleshooting', icon: HelpCircle },
  ] as const;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-900 via-purple-900 to-blue-900 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center">
              <Download className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">Downloads & Setup</h1>
              <p className="text-gray-300">Get started with UE5 AI Studio integration</p>
            </div>
          </div>
          
          {/* Quick Start */}
          <QuickStartGuide />
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-gray-800/50 border-b border-gray-700 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Error State */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/30 border border-red-700 rounded-lg flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <span className="text-red-300">{error}</span>
            <button
              onClick={loadDownloads}
              className="ml-auto px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-sm"
            >
              Retry
            </button>
          </div>
        )}

        {/* Downloads Tab */}
        {activeTab === 'downloads' && (
          <div className="space-y-8">
            {/* System Requirements */}
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-blue-400" />
                System Requirements
              </h2>
              <SystemRequirements />
            </section>

            {/* Download Cards */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-semibold flex items-center gap-2">
                  <Package className="w-5 h-5 text-green-400" />
                  Available Downloads
                </h2>
                <button
                  onClick={loadDownloads}
                  disabled={loading}
                  className="flex items-center gap-2 px-3 py-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm transition-colors"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-400" />
                </div>
              ) : (
                <div className="grid md:grid-cols-2 gap-6">
                  {downloads.map((item) => (
                    <DownloadCard
                      key={item.filename}
                      item={item}
                      onDownload={handleDownload}
                      isDownloading={downloading === item.filename}
                    />
                  ))}
                </div>
              )}
            </section>

            {/* Info Box */}
            <div className="bg-blue-900/30 border border-blue-700/50 rounded-xl p-6">
              <div className="flex items-start gap-4">
                <Info className="w-6 h-6 text-blue-400 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-white mb-2">Need Help?</h3>
                  <p className="text-gray-300 text-sm">
                    Check out the setup guides in the tabs above for detailed installation instructions.
                    If you encounter any issues, visit the Troubleshooting section or reach out to our support team.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Agent Guide Tab */}
        {activeTab === 'agent-guide' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <Monitor className="w-8 h-8 text-blue-400" />
              <div>
                <h2 className="text-2xl font-bold">Desktop Agent Installation Guide</h2>
                <p className="text-gray-400">Step-by-step instructions for setting up the UE5 AI Studio Agent</p>
              </div>
            </div>
            <AgentInstallationGuide />
          </div>
        )}

        {/* Plugin Guide Tab */}
        {activeTab === 'plugin-guide' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <Plug className="w-8 h-8 text-green-400" />
              <div>
                <h2 className="text-2xl font-bold">MCP Bridge Plugin Installation Guide</h2>
                <p className="text-gray-400">Step-by-step instructions for integrating the MCP Bridge with Unreal Engine 5</p>
              </div>
            </div>
            <PluginInstallationGuide />
          </div>
        )}

        {/* Troubleshooting Tab */}
        {activeTab === 'troubleshooting' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-6">
              <HelpCircle className="w-8 h-8 text-yellow-400" />
              <div>
                <h2 className="text-2xl font-bold">Troubleshooting Guide</h2>
                <p className="text-gray-400">Common issues and their solutions</p>
              </div>
            </div>
            <TroubleshootingSection />

            {/* Additional Resources */}
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6 mt-8">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-400" />
                Additional Resources
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <a
                  href="https://github.com/mtc-jordan/UE5_AGENT"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <FileCode className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="text-white font-medium">GitHub Repository</div>
                    <div className="text-gray-400 text-sm">Source code & issues</div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-500 ml-auto" />
                </a>
                <a
                  href="https://docs.unrealengine.com/5.0/en-US/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <BookOpen className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="text-white font-medium">UE5 Documentation</div>
                    <div className="text-gray-400 text-sm">Official Unreal docs</div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-500 ml-auto" />
                </a>
                <a
                  href="#"
                  className="flex items-center gap-3 p-4 bg-gray-700/50 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  <HelpCircle className="w-5 h-5 text-gray-400" />
                  <div>
                    <div className="text-white font-medium">Support</div>
                    <div className="text-gray-400 text-sm">Get help from our team</div>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-500 ml-auto" />
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
