/**
 * PresencePanel Component
 * Displays online users with their current status and activity
 */
import React, { useEffect, useState } from 'react';
import { Users, Circle, FileText, Keyboard } from 'lucide-react';
import { UserPresence } from '../lib/collaboration-api';

interface PresencePanelProps {
  users: UserPresence[];
  currentUserId?: number;
  className?: string;
}

export const PresencePanel: React.FC<PresencePanelProps> = ({
  users,
  currentUserId,
  className = '',
}) => {
  const [expandedUsers, setExpandedUsers] = useState<Set<number>>(new Set());

  const toggleUser = (userId: number) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
    }
    setExpandedUsers(newExpanded);
  };

  const getInitials = (username: string): string => {
    return username
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getRelativeTime = (timestamp: string): string => {
    const now = new Date();
    const then = new Date(timestamp);
    const diffMs = now.getTime() - then.getTime();
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);

    if (diffSecs < 10) return 'just now';
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffMins < 60) return `${diffMins}m ago`;
    return `${Math.floor(diffMins / 60)}h ago`;
  };

  const otherUsers = users.filter((u) => u.user_id !== currentUserId);
  const currentUser = users.find((u) => u.user_id === currentUserId);

  return (
    <div className={`flex flex-col h-full bg-gray-900 border-l border-gray-700 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-700">
        <Users className="w-5 h-5 text-blue-400" />
        <h3 className="font-semibold text-white">Online Users</h3>
        <span className="ml-auto text-sm text-gray-400">{users.length}</span>
      </div>

      {/* User List */}
      <div className="flex-1 overflow-y-auto">
        {/* Current User */}
        {currentUser && (
          <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/50">
            <div className="flex items-center gap-3">
              {/* Avatar */}
              <div
                className="relative flex items-center justify-center w-10 h-10 rounded-full font-semibold text-white"
                style={{ backgroundColor: currentUser.color }}
              >
                {getInitials(currentUser.username)}
                <Circle
                  className="absolute -bottom-1 -right-1 w-3 h-3 fill-green-500 text-green-500"
                  strokeWidth={2}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-white truncate">
                    {currentUser.username}
                  </span>
                  <span className="text-xs text-gray-400">(You)</span>
                </div>
                {currentUser.current_file_path && (
                  <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                    <FileText className="w-3 h-3" />
                    <span className="truncate">
                      {currentUser.current_file_path.split('/').pop()}
                    </span>
                  </div>
                )}
              </div>

              {/* Typing Indicator */}
              {currentUser.is_typing && (
                <Keyboard className="w-4 h-4 text-blue-400 animate-pulse" />
              )}
            </div>
          </div>
        )}

        {/* Other Users */}
        {otherUsers.length > 0 ? (
          <div className="divide-y divide-gray-700">
            {otherUsers.map((user) => (
              <div
                key={user.user_id}
                className="px-4 py-3 hover:bg-gray-800/50 transition-colors cursor-pointer"
                onClick={() => toggleUser(user.user_id)}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div
                    className="relative flex items-center justify-center w-10 h-10 rounded-full font-semibold text-white flex-shrink-0"
                    style={{ backgroundColor: user.color }}
                  >
                    {getInitials(user.username)}
                    <Circle
                      className="absolute -bottom-1 -right-1 w-3 h-3 fill-green-500 text-green-500"
                      strokeWidth={2}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-white truncate">
                        {user.username}
                      </span>
                    </div>
                    {user.current_file_path ? (
                      <div className="flex items-center gap-1 mt-1 text-xs text-gray-400">
                        <FileText className="w-3 h-3" />
                        <span className="truncate">
                          {user.current_file_path.split('/').pop()}
                        </span>
                      </div>
                    ) : (
                      <div className="mt-1 text-xs text-gray-500">Idle</div>
                    )}
                  </div>

                  {/* Typing Indicator */}
                  {user.is_typing && (
                    <Keyboard className="w-4 h-4 text-blue-400 animate-pulse flex-shrink-0" />
                  )}
                </div>

                {/* Expanded Details */}
                {expandedUsers.has(user.user_id) && (
                  <div className="mt-3 pl-13 space-y-1 text-xs text-gray-400">
                    <div>
                      <span className="text-gray-500">Email:</span> {user.email}
                    </div>
                    <div>
                      <span className="text-gray-500">Last active:</span>{' '}
                      {getRelativeTime(user.last_activity)}
                    </div>
                    {user.cursor_position && (
                      <div>
                        <span className="text-gray-500">Cursor:</span> Line{' '}
                        {user.cursor_position.line}, Col {user.cursor_position.column}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <Users className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm">No other users online</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-gray-700 text-xs text-gray-500 text-center">
        Real-time collaboration
      </div>
    </div>
  );
};

export default PresencePanel;
