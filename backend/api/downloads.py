"""
Downloads API endpoints for UE5 AI Studio Agent and MCP Bridge plugin.
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from pathlib import Path
import os

router = APIRouter(prefix="/downloads", tags=["downloads"])

# Downloads directory
DOWNLOADS_DIR = Path(__file__).parent.parent.parent / "downloads"

# Available downloads with metadata
DOWNLOADS = {
    "UE5-AI-Studio-Agent-1.2.0.zip": {
        "name": "UE5 AI Studio Agent",
        "version": "1.2.0",
        "description": "Desktop application that bridges the web platform to your local Unreal Engine 5 editor. Now with improved screenshot capture support.",
        "size": "59 KB",
        "category": "agent",
        "platform": ["Windows", "macOS", "Linux"],
        "changelog": [
            "Fixed blank screenshot issue - agent now reads screenshots locally",
            "Improved viewport preview integration",
            "Better error handling for screenshot capture"
        ]
    },
    "UE5MCPBridge-v3.3.1-complete.zip": {
        "name": "UE5 MCP Bridge Plugin",
        "version": "3.3.1",
        "description": "Unreal Engine 5 plugin that exposes 101 editor tools via MCP protocol. Supports UE5.1 through UE5.7.",
        "size": "40 KB",
        "category": "plugin",
        "platform": ["Windows", "macOS", "Linux"],
        "ue_versions": ["5.1", "5.2", "5.3", "5.4", "5.5", "5.6", "5.7"],
    },
}


@router.get("")
async def list_downloads():
    """List all available downloads with metadata."""
    downloads_list = []
    for filename, metadata in DOWNLOADS.items():
        file_path = DOWNLOADS_DIR / filename
        exists = file_path.exists()
        downloads_list.append({
            "filename": filename,
            "available": exists,
            "download_url": f"/api/downloads/{filename}" if exists else None,
            **metadata,
        })
    return {"downloads": downloads_list}


@router.get("/{filename}")
async def download_file(filename: str):
    """Download a specific file."""
    if filename not in DOWNLOADS:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = DOWNLOADS_DIR / filename
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not available for download")
    
    return FileResponse(
        path=str(file_path),
        filename=filename,
        media_type="application/zip",
        headers={
            "Content-Disposition": f"attachment; filename={filename}"
        }
    )


@router.get("/info/{filename}")
async def get_download_info(filename: str):
    """Get metadata for a specific download."""
    if filename not in DOWNLOADS:
        raise HTTPException(status_code=404, detail="File not found")
    
    file_path = DOWNLOADS_DIR / filename
    metadata = DOWNLOADS[filename].copy()
    metadata["filename"] = filename
    metadata["available"] = file_path.exists()
    
    if file_path.exists():
        metadata["actual_size"] = os.path.getsize(file_path)
        metadata["download_url"] = f"/api/downloads/{filename}"
    
    return metadata


@router.get("/check/agent")
async def check_agent_available():
    """Check if the Desktop Agent is available for download."""
    filename = "UE5-AI-Studio-Agent-1.2.0.zip"
    file_path = DOWNLOADS_DIR / filename
    return {
        "available": file_path.exists(),
        "filename": filename,
        "version": "1.2.0",
    }


@router.get("/check/plugin")
async def check_plugin_available():
    """Check if the MCP Bridge Plugin is available for download."""
    filename = "UE5MCPBridge-v3.3.1-complete.zip"
    file_path = DOWNLOADS_DIR / filename
    return {
        "available": file_path.exists(),
        "filename": filename,
        "version": "3.3.1",
    }
