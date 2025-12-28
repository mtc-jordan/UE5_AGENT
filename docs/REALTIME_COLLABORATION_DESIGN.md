# Real-time Collaboration Architecture Design

## Overview

This document outlines the architecture for implementing real-time collaboration features in UE5 AI Studio using WebSockets.

## Features

### 1. Live Chat Synchronization
- Real-time message delivery across all connected clients
- Message status indicators (sent, delivered, read)
- Optimistic UI updates with server confirmation

### 2. User Presence System
- Online/offline status indicators
- Active users in chat/workspace
- Last seen timestamps

### 3. Typing Indicators
- Real-time typing status broadcast
- Debounced typing events
- Multi-user typing display

### 4. Collaborative Workspace
- Real-time file editing notifications
- Cursor position sharing (optional)
- File lock/unlock mechanism

### 5. Notifications
- Real-time notifications for mentions
- Chat activity alerts
- System notifications

## Architecture

### WebSocket Server

```
┌─────────────────────────────────────────────────────────────┐
│                    FastAPI Application                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   REST API   │    │  WebSocket   │    │   Services   │  │
│  │   Endpoints  │    │   Endpoint   │    │              │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                   │                   │           │
│         └───────────────────┼───────────────────┘           │
│                             │                               │
│                    ┌────────▼────────┐                      │
│                    │   Connection    │                      │
│                    │    Manager      │                      │
│                    └────────┬────────┘                      │
│                             │                               │
│         ┌───────────────────┼───────────────────┐          │
│         │                   │                   │          │
│  ┌──────▼──────┐    ┌──────▼──────┐    ┌──────▼──────┐   │
│  │   Room      │    │  Presence   │    │   Event     │   │
│  │   Manager   │    │   Tracker   │    │   Broker    │   │
│  └─────────────┘    └─────────────┘    └─────────────┘   │
│                                                           │
└───────────────────────────────────────────────────────────┘
```

### Message Protocol

All WebSocket messages follow this format:

```json
{
  "type": "event_type",
  "payload": { ... },
  "timestamp": "ISO8601",
  "sender_id": "user_id"
}
```

### Event Types

| Event Type | Direction | Description |
|------------|-----------|-------------|
| `connect` | Client → Server | Initial connection with auth |
| `disconnect` | Client → Server | Graceful disconnect |
| `join_room` | Client → Server | Join a chat/workspace room |
| `leave_room` | Client → Server | Leave a room |
| `message` | Bidirectional | Chat message |
| `typing_start` | Client → Server | User started typing |
| `typing_stop` | Client → Server | User stopped typing |
| `presence_update` | Server → Client | User presence changed |
| `user_joined` | Server → Client | User joined room |
| `user_left` | Server → Client | User left room |
| `file_update` | Bidirectional | File changed in workspace |
| `notification` | Server → Client | System notification |

### Room Types

1. **Chat Rooms**: `chat:{chat_id}`
   - Messages, typing indicators, read receipts

2. **Project Rooms**: `project:{project_id}`
   - Project-wide notifications, file updates

3. **Workspace Rooms**: `workspace:{workspace_id}`
   - File editing, cursor positions

4. **Global Room**: `global`
   - System-wide broadcasts, presence

## Implementation Plan

### Phase 1: Core Infrastructure
- WebSocket endpoint with authentication
- Connection manager with room support
- Basic message routing

### Phase 2: Chat Features
- Real-time message delivery
- Typing indicators
- Message status updates

### Phase 3: Presence System
- Online/offline tracking
- Active room tracking
- Last seen updates

### Phase 4: Workspace Collaboration
- File change notifications
- Edit conflict detection
- Lock mechanism

## Security Considerations

1. **Authentication**: JWT token validation on connect
2. **Authorization**: Room-level permission checks
3. **Rate Limiting**: Message throttling per user
4. **Input Validation**: Sanitize all incoming messages
5. **Connection Limits**: Max connections per user

## Scalability

For future horizontal scaling:
- Redis pub/sub for cross-server messaging
- Sticky sessions or connection state in Redis
- Message queue for async processing

## Database Schema Updates

```sql
-- User presence tracking
ALTER TABLE users ADD COLUMN last_seen TIMESTAMP;
ALTER TABLE users ADD COLUMN is_online BOOLEAN DEFAULT FALSE;

-- Message read receipts
CREATE TABLE message_reads (
    id SERIAL PRIMARY KEY,
    message_id INTEGER REFERENCES messages(id),
    user_id INTEGER REFERENCES users(id),
    read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(message_id, user_id)
);
```

## Frontend Integration

### WebSocket Hook

```typescript
const useWebSocket = () => {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  
  // Connection management
  // Event handlers
  // Reconnection logic
};
```

### Real-time Store

```typescript
interface RealtimeState {
  onlineUsers: Set<number>;
  typingUsers: Map<number, Set<number>>; // chatId -> userIds
  unreadCounts: Map<number, number>;
}
```
