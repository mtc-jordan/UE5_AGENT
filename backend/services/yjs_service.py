"""
Yjs Document Service for Collaborative Editing
Manages Yjs CRDT documents for real-time conflict-free text editing
"""
import y_py as Y
from typing import Dict, Optional, Set
from datetime import datetime
import asyncio


class YjsDocumentService:
    """
    Manages Yjs documents for collaborative editing
    
    Features:
    - Document creation and management
    - Update broadcasting
    - Awareness (cursor/selection) management
    - Persistence (save to database)
    """
    
    def __init__(self):
        # file_id -> YDoc
        self.documents: Dict[int, Y.YDoc] = {}
        
        # file_id -> set of user_ids editing this file
        self.editors: Dict[int, Set[int]] = {}
        
        # file_id -> last_modified timestamp
        self.last_modified: Dict[int, datetime] = {}
        
        # file_id -> pending updates (for batching)
        self.pending_updates: Dict[int, list] = {}
        
        # Lock for thread-safe operations
        self._lock = asyncio.Lock()
    
    async def get_or_create_document(self, file_id: int, initial_content: str = "") -> Y.YDoc:
        """
        Get existing document or create new one
        
        Args:
            file_id: File ID
            initial_content: Initial text content if creating new document
            
        Returns:
            YDoc instance
        """
        async with self._lock:
            if file_id not in self.documents:
                # Create new Yjs document
                doc = Y.YDoc()
                
                # Get the text type (shared text object)
                text = doc.get_text("content")
                
                # Initialize with content if provided
                if initial_content:
                    with doc.begin_transaction() as txn:
                        text.extend(txn, initial_content)
                
                self.documents[file_id] = doc
                self.editors[file_id] = set()
                self.last_modified[file_id] = datetime.now()
                self.pending_updates[file_id] = []
            
            return self.documents[file_id]
    
    async def apply_update(self, file_id: int, update: bytes, user_id: int) -> bytes:
        """
        Apply update from a client to the document
        
        Args:
            file_id: File ID
            update: Yjs update (binary)
            user_id: User who made the update
            
        Returns:
            Update to broadcast to other clients (binary)
        """
        async with self._lock:
            if file_id not in self.documents:
                raise ValueError(f"Document {file_id} not found")
            
            doc = self.documents[file_id]
            
            # Apply the update to the document
            Y.apply_update(doc, update)
            
            # Track the editor
            self.editors[file_id].add(user_id)
            
            # Update last modified time
            self.last_modified[file_id] = datetime.now()
            
            # Return the update to broadcast to other clients
            # (Yjs automatically handles conflict resolution)
            return update
    
    async def get_state_vector(self, file_id: int) -> bytes:
        """
        Get state vector for a document (for sync)
        
        Args:
            file_id: File ID
            
        Returns:
            State vector (binary)
        """
        async with self._lock:
            if file_id not in self.documents:
                raise ValueError(f"Document {file_id} not found")
            
            doc = self.documents[file_id]
            return Y.encode_state_vector(doc)
    
    async def get_state_as_update(self, file_id: int, state_vector: Optional[bytes] = None) -> bytes:
        """
        Get document state as update (for initial sync)
        
        Args:
            file_id: File ID
            state_vector: Optional state vector from client
            
        Returns:
            Document state as update (binary)
        """
        async with self._lock:
            if file_id not in self.documents:
                raise ValueError(f"Document {file_id} not found")
            
            doc = self.documents[file_id]
            
            if state_vector:
                # Return diff between server and client state
                return Y.encode_state_as_update(doc, state_vector)
            else:
                # Return full document state
                return Y.encode_state_as_update(doc)
    
    async def get_text_content(self, file_id: int) -> str:
        """
        Get current text content of document
        
        Args:
            file_id: File ID
            
        Returns:
            Text content
        """
        async with self._lock:
            if file_id not in self.documents:
                raise ValueError(f"Document {file_id} not found")
            
            doc = self.documents[file_id]
            text = doc.get_text("content")
            return str(text)
    
    async def add_editor(self, file_id: int, user_id: int):
        """Add user as editor of document"""
        async with self._lock:
            if file_id in self.editors:
                self.editors[file_id].add(user_id)
    
    async def remove_editor(self, file_id: int, user_id: int):
        """Remove user as editor of document"""
        async with self._lock:
            if file_id in self.editors:
                self.editors[file_id].discard(user_id)
    
    async def get_editors(self, file_id: int) -> Set[int]:
        """Get list of users currently editing document"""
        async with self._lock:
            return self.editors.get(file_id, set()).copy()
    
    async def close_document(self, file_id: int) -> Optional[str]:
        """
        Close document and return final content
        
        Args:
            file_id: File ID
            
        Returns:
            Final text content, or None if document not found
        """
        async with self._lock:
            if file_id not in self.documents:
                return None
            
            # Get final content
            content = await self.get_text_content(file_id)
            
            # Clean up
            del self.documents[file_id]
            del self.editors[file_id]
            del self.last_modified[file_id]
            del self.pending_updates[file_id]
            
            return content
    
    async def get_document_info(self, file_id: int) -> Optional[dict]:
        """Get information about a document"""
        async with self._lock:
            if file_id not in self.documents:
                return None
            
            return {
                "file_id": file_id,
                "editors": list(self.editors.get(file_id, set())),
                "editor_count": len(self.editors.get(file_id, set())),
                "last_modified": self.last_modified.get(file_id).isoformat() if file_id in self.last_modified else None,
                "content_length": len(await self.get_text_content(file_id))
            }
    
    async def get_all_documents(self) -> list:
        """Get list of all active documents"""
        async with self._lock:
            return [
                await self.get_document_info(file_id)
                for file_id in self.documents.keys()
            ]


# Global instance
yjs_service = YjsDocumentService()
