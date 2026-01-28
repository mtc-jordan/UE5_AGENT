"""
Git Service for UE5 AI Studio Workspace
Provides comprehensive Git operations for version control
"""

import os
import asyncio
from typing import List, Dict, Any, Optional
from datetime import datetime
from pathlib import Path
import git
from git import Repo, GitCommandError, InvalidGitRepositoryError
from git.exc import NoSuchPathError

class GitService:
    """Service for Git operations in workspace"""
    
    def __init__(self, workspace_root: str):
        """
        Initialize Git service
        
        Args:
            workspace_root: Root directory of the workspace
        """
        self.workspace_root = Path(workspace_root)
        self.repo: Optional[Repo] = None
        self._load_repo()
    
    def _load_repo(self):
        """Load existing Git repository if it exists"""
        try:
            self.repo = Repo(self.workspace_root)
        except (InvalidGitRepositoryError, NoSuchPathError):
            self.repo = None
    
    # =============================================================================
    # REPOSITORY MANAGEMENT
    # =============================================================================
    
    async def init_repository(self, initial_branch: str = "main") -> Dict[str, Any]:
        """
        Initialize a new Git repository
        
        Args:
            initial_branch: Name of the initial branch
            
        Returns:
            Repository information
        """
        try:
            if self.repo is not None:
                return {
                    "success": False,
                    "error": "Repository already initialized"
                }
            
            # Initialize repository
            self.repo = Repo.init(self.workspace_root, initial_branch=initial_branch)
            
            return {
                "success": True,
                "message": f"Repository initialized with branch '{initial_branch}'",
                "branch": initial_branch
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def clone_repository(self, url: str, branch: Optional[str] = None) -> Dict[str, Any]:
        """
        Clone a repository from URL
        
        Args:
            url: Repository URL
            branch: Specific branch to clone (optional)
            
        Returns:
            Clone result
        """
        try:
            # Check if directory is empty
            if list(self.workspace_root.iterdir()):
                return {
                    "success": False,
                    "error": "Workspace directory is not empty"
                }
            
            # Clone repository
            if branch:
                self.repo = Repo.clone_from(url, self.workspace_root, branch=branch)
            else:
                self.repo = Repo.clone_from(url, self.workspace_root)
            
            return {
                "success": True,
                "message": f"Repository cloned successfully",
                "branch": self.repo.active_branch.name,
                "remote": url
            }
        except GitCommandError as e:
            return {
                "success": False,
                "error": f"Git error: {e.stderr}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_status(self) -> Dict[str, Any]:
        """
        Get repository status
        
        Returns:
            Repository status information
        """
        if not self.repo:
            return {
                "initialized": False,
                "message": "No Git repository found"
            }
        
        try:
            # Get current branch
            current_branch = self.repo.active_branch.name
            
            # Get changed files
            changed_files = [item.a_path for item in self.repo.index.diff(None)]
            staged_files = [item.a_path for item in self.repo.index.diff("HEAD")]
            untracked_files = self.repo.untracked_files
            
            # Get remote info
            remotes = [{"name": remote.name, "url": list(remote.urls)[0]} 
                      for remote in self.repo.remotes]
            
            # Get ahead/behind info
            ahead_behind = {"ahead": 0, "behind": 0}
            if remotes and self.repo.head.is_valid():
                try:
                    tracking_branch = self.repo.active_branch.tracking_branch()
                    if tracking_branch:
                        ahead_behind = {
                            "ahead": len(list(self.repo.iter_commits(f'{tracking_branch}..HEAD'))),
                            "behind": len(list(self.repo.iter_commits(f'HEAD..{tracking_branch}')))
                        }
                except Exception:
                    pass
            
            return {
                "initialized": True,
                "branch": current_branch,
                "changed_files": changed_files,
                "staged_files": staged_files,
                "untracked_files": untracked_files,
                "remotes": remotes,
                "ahead": ahead_behind["ahead"],
                "behind": ahead_behind["behind"],
                "clean": len(changed_files) == 0 and len(staged_files) == 0 and len(untracked_files) == 0
            }
        except Exception as e:
            return {
                "initialized": True,
                "error": str(e)
            }
    
    # =============================================================================
    # STAGING OPERATIONS
    # =============================================================================
    
    async def stage_files(self, file_paths: List[str]) -> Dict[str, Any]:
        """
        Stage files for commit
        
        Args:
            file_paths: List of file paths to stage
            
        Returns:
            Stage result
        """
        if not self.repo:
            return {"success": False, "error": "No repository initialized"}
        
        try:
            self.repo.index.add(file_paths)
            return {
                "success": True,
                "message": f"Staged {len(file_paths)} file(s)",
                "files": file_paths
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def unstage_files(self, file_paths: List[str]) -> Dict[str, Any]:
        """
        Unstage files
        
        Args:
            file_paths: List of file paths to unstage
            
        Returns:
            Unstage result
        """
        if not self.repo:
            return {"success": False, "error": "No repository initialized"}
        
        try:
            self.repo.index.reset(paths=file_paths)
            return {
                "success": True,
                "message": f"Unstaged {len(file_paths)} file(s)",
                "files": file_paths
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def stage_all(self) -> Dict[str, Any]:
        """Stage all changes"""
        if not self.repo:
            return {"success": False, "error": "No repository initialized"}
        
        try:
            self.repo.git.add(A=True)
            return {
                "success": True,
                "message": "All changes staged"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    # =============================================================================
    # COMMIT OPERATIONS
    # =============================================================================
    
    async def commit(self, message: str, author_name: Optional[str] = None, 
                    author_email: Optional[str] = None) -> Dict[str, Any]:
        """
        Commit staged changes
        
        Args:
            message: Commit message
            author_name: Author name (optional)
            author_email: Author email (optional)
            
        Returns:
            Commit result
        """
        if not self.repo:
            return {"success": False, "error": "No repository initialized"}
        
        try:
            # Configure author if provided
            if author_name and author_email:
                with self.repo.config_writer() as config:
                    config.set_value("user", "name", author_name)
                    config.set_value("user", "email", author_email)
            
            # Commit
            commit = self.repo.index.commit(message)
            
            return {
                "success": True,
                "message": "Changes committed successfully",
                "commit_hash": commit.hexsha[:7],
                "commit_message": message
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def get_commit_history(self, limit: int = 50) -> Dict[str, Any]:
        """
        Get commit history
        
        Args:
            limit: Maximum number of commits to return
            
        Returns:
            List of commits
        """
        if not self.repo:
            return {"success": False, "error": "No repository initialized"}
        
        try:
            commits = []
            for commit in list(self.repo.iter_commits(max_count=limit)):
                commits.append({
                    "hash": commit.hexsha[:7],
                    "full_hash": commit.hexsha,
                    "message": commit.message.strip(),
                    "author": commit.author.name,
                    "email": commit.author.email,
                    "date": commit.committed_datetime.isoformat(),
                    "files_changed": len(commit.stats.files)
                })
            
            return {
                "success": True,
                "commits": commits
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    # =============================================================================
    # BRANCH OPERATIONS
    # =============================================================================
    
    async def get_branches(self) -> Dict[str, Any]:
        """
        Get all branches
        
        Returns:
            List of branches
        """
        if not self.repo:
            return {"success": False, "error": "No repository initialized"}
        
        try:
            current_branch = self.repo.active_branch.name
            
            local_branches = []
            for branch in self.repo.branches:
                local_branches.append({
                    "name": branch.name,
                    "current": branch.name == current_branch,
                    "commit": branch.commit.hexsha[:7]
                })
            
            remote_branches = []
            for remote in self.repo.remotes:
                for ref in remote.refs:
                    if not ref.name.endswith('/HEAD'):
                        remote_branches.append({
                            "name": ref.name,
                            "commit": ref.commit.hexsha[:7]
                        })
            
            return {
                "success": True,
                "current_branch": current_branch,
                "local_branches": local_branches,
                "remote_branches": remote_branches
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def create_branch(self, branch_name: str, checkout: bool = True) -> Dict[str, Any]:
        """
        Create a new branch
        
        Args:
            branch_name: Name of the new branch
            checkout: Whether to checkout the new branch
            
        Returns:
            Create result
        """
        if not self.repo:
            return {"success": False, "error": "No repository initialized"}
        
        try:
            new_branch = self.repo.create_head(branch_name)
            
            if checkout:
                new_branch.checkout()
            
            return {
                "success": True,
                "message": f"Branch '{branch_name}' created",
                "branch": branch_name,
                "checked_out": checkout
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def switch_branch(self, branch_name: str) -> Dict[str, Any]:
        """
        Switch to a different branch
        
        Args:
            branch_name: Name of the branch to switch to
            
        Returns:
            Switch result
        """
        if not self.repo:
            return {"success": False, "error": "No repository initialized"}
        
        try:
            self.repo.git.checkout(branch_name)
            
            return {
                "success": True,
                "message": f"Switched to branch '{branch_name}'",
                "branch": branch_name
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def delete_branch(self, branch_name: str, force: bool = False) -> Dict[str, Any]:
        """
        Delete a branch
        
        Args:
            branch_name: Name of the branch to delete
            force: Force delete even if not merged
            
        Returns:
            Delete result
        """
        if not self.repo:
            return {"success": False, "error": "No repository initialized"}
        
        try:
            self.repo.delete_head(branch_name, force=force)
            
            return {
                "success": True,
                "message": f"Branch '{branch_name}' deleted"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    # =============================================================================
    # REMOTE OPERATIONS
    # =============================================================================
    
    async def add_remote(self, name: str, url: str) -> Dict[str, Any]:
        """
        Add a remote repository
        
        Args:
            name: Remote name (e.g., 'origin')
            url: Remote URL
            
        Returns:
            Add result
        """
        if not self.repo:
            return {"success": False, "error": "No repository initialized"}
        
        try:
            self.repo.create_remote(name, url)
            
            return {
                "success": True,
                "message": f"Remote '{name}' added",
                "name": name,
                "url": url
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def push(self, remote: str = "origin", branch: Optional[str] = None,
                  set_upstream: bool = False) -> Dict[str, Any]:
        """
        Push commits to remote
        
        Args:
            remote: Remote name
            branch: Branch name (uses current if None)
            set_upstream: Set upstream tracking
            
        Returns:
            Push result
        """
        if not self.repo:
            return {"success": False, "error": "No repository initialized"}
        
        try:
            if branch is None:
                branch = self.repo.active_branch.name
            
            remote_obj = self.repo.remote(remote)
            
            if set_upstream:
                push_info = remote_obj.push(refspec=f'{branch}:{branch}', set_upstream=True)
            else:
                push_info = remote_obj.push(refspec=f'{branch}:{branch}')
            
            return {
                "success": True,
                "message": f"Pushed to {remote}/{branch}",
                "remote": remote,
                "branch": branch
            }
        except GitCommandError as e:
            return {
                "success": False,
                "error": f"Push failed: {e.stderr}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def pull(self, remote: str = "origin", branch: Optional[str] = None) -> Dict[str, Any]:
        """
        Pull changes from remote
        
        Args:
            remote: Remote name
            branch: Branch name (uses current if None)
            
        Returns:
            Pull result
        """
        if not self.repo:
            return {"success": False, "error": "No repository initialized"}
        
        try:
            if branch is None:
                branch = self.repo.active_branch.name
            
            remote_obj = self.repo.remote(remote)
            pull_info = remote_obj.pull(branch)
            
            return {
                "success": True,
                "message": f"Pulled from {remote}/{branch}",
                "remote": remote,
                "branch": branch
            }
        except GitCommandError as e:
            return {
                "success": False,
                "error": f"Pull failed: {e.stderr}"
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def fetch(self, remote: str = "origin") -> Dict[str, Any]:
        """
        Fetch changes from remote
        
        Args:
            remote: Remote name
            
        Returns:
            Fetch result
        """
        if not self.repo:
            return {"success": False, "error": "No repository initialized"}
        
        try:
            remote_obj = self.repo.remote(remote)
            fetch_info = remote_obj.fetch()
            
            return {
                "success": True,
                "message": f"Fetched from {remote}",
                "remote": remote
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    # =============================================================================
    # DIFF OPERATIONS
    # =============================================================================
    
    async def get_file_diff(self, file_path: str, staged: bool = False) -> Dict[str, Any]:
        """
        Get diff for a specific file
        
        Args:
            file_path: Path to the file
            staged: Whether to get staged diff
            
        Returns:
            Diff information
        """
        if not self.repo:
            return {"success": False, "error": "No repository initialized"}
        
        try:
            if staged:
                # Diff between HEAD and staged
                diff = self.repo.index.diff("HEAD", paths=[file_path], create_patch=True)
            else:
                # Diff between staged and working directory
                diff = self.repo.index.diff(None, paths=[file_path], create_patch=True)
            
            if not diff:
                return {
                    "success": True,
                    "file": file_path,
                    "diff": "",
                    "changes": []
                }
            
            diff_item = diff[0]
            diff_text = diff_item.diff.decode('utf-8') if diff_item.diff else ""
            
            return {
                "success": True,
                "file": file_path,
                "diff": diff_text,
                "change_type": diff_item.change_type,
                "additions": diff_text.count('\n+'),
                "deletions": diff_text.count('\n-')
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    async def discard_changes(self, file_paths: List[str]) -> Dict[str, Any]:
        """
        Discard changes in files
        
        Args:
            file_paths: List of file paths
            
        Returns:
            Discard result
        """
        if not self.repo:
            return {"success": False, "error": "No repository initialized"}
        
        try:
            self.repo.index.checkout(paths=file_paths, force=True)
            
            return {
                "success": True,
                "message": f"Discarded changes in {len(file_paths)} file(s)",
                "files": file_paths
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
    
    # =============================================================================
    # UTILITY METHODS
    # =============================================================================
    
    async def configure_user(self, name: str, email: str) -> Dict[str, Any]:
        """
        Configure Git user
        
        Args:
            name: User name
            email: User email
            
        Returns:
            Configuration result
        """
        if not self.repo:
            return {"success": False, "error": "No repository initialized"}
        
        try:
            with self.repo.config_writer() as config:
                config.set_value("user", "name", name)
                config.set_value("user", "email", email)
            
            return {
                "success": True,
                "message": "Git user configured",
                "name": name,
                "email": email
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e)
            }
