# AI Chat Integration Research - Function Calling Best Practices

## Source: OpenAI Function Calling Documentation (2024-2025)

### Key Concepts

1. **Tools** - Functionality we give the model
2. **Tool calls** - Requests from the model to use tools
3. **Tool call outputs** - Output we generate for the model

### The Tool Calling Flow (5 Steps)

1. Make a request to the model with tools it could call
2. Receive a tool call from the model
3. Execute code on the application side with input from the tool call
4. Make a second request to the model with the tool output
5. Receive a final response from the model (or more tool calls)

### Function Definition Schema

```json
{
    "type": "function",
    "name": "get_weather",
    "description": "Retrieves current weather for the given location.",
    "parameters": {
        "type": "object",
        "properties": {
            "location": {
                "type": "string",
                "description": "City and country e.g. Bogotá, Colombia"
            },
            "units": {
                "type": "string",
                "enum": ["celsius", "fahrenheit"],
                "description": "Units the temperature will be returned in."
            }
        },
        "required": ["location", "units"],
        "additionalProperties": false
    },
    "strict": true
}
```

### Best Practices for Defining Functions

1. **Write clear and detailed function names, parameter descriptions, and instructions**
   - Explicitly describe the purpose of the function and each parameter
   - Use the system prompt to describe when (and when not) to use each function
   - Include examples and edge cases

2. **Apply software engineering best practices**
   - Make functions obvious and intuitive (principle of least surprise)
   - Use enums and object structure to make invalid states unrepresentable
   - Pass the "intern test" - can someone correctly use the function given only what you gave the model?

3. **Offload the burden from the model and use code where possible**
   - Don't make the model fill arguments you already know
   - Combine functions that are always called in sequence
   - Reduce the number of functions to only what's needed

### Strict Mode

- When `strict: true`, the model will always follow the exact schema
- Guarantees valid JSON output matching the schema
- Recommended for production use

### Parallel Function Calls

- Models can request multiple function calls in a single response
- Can be disabled with `parallel_tool_calls: false`

## Application to UE5 MCP Integration

### Tool Definition Strategy

For the 101 MCP tools, we should:
1. Group tools by category (Actor, Selection, Viewport, etc.)
2. Create clear descriptions for each tool
3. Define strict parameter schemas
4. Use enums where applicable (e.g., axis types, modes)

### System Prompt Strategy

```
You are an AI assistant that helps users control Unreal Engine 5 through natural language.
You have access to 101 MCP tools organized in categories:
- Actor tools: spawn, delete, move, rotate actors
- Selection tools: select, deselect actors
- Viewport tools: camera control, screenshots
- PIE tools: play/stop game
- Level tools: save, load levels
- Blueprint tools: execute blueprint functions
...

When the user asks to perform an action in UE5:
1. Identify the appropriate tool(s) to use
2. Extract parameters from the user's request
3. Call the tool with the correct parameters
4. Report the result to the user

Examples:
- "Create a cube at 0,0,100" → spawn_actor(class_name="StaticMeshActor", location_x=0, location_y=0, location_z=100)
- "Start the game" → start_pie()
- "Take a screenshot" → take_screenshot(filename="screenshot.png")
```



## Source: Anthropic - Building Effective Agents (Dec 2024)

### Key Insight
> "The most successful implementations use simple, composable patterns rather than complex frameworks."

### Workflows vs Agents

- **Workflows**: Systems where LLMs and tools are orchestrated through predefined code paths
- **Agents**: Systems where LLMs dynamically direct their own processes and tool usage

### When to Use Agents

- Start with the simplest solution possible
- Agentic systems trade latency and cost for better task performance
- For many applications, optimizing single LLM calls with retrieval and in-context examples is enough

### Agent Patterns

#### 1. Augmented LLM (Building Block)
- LLM enhanced with retrieval, tools, and memory
- Use Model Context Protocol (MCP) for tool integration

#### 2. Prompt Chaining
- Decompose task into sequence of steps
- Each LLM call processes output of previous one
- Add programmatic checks on intermediate steps

#### 3. Routing
- Classify input and direct to specialized followup task
- Separation of concerns, specialized prompts
- Route easy questions to smaller models, hard to capable models

#### 4. Parallelization
- **Sectioning**: Break task into independent subtasks run in parallel
- **Voting**: Run same task multiple times for diverse outputs

#### 5. Orchestrator-Workers
- Central LLM dynamically breaks down tasks
- Delegates to worker LLMs
- Synthesizes results

#### 6. Evaluator-Optimizer
- One LLM generates response
- Another provides evaluation and feedback
- Loop until quality threshold met

### Agentic Loop Pattern

```
while True:
    1. Call LLM with tools
    2. If tool_call in response:
        - Execute tool
        - Add result to context
        - Continue loop
    3. If final_response:
        - Return to user
        - Break loop
```

### Best Practices for Tool Use

1. **Keep tool set focused** - Only include tools relevant to current task
2. **Clear tool descriptions** - Explicit about what each tool does
3. **Handle errors gracefully** - Return informative error messages
4. **Provide examples** - Show expected input/output formats
5. **Ground truth at each step** - Get actual results from environment

