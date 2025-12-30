# Model API Research - December 2025

## DeepSeek API Models
- **deepseek-chat**: DeepSeek-V3.2 (Non-thinking Mode) - CORRECT
- **deepseek-reasoner**: DeepSeek-V3.2 (Thinking Mode) - CORRECT
- Base URL: https://api.deepseek.com
- Both models support: JSON Output, Tool Calls, Chat Prefix Completion

## Google Gemini API Models (OpenAI Compatible)
Based on official documentation (https://ai.google.dev/gemini-api/docs/models):

| Frontend ID | API Model Name | Status |
|-------------|----------------|--------|
| gemini-3-pro | gemini-3-pro-preview | Preview |
| gemini-3-flash | gemini-3-flash-preview | Preview |
| gemini-2.5-pro | gemini-2.5-pro | Stable |
| gemini-2.5-flash | gemini-2.5-flash | Stable |
| gemini-2.0-flash | gemini-2.0-flash | Stable |

Base URL: https://generativelanguage.googleapis.com/v1beta/openai/
Example from docs: model="gemini-2.5-flash"

## Anthropic Claude API Models (Claude 4.5 - Latest)
Based on official documentation (https://platform.claude.com/docs/en/about-claude/models/overview):

| Frontend ID | API Model Name (Full) | Description |
|-------------|----------------------|-------------|
| claude-4-sonnet | claude-sonnet-4-5-20250929 | Smart model for complex agents and coding |
| claude-4-haiku | claude-haiku-4-5-20251001 | Fastest model with near-frontier intelligence |
| claude-4-opus | claude-opus-4-5-20251101 | Premium model with maximum intelligence |
| claude-3-5-sonnet | claude-3-5-sonnet-20241022 | Legacy |
| claude-3-opus | claude-3-opus-20240229 | Legacy |
| claude-3-haiku | claude-3-haiku-20240307 | Legacy |

**Note**: Using full model IDs with dates (e.g., `claude-opus-4-5-20251101`) ensures stability as aliases may change.

**IMPORTANT**: Anthropic API is NOT OpenAI-compatible for tool calling!
- Need to use Anthropic's native API or a compatibility layer
- Current backend falls back to OpenAI when Anthropic is selected

## Summary of Backend Model Mappings:

### DeepSeek - CORRECT
- deepseek-chat → deepseek-chat ✓
- deepseek-reasoner → deepseek-reasoner ✓

### Google Gemini - CORRECT
- gemini-3-pro → gemini-3-pro-preview ✓
- gemini-3-flash → gemini-3-flash-preview ✓
- gemini-2.5-pro → gemini-2.5-pro ✓
- gemini-2.5-flash → gemini-2.5-flash ✓
- gemini-2.0-flash → gemini-2.0-flash ✓

### Anthropic Claude - CORRECT (using full IDs)
- claude-4-sonnet → claude-sonnet-4-5-20250929 ✓
- claude-4-opus → claude-opus-4-5-20251101 ✓
- claude-4-haiku → claude-haiku-4-5-20251001 ✓
- claude-3-5-sonnet → claude-3-5-sonnet-20241022 ✓
- claude-3-opus → claude-3-opus-20240229 ✓
- claude-3-haiku → claude-3-haiku-20240307 ✓

### OpenAI
- gpt-5 → gpt-4o (GPT-5 not available)
- gpt-4o → gpt-4o ✓
- gpt-4o-mini → gpt-4o-mini ✓
- gpt-4.1-mini → gpt-4.1-mini ✓
- gpt-4.1-nano → gpt-4.1-nano ✓
