/**
 * Collaboration Panel Component for UE5 AI Agent
 * 
 * Real-time collaboration features:
 * - User presence and status
 * - Activity feed
 * - Selection sync and highlighting
 * - Lock/unlock system
 * - Team chat
 * - Follow mode
 * - Shared viewport
 * 
 * Voice Control Integration:
 * - "Share my viewport"
 * - "Follow [name]"
 * - "Lock this actor"
 * - "Who's online"
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users, MessageSquare, Activity, Eye, EyeOff,
  Lock, Unlock, UserPlus, UserMinus, Send,
  Video, VideoOff, Mic, MicOff, Settings,
  Bell, BellOff, ChevronDown, ChevronUp,
  Circle, CheckCircle, XCircle, AlertCircle,
  Camera, Share2, Copy, ExternalLink,
  Maximize2, Minimize2, MoreVertical,
  Crown, Shield, User, Clock, Zap,
  MousePointer, Move, RotateCcw, Trash2,
  Plus, X, Search, Filter, RefreshCw
} from 'lucide-react';

// Types
interface TeamMember {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  role: 'admin' | 'editor' | 'viewer';
  color: string;
  currentAction?: string;
  selectedActors?: string[];
  viewportPosition?: { x: number; y: number; z: number };
  joinedAt: Date;
  lastActiveAt: Date;
}

interface ActivityItem {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  action: string;
  target?: string;
  details?: string;
  timestamp: Date;
  type: 'create' | 'modify' | 'delete' | 'select' | 'lock' | 'unlock' | 'chat' | 'join' | 'leave' | 'viewport';
}

interface ChatMessage {
  id: string;
  userId: string;
  userName: string;
  userColor: string;
  content: string;
  timestamp: Date;
  type: 'text' | 'image' | 'system';
  attachments?: string[];
}

interface LockedActor {
  actorId: string;
  actorName: string;
  lockedBy: string;
  lockedByName: string;
  lockedAt: Date;
}

interface CollaborationSession {
  id: string;
  name: string;
  projectName: string;
  createdBy: string;
  createdAt: Date;
  members: TeamMember[];
  maxMembers: number;
  isPublic: boolean;
  inviteCode?: string;
}

interface CollaborationPanelProps {
  isConnected: boolean;
  currentUserId?: string;
  currentUserName?: string;
  onShareViewport?: () => void;
  onFollowUser?: (userId: string) => void;
  onLockActor?: (actorId: string) => void;
  onUnlockActor?: (actorId: string) => void;
  onSendChat?: (message: string) => void;
}

// Mock data for demonstration
const MOCK_TEAM_MEMBERS: TeamMember[] = [
  {
    id: '1',
    name: 'You',
    email: 'you@example.com',
    status: 'online',
    role: 'admin',
    color: '#3B82F6',
    currentAction: 'Editing Level',
    selectedActors: ['BP_Player', 'SM_Chair'],
    joinedAt: new Date(Date.now() - 3600000),
    lastActiveAt: new Date(),
  },
  {
    id: '2',
    name: 'Sarah Chen',
    email: 'sarah@example.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah',
    status: 'online',
    role: 'editor',
    color: '#10B981',
    currentAction: 'Working on Materials',
    selectedActors: ['M_Wood', 'M_Metal'],
    joinedAt: new Date(Date.now() - 7200000),
    lastActiveAt: new Date(Date.now() - 60000),
  },
  {
    id: '3',
    name: 'Mike Johnson',
    email: 'mike@example.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mike',
    status: 'away',
    role: 'editor',
    color: '#F59E0B',
    currentAction: 'Away',
    joinedAt: new Date(Date.now() - 10800000),
    lastActiveAt: new Date(Date.now() - 300000),
  },
  {
    id: '4',
    name: 'Emily Davis',
    email: 'emily@example.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Emily',
    status: 'busy',
    role: 'viewer',
    color: '#EF4444',
    currentAction: 'Reviewing Scene',
    joinedAt: new Date(Date.now() - 1800000),
    lastActiveAt: new Date(Date.now() - 120000),
  },
];

const MOCK_ACTIVITIES: ActivityItem[] = [
  {
    id: '1',
    userId: '2',
    userName: 'Sarah Chen',
    userColor: '#10B981',
    action: 'Created new material',
    target: 'M_GlowingMetal',
    timestamp: new Date(Date.now() - 60000),
    type: 'create',
  },
  {
    id: '2',
    userId: '1',
    userName: 'You',
    userColor: '#3B82F6',
    action: 'Modified actor transform',
    target: 'BP_Player',
    details: 'Position: (100, 200, 0)',
    timestamp: new Date(Date.now() - 120000),
    type: 'modify',
  },
  {
    id: '3',
    userId: '3',
    userName: 'Mike Johnson',
    userColor: '#F59E0B',
    action: 'Locked actor',
    target: 'SM_MainBuilding',
    timestamp: new Date(Date.now() - 180000),
    type: 'lock',
  },
  {
    id: '4',
    userId: '4',
    userName: 'Emily Davis',
    userColor: '#EF4444',
    action: 'Joined the session',
    timestamp: new Date(Date.now() - 300000),
    type: 'join',
  },
  {
    id: '5',
    userId: '2',
    userName: 'Sarah Chen',
    userColor: '#10B981',
    action: 'Took viewport screenshot',
    timestamp: new Date(Date.now() - 600000),
    type: 'viewport',
  },
];

const MOCK_CHAT_MESSAGES: ChatMessage[] = [
  {
    id: '1',
    userId: '2',
    userName: 'Sarah Chen',
    userColor: '#10B981',
    content: 'Hey team! I just finished the new material for the main building.',
    timestamp: new Date(Date.now() - 300000),
    type: 'text',
  },
  {
    id: '2',
    userId: '1',
    userName: 'You',
    userColor: '#3B82F6',
    content: 'Looks great! Can you apply it to the entrance as well?',
    timestamp: new Date(Date.now() - 240000),
    type: 'text',
  },
  {
    id: '3',
    userId: '4',
    userName: 'Emily Davis',
    userColor: '#EF4444',
    content: 'I\'m reviewing the lighting setup. The shadows look a bit harsh.',
    timestamp: new Date(Date.now() - 180000),
    type: 'text',
  },
  {
    id: '4',
    userId: 'system',
    userName: 'System',
    userColor: '#6B7280',
    content: 'Mike Johnson went away',
    timestamp: new Date(Date.now() - 120000),
    type: 'system',
  },
];

const MOCK_LOCKED_ACTORS: LockedActor[] = [
  {
    actorId: 'SM_MainBuilding',
    actorName: 'SM_MainBuilding',
    lockedBy: '3',
    lockedByName: 'Mike Johnson',
    lockedAt: new Date(Date.now() - 180000),
  },
];

// Status colors
const STATUS_COLORS = {
  online: 'bg-green-500',
  away: 'bg-yellow-500',
  busy: 'bg-red-500',
  offline: 'bg-gray-500',
};

// Role icons
const ROLE_ICONS = {
  admin: Crown,
  editor: Shield,
  viewer: User,
};

// Activity type icons
const ACTIVITY_ICONS = {
  create: Plus,
  modify: Move,
  delete: Trash2,
  select: MousePointer,
  lock: Lock,
  unlock: Unlock,
  chat: MessageSquare,
  join: UserPlus,
  leave: UserMinus,
  viewport: Camera,
};

const CollaborationPanel: React.FC<CollaborationPanelProps> = ({
  isConnected,
  currentUserId = '1',
  currentUserName = 'You',
  onShareViewport,
  onFollowUser,
  onLockActor,
  onUnlockActor,
  onSendChat,
}) => {
  // State
  const [activeTab, setActiveTab] = useState<'team' | 'activity' | 'chat'>('team');
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>(MOCK_TEAM_MEMBERS);
  const [activities, setActivities] = useState<ActivityItem[]>(MOCK_ACTIVITIES);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(MOCK_CHAT_MESSAGES);
  const [lockedActors, setLockedActors] = useState<LockedActor[]>(MOCK_LOCKED_ACTORS);
  const [newMessage, setNewMessage] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [followingUser, setFollowingUser] = useState<string | null>(null);
  const [isSharingViewport, setIsSharingViewport] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showLockedActors, setShowLockedActors] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'editor' | 'viewer'>('editor');
  const [inviteLink, setInviteLink] = useState('');
  const [inviteSending, setInviteSending] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [linkCopied, setLinkCopied] = useState(false);

  const chatContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Simulate real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      // Update last active times
      setTeamMembers(prev => prev.map(member => ({
        ...member,
        lastActiveAt: member.status === 'online' ? new Date() : member.lastActiveAt,
      })));
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Handle send message
  const handleSendMessage = () => {
    if (!newMessage.trim()) return;

    const message: ChatMessage = {
      id: Date.now().toString(),
      userId: currentUserId,
      userName: currentUserName,
      userColor: '#3B82F6',
      content: newMessage,
      timestamp: new Date(),
      type: 'text',
    };

    setChatMessages(prev => [...prev, message]);
    setNewMessage('');
    onSendChat?.(newMessage);

    // Add to activity
    const activity: ActivityItem = {
      id: Date.now().toString(),
      userId: currentUserId,
      userName: currentUserName,
      userColor: '#3B82F6',
      action: 'Sent a message',
      timestamp: new Date(),
      type: 'chat',
    };
    setActivities(prev => [activity, ...prev]);
  };

  // Handle follow user
  const handleFollowUser = (userId: string) => {
    if (followingUser === userId) {
      setFollowingUser(null);
    } else {
      setFollowingUser(userId);
      onFollowUser?.(userId);
    }
  };

  // Handle share viewport
  const handleShareViewport = () => {
    setIsSharingViewport(!isSharingViewport);
    onShareViewport?.();
  };

  // Generate invite link
  const generateInviteLink = () => {
    const code = Math.random().toString(36).substring(2, 8).toUpperCase();
    const link = `https://ue5-ai.studio/join/${code}`;
    setInviteLink(link);
    return link;
  };

  // Initialize invite link when modal opens
  useEffect(() => {
    if (showInviteModal && !inviteLink) {
      generateInviteLink();
    }
  }, [showInviteModal]);

  // Handle send invite
  const handleSendInvite = async () => {
    // Validate email
    if (!inviteEmail.trim()) {
      setInviteError('Please enter an email address');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(inviteEmail)) {
      setInviteError('Please enter a valid email address');
      return;
    }

    setInviteError('');
    setInviteSending(true);

    try {
      // Simulate API call to send invite
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Add activity for the invite
      const activity: ActivityItem = {
        id: Date.now().toString(),
        userId: currentUserId,
        userName: currentUserName,
        userColor: '#3B82F6',
        action: `Invited ${inviteEmail} as ${inviteRole}`,
        timestamp: new Date(),
        type: 'join',
      };
      setActivities(prev => [activity, ...prev]);

      setInviteSent(true);
      setInviteSending(false);

      // Reset after showing success
      setTimeout(() => {
        setInviteSent(false);
        setInviteEmail('');
        setShowInviteModal(false);
      }, 2000);
    } catch (error) {
      setInviteError('Failed to send invitation. Please try again.');
      setInviteSending(false);
    }
  };

  // Handle copy invite link
  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch (error) {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = inviteLink;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  };

  // Reset invite modal state when closed
  const handleCloseInviteModal = () => {
    setShowInviteModal(false);
    setInviteEmail('');
    setInviteRole('editor');
    setInviteError('');
    setInviteSent(false);
    setLinkCopied(false);
  };

  // Format time ago
  const formatTimeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  // Get online count
  const onlineCount = teamMembers.filter(m => m.status === 'online').length;

  // Filter team members
  const filteredMembers = teamMembers.filter(member =>
    member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    member.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Render team member
  const renderTeamMember = (member: TeamMember) => {
    const RoleIcon = ROLE_ICONS[member.role];
    const isFollowing = followingUser === member.id;
    const isCurrentUser = member.id === currentUserId;

    return (
      <div
        key={member.id}
        className={`p-3 rounded-xl transition-all ${
          isFollowing ? 'bg-purple-500/20 border border-purple-500/30' : 'bg-white/5 hover:bg-white/10'
        }`}
      >
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="relative">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
              style={{ backgroundColor: member.color }}
            >
              {member.avatar ? (
                <img src={member.avatar} alt={member.name} className="w-full h-full rounded-full" />
              ) : (
                member.name.charAt(0).toUpperCase()
              )}
            </div>
            <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-gray-900 ${STATUS_COLORS[member.status]}`} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium text-white truncate">{member.name}</span>
              {isCurrentUser && (
                <span className="text-xs px-1.5 py-0.5 rounded bg-blue-500/20 text-blue-400">You</span>
              )}
              <RoleIcon className="w-3.5 h-3.5 text-gray-400" />
            </div>
            <p className="text-xs text-gray-400 truncate">{member.currentAction || 'Idle'}</p>
            {member.selectedActors && member.selectedActors.length > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <MousePointer className="w-3 h-3 text-gray-500" />
                <span className="text-xs text-gray-500 truncate">
                  {member.selectedActors.slice(0, 2).join(', ')}
                  {member.selectedActors.length > 2 && ` +${member.selectedActors.length - 2}`}
                </span>
              </div>
            )}
          </div>

          {/* Actions */}
          {!isCurrentUser && member.status === 'online' && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => handleFollowUser(member.id)}
                className={`p-1.5 rounded-lg transition-colors ${
                  isFollowing
                    ? 'bg-purple-500 text-white'
                    : 'hover:bg-white/10 text-gray-400 hover:text-white'
                }`}
                title={isFollowing ? 'Stop following' : 'Follow viewport'}
              >
                <Eye className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    );
  };

  // Render activity item
  const renderActivityItem = (activity: ActivityItem) => {
    const Icon = ACTIVITY_ICONS[activity.type];

    return (
      <div key={activity.id} className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5">
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: `${activity.userColor}20` }}
        >
          <Icon className="w-4 h-4" style={{ color: activity.userColor }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white">
            <span style={{ color: activity.userColor }}>{activity.userName}</span>
            {' '}{activity.action}
            {activity.target && (
              <span className="text-gray-400"> • {activity.target}</span>
            )}
          </p>
          {activity.details && (
            <p className="text-xs text-gray-500">{activity.details}</p>
          )}
          <p className="text-xs text-gray-500 mt-0.5">{formatTimeAgo(activity.timestamp)}</p>
        </div>
      </div>
    );
  };

  // Render chat message
  const renderChatMessage = (message: ChatMessage) => {
    const isCurrentUser = message.userId === currentUserId;
    const isSystem = message.type === 'system';

    if (isSystem) {
      return (
        <div key={message.id} className="flex justify-center my-2">
          <span className="text-xs text-gray-500 bg-white/5 px-3 py-1 rounded-full">
            {message.content}
          </span>
        </div>
      );
    }

    return (
      <div
        key={message.id}
        className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'} mb-3`}
      >
        <div className={`max-w-[80%] ${isCurrentUser ? 'order-2' : ''}`}>
          {!isCurrentUser && (
            <div className="flex items-center gap-2 mb-1">
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-xs text-white"
                style={{ backgroundColor: message.userColor }}
              >
                {message.userName.charAt(0)}
              </div>
              <span className="text-xs text-gray-400">{message.userName}</span>
            </div>
          )}
          <div
            className={`px-3 py-2 rounded-2xl ${
              isCurrentUser
                ? 'bg-blue-500 text-white rounded-br-md'
                : 'bg-white/10 text-white rounded-bl-md'
            }`}
          >
            <p className="text-sm">{message.content}</p>
          </div>
          <p className={`text-xs text-gray-500 mt-1 ${isCurrentUser ? 'text-right' : ''}`}>
            {formatTimeAgo(message.timestamp)}
          </p>
        </div>
      </div>
    );
  };

  // Compact mode
  if (!isExpanded) {
    return (
      <button
        onClick={() => setIsExpanded(true)}
        className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors"
      >
        <Users className="w-5 h-5 text-purple-400" />
        <span className="text-white font-medium">{onlineCount} Online</span>
        <ChevronDown className="w-4 h-4 text-gray-400" />
      </button>
    );
  }

  return (
    <div className="bg-gray-900/80 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-white/10">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <Users className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Team Collaboration</h3>
              <p className="text-xs text-gray-400">{onlineCount} of {teamMembers.length} online</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleShareViewport}
              className={`p-2 rounded-lg transition-colors ${
                isSharingViewport
                  ? 'bg-green-500/20 text-green-400'
                  : 'hover:bg-white/10 text-gray-400'
              }`}
              title={isSharingViewport ? 'Stop sharing' : 'Share viewport'}
            >
              {isSharingViewport ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setNotifications(!notifications)}
              className={`p-2 rounded-lg transition-colors ${
                notifications ? 'text-gray-400' : 'text-gray-600'
              } hover:bg-white/10`}
              title={notifications ? 'Mute notifications' : 'Enable notifications'}
            >
              {notifications ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
            </button>
            <button
              onClick={() => setShowInviteModal(true)}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 transition-colors"
              title="Invite team member"
            >
              <UserPlus className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsExpanded(false)}
              className="p-2 rounded-lg hover:bg-white/10 text-gray-400 transition-colors"
              title="Minimize"
            >
              <Minimize2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 p-1 rounded-lg">
          {[
            { id: 'team', label: 'Team', icon: Users },
            { id: 'activity', label: 'Activity', icon: Activity },
            { id: 'chat', label: 'Chat', icon: MessageSquare },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-purple-500 text-white'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* Team Tab */}
        {activeTab === 'team' && (
          <div className="h-full flex flex-col">
            {/* Search */}
            <div className="p-3 border-b border-white/5">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search team members..."
                  className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 text-sm focus:outline-none focus:border-purple-500/50"
                />
              </div>
            </div>

            {/* Members List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredMembers.map(renderTeamMember)}
            </div>

            {/* Locked Actors */}
            {lockedActors.length > 0 && (
              <div className="p-3 border-t border-white/10">
                <button
                  onClick={() => setShowLockedActors(!showLockedActors)}
                  className="flex items-center justify-between w-full text-sm"
                >
                  <div className="flex items-center gap-2 text-yellow-400">
                    <Lock className="w-4 h-4" />
                    <span>{lockedActors.length} Locked Actor{lockedActors.length > 1 ? 's' : ''}</span>
                  </div>
                  <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showLockedActors ? 'rotate-180' : ''}`} />
                </button>
                {showLockedActors && (
                  <div className="mt-2 space-y-2">
                    {lockedActors.map(actor => (
                      <div key={actor.actorId} className="flex items-center justify-between p-2 bg-yellow-500/10 rounded-lg">
                        <div>
                          <p className="text-sm text-white">{actor.actorName}</p>
                          <p className="text-xs text-gray-400">Locked by {actor.lockedByName}</p>
                        </div>
                        {actor.lockedBy === currentUserId && (
                          <button
                            onClick={() => onUnlockActor?.(actor.actorId)}
                            className="p-1.5 rounded-lg hover:bg-white/10 text-yellow-400"
                            title="Unlock"
                          >
                            <Unlock className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Activity Tab */}
        {activeTab === 'activity' && (
          <div className="h-full overflow-y-auto p-3 space-y-1">
            {activities.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500">
                <Activity className="w-12 h-12 mb-2 opacity-50" />
                <p>No recent activity</p>
              </div>
            ) : (
              activities.map(renderActivityItem)
            )}
          </div>
        )}

        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="h-full flex flex-col">
            {/* Messages */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto p-3"
            >
              {chatMessages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-gray-500">
                  <MessageSquare className="w-12 h-12 mb-2 opacity-50" />
                  <p>No messages yet</p>
                  <p className="text-sm">Start the conversation!</p>
                </div>
              ) : (
                chatMessages.map(renderChatMessage)
              )}
            </div>

            {/* Input */}
            <div className="p-3 border-t border-white/10">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Type a message..."
                  className="flex-1 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 text-sm focus:outline-none focus:border-purple-500/50"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim()}
                  className="p-2 rounded-xl bg-purple-500 text-white hover:bg-purple-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Following Indicator */}
      {followingUser && (
        <div className="p-3 border-t border-white/10 bg-purple-500/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Eye className="w-4 h-4 text-purple-400" />
              <span className="text-sm text-purple-400">
                Following {teamMembers.find(m => m.id === followingUser)?.name}
              </span>
            </div>
            <button
              onClick={() => setFollowingUser(null)}
              className="text-xs text-gray-400 hover:text-white"
            >
              Stop
            </button>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-gray-900 rounded-2xl p-6 w-full max-w-md mx-4 border border-white/10 shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Invite Team Member</h3>
                  <p className="text-xs text-gray-400">Add collaborators to your session</p>
                </div>
              </div>
              <button
                onClick={handleCloseInviteModal}
                className="p-2 rounded-lg hover:bg-white/10 text-gray-400 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Success State */}
            {inviteSent ? (
              <div className="py-8 text-center">
                <div className="w-16 h-16 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-8 h-8 text-green-400" />
                </div>
                <h4 className="text-lg font-semibold text-white mb-2">Invitation Sent!</h4>
                <p className="text-gray-400 text-sm">An invitation has been sent to {inviteEmail}</p>
              </div>
            ) : (
              <>
                {/* Form */}
                <div className="space-y-4">
                  {/* Email Input */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Email Address</label>
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => {
                        setInviteEmail(e.target.value);
                        setInviteError('');
                      }}
                      placeholder="colleague@example.com"
                      className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-gray-500 focus:outline-none transition-colors ${
                        inviteError ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-purple-500/50'
                      }`}
                    />
                    {inviteError && (
                      <p className="text-red-400 text-xs mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {inviteError}
                      </p>
                    )}
                  </div>
                  
                  {/* Role Selection */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Role</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => setInviteRole('editor')}
                        className={`p-3 rounded-xl border transition-all ${
                          inviteRole === 'editor'
                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        <Shield className="w-5 h-5 mx-auto mb-1" />
                        <div className="text-sm font-medium">Editor</div>
                        <div className="text-xs opacity-70">Can edit</div>
                      </button>
                      <button
                        onClick={() => setInviteRole('viewer')}
                        className={`p-3 rounded-xl border transition-all ${
                          inviteRole === 'viewer'
                            ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                        }`}
                      >
                        <Eye className="w-5 h-5 mx-auto mb-1" />
                        <div className="text-sm font-medium">Viewer</div>
                        <div className="text-xs opacity-70">View only</div>
                      </button>
                    </div>
                  </div>

                  {/* Divider */}
                  <div className="relative py-2">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-white/10"></div>
                    </div>
                    <div className="relative flex justify-center">
                      <span className="px-3 bg-gray-900 text-xs text-gray-500">OR SHARE LINK</span>
                    </div>
                  </div>

                  {/* Invite Link */}
                  <div>
                    <label className="text-sm text-gray-400 mb-2 block">Invite Link</label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={inviteLink}
                        readOnly
                        className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-300 text-sm font-mono"
                      />
                      <button
                        onClick={handleCopyLink}
                        className={`px-4 py-3 rounded-xl transition-all flex items-center gap-2 ${
                          linkCopied
                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                            : 'bg-white/10 hover:bg-white/20 text-white'
                        }`}
                      >
                        {linkCopied ? (
                          <>
                            <CheckCircle className="w-4 h-4" />
                            <span className="text-sm">Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4" />
                            <span className="text-sm">Copy</span>
                          </>
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Anyone with this link can join as a {inviteRole}
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleCloseInviteModal}
                    className="flex-1 px-4 py-3 rounded-xl border border-white/10 text-white hover:bg-white/5 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSendInvite}
                    disabled={inviteSending}
                    className="flex-1 px-4 py-3 rounded-xl bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium hover:from-purple-600 hover:to-pink-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {inviteSending ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Send Invitation
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Voice Commands Help */}
      <div className="p-3 border-t border-white/10 bg-white/5">
        <p className="text-xs text-gray-500 mb-2">Voice Commands</p>
        <div className="flex flex-wrap gap-1">
          {['"Who\'s online"', '"Follow Sarah"', '"Share viewport"', '"Lock actor"'].map(cmd => (
            <span key={cmd} className="text-xs px-2 py-1 rounded-full bg-white/5 text-gray-400">
              {cmd}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CollaborationPanel;
