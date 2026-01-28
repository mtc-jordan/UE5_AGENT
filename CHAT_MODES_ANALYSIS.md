# UE5 AI Studio - Chat Modes Analysis

**Date**: January 28, 2026  
**Component**: Main Chat Interface  
**File**: `frontend/src/pages/Chat.tsx`

---

## Overview

The chat interface supports **three distinct agent collaboration modes**:

1. **Solo Mode** - Single agent responds
2. **Team Mode** - Multiple agents respond sequentially
3. **Roundtable Mode** - Agents discuss together collaboratively

---

## Mode Implementations

### 1. Solo Mode

**UI Location**: Header mode toggle (User icon)

**Behavior**:
- User selects ONE agent from the agent selector
- Only the selected agent responds to queries
- Stored in `soloAgent` state
- Agent selector shows radio-style selection

**Code Implementation**:
```typescript
// Line 129
const { soloAgent, setSoloAgent } = useSettingsStore()

// Lines 861-893 - Solo agent selector
{mode === 'solo' ? (
  <>
    <div className="text-xs font-medium text-ue-muted uppercase tracking-wider px-2 py-1">
      Select Agent
    </div>
    {allAgents.map((agent) => {
      const Icon = agentIcons[agent]
      return (
        <button
          key={agent}
          onClick={() => {
            setSoloAgent(agent)
            setShowAgentSelector(false)
          }}
          className={cn(
            'w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors',
            soloAgent === agent ? 'bg-ue-accent/10 text-ue-accent' : 'hover:bg-ue-bg'
          )}
        >
          {/* Agent display */}
        </button>
      )
    })}
  </>
)}
```

**API Call**:
```typescript
// Lines 337-343
for await (const chunk of aiApi.chat({
  message: userMessage.content,
  chat_id: activeChatId,
  mode,  // 'solo'
  active_agents: activeAgents,
  solo_agent: soloAgent,  // Selected agent
  model
}))
```

**Use Cases**:
- Focused expertise (e.g., only Blueprint Specialist)
- Quick single-perspective answers
- Testing specific agent capabilities

---

### 2. Team Mode

**UI Location**: Header mode toggle (Users icon)

**Behavior**:
- User selects MULTIPLE agents (minimum 1)
- Agents respond **sequentially** (one after another)
- Each agent provides their perspective
- Stored in `activeAgents` array
- Agent selector shows checkbox-style multi-select

**Code Implementation**:
```typescript
// Line 129
const { activeAgents, setActiveAgents } = useSettingsStore()

// Lines 894-939 - Team agent selector
{mode === 'team' || mode === 'roundtable' ? (
  <>
    <div className="text-xs font-medium text-ue-muted uppercase tracking-wider px-2 py-1">
      Active Agents
    </div>
    {allAgents.map((agent) => {
      const Icon = agentIcons[agent]
      const isActive = activeAgents.includes(agent)
      return (
        <button
          key={agent}
          onClick={() => toggleAgent(agent)}
          className={cn(
            'w-full flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors',
            isActive ? 'bg-ue-accent/10' : 'hover:bg-ue-bg'
          )}
        >
          {/* Checkbox-style selection */}
        </button>
      )
    })}
  </>
)}
```

**Agent Toggle Logic**:
```typescript
// Lines 525-533
const toggleAgent = (agent: string) => {
  if (activeAgents.includes(agent)) {
    if (activeAgents.length > 1) {  // Prevent removing last agent
      setActiveAgents(activeAgents.filter((a) => a !== agent))
    }
  } else {
    setActiveAgents([...activeAgents, agent])
  }
}
```

**Streaming Response Handling**:
```typescript
// Lines 346-369 - Each agent streams separately
if (chunk.type === 'phase') {
  setCurrentPhase(chunk.phase || chunk.message || '')
} else if (chunk.type === 'chunk') {
  const agent = chunk.agent || 'assistant'
  
  if (!assistantMessages.has(agent)) {
    const newMessage: Message = {
      id: `${Date.now()}-${agent}`,
      role: 'assistant',
      agent,
      agent_name: chunk.agent_name || agentNames[agent],
      agent_color: chunk.agent_color || agentColors[agent],
      content: '',
      created_at: new Date().toISOString()
    }
    assistantMessages.set(agent, newMessage)
  }
  
  const msg = assistantMessages.get(agent)!
  msg.content += chunk.content || ''
  
  setStreamingMessages(new Map(assistantMessages))
}
```

**Use Cases**:
- Multiple perspectives on complex problems
- Comprehensive analysis (architect + developer + QA)
- Cross-functional collaboration
- Each agent provides independent response

---

### 3. Roundtable Mode

**UI Location**: Header mode toggle (MessageCircle icon with special styling)

**Behavior**:
- User selects MULTIPLE agents (same as Team)
- Agents **discuss together** before responding
- **Collaborative synthesis** of ideas
- Agents reference and build on each other's suggestions
- Final coordinated response combining all perspectives

**Code Implementation**:
```typescript
// Lines 651-662 - Roundtable button with special styling
<button
  onClick={() => setMode('roundtable')}
  className={cn(
    'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all',
    mode === 'roundtable' 
      ? 'bg-ue-accent/20 text-ue-accent border border-ue-accent/30'  // Special highlight
      : 'text-ue-muted hover:text-ue-text'
  )}
  title="Agents discuss together"
>
  <MessageCircle className="w-4 h-4" />
  Round Table
</button>
```

**API Call** (same as Team but backend handles differently):
```typescript
// Lines 337-343
for await (const chunk of aiApi.chat({
  message: userMessage.content,
  chat_id: activeChatId,
  mode,  // 'roundtable'
  active_agents: activeAgents,  // Multiple agents
  solo_agent: soloAgent,
  model
}))
```

**Backend Differentiation**:
The backend receives `mode: 'roundtable'` and should:
1. Facilitate discussion phase between agents
2. Allow agents to see each other's responses
3. Enable agents to build on ideas
4. Synthesize final coordinated response

**Use Cases**:
- Complex architectural decisions
- Design reviews requiring consensus
- Problem-solving requiring multiple expertise areas
- Strategic planning

---

## Agent System

### Available Agents (6 total)

| Agent | Icon | Color | Expertise |
|-------|------|-------|-----------|
| `architect` | Cpu | Blue | Lead Architect - System design |
| `developer` | Code | Green | C++ Developer - Implementation |
| `blueprint` | Workflow | Purple | Blueprint Specialist - Visual scripting |
| `qa` | Shield | Red | QA Engineer - Testing & quality |
| `devops` | Server | Orange | DevOps Engineer - Infrastructure |
| `artist` | Palette | Pink | Technical Artist - Visuals & optimization |

**Code Definition**:
```typescript
// Lines 77-91
const agentIcons: Record<string, any> = {
  architect: Cpu,
  developer: Code,
  blueprint: Workflow,
  qa: Shield,
  devops: Server,
  artist: Palette
}

const agentNames: Record<string, string> = {
  architect: 'Lead Architect',
  developer: 'C++ Developer',
  blueprint: 'Blueprint Specialist',
  qa: 'QA Engineer',
  devops: 'DevOps Engineer',
  artist: 'Technical Artist'
}

const allAgents = ['architect', 'developer', 'blueprint', 'qa', 'devops', 'artist']
```

---

## Message Display

### Message Structure

```typescript
interface Message {
  id: string
  role: 'user' | 'assistant'
  agent?: string              // Agent ID (architect, developer, etc.)
  agent_name?: string         // Display name (Lead Architect, etc.)
  agent_color?: string        // Color for visual distinction
  content: string
  created_at: string
  isEditing?: boolean
  feedback?: 'positive' | 'negative' | null
  tokens?: number             // Token usage
  responseTime?: number       // Response time in ms
}
```

### Agent Message Display

**Lines 1000-1100** (approximate):
- Each agent message shows with colored avatar
- Agent name displayed prominently
- Color-coded for visual distinction
- Supports markdown rendering
- Code syntax highlighting
- Copy button for code blocks

---

## Phase Indicators

During streaming responses, the system shows current phase:

```typescript
// Lines 346-348
if (chunk.type === 'phase') {
  setCurrentPhase(chunk.phase || chunk.message || '')
}
```

**Example Phases**:
- "Analyzing request..."
- "Architect is thinking..."
- "Developer is implementing..."
- "Synthesizing responses..."

---

## Key Features

### 1. Real-time Streaming
- Server-Sent Events (SSE) for live updates
- Progressive rendering of agent responses
- Phase indicators showing current activity

### 2. Agent Visualization
- Color-coded agent avatars
- Agent names and roles
- Visual distinction between agents

### 3. Multi-agent Coordination
- Sequential responses (Team)
- Collaborative discussion (Roundtable)
- Independent expertise (Solo)

### 4. Message Management
- Edit messages
- Delete messages
- Regenerate responses
- Copy content
- Feedback (thumbs up/down)

### 5. Context Awareness
- Project context integration
- Memory system
- Conversation history

---

## Issues & Recommendations

### Current Issues

1. **Backend Roundtable Implementation**
   - Frontend sends `mode: 'roundtable'` but backend may not differentiate from Team mode
   - Need to verify backend handles collaborative discussion
   - Should implement agent-to-agent communication

2. **Agent Selection Persistence**
   - Agent selections stored in settings store
   - May not persist across sessions
   - Consider saving to backend

3. **Phase Indicators**
   - Generic phase messages
   - Could be more descriptive per agent and mode
   - Roundtable should show "Discussion phase", "Synthesis phase"

4. **Model List Outdated**
   - Chat.tsx has old model list (lines 93-105)
   - Doesn't match the 20 models in config/models.ts
   - Should import from central config

### Recommendations

#### High Priority

1. **Sync Model List**
   ```typescript
   // Replace lines 93-105 with:
   import { AI_MODELS } from '../config/models'
   const models = AI_MODELS
   ```

2. **Enhance Roundtable Mode**
   - Add backend logic for agent discussion
   - Show discussion phase in UI
   - Display synthesis process
   - Add "Agents are discussing..." indicator

3. **Improve Phase Indicators**
   ```typescript
   // Mode-specific phases
   if (mode === 'roundtable') {
     phases = [
       'Agents joining discussion...',
       'Discussing approaches...',
       'Building consensus...',
       'Synthesizing final response...'
     ]
   }
   ```

#### Medium Priority

4. **Agent Persistence**
   - Save agent selections to backend
   - Load from user preferences
   - Remember last used configuration

5. **Agent Descriptions**
   - Add tooltips explaining each agent's expertise
   - Show example use cases
   - Help users choose appropriate agents

6. **Mode Explanations**
   - Add info icon next to each mode
   - Explain when to use each mode
   - Show expected behavior

#### Low Priority

7. **Agent Performance Metrics**
   - Track response times per agent
   - Show token usage per agent
   - Display quality metrics

8. **Agent Customization**
   - Allow users to configure agent personalities
   - Adjust agent expertise levels
   - Create custom agents

---

## Testing Checklist

### Solo Mode
- [ ] Select single agent
- [ ] Agent responds correctly
- [ ] Agent color/name displayed
- [ ] Can switch agents mid-conversation
- [ ] Response quality appropriate for agent

### Team Mode
- [ ] Select multiple agents
- [ ] All selected agents respond
- [ ] Responses appear sequentially
- [ ] Each agent has distinct perspective
- [ ] Can add/remove agents
- [ ] Minimum 1 agent enforced

### Roundtable Mode
- [ ] Select multiple agents
- [ ] Discussion phase visible
- [ ] Agents reference each other (if implemented)
- [ ] Synthesized response provided
- [ ] Collaborative tone evident
- [ ] Better than Team mode for complex questions

### General
- [ ] Mode switching works mid-conversation
- [ ] Agent selections persist during session
- [ ] Phase indicators show correctly
- [ ] Streaming works for all modes
- [ ] Stop button works
- [ ] Error handling graceful

---

## Conclusion

The chat interface has a **solid foundation** for three collaboration modes:

**Strengths**:
- Clean UI with clear mode distinction
- Flexible agent selection
- Real-time streaming
- Good visual feedback

**Needs Improvement**:
- Backend Roundtable implementation
- Model list synchronization
- Agent persistence
- Mode-specific phase indicators

**Overall Assessment**: 7/10
- Solo and Team modes: Fully functional
- Roundtable mode: UI ready, backend needs enhancement
- User experience: Good, could be excellent with improvements

---

**Next Steps**:
1. Verify backend Roundtable implementation
2. Sync model list with central config
3. Add mode-specific phase indicators
4. Test all modes thoroughly
5. Document agent expertise and use cases
