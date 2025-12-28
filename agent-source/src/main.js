/**
 * UE5 AI Studio Local Agent
 * 
 * This agent runs on the user's local machine and provides:
 * - WebSocket connection to the cloud platform
 * - TCP connection to local UE5 MCP server
 * - Tool execution relay
 */

const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage, dialog } = require('electron');
const path = require('path');
const Store = require('electron-store');

const WebSocketClient = require('./websocket-client');
const MCPClient = require('./mcp-client');

// Default configuration
const defaultConfig = {
  serverUrl: 'wss://your-server.com/api/agent/ws',
  token: '',
  mcpHost: '127.0.0.1',
  mcpPort: 55557,
  autoConnect: true,
  minimizeToTray: true,
  startMinimized: false
};

const store = new Store({ defaults: defaultConfig });

let mainWindow = null;
let tray = null;
let wsClient = null;
let mcpClient = null;

// Connection state
const connectionState = {
  cloud: 'disconnected',
  ue5: 'disconnected',
  lastError: null
};

/**
 * Create the main application window
 */
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    minWidth: 600,
    minHeight: 400,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: !store.get('startMinimized'),
    frame: true,
    titleBarStyle: 'default'
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('close', (event) => {
    if (!app.isQuitting && store.get('minimizeToTray')) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Send initial state to renderer
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('connection-state', connectionState);
    mainWindow.webContents.send('settings', {
      serverUrl: store.get('serverUrl'),
      token: store.get('token') ? '••••••••' : '',
      mcpHost: store.get('mcpHost'),
      mcpPort: store.get('mcpPort'),
      autoConnect: store.get('autoConnect'),
      minimizeToTray: store.get('minimizeToTray'),
      startMinimized: store.get('startMinimized')
    });
  });
}

/**
 * Create system tray icon
 */
function createTray() {
  const iconPath = path.join(__dirname, '../assets/tray-icon.png');
  
  // Create a simple icon if the file doesn't exist
  let icon;
  try {
    icon = nativeImage.createFromPath(iconPath);
    if (icon.isEmpty()) {
      icon = nativeImage.createEmpty();
    }
  } catch (e) {
    icon = nativeImage.createEmpty();
  }

  tray = new Tray(icon);
  tray.setToolTip('UE5 AI Studio Agent');
  
  updateTrayMenu();

  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus();
      } else {
        mainWindow.show();
      }
    }
  });
}

/**
 * Update tray menu based on connection state
 */
function updateTrayMenu() {
  if (!tray) return;

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Cloud: ${connectionState.cloud}`,
      enabled: false
    },
    {
      label: `UE5: ${connectionState.ue5}`,
      enabled: false
    },
    { type: 'separator' },
    {
      label: connectionState.cloud === 'connected' ? 'Disconnect from Cloud' : 'Connect to Cloud',
      click: () => {
        if (connectionState.cloud === 'connected') {
          disconnectFromCloud();
        } else {
          connectToCloud();
        }
      }
    },
    {
      label: connectionState.ue5 === 'connected' ? 'Disconnect from UE5' : 'Connect to UE5',
      click: () => {
        if (connectionState.ue5 === 'connected') {
          disconnectFromUE5();
        } else {
          connectToUE5();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Show Window',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
        }
      }
    },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        quitApp();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

/**
 * Initialize IPC handlers for renderer communication
 */
function initIPC() {
  ipcMain.handle('get-connection-state', () => connectionState);
  
  ipcMain.handle('get-settings', () => ({
    serverUrl: store.get('serverUrl'),
    token: store.get('token') ? '••••••••' : '',
    hasToken: !!store.get('token'),
    mcpHost: store.get('mcpHost'),
    mcpPort: store.get('mcpPort'),
    autoConnect: store.get('autoConnect'),
    minimizeToTray: store.get('minimizeToTray'),
    startMinimized: store.get('startMinimized')
  }));

  ipcMain.handle('save-settings', (event, settings) => {
    if (settings.serverUrl) store.set('serverUrl', settings.serverUrl);
    if (settings.token) store.set('token', settings.token);
    if (settings.mcpHost) store.set('mcpHost', settings.mcpHost);
    if (settings.mcpPort) store.set('mcpPort', settings.mcpPort);
    if (settings.autoConnect !== undefined) store.set('autoConnect', settings.autoConnect);
    if (settings.minimizeToTray !== undefined) store.set('minimizeToTray', settings.minimizeToTray);
    if (settings.startMinimized !== undefined) store.set('startMinimized', settings.startMinimized);
    return true;
  });

  // Token management
  ipcMain.handle('save-token', (event, token) => {
    store.set('token', token);
    console.log('Token saved successfully');
    return true;
  });

  ipcMain.handle('clear-token', () => {
    store.delete('token');
    console.log('Token cleared');
    return true;
  });

  // External links
  ipcMain.handle('open-external', (event, url) => {
    const { shell } = require('electron');
    shell.openExternal(url);
    return true;
  });

  ipcMain.handle('connect-cloud', async () => {
    return await connectToCloud();
  });

  ipcMain.handle('disconnect-cloud', async () => {
    await disconnectFromCloud();
    return true;
  });

  ipcMain.handle('connect-ue5', async () => {
    return await connectToUE5();
  });

  ipcMain.handle('disconnect-ue5', async () => {
    await disconnectFromUE5();
    return true;
  });

  ipcMain.handle('get-mcp-tools', async () => {
    if (mcpClient && connectionState.ue5 === 'connected') {
      return mcpClient.tools;
    }
    return [];
  });
}

/**
 * Connect to cloud platform
 */
async function connectToCloud() {
  const token = store.get('token');
  
  if (!token) {
    connectionState.lastError = 'No authentication token. Please log in.';
    updateConnectionState();
    return false;
  }

  const serverUrl = store.get('serverUrl');
  
  connectionState.cloud = 'connecting';
  updateConnectionState();

  try {
    wsClient = new WebSocketClient(serverUrl, token);
    
    wsClient.on('connected', () => {
      connectionState.cloud = 'connected';
      connectionState.lastError = null;
      updateConnectionState();
      
      // Send current UE5 status to cloud after (re)connection
      // This ensures the cloud knows about existing UE5 connections
      if (connectionState.ue5 === 'connected') {
        console.log('Cloud connected - sending existing UE5 status');
        sendStatusUpdate();
      }
      
      // Auto-connect to UE5 if configured
      if (store.get('autoConnect') && connectionState.ue5 !== 'connected') {
        connectToUE5();
      }
    });

    wsClient.on('disconnected', (reason) => {
      connectionState.cloud = 'disconnected';
      connectionState.lastError = reason;
      updateConnectionState();
    });

    wsClient.on('error', (error) => {
      connectionState.lastError = error.message || 'Connection error';
      updateConnectionState();
    });

    wsClient.on('command', async (command) => {
      await handleCloudCommand(command);
    });

    await wsClient.connect();
    return true;
  } catch (error) {
    connectionState.cloud = 'disconnected';
    connectionState.lastError = error.message;
    updateConnectionState();
    return false;
  }
}

/**
 * Disconnect from cloud platform
 */
async function disconnectFromCloud() {
  if (wsClient) {
    await wsClient.disconnect();
    wsClient = null;
  }
  connectionState.cloud = 'disconnected';
  updateConnectionState();
}

/**
 * Connect to local UE5 MCP server
 * Fixed: Now properly handles existing connections
 */
async function connectToUE5() {
  const host = store.get('mcpHost') || '127.0.0.1';
  const port = parseInt(store.get('mcpPort')) || 55557;
  
  console.log(`connectToUE5 called with host=${host}, port=${port}, type=${typeof port}`);

  // If already connected to the same host:port, just return success
  if (mcpClient && connectionState.ue5 === 'connected') {
    console.log('Already connected to UE5 MCP server');
    sendStatusUpdate();
    return true;
  }

  // If there's an existing client, disconnect it first
  if (mcpClient) {
    console.log('Disconnecting existing MCP client before reconnecting...');
    try {
      await mcpClient.disconnect();
    } catch (e) {
      console.log('Error disconnecting old client:', e.message);
    }
    mcpClient = null;
  }

  connectionState.ue5 = 'connecting';
  updateConnectionState();

  try {
    mcpClient = new MCPClient(host, port);
    
    mcpClient.on('connected', () => {
      connectionState.ue5 = 'connected';
      connectionState.lastError = null;
      updateConnectionState();
      
      // Notify cloud of UE5 connection
      sendStatusUpdate();
    });

    mcpClient.on('disconnected', (reason) => {
      connectionState.ue5 = 'disconnected';
      updateConnectionState();
      sendStatusUpdate();
    });

    mcpClient.on('error', (error) => {
      connectionState.lastError = error.message || 'MCP connection error';
      updateConnectionState();
    });

    await mcpClient.connect();
    return true;
  } catch (error) {
    connectionState.ue5 = 'disconnected';
    connectionState.lastError = error.message;
    updateConnectionState();
    sendStatusUpdate();
    return false;
  }
}

/**
 * Disconnect from UE5 MCP server
 */
async function disconnectFromUE5() {
  if (mcpClient) {
    await mcpClient.disconnect();
    mcpClient = null;
  }
  connectionState.ue5 = 'disconnected';
  updateConnectionState();
  sendStatusUpdate();
}

/**
 * Handle commands from cloud platform
 */
async function handleCloudCommand(command) {
  const { type, command_id, ...payload } = command;

  try {
    let result;

    switch (type) {
      case 'mcp_connect':
        // Use provided host/port or fall back to stored settings
        const connectHost = payload.host || store.get('mcpHost');
        const connectPort = payload.port || store.get('mcpPort');
        
        // Update stored settings if provided
        if (payload.host) store.set('mcpHost', payload.host);
        if (payload.port) store.set('mcpPort', payload.port);
        
        await connectToUE5();
        result = { 
          success: connectionState.ue5 === 'connected',
          host: connectHost,
          port: connectPort
        };
        break;

      case 'mcp_disconnect':
        await disconnectFromUE5();
        result = { success: true };
        break;

      case 'mcp_call':
        if (!mcpClient || connectionState.ue5 !== 'connected') {
          throw new Error('Not connected to UE5');
        }
        result = await mcpClient.callTool(payload.tool, payload.parameters);
        break;

      case 'mcp_tools_list':
        if (!mcpClient || connectionState.ue5 !== 'connected') {
          throw new Error('Not connected to UE5');
        }
        result = await mcpClient.getTools();
        break;

      default:
        throw new Error(`Unknown command type: ${type}`);
    }

    // Send success response
    if (wsClient) {
      wsClient.send({
        type: type === 'mcp_tools_list' ? 'mcp_tools_list' : 'command_result',
        command_id,
        result,
        tools: type === 'mcp_tools_list' ? result : undefined
      });
    }
  } catch (error) {
    // Send error response
    if (wsClient) {
      wsClient.send({
        type: 'command_error',
        command_id,
        error: error.message
      });
    }
  }
}

/**
 * Send status update to cloud
 */
function sendStatusUpdate() {
  console.log(`sendStatusUpdate called - cloud: ${connectionState.cloud}, ue5: ${connectionState.ue5}`);
  if (wsClient && connectionState.cloud === 'connected') {
    const statusMsg = {
      type: 'status_update',
      ue5_status: connectionState.ue5,
      mcp_host: store.get('mcpHost'),
      mcp_port: store.get('mcpPort'),
      available_tools: mcpClient ? mcpClient.tools : []
    };
    console.log('Sending status update to cloud:', JSON.stringify(statusMsg));
    wsClient.send(statusMsg);
    
    // Also update the WebSocket client's UE5 status for heartbeats
    wsClient.setUE5Status(connectionState.ue5);
  } else {
    console.log('Cannot send status update - wsClient:', !!wsClient, 'cloud state:', connectionState.cloud);
  }
}

/**
 * Update connection state and notify renderer
 */
function updateConnectionState() {
  updateTrayMenu();
  
  if (mainWindow) {
    mainWindow.webContents.send('connection-state', connectionState);
  }
}

/**
 * Quit the application
 */
function quitApp() {
  app.isQuitting = true;
  
  // Cleanup connections
  if (wsClient) {
    wsClient.disconnect();
  }
  if (mcpClient) {
    mcpClient.disconnect();
  }
  
  app.quit();
}

// App lifecycle events
app.whenReady().then(() => {
  createWindow();
  createTray();
  initIPC();

  // Auto-connect if configured
  if (store.get('autoConnect') && store.get('token')) {
    connectToCloud();
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    if (!store.get('minimizeToTray')) {
      quitApp();
    }
  }
});

app.on('before-quit', () => {
  app.isQuitting = true;
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught exception:', error);
  dialog.showErrorBox('Error', `An unexpected error occurred: ${error.message}`);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled rejection at:', promise, 'reason:', reason);
});
