/**
 * Git API Client for UE5 AI Studio Workspace
 */

import axios from 'axios';

const API_BASE = '/api/git';

// =============================================================================
// TYPES
// =============================================================================

export interface GitStatus {
  initialized: boolean;
  branch?: string;
  changed_files?: string[];
  staged_files?: string[];
  untracked_files?: string[];
  remotes?: Array<{ name: string; url: string }>;
  ahead?: number;
  behind?: number;
  clean?: boolean;
  error?: string;
}

export interface GitBranch {
  name: string;
  current?: boolean;
  commit: string;
}

export interface GitCommit {
  hash: string;
  full_hash: string;
  message: string;
  author: string;
  email: string;
  date: string;
  files_changed: number;
}

export interface GitDiff {
  file: string;
  diff: string;
  change_type: string;
  additions: number;
  deletions: number;
}

// =============================================================================
// REPOSITORY MANAGEMENT
// =============================================================================

export async function initRepository(initialBranch: string = 'main') {
  const response = await axios.post(`${API_BASE}/init`, { initial_branch: initialBranch });
  return response.data;
}

export async function cloneRepository(url: string, branch?: string) {
  const response = await axios.post(`${API_BASE}/clone`, { url, branch });
  return response.data;
}

export async function getStatus(): Promise<GitStatus> {
  const response = await axios.get(`${API_BASE}/status`);
  return response.data;
}

// =============================================================================
// STAGING OPERATIONS
// =============================================================================

export async function stageFiles(filePaths: string[]) {
  const response = await axios.post(`${API_BASE}/stage`, { file_paths: filePaths });
  return response.data;
}

export async function unstageFiles(filePaths: string[]) {
  const response = await axios.post(`${API_BASE}/unstage`, { file_paths: filePaths });
  return response.data;
}

export async function stageAll() {
  const response = await axios.post(`${API_BASE}/stage-all`);
  return response.data;
}

// =============================================================================
// COMMIT OPERATIONS
// =============================================================================

export async function commit(message: string, authorName?: string, authorEmail?: string) {
  const response = await axios.post(`${API_BASE}/commit`, {
    message,
    author_name: authorName,
    author_email: authorEmail
  });
  return response.data;
}

export async function getCommitHistory(limit: number = 50): Promise<{ commits: GitCommit[] }> {
  const response = await axios.get(`${API_BASE}/log`, { params: { limit } });
  return response.data;
}

// =============================================================================
// BRANCH OPERATIONS
// =============================================================================

export async function getBranches() {
  const response = await axios.get(`${API_BASE}/branches`);
  return response.data;
}

export async function createBranch(branchName: string, checkout: boolean = true) {
  const response = await axios.post(`${API_BASE}/branch/create`, {
    branch_name: branchName,
    checkout
  });
  return response.data;
}

export async function switchBranch(branchName: string) {
  const response = await axios.post(`${API_BASE}/branch/switch`, { branch_name: branchName });
  return response.data;
}

export async function deleteBranch(branchName: string, force: boolean = false) {
  const response = await axios.post(`${API_BASE}/branch/delete`, {
    branch_name: branchName,
    force
  });
  return response.data;
}

// =============================================================================
// REMOTE OPERATIONS
// =============================================================================

export async function addRemote(name: string, url: string) {
  const response = await axios.post(`${API_BASE}/remote/add`, { name, url });
  return response.data;
}

export async function push(remote: string = 'origin', branch?: string, setUpstream: boolean = false) {
  const response = await axios.post(`${API_BASE}/push`, {
    remote,
    branch,
    set_upstream: setUpstream
  });
  return response.data;
}

export async function pull(remote: string = 'origin', branch?: string) {
  const response = await axios.post(`${API_BASE}/pull`, { remote, branch });
  return response.data;
}

export async function fetch(remote: string = 'origin') {
  const response = await axios.post(`${API_BASE}/fetch`, { remote });
  return response.data;
}

// =============================================================================
// DIFF OPERATIONS
// =============================================================================

export async function getFileDiff(filePath: string, staged: boolean = false): Promise<GitDiff> {
  const response = await axios.get(`${API_BASE}/diff/${encodeURIComponent(filePath)}`, {
    params: { staged }
  });
  return response.data;
}

export async function discardChanges(filePaths: string[]) {
  const response = await axios.post(`${API_BASE}/discard`, { file_paths: filePaths });
  return response.data;
}

// =============================================================================
// CONFIGURATION
// =============================================================================

export async function configureUser(name: string, email: string) {
  const response = await axios.post(`${API_BASE}/config/user`, { name, email });
  return response.data;
}
