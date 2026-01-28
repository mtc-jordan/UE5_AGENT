"""
File Locking Service for Collaborative Editing
Manages soft and hard locks to prevent editing conflicts
"""
from typing import Dict, Optional, Set
from datetime import datetime, timedelta
from enum import Enum
import asyncio


class LockType(str, Enum):
    """Lock types"""
    SOFT = "soft"  # Warning only, others can still edit
    HARD = "hard"  # Exclusive access, others cannot edit


class FileLock:
    """Represents a file lock"""
    
    def __init__(
        self,
        file_id: int,
        user_id: int,
        lock_type: LockType,
        reason: Optional[str] = None
    ):
        self.file_id = file_id
        self.user_id = user_id
        self.lock_type = lock_type
        self.reason = reason or "Editing"
        self.created_at = datetime.now()
        self.expires_at: Optional[datetime] = None
        self.auto_unlock = True
    
    def is_expired(self) -> bool:
        """Check if lock has expired"""
        if self.expires_at is None:
            return False
        return datetime.now() > self.expires_at
    
    def to_dict(self) -> dict:
        """Convert to dictionary"""
        return {
            "file_id": self.file_id,
            "user_id": self.user_id,
            "lock_type": self.lock_type.value,
            "reason": self.reason,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "auto_unlock": self.auto_unlock
        }


class FileLockService:
    """
    Manages file locks for collaborative editing
    
    Features:
    - Soft locks (warnings)
    - Hard locks (exclusive access)
    - Auto-unlock on disconnect
    - Lock expiration
    - Request access system
    """
    
    def __init__(self):
        # file_id -> FileLock
        self.locks: Dict[int, FileLock] = {}
        
        # file_id -> set of user_ids waiting for access
        self.access_requests: Dict[int, Set[int]] = {}
        
        # user_id -> set of file_ids they're viewing
        self.user_files: Dict[int, Set[int]] = {}
        
        # Lock for thread-safe operations
        self._lock = asyncio.Lock()
    
    async def acquire_lock(
        self,
        file_id: int,
        user_id: int,
        lock_type: LockType = LockType.SOFT,
        reason: Optional[str] = None,
        duration_minutes: Optional[int] = None
    ) -> dict:
        """
        Acquire a lock on a file
        
        Args:
            file_id: File ID
            user_id: User ID
            lock_type: Type of lock (soft or hard)
            reason: Reason for locking
            duration_minutes: Lock duration (None = until disconnect)
            
        Returns:
            Result dict with success status and message
        """
        async with self._lock:
            # Check if file is already locked
            if file_id in self.locks:
                existing_lock = self.locks[file_id]
                
                # Check if lock is expired
                if existing_lock.is_expired():
                    # Remove expired lock
                    del self.locks[file_id]
                else:
                    # File is locked by someone else
                    if existing_lock.user_id != user_id:
                        if existing_lock.lock_type == LockType.HARD:
                            return {
                                "success": False,
                                "message": f"File is locked by user {existing_lock.user_id}",
                                "lock": existing_lock.to_dict()
                            }
                        else:
                            # Soft lock - allow but warn
                            return {
                                "success": True,
                                "warning": f"File is being edited by user {existing_lock.user_id}",
                                "lock": existing_lock.to_dict()
                            }
                    else:
                        # Same user - upgrade lock if needed
                        if lock_type == LockType.HARD and existing_lock.lock_type == LockType.SOFT:
                            existing_lock.lock_type = LockType.HARD
                            existing_lock.reason = reason or existing_lock.reason
                            return {
                                "success": True,
                                "message": "Lock upgraded to hard lock",
                                "lock": existing_lock.to_dict()
                            }
                        else:
                            return {
                                "success": True,
                                "message": "Lock already held",
                                "lock": existing_lock.to_dict()
                            }
            
            # Create new lock
            lock = FileLock(file_id, user_id, lock_type, reason)
            
            # Set expiration if duration specified
            if duration_minutes:
                lock.expires_at = datetime.now() + timedelta(minutes=duration_minutes)
                lock.auto_unlock = False
            
            self.locks[file_id] = lock
            
            # Track user's files
            if user_id not in self.user_files:
                self.user_files[user_id] = set()
            self.user_files[user_id].add(file_id)
            
            return {
                "success": True,
                "message": f"{lock_type.value.capitalize()} lock acquired",
                "lock": lock.to_dict()
            }
    
    async def release_lock(self, file_id: int, user_id: int) -> dict:
        """
        Release a lock on a file
        
        Args:
            file_id: File ID
            user_id: User ID
            
        Returns:
            Result dict with success status
        """
        async with self._lock:
            if file_id not in self.locks:
                return {
                    "success": False,
                    "message": "File is not locked"
                }
            
            lock = self.locks[file_id]
            
            # Check if user owns the lock
            if lock.user_id != user_id:
                return {
                    "success": False,
                    "message": "Lock is owned by another user"
                }
            
            # Remove lock
            del self.locks[file_id]
            
            # Update user's files
            if user_id in self.user_files:
                self.user_files[user_id].discard(file_id)
            
            # Notify waiting users
            if file_id in self.access_requests:
                waiting_users = self.access_requests[file_id]
                del self.access_requests[file_id]
                
                return {
                    "success": True,
                    "message": "Lock released",
                    "waiting_users": list(waiting_users)
                }
            
            return {
                "success": True,
                "message": "Lock released"
            }
    
    async def get_lock(self, file_id: int) -> Optional[dict]:
        """Get lock information for a file"""
        async with self._lock:
            if file_id not in self.locks:
                return None
            
            lock = self.locks[file_id]
            
            # Check if expired
            if lock.is_expired():
                del self.locks[file_id]
                return None
            
            return lock.to_dict()
    
    async def check_access(self, file_id: int, user_id: int) -> dict:
        """
        Check if user can access a file
        
        Returns:
            Dict with can_edit, can_view, and lock info
        """
        async with self._lock:
            if file_id not in self.locks:
                return {
                    "can_edit": True,
                    "can_view": True,
                    "lock": None
                }
            
            lock = self.locks[file_id]
            
            # Check if expired
            if lock.is_expired():
                del self.locks[file_id]
                return {
                    "can_edit": True,
                    "can_view": True,
                    "lock": None
                }
            
            # Owner can always edit
            if lock.user_id == user_id:
                return {
                    "can_edit": True,
                    "can_view": True,
                    "lock": lock.to_dict()
                }
            
            # Hard lock - no editing
            if lock.lock_type == LockType.HARD:
                return {
                    "can_edit": False,
                    "can_view": True,
                    "lock": lock.to_dict(),
                    "message": f"File is locked by user {lock.user_id}"
                }
            
            # Soft lock - can edit with warning
            return {
                "can_edit": True,
                "can_view": True,
                "lock": lock.to_dict(),
                "warning": f"File is being edited by user {lock.user_id}"
            }
    
    async def request_access(self, file_id: int, user_id: int) -> dict:
        """Request access to a locked file"""
        async with self._lock:
            if file_id not in self.locks:
                return {
                    "success": False,
                    "message": "File is not locked"
                }
            
            lock = self.locks[file_id]
            
            # Add to access requests
            if file_id not in self.access_requests:
                self.access_requests[file_id] = set()
            
            self.access_requests[file_id].add(user_id)
            
            return {
                "success": True,
                "message": f"Access requested from user {lock.user_id}",
                "lock_owner": lock.user_id
            }
    
    async def get_access_requests(self, file_id: int) -> list:
        """Get list of users requesting access to a file"""
        async with self._lock:
            if file_id not in self.access_requests:
                return []
            return list(self.access_requests[file_id])
    
    async def release_all_user_locks(self, user_id: int) -> list:
        """Release all locks held by a user (on disconnect)"""
        async with self._lock:
            if user_id not in self.user_files:
                return []
            
            released_files = []
            
            for file_id in list(self.user_files[user_id]):
                if file_id in self.locks:
                    lock = self.locks[file_id]
                    if lock.user_id == user_id and lock.auto_unlock:
                        del self.locks[file_id]
                        released_files.append(file_id)
            
            # Clear user's files
            del self.user_files[user_id]
            
            return released_files
    
    async def get_all_locks(self) -> list:
        """Get list of all active locks"""
        async with self._lock:
            # Remove expired locks
            expired = [
                file_id for file_id, lock in self.locks.items()
                if lock.is_expired()
            ]
            for file_id in expired:
                del self.locks[file_id]
            
            return [lock.to_dict() for lock in self.locks.values()]
    
    async def get_user_locks(self, user_id: int) -> list:
        """Get list of locks held by a user"""
        async with self._lock:
            return [
                lock.to_dict()
                for lock in self.locks.values()
                if lock.user_id == user_id
            ]


# Global instance
file_lock_service = FileLockService()
