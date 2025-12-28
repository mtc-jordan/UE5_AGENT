# Viewport Preview Feature

## Overview

The Viewport Preview feature provides real-time visual feedback from your UE5 editor directly in the AI chat interface. It enables automatic screenshot capture before and after tool execution, creating visual comparisons that help you understand exactly what changes the AI made to your scene.

## Features

### 1. Auto-Capture Mode
When enabled, the system automatically captures viewport screenshots:
- **Before** any tool execution that modifies the scene
- **After** the tool completes
- Creates before/after pairs for visual comparison

### 2. Manual Capture
Click the camera button to manually capture the current viewport state at any time.

### 3. Screenshot Gallery
- View all captured screenshots in a thumbnail gallery
- Click any thumbnail to view full-size
- Navigate between screenshots with arrow keys or buttons
- Screenshots are sorted by timestamp (newest first)

### 4. Before/After Comparison
- Interactive slider to compare before and after states
- Visual diff shows exactly what changed
- Tool name and parameters displayed for context
- Swipe or drag to reveal changes

### 5. Full-Size Image Modal
- Click any screenshot to view at full resolution
- Zoom controls for detailed inspection
- Download option to save screenshots locally
- Keyboard navigation (arrow keys, Escape to close)

## Architecture

### Backend Components

#### ViewportPreviewService (`backend/services/viewport_preview.py`)
- Manages screenshot capture via MCP `take_screenshot` tool
- Stores screenshots with metadata (timestamp, context, tool info)
- Creates and manages before/after pairs
- Handles base64 encoding for web transfer

#### Viewport API (`backend/api/viewport.py`)
- `POST /api/viewport/capture` - Manual screenshot capture
- `GET /api/viewport/screenshots` - List recent screenshots
- `GET /api/viewport/screenshot/{id}` - Get specific screenshot
- `GET /api/viewport/pairs` - List before/after pairs
- `DELETE /api/viewport/screenshot/{id}` - Delete screenshot

### Frontend Components

#### ViewportPreview (`frontend/src/components/ViewportPreview.tsx`)
- Main component with tabs for Gallery and Comparisons
- Thumbnail grid with click-to-expand
- Auto-capture toggle switch
- Manual capture button

#### ImageModal
- Full-screen image viewer
- Navigation controls
- Zoom functionality
- Download option

#### BeforeAfterSlider
- Interactive comparison slider
- Draggable divider
- Labels for before/after states

## Usage

### In AI Chat Interface

1. Navigate to **UE5 Connection** → **AI Commands** tab
2. Ensure your agent is connected to UE5
3. Toggle **Auto-Capture** on (enabled by default)
4. Enter a command like "Create a cube at position 0, 0, 100"
5. The system will:
   - Capture the viewport before execution
   - Execute the tool
   - Capture the viewport after execution
   - Display the comparison in the chat

### Viewing Comparisons

1. Scroll down to the **Viewport Preview** section
2. Click the **Comparisons** tab
3. Click any comparison to open the before/after slider
4. Drag the slider to compare states

### Manual Screenshots

1. Click the camera icon in the Viewport Preview header
2. The screenshot will appear in the Gallery tab
3. Click to view full-size

## API Reference

### Capture Screenshot
```http
POST /api/viewport/capture
Content-Type: application/json
Authorization: Bearer <token>

{
  "context": "Manual capture",
  "resolution_x": 1920,
  "resolution_y": 1080
}
```

### List Screenshots
```http
GET /api/viewport/screenshots?limit=20&offset=0
Authorization: Bearer <token>
```

### Get Before/After Pairs
```http
GET /api/viewport/pairs?limit=10
Authorization: Bearer <token>
```

## Configuration

### Screenshot Storage
Screenshots are stored in the `screenshots/` directory by default. Configure the path in your environment:

```env
SCREENSHOT_DIR=/path/to/screenshots
```

### Resolution Settings
Default capture resolution is 1280x720. Modify in the capture request:

```json
{
  "resolution_x": 1920,
  "resolution_y": 1080
}
```

## Troubleshooting

### Screenshots Not Appearing
1. Verify the agent is connected to UE5
2. Check that MCP bridge is running in UE5
3. Ensure the `take_screenshot` tool is available

### Low Quality Images
- Increase resolution in capture settings
- Check UE5 viewport resolution settings

### Auto-Capture Not Working
- Verify auto-capture is enabled (toggle switch)
- Check that the tool being executed modifies the scene
- Review browser console for errors

## Future Enhancements

- [ ] Video recording of tool execution
- [ ] Animated GIF generation for comparisons
- [ ] Screenshot annotations
- [ ] Cloud storage integration
- [ ] Comparison history timeline
