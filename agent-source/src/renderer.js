/**
 * Renderer Process - UI Logic
 */

// DOM Elements
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

// Status elements
const cloudDot = document.getElementById('cloud-dot');
const cloudStatus = document.getElementById('cloud-status');
const cloudConnectBtn = document.getElementById('cloud-connect-btn');
const cloudDisconnectBtn = document.getElementById('cloud-disconnect-btn');

const ue5Dot = document.getElementById('ue5-dot');
const ue5Status = document.getElementById('ue5-status');
const ue5ConnectBtn = document.getElementById('ue5-connect-btn');
const ue5DisconnectBtn = document.getElementById('ue5-disconnect-btn');

const errorMessage = document.getElementById('error-message');

// Settings elements
const serverUrlInput = document.getElementById('server-url');
const mcpHostInput = document.getElementById('mcp-host');
const mcpPortInput = document.getElementById('mcp-port');
const autoConnectCheckbox = document.getElementById('auto-connect');
const minimizeToTrayCheckbox = document.getElementById('minimize-to-tray');
const autoStartCheckbox = document.getElementById('auto-start');
const saveSettingsBtn = document.getElementById('save-settings-btn');

// Login elements
const loginForm = document.getElementById('login-form');
const loggedIn = document.getElementById('logged-in');
const tokenInput = document.getElementById('token-input');
const saveTokenBtn = document.getElementById('save-token-btn');
const logoutBtn = document.getElementById('logout-btn');
const getTokenLink = document.getElementById('get-token-link');
const helpLink = document.getElementById('help-link');

// Tab switching
tabs.forEach(tab => {
  tab.addEventListener('click', () => {
    const tabId = tab.dataset.tab;
    
    tabs.forEach(t => t.classList.remove('active'));
    tabContents.forEach(c => c.classList.remove('active'));
    
    tab.classList.add('active');
    document.getElementById(`${tabId}-tab`).classList.add('active');
  });
});

// Update connection status UI
function updateConnectionUI(state) {
  // Cloud status
  cloudDot.className = 'status-dot';
  cloudStatus.className = 'status-text';
  
  if (state.cloud === 'connected') {
    cloudDot.classList.add('connected');
    cloudStatus.classList.add('connected');
    cloudStatus.textContent = 'Connected';
    cloudConnectBtn.style.display = 'none';
    cloudDisconnectBtn.style.display = 'inline-flex';
  } else if (state.cloud === 'connecting') {
    cloudDot.classList.add('connecting');
    cloudStatus.classList.add('connecting');
    cloudStatus.textContent = 'Connecting...';
    cloudConnectBtn.disabled = true;
  } else {
    cloudStatus.classList.add('disconnected');
    cloudStatus.textContent = 'Disconnected';
    cloudConnectBtn.style.display = 'inline-flex';
    cloudConnectBtn.disabled = false;
    cloudDisconnectBtn.style.display = 'none';
  }

  // UE5 status
  ue5Dot.className = 'status-dot';
  ue5Status.className = 'status-text';
  
  if (state.ue5 === 'connected') {
    ue5Dot.classList.add('connected');
    ue5Status.classList.add('connected');
    ue5Status.textContent = 'Connected';
    ue5ConnectBtn.style.display = 'none';
    ue5DisconnectBtn.style.display = 'inline-flex';
  } else if (state.ue5 === 'connecting') {
    ue5Dot.classList.add('connecting');
    ue5Status.classList.add('connecting');
    ue5Status.textContent = 'Connecting...';
    ue5ConnectBtn.disabled = true;
  } else {
    ue5Status.classList.add('disconnected');
    ue5Status.textContent = 'Disconnected';
    ue5ConnectBtn.style.display = 'inline-flex';
    ue5ConnectBtn.disabled = false;
    ue5DisconnectBtn.style.display = 'none';
  }

  // Error message
  if (state.lastError) {
    errorMessage.textContent = state.lastError;
    errorMessage.style.display = 'block';
  } else {
    errorMessage.style.display = 'none';
  }
}

// Load settings
async function loadSettings() {
  const settings = await window.electronAPI.getSettings();
  
  serverUrlInput.value = settings.serverUrl || '';
  mcpHostInput.value = settings.mcpHost || '127.0.0.1';
  mcpPortInput.value = settings.mcpPort || 55557;
  autoConnectCheckbox.checked = settings.autoConnect;
  minimizeToTrayCheckbox.checked = settings.minimizeToTray;
  autoStartCheckbox.checked = settings.autoStart;
  
  // Update login UI
  if (settings.hasToken) {
    loginForm.style.display = 'none';
    loggedIn.style.display = 'block';
  } else {
    loginForm.style.display = 'block';
    loggedIn.style.display = 'none';
  }
}

// Save settings
saveSettingsBtn.addEventListener('click', async () => {
  const settings = {
    serverUrl: serverUrlInput.value,
    mcpHost: mcpHostInput.value,
    mcpPort: parseInt(mcpPortInput.value) || 55557,
    autoConnect: autoConnectCheckbox.checked,
    minimizeToTray: minimizeToTrayCheckbox.checked,
    autoStart: autoStartCheckbox.checked
  };
  
  await window.electronAPI.saveSettings(settings);
  alert('Settings saved!');
});

// Save token
saveTokenBtn.addEventListener('click', async () => {
  const token = tokenInput.value.trim();
  if (!token) {
    alert('Please enter a token');
    return;
  }
  
  await window.electronAPI.saveToken(token);
  tokenInput.value = '';
  loginForm.style.display = 'none';
  loggedIn.style.display = 'block';
});

// Logout
logoutBtn.addEventListener('click', async () => {
  await window.electronAPI.clearToken();
  await window.electronAPI.disconnectCloud();
  loginForm.style.display = 'block';
  loggedIn.style.display = 'none';
});

// Cloud connection
cloudConnectBtn.addEventListener('click', async () => {
  cloudConnectBtn.disabled = true;
  await window.electronAPI.connectCloud();
});

cloudDisconnectBtn.addEventListener('click', async () => {
  await window.electronAPI.disconnectCloud();
});

// UE5 connection
ue5ConnectBtn.addEventListener('click', async () => {
  ue5ConnectBtn.disabled = true;
  await window.electronAPI.connectUE5();
});

ue5DisconnectBtn.addEventListener('click', async () => {
  await window.electronAPI.disconnectUE5();
});

// External links
getTokenLink.addEventListener('click', (e) => {
  e.preventDefault();
  window.electronAPI.openExternal('https://your-server.com/settings');
});

helpLink.addEventListener('click', (e) => {
  e.preventDefault();
  window.electronAPI.openExternal('https://your-server.com/docs/agent');
});

// Listen for connection state updates
window.electronAPI.onConnectionState((state) => {
  updateConnectionUI(state);
});

// Listen for show settings command
window.electronAPI.onShowSettings(() => {
  tabs.forEach(t => t.classList.remove('active'));
  tabContents.forEach(c => c.classList.remove('active'));
  
  document.querySelector('[data-tab="settings"]').classList.add('active');
  document.getElementById('settings-tab').classList.add('active');
});

// Initialize
async function init() {
  await loadSettings();
  const state = await window.electronAPI.getConnectionState();
  updateConnectionUI(state);
}

init();
