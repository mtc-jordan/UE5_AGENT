"""
UE5 AI Studio - Workspace Models
================================

Database models for the persistent file workspace system.
Supports hierarchical file/folder structure with versioning.

Version: 2.0.0
"""

from sqlalchemy import (
    Column, Integer, String, Text, Boolean, DateTime, 
    ForeignKey, Enum as SQLEnum, Index, UniqueConstraint
)
from sqlalchemy.orm import relationship
from datetime import datetime
import enum

from core.database import Base


class FileType(enum.Enum):
    """Type of workspace item."""
    FILE = "file"
    FOLDER = "folder"


class FileStatus(enum.Enum):
    """Status of a file."""
    ACTIVE = "active"
    DELETED = "deleted"
    ARCHIVED = "archived"


class WorkspaceFile(Base):
    """
    Represents a file or folder in the workspace.
    
    Supports:
    - Hierarchical folder structure
    - File versioning
    - Soft delete
    - File metadata
    """
    __tablename__ = "workspace_files"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Ownership
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=True, index=True)
    
    # File/Folder info
    name = Column(String(255), nullable=False)
    path = Column(String(1024), nullable=False)  # Full path like /src/components/Button.tsx
    file_type = Column(SQLEnum(FileType), default=FileType.FILE, nullable=False)
    
    # Parent folder (null for root items)
    parent_id = Column(Integer, ForeignKey("workspace_files.id"), nullable=True, index=True)
    
    # File content (null for folders)
    content = Column(Text, nullable=True)
    
    # Metadata
    mime_type = Column(String(128), nullable=True)  # e.g., text/plain, application/json
    size = Column(Integer, default=0)  # Size in bytes
    language = Column(String(64), nullable=True)  # Programming language for syntax highlighting
    
    # Status
    status = Column(SQLEnum(FileStatus), default=FileStatus.ACTIVE, nullable=False)
    is_readonly = Column(Boolean, default=False)
    is_generated = Column(Boolean, default=False)  # True if AI-generated
    
    # Versioning
    version = Column(Integer, default=1)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = relationship("User", back_populates="workspace_files")
    project = relationship("Project", back_populates="workspace_files")
    parent = relationship("WorkspaceFile", remote_side=[id], back_populates="children")
    children = relationship("WorkspaceFile", back_populates="parent", cascade="all, delete-orphan")
    versions = relationship("FileVersion", back_populates="file", cascade="all, delete-orphan")
    
    # Indexes for common queries
    __table_args__ = (
        Index("idx_workspace_user_path", "user_id", "path"),
        Index("idx_workspace_project_path", "project_id", "path"),
        Index("idx_workspace_parent", "parent_id"),
        UniqueConstraint("user_id", "project_id", "path", name="uq_user_project_path"),
    )
    
    def __repr__(self):
        return f"<WorkspaceFile(id={self.id}, name='{self.name}', type={self.file_type.value})>"
    
    @property
    def is_folder(self) -> bool:
        """Check if this is a folder."""
        return self.file_type == FileType.FOLDER
    
    @property
    def extension(self) -> str:
        """Get file extension."""
        if self.is_folder:
            return ""
        parts = self.name.rsplit(".", 1)
        return parts[1] if len(parts) > 1 else ""
    
    def get_full_path(self) -> str:
        """Get the full path including all parent folders."""
        return self.path


class FileVersion(Base):
    """
    Stores previous versions of files for history/undo.
    
    Keeps track of:
    - Content snapshots
    - Who made the change
    - When the change was made
    """
    __tablename__ = "file_versions"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # File reference
    file_id = Column(Integer, ForeignKey("workspace_files.id"), nullable=False, index=True)
    
    # Version info
    version_number = Column(Integer, nullable=False)
    content = Column(Text, nullable=True)
    size = Column(Integer, default=0)
    
    # Change metadata
    change_type = Column(String(32), nullable=True)  # create, update, rename, etc.
    change_description = Column(String(512), nullable=True)
    changed_by = Column(String(64), nullable=True)  # user or "ai"
    
    # Timestamp
    created_at = Column(DateTime, default=datetime.utcnow)
    
    # Relationships
    file = relationship("WorkspaceFile", back_populates="versions")
    
    __table_args__ = (
        Index("idx_file_version", "file_id", "version_number"),
        UniqueConstraint("file_id", "version_number", name="uq_file_version"),
    )
    
    def __repr__(self):
        return f"<FileVersion(file_id={self.file_id}, version={self.version_number})>"


class WorkspaceTemplate(Base):
    """
    Pre-defined file/folder templates for quick project setup.
    
    Templates can include:
    - UE5 C++ class templates
    - Blueprint structure templates
    - Common project layouts
    """
    __tablename__ = "workspace_templates"
    
    id = Column(Integer, primary_key=True, index=True)
    
    # Template info
    name = Column(String(128), nullable=False, unique=True)
    description = Column(Text, nullable=True)
    category = Column(String(64), nullable=True)  # ue5, web, general
    
    # Template structure (JSON)
    structure = Column(Text, nullable=False)  # JSON defining files/folders
    
    # Metadata
    is_system = Column(Boolean, default=False)  # System templates can't be deleted
    usage_count = Column(Integer, default=0)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    def __repr__(self):
        return f"<WorkspaceTemplate(name='{self.name}', category='{self.category}')>"


# Language detection mapping
EXTENSION_LANGUAGE_MAP = {
    # C/C++
    ".cpp": "cpp",
    ".h": "cpp",
    ".hpp": "cpp",
    ".c": "c",
    ".cc": "cpp",
    
    # Web
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "typescript",
    ".html": "html",
    ".css": "css",
    ".scss": "scss",
    ".json": "json",
    
    # Python
    ".py": "python",
    ".pyi": "python",
    
    # UE5 specific
    ".uasset": "binary",
    ".umap": "binary",
    ".uplugin": "json",
    ".uproject": "json",
    ".Build.cs": "csharp",
    
    # Config
    ".ini": "ini",
    ".yaml": "yaml",
    ".yml": "yaml",
    ".toml": "toml",
    ".xml": "xml",
    
    # Documentation
    ".md": "markdown",
    ".txt": "plaintext",
    ".rst": "restructuredtext",
    
    # Shell
    ".sh": "bash",
    ".bat": "batch",
    ".ps1": "powershell",
}


def detect_language(filename: str) -> str:
    """Detect programming language from filename."""
    # Check for special filenames
    if filename.endswith(".Build.cs"):
        return "csharp"
    
    # Check extension
    for ext, lang in EXTENSION_LANGUAGE_MAP.items():
        if filename.endswith(ext):
            return lang
    
    return "plaintext"


def detect_mime_type(filename: str) -> str:
    """Detect MIME type from filename."""
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    
    mime_types = {
        # Text
        "txt": "text/plain",
        "md": "text/markdown",
        "json": "application/json",
        "xml": "application/xml",
        "yaml": "text/yaml",
        "yml": "text/yaml",
        
        # Code
        "py": "text/x-python",
        "js": "text/javascript",
        "ts": "text/typescript",
        "jsx": "text/javascript",
        "tsx": "text/typescript",
        "cpp": "text/x-c++src",
        "h": "text/x-c++hdr",
        "hpp": "text/x-c++hdr",
        "c": "text/x-csrc",
        "cs": "text/x-csharp",
        
        # Web
        "html": "text/html",
        "css": "text/css",
        "scss": "text/x-scss",
        
        # Config
        "ini": "text/plain",
        "toml": "text/plain",
        
        # UE5
        "uasset": "application/octet-stream",
        "umap": "application/octet-stream",
        "uplugin": "application/json",
        "uproject": "application/json",
    }
    
    return mime_types.get(ext, "text/plain")
