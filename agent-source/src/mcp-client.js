/**
 * MCP Client for Local UE5 Connection
 * 
 * Handles:
 * - TCP connection to local MCP server
 * - Tool discovery
 * - Tool execution
 * - Connection health monitoring
 */

const net = require('net');
const EventEmitter = require('events');

class MCPClient extends EventEmitter {
  constructor(host = '127.0.0.1', port = 55557) {
    super();
    this.host = host || '127.0.0.1';
    this.port = parseInt(port) || 55557;
    console.log(`MCPClient initialized with host=${this.host}, port=${this.port}`);
    this.socket = null;
    this.tools = [];
    this.pendingRequests = new Map();
    this.requestId = 0;
    this.buffer = '';
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.shouldReconnect = true;
    this.reconnectTimer = null;
  }

  /**
   * Connect to the MCP server
   */
  async connect() {
    return new Promise((resolve, reject) => {
      this.shouldReconnect = true;
      
      this.socket = new net.Socket();
      
      this.socket.on('connect', async () => {
        console.log(`Connected to MCP server at ${this.host}:${this.port}`);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        
        // Cancel any pending reconnect timer since we're now connected
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        
        // Initialize MCP protocol
        try {
          console.log('Starting MCP initialization...');
          await this.initialize();
          console.log('MCP initialization complete, discovering tools...');
          await this.discoverTools();
          console.log('Tool discovery complete, emitting connected event');
          this.emit('connected');
          resolve();
        } catch (error) {
          console.error('Error during MCP initialization:', error.message);
          this.emit('error', error);
          reject(error);
        }
      });

      this.socket.on('data', (data) => {
        this.handleData(data);
      });

      this.socket.on('close', (hadError) => {
        console.log(`MCP connection closed (hadError: ${hadError})`);
        this.isConnected = false;
        this.emit('disconnected', 'Connection closed');
        
        if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
          this.scheduleReconnect();
        }
      });

      this.socket.on('error', (error) => {
        console.error('MCP socket error:', error.message);
        console.error('Error code:', error.code);
        console.error('Error details:', JSON.stringify(error, Object.getOwnPropertyNames(error)));
        this.emit('error', error);
        
        if (!this.isConnected) {
          reject(error);
        }
      });

      // Force IPv4 to avoid ::1 (IPv6) issues
      const connectHost = this.host === 'localhost' ? '127.0.0.1' : this.host;
      console.log(`Attempting to connect to ${connectHost}:${this.port} (original host: ${this.host})...`);
      this.socket.connect({
        port: this.port,
        host: connectHost,
        family: 4  // Force IPv4
      });
    });
  }

  /**
   * Initialize MCP protocol
   */
  async initialize() {
    const response = await this.sendRequest('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: { listChanged: true },
        sampling: {}
      },
      clientInfo: {
        name: 'ue5-ai-studio-agent',
        version: '1.0.0'
      }
    });
    
    console.log('MCP initialized:', response);
    return response;
  }

  /**
   * Discover available tools
   */
  async discoverTools() {
    try {
      const response = await this.sendRequest('tools/list', {});
      this.tools = response.tools || [];
      console.log(`Discovered ${this.tools.length} MCP tools`);
      return this.tools;
    } catch (error) {
      console.error('Error discovering tools:', error);
      this.tools = [];
      return [];
    }
  }

  /**
   * Get available tools
   */
  async getTools() {
    if (this.tools.length === 0) {
      await this.discoverTools();
    }
    return this.tools;
  }

  /**
   * Call an MCP tool
   */
  async callTool(toolName, parameters = {}) {
    if (!this.isConnected) {
      throw new Error('Not connected to MCP server');
    }

    const response = await this.sendRequest('tools/call', {
      name: toolName,
      arguments: parameters
    });

    // Special handling for take_screenshot - read file and convert to base64
    if (toolName === 'take_screenshot') {
      return await this.processScreenshotResult(response);
    }

    return response;
  }

  /**
   * Process screenshot result - read file from disk and convert to base64
   * The UE5 screenshot is saved locally, so we can read it directly
   */
  async processScreenshotResult(response) {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      // Check if response already has base64 data
      if (response && response.base64) {
        return response;
      }
      
      // Extract file path from response
      let filePath = null;
      
      if (typeof response === 'string') {
        // Parse "Screenshot requested: path" format
        const match = response.match(/Screenshot requested:\s*(.+?)(?:\s*$)/);
        if (match) {
          filePath = match[1].trim();
        } else {
          filePath = response;
        }
      } else if (response && response.content && Array.isArray(response.content)) {
        // MCP format with content array
        const textContent = response.content.find(c => c.type === 'text');
        if (textContent && textContent.text) {
          const match = textContent.text.match(/Screenshot requested:\s*(.+?)(?:\s*$)/);
          if (match) {
            filePath = match[1].trim();
          }
        }
      } else if (response && response.file_path) {
        filePath = response.file_path;
      }
      
      if (!filePath) {
        console.log('Could not extract file path from screenshot response:', response);
        return response;
      }
      
      // Normalize path
      filePath = filePath.replace(/\\/g, '/');
      if (!filePath.toLowerCase().endsWith('.png')) {
        filePath = filePath + '.png';
      }
      
      console.log(`Waiting for screenshot file: ${filePath}`);
      
      // Wait for file to be written (async operation in UE5)
      const maxWait = 5000; // 5 seconds
      const checkInterval = 200; // 200ms
      let waited = 0;
      let lastSize = -1;
      let stableCount = 0;
      
      while (waited < maxWait) {
        try {
          const stats = await fs.stat(filePath);
          if (stats.size > 0) {
            if (stats.size === lastSize) {
              stableCount++;
              if (stableCount >= 2) {
                // File size stable, read it
                const imageBuffer = await fs.readFile(filePath);
                const base64Data = imageBuffer.toString('base64');
                
                console.log(`Screenshot read successfully: ${imageBuffer.length} bytes`);
                
                return {
                  success: true,
                  file_path: filePath,
                  base64: base64Data,
                  width: 1280,
                  height: 720
                };
              }
            } else {
              stableCount = 0;
            }
            lastSize = stats.size;
          }
        } catch (err) {
          // File doesn't exist yet, keep waiting
        }
        
        await new Promise(resolve => setTimeout(resolve, checkInterval));
        waited += checkInterval;
      }
      
      console.log(`Timeout waiting for screenshot file: ${filePath}`);
      return response;
      
    } catch (error) {
      console.error('Error processing screenshot:', error);
      return response;
    }
  }

  /**
   * Send a JSON-RPC request
   */
  sendRequest(method, params) {
    return new Promise((resolve, reject) => {
      const id = ++this.requestId;
      
      const request = {
        jsonrpc: '2.0',
        id,
        method,
        params
      };

      this.pendingRequests.set(id, { resolve, reject });

      // Set timeout for request
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          reject(new Error(`Request timeout: ${method}`));
        }
      }, 30000);

      const message = JSON.stringify(request) + '\n';
      console.log(`Sending request: ${method} (id=${id})`);
      console.log(`Request payload: ${message.substring(0, 200)}...`);
      this.socket.write(message);
    });
  }

  /**
   * Handle incoming data
   */
  handleData(data) {
    const dataStr = data.toString();
    console.log(`Received data (${dataStr.length} bytes): ${dataStr.substring(0, 200)}...`);
    this.buffer += dataStr;
    
    // Process complete messages (newline-delimited JSON)
    let newlineIndex;
    while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
      const messageStr = this.buffer.slice(0, newlineIndex);
      this.buffer = this.buffer.slice(newlineIndex + 1);
      
      if (messageStr.trim()) {
        try {
          const message = JSON.parse(messageStr);
          this.handleMessage(message);
        } catch (error) {
          console.error('Error parsing MCP message:', error);
        }
      }
    }
  }

  /**
   * Handle a parsed message
   */
  handleMessage(message) {
    // Handle JSON-RPC response
    if (message.id !== undefined) {
      const pending = this.pendingRequests.get(message.id);
      if (pending) {
        this.pendingRequests.delete(message.id);
        
        if (message.error) {
          pending.reject(new Error(message.error.message || 'MCP error'));
        } else {
          pending.resolve(message.result);
        }
      }
    }
    
    // Handle notifications
    if (message.method && !message.id) {
      this.handleNotification(message);
    }
  }

  /**
   * Handle MCP notifications
   */
  handleNotification(notification) {
    switch (notification.method) {
      case 'notifications/tools/list_changed':
        // Tools have changed, rediscover
        this.discoverTools();
        break;
      
      default:
        console.log('MCP notification:', notification.method);
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    // Cancel any existing reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`Reconnecting to MCP in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
    
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      if (!this.shouldReconnect) {
        console.log('Reconnect cancelled - shouldReconnect is false');
        return;
      }
      this.reconnectAttempts++;
      this.connect().catch(() => {
        // Error already handled
      });
    }, delay);
  }

  /**
   * Disconnect from MCP server
   */
  async disconnect() {
    this.shouldReconnect = false;
    this.isConnected = false;
    
    // Cancel any pending reconnect
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Cancel pending requests
    for (const [id, pending] of this.pendingRequests) {
      pending.reject(new Error('Connection closed'));
    }
    this.pendingRequests.clear();
    
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }
}

module.exports = MCPClient;
