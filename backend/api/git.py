"""
Git API Endpoints for UE5 AI Studio Workspace
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Dict, Any, Optional
from core.database import get_db
from services.auth import get_current_user
from services.git_service import GitService
from models.user import User
import os

router = APIRouter(prefix="/api/git", tags=["Git"])

# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class InitRepoRequest(BaseModel):
    initial_branch: str = "main"

class CloneRepoRequest(BaseModel):
    url: str
    branch: Optional[str] = None

class StageFilesRequest(BaseModel):
    file_paths: List[str]

class CommitRequest(BaseModel):
    message: str
    author_name: Optional[str] = None
    author_email: Optional[str] = None

class CreateBranchRequest(BaseModel):
    branch_name: str
    checkout: bool = True

class SwitchBranchRequest(BaseModel):
    branch_name: str

class DeleteBranchRequest(BaseModel):
    branch_name: str
    force: bool = False

class AddRemoteRequest(BaseModel):
    name: str
    url: str

class PushRequest(BaseModel):
    remote: str = "origin"
    branch: Optional[str] = None
    set_upstream: bool = False

class PullRequest(BaseModel):
    remote: str = "origin"
    branch: Optional[str] = None

class FetchRequest(BaseModel):
    remote: str = "origin"

class ConfigureUserRequest(BaseModel):
    name: str
    email: str

# =============================================================================
# HELPER FUNCTIONS
# =============================================================================

def get_git_service(current_user: User = Depends(get_current_user)) -> GitService:
    """Get Git service for current user's workspace"""
    workspace_root = f"/home/ubuntu/workspace/user_{current_user.id}"
    os.makedirs(workspace_root, exist_ok=True)
    return GitService(workspace_root)

# =============================================================================
# REPOSITORY MANAGEMENT ENDPOINTS
# =============================================================================

@router.post("/init")
async def init_repository(
    request: InitRepoRequest,
    git_service: GitService = Depends(get_git_service)
):
    """Initialize a new Git repository"""
    result = await git_service.init_repository(request.initial_branch)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result

@router.post("/clone")
async def clone_repository(
    request: CloneRepoRequest,
    git_service: GitService = Depends(get_git_service)
):
    """Clone a repository from URL"""
    result = await git_service.clone_repository(request.url, request.branch)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result

@router.get("/status")
async def get_status(git_service: GitService = Depends(get_git_service)):
    """Get repository status"""
    result = await git_service.get_status()
    return result

# =============================================================================
# STAGING ENDPOINTS
# =============================================================================

@router.post("/stage")
async def stage_files(
    request: StageFilesRequest,
    git_service: GitService = Depends(get_git_service)
):
    """Stage files for commit"""
    result = await git_service.stage_files(request.file_paths)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result

@router.post("/unstage")
async def unstage_files(
    request: StageFilesRequest,
    git_service: GitService = Depends(get_git_service)
):
    """Unstage files"""
    result = await git_service.unstage_files(request.file_paths)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result

@router.post("/stage-all")
async def stage_all(git_service: GitService = Depends(get_git_service)):
    """Stage all changes"""
    result = await git_service.stage_all()
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result

# =============================================================================
# COMMIT ENDPOINTS
# =============================================================================

@router.post("/commit")
async def commit(
    request: CommitRequest,
    git_service: GitService = Depends(get_git_service)
):
    """Commit staged changes"""
    result = await git_service.commit(
        request.message,
        request.author_name,
        request.author_email
    )
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result

@router.get("/log")
async def get_commit_history(
    limit: int = 50,
    git_service: GitService = Depends(get_git_service)
):
    """Get commit history"""
    result = await git_service.get_commit_history(limit)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result

# =============================================================================
# BRANCH ENDPOINTS
# =============================================================================

@router.get("/branches")
async def get_branches(git_service: GitService = Depends(get_git_service)):
    """Get all branches"""
    result = await git_service.get_branches()
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result

@router.post("/branch/create")
async def create_branch(
    request: CreateBranchRequest,
    git_service: GitService = Depends(get_git_service)
):
    """Create a new branch"""
    result = await git_service.create_branch(request.branch_name, request.checkout)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result

@router.post("/branch/switch")
async def switch_branch(
    request: SwitchBranchRequest,
    git_service: GitService = Depends(get_git_service)
):
    """Switch to a different branch"""
    result = await git_service.switch_branch(request.branch_name)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result

@router.post("/branch/delete")
async def delete_branch(
    request: DeleteBranchRequest,
    git_service: GitService = Depends(get_git_service)
):
    """Delete a branch"""
    result = await git_service.delete_branch(request.branch_name, request.force)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result

# =============================================================================
# REMOTE ENDPOINTS
# =============================================================================

@router.post("/remote/add")
async def add_remote(
    request: AddRemoteRequest,
    git_service: GitService = Depends(get_git_service)
):
    """Add a remote repository"""
    result = await git_service.add_remote(request.name, request.url)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result

@router.post("/push")
async def push(
    request: PushRequest,
    git_service: GitService = Depends(get_git_service)
):
    """Push commits to remote"""
    result = await git_service.push(request.remote, request.branch, request.set_upstream)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result

@router.post("/pull")
async def pull(
    request: PullRequest,
    git_service: GitService = Depends(get_git_service)
):
    """Pull changes from remote"""
    result = await git_service.pull(request.remote, request.branch)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result

@router.post("/fetch")
async def fetch(
    request: FetchRequest,
    git_service: GitService = Depends(get_git_service)
):
    """Fetch changes from remote"""
    result = await git_service.fetch(request.remote)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result

# =============================================================================
# DIFF ENDPOINTS
# =============================================================================

@router.get("/diff/{file_path:path}")
async def get_file_diff(
    file_path: str,
    staged: bool = False,
    git_service: GitService = Depends(get_git_service)
):
    """Get diff for a specific file"""
    result = await git_service.get_file_diff(file_path, staged)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result

@router.post("/discard")
async def discard_changes(
    request: StageFilesRequest,
    git_service: GitService = Depends(get_git_service)
):
    """Discard changes in files"""
    result = await git_service.discard_changes(request.file_paths)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result

# =============================================================================
# CONFIGURATION ENDPOINTS
# =============================================================================

@router.post("/config/user")
async def configure_user(
    request: ConfigureUserRequest,
    git_service: GitService = Depends(get_git_service)
):
    """Configure Git user"""
    result = await git_service.configure_user(request.name, request.email)
    
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    
    return result
