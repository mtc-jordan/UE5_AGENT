"""
File Lock API Endpoints
REST API for managing file locks in collaborative editing
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.file_lock_service import file_lock_service, LockType
from services.auth import get_current_user
from models.user import User


router = APIRouter(prefix="/file-locks", tags=["file-locks"])


class AcquireLockRequest(BaseModel):
    """Request to acquire a file lock"""
    file_id: int
    lock_type: str = "soft"  # "soft" or "hard"
    reason: Optional[str] = None
    duration_minutes: Optional[int] = None


class ReleaseLockRequest(BaseModel):
    """Request to release a file lock"""
    file_id: int


class RequestAccessRequest(BaseModel):
    """Request access to a locked file"""
    file_id: int


@router.post("/acquire")
async def acquire_lock(
    request: AcquireLockRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Acquire a lock on a file
    
    - **file_id**: File ID to lock
    - **lock_type**: "soft" (warning) or "hard" (exclusive)
    - **reason**: Optional reason for locking
    - **duration_minutes**: Lock duration (None = until disconnect)
    """
    try:
        lock_type = LockType(request.lock_type)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid lock type. Must be 'soft' or 'hard'")
    
    result = await file_lock_service.acquire_lock(
        file_id=request.file_id,
        user_id=current_user.id,
        lock_type=lock_type,
        reason=request.reason,
        duration_minutes=request.duration_minutes
    )
    
    if not result["success"] and "warning" not in result:
        raise HTTPException(status_code=409, detail=result["message"])
    
    return result


@router.post("/release")
async def release_lock(
    request: ReleaseLockRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Release a lock on a file
    
    - **file_id**: File ID to unlock
    """
    result = await file_lock_service.release_lock(
        file_id=request.file_id,
        user_id=current_user["id"]
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result


@router.get("/file/{file_id}")
async def get_file_lock(
    file_id: int,
    current_user: User = Depends(get_current_user)
):
    """
    Get lock information for a file
    
    - **file_id**: File ID
    """
    lock = await file_lock_service.get_lock(file_id)
    
    if lock is None:
        return {"locked": False, "lock": None}
    
    return {"locked": True, "lock": lock}


@router.get("/file/{file_id}/access")
async def check_file_access(
    file_id: int,
    current_user: User = Depends(get_current_user)
):
    """
    Check if current user can access a file
    
    - **file_id**: File ID
    
    Returns can_edit, can_view, and lock info
    """
    return await file_lock_service.check_access(
        file_id=file_id,
        user_id=current_user["id"]
    )


@router.post("/request-access")
async def request_file_access(
    request: RequestAccessRequest,
    current_user: User = Depends(get_current_user)
):
    """
    Request access to a locked file
    
    - **file_id**: File ID
    
    Notifies the lock owner that someone wants access
    """
    result = await file_lock_service.request_access(
        file_id=request.file_id,
        user_id=current_user["id"]
    )
    
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    
    return result


@router.get("/file/{file_id}/requests")
async def get_access_requests(
    file_id: int,
    current_user: User = Depends(get_current_user)
):
    """
    Get list of users requesting access to a file
    
    - **file_id**: File ID
    
    Only the lock owner can see access requests
    """
    lock = await file_lock_service.get_lock(file_id)
    
    if lock is None:
        raise HTTPException(status_code=404, detail="File is not locked")
    
    if lock["user_id"] != current_user.id:
        raise HTTPException(status_code=403, detail="Only lock owner can see access requests")
    
    requests = await file_lock_service.get_access_requests(file_id)
    
    return {"file_id": file_id, "requests": requests}


@router.get("/all")
async def get_all_locks(current_user: dict = Depends(get_current_user)):
    """
    Get list of all active locks
    
    Returns all locks in the system
    """
    locks = await file_lock_service.get_all_locks()
    return {"locks": locks}


@router.get("/user")
async def get_user_locks(current_user: dict = Depends(get_current_user)):
    """
    Get list of locks held by current user
    
    Returns all locks owned by the current user
    """
    locks = await file_lock_service.get_user_locks(current_user["id"])
    return {"locks": locks}


@router.delete("/user/all")
async def release_all_user_locks(current_user: dict = Depends(get_current_user)):
    """
    Release all locks held by current user
    
    Useful when user wants to unlock all files at once
    """
    released_files = await file_lock_service.release_all_user_locks(current_user["id"])
    return {
        "success": True,
        "message": f"Released {len(released_files)} locks",
        "released_files": released_files
    }
