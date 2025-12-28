"""
UE5 AI Studio - Workspace Service
==================================

Service layer for file workspace operations including:
- File/folder CRUD operations
- Version management
- Path normalization
- Template application

Version: 2.0.0
"""

import os
import re
import json
import logging
from typing import Optional, List, Dict, Any, Tuple
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, delete
from sqlalchemy.orm import selectinload

from models.workspace import (
    WorkspaceFile, 
    FileVersion, 
    WorkspaceTemplate,
    FileType,
    FileStatus,
    detect_language,
    detect_mime_type
)

logger = logging.getLogger(__name__)


class WorkspaceService:
    """
    Service for managing workspace files and folders.
    
    Provides:
    - CRUD operations for files and folders
    - Path-based navigation
    - Version history management
    - Template application
    """
    
    # Maximum file size (10MB)
    MAX_FILE_SIZE = 10 * 1024 * 1024
    
    # Maximum versions to keep per file
    MAX_VERSIONS = 50
    
    # Reserved filenames
    RESERVED_NAMES = {'.', '..', 'CON', 'PRN', 'AUX', 'NUL'}
    
    def __init__(self, db: AsyncSession):
        """Initialize workspace service with database session."""
        self.db = db
    
    # =========================================================================
    # PATH UTILITIES
    # =========================================================================
    
    @staticmethod
    def normalize_path(path: str) -> str:
        """
        Normalize a file path.
        
        - Ensures leading slash
        - Removes trailing slash (except for root)
        - Removes duplicate slashes
        - Handles . and .. components
        """
        if not path:
            return "/"
        
        # Ensure leading slash
        if not path.startswith("/"):
            path = "/" + path
        
        # Split and process components
        parts = path.split("/")
        normalized = []
        
        for part in parts:
            if part == "" or part == ".":
                continue
            elif part == "..":
                if normalized:
                    normalized.pop()
            else:
                normalized.append(part)
        
        result = "/" + "/".join(normalized)
        return result if result != "/" else "/"
    
    @staticmethod
    def get_parent_path(path: str) -> str:
        """Get the parent directory path."""
        normalized = WorkspaceService.normalize_path(path)
        if normalized == "/":
            return "/"
        
        parts = normalized.rsplit("/", 1)
        return parts[0] if parts[0] else "/"
    
    @staticmethod
    def get_filename(path: str) -> str:
        """Get the filename from a path."""
        normalized = WorkspaceService.normalize_path(path)
        return normalized.rsplit("/", 1)[-1]
    
    @staticmethod
    def join_path(base: str, name: str) -> str:
        """Join a base path with a filename."""
        base = WorkspaceService.normalize_path(base)
        if base == "/":
            return f"/{name}"
        return f"{base}/{name}"
    
    @staticmethod
    def validate_filename(name: str) -> Tuple[bool, str]:
        """
        Validate a filename.
        
        Returns:
            Tuple of (is_valid, error_message)
        """
        if not name:
            return False, "Filename cannot be empty"
        
        if name in WorkspaceService.RESERVED_NAMES:
            return False, f"'{name}' is a reserved name"
        
        if len(name) > 255:
            return False, "Filename too long (max 255 characters)"
        
        # Check for invalid characters
        invalid_chars = r'[<>:"/\\|?*\x00-\x1f]'
        if re.search(invalid_chars, name):
            return False, "Filename contains invalid characters"
        
        return True, ""
    
    # =========================================================================
    # FILE OPERATIONS
    # =========================================================================
    
    async def get_file(
        self,
        user_id: int,
        file_id: int,
        project_id: Optional[int] = None
    ) -> Optional[WorkspaceFile]:
        """
        Get a file by ID.
        
        Args:
            user_id: Owner user ID
            file_id: File ID
            project_id: Optional project filter
            
        Returns:
            WorkspaceFile or None
        """
        query = select(WorkspaceFile).where(
            WorkspaceFile.id == file_id,
            WorkspaceFile.user_id == user_id,
            WorkspaceFile.status == FileStatus.ACTIVE
        )
        
        if project_id is not None:
            query = query.where(WorkspaceFile.project_id == project_id)
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def get_file_by_path(
        self,
        user_id: int,
        path: str,
        project_id: Optional[int] = None
    ) -> Optional[WorkspaceFile]:
        """
        Get a file by its path.
        
        Args:
            user_id: Owner user ID
            path: File path
            project_id: Optional project filter
            
        Returns:
            WorkspaceFile or None
        """
        normalized_path = self.normalize_path(path)
        
        query = select(WorkspaceFile).where(
            WorkspaceFile.user_id == user_id,
            WorkspaceFile.path == normalized_path,
            WorkspaceFile.status == FileStatus.ACTIVE
        )
        
        if project_id is not None:
            query = query.where(WorkspaceFile.project_id == project_id)
        
        result = await self.db.execute(query)
        return result.scalar_one_or_none()
    
    async def list_files(
        self,
        user_id: int,
        parent_path: str = "/",
        project_id: Optional[int] = None,
        include_children: bool = False,
        file_type: Optional[FileType] = None
    ) -> List[WorkspaceFile]:
        """
        List files in a directory.
        
        Args:
            user_id: Owner user ID
            parent_path: Parent directory path
            project_id: Optional project filter
            include_children: If True, include all descendants
            file_type: Optional filter by file type
            
        Returns:
            List of WorkspaceFile objects
        """
        normalized_path = self.normalize_path(parent_path)
        
        if include_children:
            # Get all files under this path
            if normalized_path == "/":
                path_filter = WorkspaceFile.path.like("/%")
            else:
                path_filter = WorkspaceFile.path.like(f"{normalized_path}/%")
            
            query = select(WorkspaceFile).where(
                WorkspaceFile.user_id == user_id,
                path_filter,
                WorkspaceFile.status == FileStatus.ACTIVE
            )
        else:
            # Get parent folder first
            if normalized_path == "/":
                parent_id = None
            else:
                parent = await self.get_file_by_path(user_id, normalized_path, project_id)
                if not parent:
                    return []
                parent_id = parent.id
            
            query = select(WorkspaceFile).where(
                WorkspaceFile.user_id == user_id,
                WorkspaceFile.parent_id == parent_id,
                WorkspaceFile.status == FileStatus.ACTIVE
            )
        
        if project_id is not None:
            query = query.where(WorkspaceFile.project_id == project_id)
        
        if file_type is not None:
            query = query.where(WorkspaceFile.file_type == file_type)
        
        # Order: folders first, then by name
        query = query.order_by(
            WorkspaceFile.file_type.desc(),  # FOLDER > FILE
            WorkspaceFile.name
        )
        
        result = await self.db.execute(query)
        return list(result.scalars().all())
    
    async def create_file(
        self,
        user_id: int,
        path: str,
        content: str = "",
        project_id: Optional[int] = None,
        is_generated: bool = False
    ) -> WorkspaceFile:
        """
        Create a new file.
        
        Args:
            user_id: Owner user ID
            path: File path
            content: File content
            project_id: Optional project ID
            is_generated: Whether file was AI-generated
            
        Returns:
            Created WorkspaceFile
            
        Raises:
            ValueError: If path is invalid or file exists
        """
        normalized_path = self.normalize_path(path)
        filename = self.get_filename(normalized_path)
        
        # Validate filename
        is_valid, error = self.validate_filename(filename)
        if not is_valid:
            raise ValueError(error)
        
        # Check if file already exists
        existing = await self.get_file_by_path(user_id, normalized_path, project_id)
        if existing:
            raise ValueError(f"File already exists: {normalized_path}")
        
        # Ensure parent folder exists
        parent_path = self.get_parent_path(normalized_path)
        parent_id = None
        
        if parent_path != "/":
            parent = await self.get_file_by_path(user_id, parent_path, project_id)
            if not parent:
                # Create parent folders recursively
                parent = await self.create_folder(user_id, parent_path, project_id)
            parent_id = parent.id
        
        # Detect language and mime type
        language = detect_language(filename)
        mime_type = detect_mime_type(filename)
        
        # Create file
        file = WorkspaceFile(
            user_id=user_id,
            project_id=project_id,
            name=filename,
            path=normalized_path,
            file_type=FileType.FILE,
            parent_id=parent_id,
            content=content,
            mime_type=mime_type,
            size=len(content.encode('utf-8')),
            language=language,
            is_generated=is_generated,
            version=1
        )
        
        self.db.add(file)
        await self.db.commit()
        await self.db.refresh(file)
        
        # Create initial version
        await self._create_version(file, "create", "File created")
        
        logger.info(f"Created file: {normalized_path}")
        return file
    
    async def create_folder(
        self,
        user_id: int,
        path: str,
        project_id: Optional[int] = None
    ) -> WorkspaceFile:
        """
        Create a new folder.
        
        Args:
            user_id: Owner user ID
            path: Folder path
            project_id: Optional project ID
            
        Returns:
            Created WorkspaceFile (folder)
            
        Raises:
            ValueError: If path is invalid or folder exists
        """
        normalized_path = self.normalize_path(path)
        
        if normalized_path == "/":
            raise ValueError("Cannot create root folder")
        
        folder_name = self.get_filename(normalized_path)
        
        # Validate folder name
        is_valid, error = self.validate_filename(folder_name)
        if not is_valid:
            raise ValueError(error)
        
        # Check if folder already exists
        existing = await self.get_file_by_path(user_id, normalized_path, project_id)
        if existing:
            if existing.file_type == FileType.FOLDER:
                return existing  # Return existing folder
            raise ValueError(f"A file with this name already exists: {normalized_path}")
        
        # Ensure parent folder exists
        parent_path = self.get_parent_path(normalized_path)
        parent_id = None
        
        if parent_path != "/":
            parent = await self.get_file_by_path(user_id, parent_path, project_id)
            if not parent:
                # Create parent folders recursively
                parent = await self.create_folder(user_id, parent_path, project_id)
            parent_id = parent.id
        
        # Create folder
        folder = WorkspaceFile(
            user_id=user_id,
            project_id=project_id,
            name=folder_name,
            path=normalized_path,
            file_type=FileType.FOLDER,
            parent_id=parent_id,
            mime_type="inode/directory",
            version=1
        )
        
        self.db.add(folder)
        await self.db.commit()
        await self.db.refresh(folder)
        
        logger.info(f"Created folder: {normalized_path}")
        return folder
    
    async def update_file(
        self,
        user_id: int,
        file_id: int,
        content: str,
        project_id: Optional[int] = None,
        changed_by: str = "user"
    ) -> WorkspaceFile:
        """
        Update file content.
        
        Args:
            user_id: Owner user ID
            file_id: File ID
            content: New content
            project_id: Optional project filter
            changed_by: Who made the change (user/ai)
            
        Returns:
            Updated WorkspaceFile
            
        Raises:
            ValueError: If file not found or is readonly
        """
        file = await self.get_file(user_id, file_id, project_id)
        
        if not file:
            raise ValueError("File not found")
        
        if file.file_type == FileType.FOLDER:
            raise ValueError("Cannot update folder content")
        
        if file.is_readonly:
            raise ValueError("File is read-only")
        
        # Check size limit
        if len(content.encode('utf-8')) > self.MAX_FILE_SIZE:
            raise ValueError(f"File too large (max {self.MAX_FILE_SIZE // 1024 // 1024}MB)")
        
        # Create version before update
        await self._create_version(file, "update", f"Updated by {changed_by}")
        
        # Update file
        file.content = content
        file.size = len(content.encode('utf-8'))
        file.version += 1
        file.updated_at = datetime.utcnow()
        
        await self.db.commit()
        await self.db.refresh(file)
        
        logger.info(f"Updated file: {file.path} (v{file.version})")
        return file
    
    async def rename_file(
        self,
        user_id: int,
        file_id: int,
        new_name: str,
        project_id: Optional[int] = None
    ) -> WorkspaceFile:
        """
        Rename a file or folder.
        
        Args:
            user_id: Owner user ID
            file_id: File ID
            new_name: New filename
            project_id: Optional project filter
            
        Returns:
            Renamed WorkspaceFile
            
        Raises:
            ValueError: If file not found or name invalid
        """
        file = await self.get_file(user_id, file_id, project_id)
        
        if not file:
            raise ValueError("File not found")
        
        # Validate new name
        is_valid, error = self.validate_filename(new_name)
        if not is_valid:
            raise ValueError(error)
        
        # Calculate new path
        parent_path = self.get_parent_path(file.path)
        new_path = self.join_path(parent_path, new_name)
        
        # Check if new path already exists
        existing = await self.get_file_by_path(user_id, new_path, project_id)
        if existing and existing.id != file_id:
            raise ValueError(f"A file with this name already exists: {new_path}")
        
        old_path = file.path
        
        # Update file
        file.name = new_name
        file.path = new_path
        file.updated_at = datetime.utcnow()
        
        # Update language if file
        if file.file_type == FileType.FILE:
            file.language = detect_language(new_name)
            file.mime_type = detect_mime_type(new_name)
        
        # If folder, update all children paths
        if file.file_type == FileType.FOLDER:
            await self._update_children_paths(user_id, old_path, new_path, project_id)
        
        await self.db.commit()
        await self.db.refresh(file)
        
        logger.info(f"Renamed: {old_path} -> {new_path}")
        return file
    
    async def move_file(
        self,
        user_id: int,
        file_id: int,
        new_parent_path: str,
        project_id: Optional[int] = None
    ) -> WorkspaceFile:
        """
        Move a file or folder to a new location.
        
        Args:
            user_id: Owner user ID
            file_id: File ID
            new_parent_path: New parent folder path
            project_id: Optional project filter
            
        Returns:
            Moved WorkspaceFile
            
        Raises:
            ValueError: If file not found or move invalid
        """
        file = await self.get_file(user_id, file_id, project_id)
        
        if not file:
            raise ValueError("File not found")
        
        normalized_parent = self.normalize_path(new_parent_path)
        new_path = self.join_path(normalized_parent, file.name)
        
        # Check if moving into itself (for folders)
        if file.file_type == FileType.FOLDER:
            if new_path.startswith(file.path + "/"):
                raise ValueError("Cannot move folder into itself")
        
        # Check if new path already exists
        existing = await self.get_file_by_path(user_id, new_path, project_id)
        if existing:
            raise ValueError(f"A file with this name already exists at destination")
        
        # Get or create new parent
        new_parent_id = None
        if normalized_parent != "/":
            parent = await self.get_file_by_path(user_id, normalized_parent, project_id)
            if not parent:
                parent = await self.create_folder(user_id, normalized_parent, project_id)
            if parent.file_type != FileType.FOLDER:
                raise ValueError("Destination is not a folder")
            new_parent_id = parent.id
        
        old_path = file.path
        
        # Update file
        file.parent_id = new_parent_id
        file.path = new_path
        file.updated_at = datetime.utcnow()
        
        # If folder, update all children paths
        if file.file_type == FileType.FOLDER:
            await self._update_children_paths(user_id, old_path, new_path, project_id)
        
        await self.db.commit()
        await self.db.refresh(file)
        
        logger.info(f"Moved: {old_path} -> {new_path}")
        return file
    
    async def delete_file(
        self,
        user_id: int,
        file_id: int,
        project_id: Optional[int] = None,
        permanent: bool = False
    ) -> bool:
        """
        Delete a file or folder.
        
        Args:
            user_id: Owner user ID
            file_id: File ID
            project_id: Optional project filter
            permanent: If True, permanently delete; otherwise soft delete
            
        Returns:
            True if deleted
            
        Raises:
            ValueError: If file not found
        """
        file = await self.get_file(user_id, file_id, project_id)
        
        if not file:
            raise ValueError("File not found")
        
        if permanent:
            # Permanently delete file and all children
            if file.file_type == FileType.FOLDER:
                # Delete all children first
                await self.db.execute(
                    delete(WorkspaceFile).where(
                        WorkspaceFile.user_id == user_id,
                        WorkspaceFile.path.like(f"{file.path}/%")
                    )
                )
            
            await self.db.delete(file)
        else:
            # Soft delete
            file.status = FileStatus.DELETED
            file.updated_at = datetime.utcnow()
            
            # Soft delete children if folder
            if file.file_type == FileType.FOLDER:
                await self.db.execute(
                    select(WorkspaceFile).where(
                        WorkspaceFile.user_id == user_id,
                        WorkspaceFile.path.like(f"{file.path}/%")
                    )
                )
                # Update all children to deleted
                children = await self.list_files(
                    user_id, file.path, project_id, include_children=True
                )
                for child in children:
                    child.status = FileStatus.DELETED
        
        await self.db.commit()
        
        logger.info(f"Deleted {'permanently' if permanent else 'soft'}: {file.path}")
        return True
    
    async def copy_file(
        self,
        user_id: int,
        file_id: int,
        dest_path: str,
        project_id: Optional[int] = None
    ) -> WorkspaceFile:
        """
        Copy a file to a new location.
        
        Args:
            user_id: Owner user ID
            file_id: Source file ID
            dest_path: Destination path
            project_id: Optional project filter
            
        Returns:
            New WorkspaceFile copy
        """
        source = await self.get_file(user_id, file_id, project_id)
        
        if not source:
            raise ValueError("Source file not found")
        
        if source.file_type == FileType.FOLDER:
            raise ValueError("Cannot copy folders (yet)")
        
        # Create copy
        return await self.create_file(
            user_id=user_id,
            path=dest_path,
            content=source.content or "",
            project_id=project_id,
            is_generated=source.is_generated
        )
    
    # =========================================================================
    # VERSION MANAGEMENT
    # =========================================================================
    
    async def _create_version(
        self,
        file: WorkspaceFile,
        change_type: str,
        description: str,
        changed_by: str = "user"
    ) -> FileVersion:
        """Create a version snapshot of a file."""
        version = FileVersion(
            file_id=file.id,
            version_number=file.version,
            content=file.content,
            size=file.size,
            change_type=change_type,
            change_description=description,
            changed_by=changed_by
        )
        
        self.db.add(version)
        
        # Cleanup old versions if exceeding limit
        await self._cleanup_versions(file.id)
        
        return version
    
    async def _cleanup_versions(self, file_id: int):
        """Remove old versions exceeding the limit."""
        # Get version count
        count_result = await self.db.execute(
            select(func.count(FileVersion.id)).where(
                FileVersion.file_id == file_id
            )
        )
        count = count_result.scalar()
        
        if count > self.MAX_VERSIONS:
            # Delete oldest versions
            to_delete = count - self.MAX_VERSIONS
            
            oldest = await self.db.execute(
                select(FileVersion.id).where(
                    FileVersion.file_id == file_id
                ).order_by(FileVersion.version_number).limit(to_delete)
            )
            
            ids_to_delete = [row[0] for row in oldest.fetchall()]
            
            await self.db.execute(
                delete(FileVersion).where(FileVersion.id.in_(ids_to_delete))
            )
    
    async def get_file_versions(
        self,
        user_id: int,
        file_id: int,
        project_id: Optional[int] = None,
        limit: int = 20
    ) -> List[FileVersion]:
        """Get version history for a file."""
        file = await self.get_file(user_id, file_id, project_id)
        
        if not file:
            raise ValueError("File not found")
        
        result = await self.db.execute(
            select(FileVersion).where(
                FileVersion.file_id == file_id
            ).order_by(FileVersion.version_number.desc()).limit(limit)
        )
        
        return list(result.scalars().all())
    
    async def restore_version(
        self,
        user_id: int,
        file_id: int,
        version_number: int,
        project_id: Optional[int] = None
    ) -> WorkspaceFile:
        """Restore a file to a previous version."""
        file = await self.get_file(user_id, file_id, project_id)
        
        if not file:
            raise ValueError("File not found")
        
        # Get the version
        result = await self.db.execute(
            select(FileVersion).where(
                FileVersion.file_id == file_id,
                FileVersion.version_number == version_number
            )
        )
        version = result.scalar_one_or_none()
        
        if not version:
            raise ValueError(f"Version {version_number} not found")
        
        # Create version of current state before restore
        await self._create_version(file, "restore", f"Before restore to v{version_number}")
        
        # Restore content
        file.content = version.content
        file.size = version.size
        file.version += 1
        file.updated_at = datetime.utcnow()
        
        await self.db.commit()
        await self.db.refresh(file)
        
        logger.info(f"Restored {file.path} to version {version_number}")
        return file
    
    # =========================================================================
    # HELPER METHODS
    # =========================================================================
    
    async def _update_children_paths(
        self,
        user_id: int,
        old_path: str,
        new_path: str,
        project_id: Optional[int] = None
    ):
        """Update paths of all children when a folder is renamed/moved."""
        query = select(WorkspaceFile).where(
            WorkspaceFile.user_id == user_id,
            WorkspaceFile.path.like(f"{old_path}/%"),
            WorkspaceFile.status == FileStatus.ACTIVE
        )
        
        if project_id is not None:
            query = query.where(WorkspaceFile.project_id == project_id)
        
        result = await self.db.execute(query)
        children = result.scalars().all()
        
        for child in children:
            child.path = new_path + child.path[len(old_path):]
    
    async def search_files(
        self,
        user_id: int,
        query: str,
        project_id: Optional[int] = None,
        file_type: Optional[FileType] = None,
        limit: int = 50
    ) -> List[WorkspaceFile]:
        """
        Search files by name or content.
        
        Args:
            user_id: Owner user ID
            query: Search query
            project_id: Optional project filter
            file_type: Optional type filter
            limit: Maximum results
            
        Returns:
            List of matching files
        """
        search_filter = or_(
            WorkspaceFile.name.ilike(f"%{query}%"),
            WorkspaceFile.content.ilike(f"%{query}%")
        )
        
        db_query = select(WorkspaceFile).where(
            WorkspaceFile.user_id == user_id,
            WorkspaceFile.status == FileStatus.ACTIVE,
            search_filter
        )
        
        if project_id is not None:
            db_query = db_query.where(WorkspaceFile.project_id == project_id)
        
        if file_type is not None:
            db_query = db_query.where(WorkspaceFile.file_type == file_type)
        
        db_query = db_query.order_by(WorkspaceFile.updated_at.desc()).limit(limit)
        
        result = await self.db.execute(db_query)
        return list(result.scalars().all())
    
    async def get_workspace_stats(
        self,
        user_id: int,
        project_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Get workspace statistics."""
        base_filter = [
            WorkspaceFile.user_id == user_id,
            WorkspaceFile.status == FileStatus.ACTIVE
        ]
        
        if project_id is not None:
            base_filter.append(WorkspaceFile.project_id == project_id)
        
        # Count files
        file_count = await self.db.execute(
            select(func.count(WorkspaceFile.id)).where(
                *base_filter,
                WorkspaceFile.file_type == FileType.FILE
            )
        )
        
        # Count folders
        folder_count = await self.db.execute(
            select(func.count(WorkspaceFile.id)).where(
                *base_filter,
                WorkspaceFile.file_type == FileType.FOLDER
            )
        )
        
        # Total size
        total_size = await self.db.execute(
            select(func.sum(WorkspaceFile.size)).where(*base_filter)
        )
        
        # Generated files count
        generated_count = await self.db.execute(
            select(func.count(WorkspaceFile.id)).where(
                *base_filter,
                WorkspaceFile.is_generated == True
            )
        )
        
        return {
            "file_count": file_count.scalar() or 0,
            "folder_count": folder_count.scalar() or 0,
            "total_size": total_size.scalar() or 0,
            "generated_count": generated_count.scalar() or 0
        }


# Dependency injection helper
async def get_workspace_service(db: AsyncSession) -> WorkspaceService:
    """Get workspace service instance."""
    return WorkspaceService(db)
