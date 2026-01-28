# Phase 6: Voice Command System Architecture

## 🏗️ System Architecture

### Overview
The voice command system is built on a modular architecture that separates concerns:
1. **Voice Recognition** - Web Speech API integration
2. **Command Parsing** - Natural language understanding
3. **Action Execution** - Command → Platform action
4. **Feedback System** - Visual and audio responses
5. **Context Management** - Workspace state awareness

---

## 📊 Component Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    Voice Command System                  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐      ┌──────────────┐               │
│  │ Voice Input  │──────▶│ Speech       │               │
│  │ (Microphone) │      │ Recognition  │               │
│  └──────────────┘      └──────┬───────┘               │
│                               │                         │
│                               ▼                         │
│                        ┌──────────────┐                │
│                        │   Command    │                │
│                        │   Parser     │                │
│                        └──────┬───────┘                │
│                               │                         │
│                               ▼                         │
│                        ┌──────────────┐                │
│                        │   Context    │                │
│                        │   Manager    │                │
│                        └──────┬───────┘                │
│                               │                         │
│                               ▼                         │
│                        ┌──────────────┐                │
│                        │   Action     │                │
│                        │   Executor   │                │
│                        └──────┬───────┘                │
│                               │                         │
│                ┌──────────────┴──────────────┐         │
│                ▼                             ▼         │
│         ┌──────────────┐            ┌──────────────┐  │
│         │   Visual     │            │    Audio     │  │
│         │   Feedback   │            │   Feedback   │  │
│         └──────────────┘            └──────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 Core Components

### 1. VoiceRecognitionService
**Location:** `frontend/src/services/voice-recognition.ts`

**Responsibilities:**
- Initialize Web Speech API
- Handle microphone permissions
- Start/stop listening
- Emit transcribed text
- Handle recognition errors

**Interface:**
```typescript
interface VoiceRecognitionService {
  isSupported(): boolean;
  requestPermission(): Promise<boolean>;
  startListening(options?: ListenOptions): void;
  stopListening(): void;
  on(event: 'result' | 'error' | 'end', callback: Function): void;
  off(event: string, callback: Function): void;
}
```

### 2. CommandParser
**Location:** `frontend/src/services/command-parser.ts`

**Responsibilities:**
- Parse natural language commands
- Extract intent and entities
- Match commands to actions
- Handle ambiguous commands

**Interface:**
```typescript
interface CommandParser {
  parse(text: string, context: WorkspaceContext): ParsedCommand;
  register(command: CommandDefinition): void;
  getSuggestions(partial: string): string[];
}

interface ParsedCommand {
  intent: string;
  entities: Record<string, any>;
  confidence: number;
  action: string;
  params: Record<string, any>;
}
```

### 3. CommandRegistry
**Location:** `frontend/src/services/command-registry.ts`

**Responsibilities:**
- Store all available commands
- Command pattern matching
- Command validation
- Command help/documentation

**Command Structure:**
```typescript
interface CommandDefinition {
  id: string;
  patterns: string[];  // ["open file {filename}", "show {filename}"]
  intent: string;      // "file.open"
  description: string;
  examples: string[];
  category: string;    // "file", "git", "ai", "navigation"
  handler: (params: any, context: any) => Promise<CommandResult>;
}
```

### 4. ActionExecutor
**Location:** `frontend/src/services/action-executor.ts`

**Responsibilities:**
- Execute parsed commands
- Handle async operations
- Error handling
- Result reporting

**Interface:**
```typescript
interface ActionExecutor {
  execute(command: ParsedCommand, context: WorkspaceContext): Promise<ActionResult>;
  canExecute(command: ParsedCommand): boolean;
}

interface ActionResult {
  success: boolean;
  message: string;
  data?: any;
  error?: Error;
}
```

### 5. VoiceContextManager
**Location:** `frontend/src/services/voice-context.ts`

**Responsibilities:**
- Track workspace state
- Maintain conversation context
- Resolve ambiguous references ("this file", "that function")
- History management

**Context Structure:**
```typescript
interface WorkspaceContext {
  currentFile: string | null;
  openFiles: string[];
  selectedText: string | null;
  cursorPosition: { line: number; column: number } | null;
  gitBranch: string | null;
  onlineUsers: User[];
  recentCommands: ParsedCommand[];
  conversationHistory: ConversationTurn[];
}
```

### 6. VoiceFeedbackService
**Location:** `frontend/src/services/voice-feedback.ts`

**Responsibilities:**
- Text-to-speech responses
- Audio cues (beeps, confirmations)
- Voice personality/tone
- Multi-language support

**Interface:**
```typescript
interface VoiceFeedbackService {
  speak(text: string, options?: SpeechOptions): Promise<void>;
  playSound(sound: 'success' | 'error' | 'listening' | 'processing'): void;
  setVoice(voiceId: string): void;
  setLanguage(lang: string): void;
}
```

---

## 🎨 UI Components

### 1. VoiceControlPanel
**Location:** `frontend/src/components/VoiceControlPanel.tsx`

**Features:**
- Microphone button (push-to-talk or toggle)
- Visual listening indicator (animated)
- Transcription display (real-time)
- Command feedback
- Status messages

**States:**
- Idle (ready to listen)
- Listening (actively recording)
- Processing (parsing command)
- Executing (running action)
- Success/Error (result display)

### 2. VoiceCommandHistory
**Location:** `frontend/src/components/VoiceCommandHistory.tsx`

**Features:**
- List of recent commands
- Command results
- Retry failed commands
- Clear history

### 3. VoiceSettings
**Location:** `frontend/src/components/VoiceSettings.tsx`

**Features:**
- Microphone selection
- Activation mode (hotkey vs always-on)
- Language selection
- Voice feedback toggle
- Confidence threshold

---

## 🎤 Command Categories

### File Operations
```
"open file {filename}"
"close file {filename}"
"save file"
"create file {filename}"
"delete file {filename}"
"rename file {oldname} to {newname}"
"show file tree"
```

### Navigation
```
"go to line {number}"
"find {text}"
"go back"
"go forward"
"switch to {filename}"
"show {panel}"  // terminal, git, explorer
```

### Git Operations
```
"commit with message {message}"
"push changes"
"pull changes"
"create branch {name}"
"switch to branch {name}"
"show git status"
"show git log"
```

### AI Operations
```
"explain this code"
"explain {selection}"
"generate {description}"
"fix this error"
"optimize this function"
"add comments"
```

### Collaboration
```
"show who's online"
"lock this file"
"unlock this file"
"request access to {filename}"
"show file locks"
```

### Workspace
```
"show settings"
"change theme to {theme}"
"increase font size"
"decrease font size"
"toggle terminal"
"toggle sidebar"
```

---

## 🔧 Technical Implementation

### Web Speech API Integration

```typescript
// Browser support check
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

// Initialize
const recognition = new SpeechRecognition();
recognition.continuous = true;  // Keep listening
recognition.interimResults = true;  // Show partial results
recognition.lang = 'en-US';  // Language
recognition.maxAlternatives = 3;  // Get multiple interpretations

// Event handlers
recognition.onresult = (event) => {
  const result = event.results[event.results.length - 1];
  const transcript = result[0].transcript;
  const confidence = result[0].confidence;
  
  if (result.isFinal) {
    // Process final command
    processCommand(transcript, confidence);
  } else {
    // Show interim result
    showInterimTranscript(transcript);
  }
};

recognition.onerror = (event) => {
  handleError(event.error);
};
```

### Command Pattern Matching

```typescript
// Simple pattern matching with named entities
function matchPattern(text: string, pattern: string): Match | null {
  // Convert pattern to regex
  // "open file {filename}" → /^open file (.+)$/i
  
  const regex = patternToRegex(pattern);
  const match = text.match(regex);
  
  if (match) {
    const entities = extractEntities(pattern, match);
    return { entities, confidence: calculateConfidence(match) };
  }
  
  return null;
}

// Fuzzy matching for typos
function fuzzyMatch(text: string, patterns: string[]): Match | null {
  const scores = patterns.map(pattern => ({
    pattern,
    score: levenshteinDistance(text, pattern)
  }));
  
  const best = scores.sort((a, b) => a.score - b.score)[0];
  
  if (best.score < THRESHOLD) {
    return matchPattern(text, best.pattern);
  }
  
  return null;
}
```

### Context Resolution

```typescript
// Resolve ambiguous references
function resolveReference(text: string, context: WorkspaceContext): string | null {
  const pronouns = ['this', 'that', 'current', 'it'];
  
  for (const pronoun of pronouns) {
    if (text.includes(pronoun)) {
      // "explain this function" → use selected text or current function
      if (context.selectedText) {
        return context.selectedText;
      }
      
      if (context.currentFile) {
        return context.currentFile;
      }
    }
  }
  
  return null;
}
```

---

## 🎯 Command Execution Flow

```
1. User speaks: "Open file PlayerController.cpp"
   ↓
2. Web Speech API transcribes: "open file PlayerController.cpp"
   ↓
3. CommandParser matches pattern: "open file {filename}"
   ↓
4. Extract entities: { filename: "PlayerController.cpp" }
   ↓
5. Resolve with context: Check if file exists in project
   ↓
6. ActionExecutor runs: fileService.openFile("PlayerController.cpp")
   ↓
7. Visual feedback: File opens in editor
   ↓
8. Audio feedback: "Opening PlayerController.cpp"
   ↓
9. Update context: currentFile = "PlayerController.cpp"
```

---

## 🔒 Security Considerations

1. **Microphone Permissions**: Request explicitly, handle denials gracefully
2. **Command Validation**: Validate all commands before execution
3. **Dangerous Commands**: Require confirmation for destructive actions
4. **Rate Limiting**: Prevent command spam
5. **Context Isolation**: Commands can only access user's own workspace

---

## 📊 Performance Targets

- **Recognition Latency**: < 500ms from speech end to transcription
- **Parsing Time**: < 100ms to parse and match command
- **Execution Time**: Depends on action (file open < 200ms)
- **Total Response Time**: < 1 second for simple commands
- **Accuracy**: > 95% for clear speech in quiet environment

---

## 🌐 Browser Support

**Required:**
- Chrome 77+
- Edge 79+
- Safari 14.1+
- Firefox (with flag enabled)

**Fallback:**
- Show "Voice commands not supported" message
- Offer keyboard shortcuts as alternative

---

## 🧪 Testing Strategy

1. **Unit Tests**: Each service independently
2. **Integration Tests**: Command flow end-to-end
3. **Manual Testing**: Real voice input in different environments
4. **Accuracy Testing**: Measure recognition accuracy
5. **Performance Testing**: Measure latency and response times

---

## 🚀 Future Enhancements (Post-Sprint 1)

- Multi-language support (Arabic, Spanish, etc.)
- Custom wake word ("Hey Studio")
- Voice macros (chain multiple commands)
- Voice shortcuts (custom command aliases)
- Offline mode (local speech recognition)
- Voice training (improve accuracy for user's voice)

---

**Created:** January 28, 2026  
**Phase:** 6 - Voice Commands  
**Sprint:** 1 - Foundation  
**Status:** 🏗️ In Progress
