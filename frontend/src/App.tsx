import { useEffect } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore, useSettingsStore } from './lib/store'
import { preferencesApi } from './lib/api'
import Layout from './components/Layout'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'
import Chat from './pages/Chat'
import Projects from './pages/Projects'
import Settings from './pages/Settings'
import UE5Connection from './pages/UE5Connection'
import Workspace from './pages/Workspace'
import Plugins from './pages/Plugins'
import PluginEditor from './pages/PluginEditor'
import ModelComparison from './pages/ModelComparison'
import AdminRoles from './pages/AdminRoles'
import Pricing from './pages/Pricing'
import SubscriptionSettings from './pages/SubscriptionSettings'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  
  return <>{children}</>
}

// Component to load user preferences on authentication
function PreferencesLoader({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated)
  const { setMode, setModel, setActiveAgents, setSoloAgent } = useSettingsStore()

  useEffect(() => {
    if (isAuthenticated) {
      // Load user preferences from backend and sync with local store
      preferencesApi.get()
        .then((response) => {
          const prefs = response.data
          setMode(prefs.default_chat_mode as 'solo' | 'team')
          setModel(prefs.default_model)
          setActiveAgents(prefs.default_active_agents)
          setSoloAgent(prefs.default_solo_agent)
        })
        .catch((error) => {
          console.error('Failed to load preferences:', error)
        })
    }
  }, [isAuthenticated, setMode, setModel, setActiveAgents, setSoloAgent])

  return <>{children}</>
}

function App() {
  return (
    <PreferencesLoader>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="chat" element={<Chat />} />
          <Route path="chat/:chatId" element={<Chat />} />
          <Route path="projects" element={<Projects />} />
          <Route path="workspace" element={<Workspace />} />
          <Route path="plugins" element={<Plugins />} />
          <Route path="plugins/new" element={<PluginEditor />} />
          <Route path="plugins/:id/edit" element={<PluginEditor />} />
          <Route path="plugins/:id/run" element={<PluginEditor />} />
          <Route path="compare" element={<ModelComparison />} />
          <Route path="ue5" element={<UE5Connection />} />
          <Route path="settings" element={<Settings />} />
          <Route path="settings/subscription" element={<SubscriptionSettings />} />
          <Route path="pricing" element={<Pricing />} />
          <Route path="admin/roles" element={<AdminRoles />} />
        </Route>
      </Routes>
    </PreferencesLoader>
  )
}

export default App
