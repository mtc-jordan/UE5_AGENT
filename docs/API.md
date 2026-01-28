# API Documentation

## Base URL

```
http://localhost:8000/api
```

## Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your_jwt_token>
```

---

## Authentication Endpoints

### Register User

```http
POST /auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "username": "username",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "username",
    "is_admin": false
  }
}
```

### Login

```http
POST /auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**
```json
{
  "access_token": "eyJ...",
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "username": "username"
  }
}
```

### Get Current User

```http
GET /auth/me
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "username": "username",
  "is_admin": false,
  "created_at": "2026-01-27T00:00:00Z"
}
```

---

## AI Chat Endpoints

### Send Chat Message

```http
POST /ue5-ai/chat
```

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "message": "How do I spawn an actor in UE5?",
  "model": "deepseek-chat",
  "project_id": "optional-project-uuid",
  "chat_id": "optional-chat-uuid",
  "tools": [
    {
      "name": "spawn_actor",
      "description": "Spawn an actor in UE5",
      "parameters": {
        "type": "object",
        "properties": {
          "class_path": {"type": "string"},
          "location": {"type": "object"}
        }
      }
    }
  ]
}
```

**Response:**
```json
{
  "content": "To spawn an actor in UE5, you can use...",
  "tool_calls": [
    {
      "id": "call_123",
      "name": "spawn_actor",
      "arguments": {
        "class_path": "/Game/Blueprints/BP_MyActor",
        "location": {"x": 0, "y": 0, "z": 0}
      }
    }
  ],
  "finish_reason": "stop",
  "model": "deepseek-chat",
  "usage": {
    "prompt_tokens": 100,
    "completion_tokens": 50,
    "total_tokens": 150
  }
}
```

### Stream Chat Message

```http
POST /ue5-ai/chat/stream
```

**Request Body:** Same as `/chat`

**Response:** Server-Sent Events (SSE) stream

```
data: {"type": "content", "content": "To spawn"}
data: {"type": "content", "content": " an actor"}
data: {"type": "tool_call", "tool_call": {...}}
data: {"type": "done", "finish_reason": "stop"}
```

### List Available Models

```http
GET /ue5-ai/models
```

**Response:**
```json
{
  "models": [
    {
      "id": "deepseek-chat",
      "name": "DeepSeek V3",
      "provider": "deepseek",
      "capabilities": ["chat", "tools"],
      "context_window": 128000
    },
    ...
  ]
}
```

---

## Project Endpoints

### List Projects

```http
GET /projects
```

**Headers:**
```
Authorization: Bearer <token>
```

**Response:**
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "My UE5 Project",
      "description": "Project description",
      "created_at": "2026-01-27T00:00:00Z",
      "updated_at": "2026-01-27T00:00:00Z"
    }
  ]
}
```

### Create Project

```http
POST /projects
```

**Request Body:**
```json
{
  "name": "New Project",
  "description": "Optional description"
}
```

### Get Project

```http
GET /projects/{project_id}
```

### Update Project

```http
PUT /projects/{project_id}
```

### Delete Project

```http
DELETE /projects/{project_id}
```

### Get Project Stats

```http
GET /projects/stats
```

**Response:**
```json
{
  "total_projects": 10,
  "total_chats": 50,
  "total_messages": 500
}
```

---

## Memory Endpoints

### Store Memory

```http
POST /memory/store
```

**Request Body:**
```json
{
  "content": "Remember that the player controller is at /Game/Blueprints/BP_PlayerController",
  "project_id": "optional-uuid",
  "tags": ["blueprint", "player"]
}
```

### Recall Memory

```http
POST /memory/recall
```

**Request Body:**
```json
{
  "query": "player controller blueprint",
  "project_id": "optional-uuid",
  "limit": 5
}
```

**Response:**
```json
{
  "memories": [
    {
      "id": "uuid",
      "content": "Remember that the player controller...",
      "relevance_score": 0.95,
      "created_at": "2026-01-27T00:00:00Z"
    }
  ]
}
```

### Search Memory

```http
GET /memory/search?q=player&project_id=uuid
```

---

## Admin Endpoints

### List Users (Admin)

```http
GET /admin/users
```

**Headers:**
```
Authorization: Bearer <admin_token>
```

**Response:**
```json
{
  "users": [
    {
      "id": "uuid",
      "email": "user@example.com",
      "username": "username",
      "is_admin": false,
      "created_at": "2026-01-27T00:00:00Z"
    }
  ]
}
```

### Make User Admin

```http
POST /admin/users/{user_id}/make-admin
```

### List User Roles

```http
GET /admin/users/{user_id}/roles
```

---

## Monitoring Endpoints

### Health Check

```http
GET /monitoring/health
```

**Response:**
```json
{
  "status": "healthy",
  "metrics": {
    "cpu_percent": 15.5,
    "memory_percent": 45.2,
    "memory_used_mb": 1800,
    "memory_available_mb": 2000,
    "disk_percent": 30.5,
    "disk_used_gb": 12.5,
    "disk_free_gb": 28.5,
    "uptime_seconds": 3600
  },
  "timestamp": "2026-01-27T12:00:00Z"
}
```

### Get Metrics (Admin)

```http
GET /monitoring/metrics
```

**Response:**
```json
{
  "requests_per_second": 10.5,
  "avg_response_time_ms": 150,
  "p95_response_time_ms": 300,
  "p99_response_time_ms": 500,
  "error_rate": 0.01,
  "status_codes": {
    "200": 950,
    "400": 30,
    "500": 20
  }
}
```

### Get Endpoint Stats (Admin)

```http
GET /monitoring/endpoints
```

**Response:**
```json
{
  "endpoints": [
    {
      "path": "/api/ue5-ai/chat",
      "method": "POST",
      "count": 500,
      "avg_response_time_ms": 200,
      "p95_response_time_ms": 400
    }
  ]
}
```

### Get Alerts (Admin)

```http
GET /monitoring/alerts
```

**Response:**
```json
{
  "alerts": [
    {
      "level": "warning",
      "message": "High memory usage: 85%",
      "timestamp": "2026-01-27T12:00:00Z"
    }
  ]
}
```

---

## API Keys Endpoints

### List API Keys

```http
GET /api-keys
```

**Response:**
```json
{
  "api_keys": [
    {
      "provider": "openai",
      "masked_key": "sk-...xyz",
      "is_configured": true,
      "last_used": "2026-01-27T12:00:00Z"
    }
  ]
}
```

### Set API Key

```http
POST /api-keys
```

**Request Body:**
```json
{
  "provider": "openai",
  "api_key": "sk-..."
}
```

### Delete API Key

```http
DELETE /api-keys/{provider}
```

### Test API Key

```http
POST /api-keys/{provider}/test
```

---

## Error Responses

All error responses follow this format:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "Additional context"
    }
  },
  "request_id": "uuid",
  "timestamp": "2026-01-27T12:00:00Z"
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Invalid request data |
| `RATE_LIMIT` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limiting

- **Default**: 100 requests per minute per user
- **Admin**: 1000 requests per minute
- **Headers**:
  - `X-RateLimit-Limit`: Total requests allowed
  - `X-RateLimit-Remaining`: Requests remaining
  - `X-RateLimit-Reset`: Time until reset (Unix timestamp)

---

## Pagination

List endpoints support pagination:

```http
GET /projects?page=1&page_size=20
```

**Response:**
```json
{
  "items": [...],
  "total": 100,
  "page": 1,
  "page_size": 20,
  "total_pages": 5
}
```

---

## Webhooks (Coming Soon)

Subscribe to events:

- `chat.message.created`
- `project.created`
- `tool.executed`

---

For interactive API documentation, visit:
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
