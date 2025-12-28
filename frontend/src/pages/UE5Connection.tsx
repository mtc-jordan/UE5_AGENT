import { useEffect, useState } from 'react'
import { mcpApi } from '../lib/api'
import {
  Plug,
  PlugZap,
  Plus,
  Trash2,
  RefreshCw,
  X,
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
} from 'lucide-react'
import { cn } from '../lib/utils'

interface MCPConnection {
  id: number
  name: string
  endpoint: string
  status: 'connected' | 'disconnected' | 'error'
  last_connected: string | null
  available_tools: string[]
}

export default function UE5Connection() {
  const [connections, setConnections] = useState<MCPConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [formData, setFormData] = useState({ name: '', endpoint: '' })
  const [saving, setSaving] = useState(false)
  const [connecting, setConnecting] = useState<number | null>(null)

  useEffect(() => {
    loadConnections()
  }, [])

  const loadConnections = async () => {
    try {
      const response = await mcpApi.connections()
      setConnections(response.data)
    } catch (error) {
      console.error('Failed to load connections:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const response = await mcpApi.create(formData)
      setConnections([...connections, response.data])
      setShowCreate(false)
      setFormData({ name: '', endpoint: '' })
    } catch (error) {
      console.error('Failed to create connection:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleConnect = async (id: number) => {
    setConnecting(id)
    try {
      const response = await mcpApi.connect(id)
      setConnections(connections.map((c) => (c.id === id ? response.data : c)))
    } catch (error) {
      console.error('Failed to connect:', error)
    } finally {
      setConnecting(null)
    }
  }

  const handleDisconnect = async (id: number) => {
    setConnecting(id)
    try {
      const response = await mcpApi.disconnect(id)
      setConnections(connections.map((c) => (c.id === id ? response.data : c)))
    } catch (error) {
      console.error('Failed to disconnect:', error)
    } finally {
      setConnecting(null)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this connection?')) return
    try {
      await mcpApi.delete(id)
      setConnections(connections.filter((c) => c.id !== id))
    } catch (error) {
      console.error('Failed to delete connection:', error)
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'connected':
        return <CheckCircle className="w-5 h-5 text-ue-success" />
      case 'error':
        return <XCircle className="w-5 h-5 text-ue-error" />
      default:
        return <AlertCircle className="w-5 h-5 text-ue-muted" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'connected':
        return 'Connected'
      case 'error':
        return 'Error'
      default:
        return 'Disconnected'
    }
  }

  return (
    <div className="h-full overflow-y-auto p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">UE5 Connection</h1>
            <p className="text-ue-muted mt-1">
              Connect to your Unreal Engine projects via MCP
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="btn btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Connection
          </button>
        </div>

        {/* Info Card */}
        <div className="card bg-ue-accent/5 border-ue-accent/20 mb-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 bg-ue-accent/10 rounded-lg flex items-center justify-center">
              <PlugZap className="w-5 h-5 text-ue-accent" />
            </div>
            <div>
              <h3 className="font-semibold">How to Connect</h3>
              <p className="text-sm text-ue-muted mt-1">
                1. Install the UE5 AI Studio MCP plugin in your Unreal project
                <br />
                2. Start the MCP server from the plugin settings
                <br />
                3. Add a connection here using the server endpoint (default: http://localhost:8080)
              </p>
            </div>
          </div>
        </div>

        {/* Connections List */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-ue-muted" />
          </div>
        ) : connections.length === 0 ? (
          <div className="card text-center py-12">
            <Plug className="w-16 h-16 text-ue-muted mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No connections</h2>
            <p className="text-ue-muted mb-4">
              Add a connection to start building directly in Unreal Engine.
            </p>
            <button
              onClick={() => setShowCreate(true)}
              className="btn btn-primary"
            >
              Add Connection
            </button>
          </div>
        ) : (
          <div className="grid gap-4">
            {connections.map((connection) => (
              <div key={connection.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        'w-12 h-12 rounded-xl flex items-center justify-center',
                        connection.status === 'connected'
                          ? 'bg-ue-success/10'
                          : 'bg-ue-surface'
                      )}
                    >
                      <Plug
                        className={cn(
                          'w-6 h-6',
                          connection.status === 'connected'
                            ? 'text-ue-success'
                            : 'text-ue-muted'
                        )}
                      />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{connection.name}</h3>
                      <p className="text-sm text-ue-muted mt-1">{connection.endpoint}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {getStatusIcon(connection.status)}
                        <span
                          className={cn(
                            'text-sm',
                            connection.status === 'connected'
                              ? 'text-ue-success'
                              : connection.status === 'error'
                              ? 'text-ue-error'
                              : 'text-ue-muted'
                          )}
                        >
                          {getStatusText(connection.status)}
                        </span>
                      </div>
                      
                      {/* Available Tools */}
                      {connection.status === 'connected' && connection.available_tools?.length > 0 && (
                        <div className="mt-3">
                          <div className="text-xs font-medium text-ue-muted mb-2">
                            Available Tools
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {connection.available_tools.map((tool) => (
                              <span
                                key={tool}
                                className="px-2 py-1 bg-ue-bg rounded text-xs text-ue-muted"
                              >
                                {tool}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {connection.status === 'connected' ? (
                      <button
                        onClick={() => handleDisconnect(connection.id)}
                        disabled={connecting === connection.id}
                        className="btn btn-secondary flex items-center gap-2"
                      >
                        {connecting === connection.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Plug className="w-4 h-4" />
                        )}
                        Disconnect
                      </button>
                    ) : (
                      <button
                        onClick={() => handleConnect(connection.id)}
                        disabled={connecting === connection.id}
                        className="btn btn-primary flex items-center gap-2"
                      >
                        {connecting === connection.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <PlugZap className="w-4 h-4" />
                        )}
                        Connect
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(connection.id)}
                      className="p-2 text-ue-muted hover:text-ue-error transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-ue-surface border border-ue-border rounded-xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-semibold">Add Connection</h2>
                <button
                  onClick={() => setShowCreate(false)}
                  className="p-2 text-ue-muted hover:text-ue-text transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-ue-muted mb-1.5">
                    Connection Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="input"
                    placeholder="My UE5 Project"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-ue-muted mb-1.5">
                    MCP Server Endpoint
                  </label>
                  <input
                    type="url"
                    value={formData.endpoint}
                    onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                    className="input"
                    placeholder="http://localhost:8080"
                    required
                  />
                  <p className="text-xs text-ue-muted mt-1">
                    The URL where your UE5 MCP server is running
                  </p>
                </div>

                <div className="flex gap-3 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCreate(false)}
                    className="btn btn-secondary flex-1"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                  >
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                    Add Connection
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
