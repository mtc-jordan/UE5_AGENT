# Blueprint/Material Assistant Enhancement Research

## Unity AI Features (Key Insights)

### Contextual Awareness
- Get tailored help by referencing assets in the Editor
- Drag-and-drop assets to provide context to AI

### Key Features
1. **Assistant** - Contextual helper that can:
   - Answer questions about your project
   - Generate pre-compiled code
   - Execute agentic actions (batch renaming, creating NPC variants, placing objects)
   - Resolve console errors
   - Guide through implementing new features

2. **Generators** - Asset generation:
   - Animate
   - Sprite
   - Texture
   - Sound (new)
   - Post-processing effects (envelope editing, background removal, pixelation, upscaling, recolor)

3. **Inference Engine** - Local AI model inference for runtime experiences

### Workflow Automation
- Locate, modify, and organize assets in bulk
- Automate repetitive tasks (finding lights over set intensity, objects missing components)
- Update names, layers, or components all at once
- Debug console errors with AI explanations
- Plain language commands to generate objects and automate scene setup


## AI Shader Generation Research (Medium Article - Jan 2025)

### Key Insights from "Generative AI for Node-Based Shaders"

The research explores using AI to generate node-based shaders from natural language descriptions. The system works by:
1. Taking natural language descriptions of desired effects
2. Processing through LLMs (GPT-4o, Gemini 1.5 Pro)
3. Generating appropriate shader code
4. Converting code into Unity-compatible node graphs

### Main Challenge: Constraining AI to Node-Based Functions
- AI must think exclusively in predefined nodes
- Even basic operations need specific function calls (e.g., `Add(arg1, arg2, result)`)
- Prompt engineering proved more effective than fine-tuning

### Results by Prompt Type
| Prompt Type | Score | Notes |
|-------------|-------|-------|
| Task-Based ("rotating gradient") | 9.6/10 | Nearly perfect results |
| Creative ("aurora borealis effect") | 5.2/10 | Good starting points |
| Particle Systems | High | Complex behaviors possible |

### Key Features to Implement
1. **Iteration/Refinement** - Allow users to refine generated results
2. **RAG (Retrieval-Augmented Generation)** - Use knowledge base of examples
3. **Node Position Management** - Auto-layout generated nodes
4. **Code-to-Node Parsing** - Convert generated code to visual graphs

## Scenario AI Texture Generation Features

### Key Capabilities
1. **Text-to-Texture** - Generate seamless PBR textures from prompts
2. **Image Reference** - Guide colors, patterns with reference images
3. **Complete PBR Generation** - Albedo, height, normal, metallic, AO maps
4. **Upscaling** - Up to 8K resolution
5. **3D Preview** - Real-time preview on sphere, plane, cube, cylinder
6. **Specialized Models** - Wood, stone, terracotta, etc.
7. **Custom Model Training** - Train your own texture model

### Workflow Steps
1. Start from text or images
2. Configure settings (variations, sampling, guidance)
3. Generate & preview on 3D object
4. Produce PBR maps & upscale
5. Export & integrate (Unity integration available)

