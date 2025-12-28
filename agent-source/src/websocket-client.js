/**
 * WebSocket Client for UE5 AI Studio Cloud Platform
 * 
 * Handles:
 * - Connection to cloud platform
 * - Authentication
 * - Heartbeat
 * - Automatic reconnection
 * - Message routing
 */

const WebSocket = require('ws');
const EventEmitter = require('events');

class WebSocketClient extends EventEmitter {
  constructor(serverUrl, token) {
    super();
    this.serverUrl = serverUrl;
    this.token = token;
    this.ws = null;
    this.connectionId = null;
    this.heartbeatInterval = null;
    this.heartbeatTimeout = 30000; // 30 seconds
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 10;
    this.reconnectDelay = 1000; // Start with 1 second
    this.maxReconnectDelay = 60000; // Max 60 seconds
    this.isConnecting = false;
    this.shouldReconnect = true;
  }

  /**
   * Connect to the cloud platform
   */
  async connect() {
    if (this.isConnecting) {
      return;
    }

    this.isConnecting = true;
    this.shouldReconnect = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.serverUrl);

        this.ws.on('open', () => {
          console.log('WebSocket connected, authenticating...');
          this.authenticate();
        });

        this.ws.on('message', (data) => {
          this.handleMessage(data, resolve, reject);
        });

        this.ws.on('close', (code, reason) => {
          console.log(`WebSocket closed: ${code} - ${reason}`);
          this.cleanup();
          this.emit('disconnected', reason.toString() || 'Connection closed');
          
          if (this.shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
            this.scheduleReconnect();
          }
        });

        this.ws.on('error', (error) => {
          console.error('WebSocket error:', error.message);
          this.emit('error', error);
          
          if (this.isConnecting) {
            this.isConnecting = false;
            reject(error);
          }
        });

      } catch (error) {
        this.isConnecting = false;
        reject(error);
      }
    });
  }

  /**
   * Send authentication message
   */
  authenticate() {
    this.send({
      type: 'auth_request',
      token: this.token,
      metadata: {
        platform: process.platform,
        version: require('../package.json').version,
        hostname: require('os').hostname()
      }
    });
  }

  /**
   * Handle incoming messages
   */
  handleMessage(data, connectResolve, connectReject) {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'auth_success':
          console.log('Authentication successful');
          this.connectionId = message.connection_id;
          this.heartbeatTimeout = (message.heartbeat_interval || 30) * 1000;
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.startHeartbeat();
          this.emit('connected');
          if (connectResolve) connectResolve();
          break;

        case 'auth_failure':
          console.error('Authentication failed:', message.reason);
          this.isConnecting = false;
          this.shouldReconnect = false;
          const error = new Error(message.reason || 'Authentication failed');
          this.emit('error', error);
          if (connectReject) connectReject(error);
          break;

        case 'heartbeat_ack':
          // Heartbeat acknowledged, connection is healthy
          break;

        case 'mcp_connect':
        case 'mcp_disconnect':
        case 'mcp_call':
        case 'mcp_tools_list':
          // Forward commands to main process
          this.emit('command', message);
          break;

        case 'error':
          console.error('Server error:', message.error);
          this.emit('error', new Error(message.error));
          break;

        default:
          console.log('Unknown message type:', message.type);
      }
    } catch (error) {
      console.error('Error parsing message:', error);
    }
  }

  /**
   * Send a message to the server
   */
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Start heartbeat timer
   */
  startHeartbeat() {
    this.stopHeartbeat();
    
    this.heartbeatInterval = setInterval(() => {
      this.send({
        type: 'heartbeat',
        timestamp: new Date().toISOString(),
        ue5_status: this.ue5Status || 'disconnected'
      });
    }, this.heartbeatTimeout);
  }

  /**
   * Stop heartbeat timer
   */
  stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  scheduleReconnect() {
    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );
    
    console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})`);
    
    setTimeout(() => {
      this.reconnectAttempts++;
      this.connect().catch(() => {
        // Error already handled in connect()
      });
    }, delay);
  }

  /**
   * Cleanup resources
   */
  cleanup() {
    this.stopHeartbeat();
    this.isConnecting = false;
    this.connectionId = null;
  }

  /**
   * Disconnect from the server
   */
  async disconnect() {
    this.shouldReconnect = false;
    this.cleanup();
    
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
  }

  /**
   * Update UE5 status for heartbeat
   */
  setUE5Status(status) {
    this.ue5Status = status;
  }
}

module.exports = WebSocketClient;
