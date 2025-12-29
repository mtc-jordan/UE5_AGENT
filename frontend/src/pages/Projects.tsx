import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { projectsApi, chatsApi } from '../lib/api'
import {
  FolderKanban,
  Plus,
  Trash2,
  Edit,
  X,
  Loader2,
  MessageSquare,
  ChevronRight,
  Calendar,
  GitBranch,
  FolderOpen,
  Cpu,
  ExternalLink} from 'lucide-react'
import { formatDate, cn} from '../lib/utils'

interface Chat {
  id: number
  title: string
  mode: string
  model: string
  created_at: string
  updated_at: string
}

interface Project {
  id: number
  name: string
  description: string
  ue_version: string
  project_path: string
  created_at: string
  updated_at: string
  chat_count: number
  recent_chats: Chat[]
}

const ueVersions = ['5.5', '5.4', '5.3', '5.2', '5.1', '5.0']

export default function Projects() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [projectChats, setProjectChats] = useState<Chat[]>([])
  const [loadingChats, setLoadingChats] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    ue_version: '5.4',
    project_path: ''})
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadProjects()
  }, [])

  const loadProjects = async () => {
    try {
      const response = await projectsApi.list()
      setProjects(response.data)
    } catch (error) {
      console.error('Failed to load projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadProjectChats = async (project: Project) => {
    setSelectedProject(project)
    setLoadingChats(true)
    try {
      const response = await chatsApi.list(project.id)
      setProjectChats(response.data)
    } catch (error) {
      console.error('Failed to load project chats:', error)
    } finally {
      setLoadingChats(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const response = await projectsApi.create(formData)
      setProjects([response.data, ...projects])
      setShowCreate(false)
      setFormData({ name: '', description: '', ue_version: '5.4', project_path: '' })
    } catch (error) {
      console.error('Failed to create project:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingProject) return
    setSaving(true)
    try {
      const response = await projectsApi.update(editingProject.id, formData)
      setProjects(projects.map((p) => (p.id === editingProject.id ? { ...response.data, chat_count: p.chat_count, recent_chats: p.recent_chats } : p)))
      setEditingProject(null)
      setFormData({ name: '', description: '', ue_version: '5.4', project_path: '' })
    } catch (error) {
      console.error('Failed to update project:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this project? All associated chats will also be deleted.')) return
    try {
      await projectsApi.delete(id)
      setProjects(projects.filter((p) => p.id !== id))
      if (selectedProject?.id === id) {
        setSelectedProject(null)
        setProjectChats([])
      }
    } catch (error) {
      console.error('Failed to delete project:', error)
    }
  }

  const handleNewChat = async (projectId: number) => {
    try {
      const response = await chatsApi.create({
        project_id: projectId,
        title: 'New Conversation',
        mode: 'team',
        model: 'deepseek-chat'})
      navigate(`/chat/${response.data.id}`)
    } catch (error) {
      console.error('Failed to create chat:', error)
    }
  }

  const openEdit = (project: Project) => {
    setEditingProject(project)
    setFormData({
      name: project.name,
      description: project.description || '',
      ue_version: project.ue_version,
      project_path: project.project_path || ''})
  }

  const closeModal = () => {
    setShowCreate(false)
    setEditingProject(null)
    setFormData({ name: '', description: '', ue_version: '5.4', project_path: '' })
  }

  return (
    <div className="h-full flex">
      {/* Projects List */}
      <div className={cn(
        'flex flex-col border-r border-ue-border bg-ue-surface transition-all duration-300',
        selectedProject ? 'w-80' : 'flex-1'
      )}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-ue-border">
          <div>
            <h1 className="text-lg font-semibold">Projects</h1>
            <p className="text-xs text-ue-muted">{projects.length} project{projects.length !== 1 ? 's' : ''}</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="btn btn-primary btn-sm flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            New
          </button>
        </div>

        {/* Projects */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-ue-muted" />
            </div>
          ) : projects.length === 0 ? (
            <div className="text-center py-12 px-4">
              <FolderKanban className="w-12 h-12 text-ue-muted mx-auto mb-3" />
              <h2 className="font-semibold mb-1">No projects yet</h2>
              <p className="text-sm text-ue-muted mb-4">
                Create your first project to organize your UE5 work.
              </p>
              <button
                onClick={() => setShowCreate(true)}
                className="btn btn-primary btn-sm"
              >
                Create Project
              </button>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {projects.map((project) => (
                <button
                  key={project.id}
                  onClick={() => loadProjectChats(project)}
                  className={cn(
                    'w-full text-left p-3 rounded-lg transition-colors',
                    selectedProject?.id === project.id
                      ? 'bg-ue-accent/10 border border-ue-accent/30'
                      : 'hover:bg-ue-bg border border-transparent'
                  )}
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-ue-success/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FolderKanban className="w-5 h-5 text-ue-success" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{project.name}</div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-ue-muted">
                        <span className="flex items-center gap-1">
                          <GitBranch className="w-3 h-3" />
                          UE {project.ue_version}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageSquare className="w-3 h-3" />
                          {project.chat_count}
                        </span>
                      </div>
                    </div>
                    <ChevronRight className={cn(
                      'w-4 h-4 text-ue-muted transition-transform',
                      selectedProject?.id === project.id && 'rotate-90'
                    )} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Project Detail Panel */}
      {selectedProject && (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Project Header */}
          <div className="px-6 py-4 border-b border-ue-border bg-ue-surface">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="w-14 h-14 bg-ue-success/10 rounded-xl flex items-center justify-center">
                  <FolderKanban className="w-7 h-7 text-ue-success" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold">{selectedProject.name}</h2>
                  {selectedProject.description && (
                    <p className="text-sm text-ue-muted mt-1 max-w-lg">{selectedProject.description}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-sm text-ue-muted">
                    <span className="flex items-center gap-1.5">
                      <GitBranch className="w-4 h-4" />
                      Unreal Engine {selectedProject.ue_version}
                    </span>
                    {selectedProject.project_path && (
                      <span className="flex items-center gap-1.5">
                        <FolderOpen className="w-4 h-4" />
                        <span className="truncate max-w-xs">{selectedProject.project_path}</span>
                      </span>
                    )}
                    <span className="flex items-center gap-1.5">
                      <Calendar className="w-4 h-4" />
                      Updated {formatDate(selectedProject.updated_at)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => openEdit(selectedProject)}
                  className="btn btn-secondary btn-sm flex items-center gap-1.5"
                >
                  <Edit className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(selectedProject.id)}
                  className="btn btn-secondary btn-sm text-ue-error hover:bg-ue-error/10"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Project Chats */}
          <div className="flex-1 overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Conversations</h3>
              <button
                onClick={() => handleNewChat(selectedProject.id)}
                className="btn btn-primary btn-sm flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4" />
                New Chat
              </button>
            </div>

            {loadingChats ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-ue-muted" />
              </div>
            ) : projectChats.length === 0 ? (
              <div className="text-center py-12 bg-ue-bg/50 rounded-xl border border-ue-border">
                <MessageSquare className="w-12 h-12 text-ue-muted mx-auto mb-3" />
                <h3 className="font-semibold mb-1">No conversations yet</h3>
                <p className="text-sm text-ue-muted mb-4">
                  Start a new chat to get AI assistance for this project.
                </p>
                <button
                  onClick={() => handleNewChat(selectedProject.id)}
                  className="btn btn-primary btn-sm"
                >
                  Start Conversation
                </button>
              </div>
            ) : (
              <div className="grid gap-3">
                {projectChats.map((chat) => (
                  <button
                    key={chat.id}
                    onClick={() => navigate(`/chat/${chat.id}`)}
                    className="w-full text-left p-4 bg-ue-surface border border-ue-border rounded-lg hover:border-ue-accent/50 transition-colors group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 bg-ue-accent/10 rounded-lg flex items-center justify-center">
                          <MessageSquare className="w-5 h-5 text-ue-accent" />
                        </div>
                        <div>
                          <div className="font-medium group-hover:text-ue-accent transition-colors">
                            {chat.title}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-ue-muted">
                            <span className="capitalize">{chat.mode} mode</span>
                            <span>{chat.model}</span>
                            <span>{formatDate(chat.updated_at)}</span>
                          </div>
                        </div>
                      </div>
                      <ExternalLink className="w-4 h-4 text-ue-muted opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Best Practices Card */}
            <div className="mt-8 p-4 bg-ue-bg/50 rounded-xl border border-ue-border">
              <h4 className="font-semibold mb-3 flex items-center gap-2">
                <Cpu className="w-4 h-4 text-ue-accent" />
                Project Best Practices
              </h4>
              <div className="space-y-2 text-sm text-ue-muted">
                <p>• <strong>Context Separation:</strong> Each chat in this project automatically includes your project details (UE version, path) for relevant advice.</p>
                <p>• <strong>Version Tracking:</strong> The AI will provide code compatible with UE {selectedProject.ue_version}.</p>
                <p>• <strong>Organized History:</strong> All conversations for this project are grouped here for easy reference.</p>
                {selectedProject.project_path && (
                  <p>• <strong>Path Awareness:</strong> The AI knows your project is at <code className="bg-ue-surface px-1 rounded">{selectedProject.project_path}</code></p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Empty State when no project selected */}
      {!selectedProject && projects.length > 0 && (
        <div className="flex-1 flex items-center justify-center bg-ue-bg/30">
          <div className="text-center">
            <FolderKanban className="w-16 h-16 text-ue-muted mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Select a Project</h2>
            <p className="text-ue-muted max-w-md">
              Choose a project from the list to view its conversations and details.
            </p>
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreate || editingProject) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-ue-surface border border-ue-border rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold">
                {editingProject ? 'Edit Project' : 'New Project'}
              </h2>
              <button
                onClick={closeModal}
                className="p-2 text-ue-muted hover:text-ue-text transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={editingProject ? handleUpdate : handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ue-muted mb-1.5">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input"
                  placeholder="My UE5 Game"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ue-muted mb-1.5">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="input min-h-[80px] resize-none"
                  placeholder="A brief description of your project (genre, features, etc.)"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-ue-muted mb-1.5">
                  Unreal Engine Version *
                </label>
                <select
                  value={formData.ue_version}
                  onChange={(e) => setFormData({ ...formData, ue_version: e.target.value })}
                  className="input"
                >
                  {ueVersions.map((v) => (
                    <option key={v} value={v}>UE {v}</option>
                  ))}
                </select>
                <p className="text-xs text-ue-muted mt-1">
                  The AI will provide version-specific code and avoid deprecated APIs.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-ue-muted mb-1.5">
                  Project Path
                </label>
                <input
                  type="text"
                  value={formData.project_path}
                  onChange={(e) => setFormData({ ...formData, project_path: e.target.value })}
                  className="input"
                  placeholder="C:/Projects/MyGame/MyGame.uproject"
                />
                <p className="text-xs text-ue-muted mt-1">
                  Path to your .uproject file for MCP integration.
                </p>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="btn btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !formData.name.trim()}
                  className="btn btn-primary flex-1 flex items-center justify-center gap-2"
                >
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                  {editingProject ? 'Save Changes' : 'Create Project'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
