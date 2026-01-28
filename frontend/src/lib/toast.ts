/**
 * UE5 AI Studio - Toast Notifications
 * ====================================
 * 
 * Centralized toast notification system using react-hot-toast.
 * 
 * Version: 2.0.0
 */

import toast from 'react-hot-toast';

// =============================================================================
// TOAST CONFIGURATION
// =============================================================================

export const toastConfig = {
  duration: 3000,
  position: 'bottom-right' as const,
  style: {
    background: '#1F2937',
    color: '#F3F4F6',
    border: '1px solid #374151',
    borderRadius: '0.5rem',
    padding: '12px 16px',
  },
  success: {
    iconTheme: {
      primary: '#10B981',
      secondary: '#FFFFFF',
    },
  },
  error: {
    iconTheme: {
      primary: '#EF4444',
      secondary: '#FFFFFF',
    },
  },
};

// =============================================================================
// TOAST HELPERS
// =============================================================================

export const showSuccess = (message: string) => {
  toast.success(message, toastConfig);
};

export const showError = (message: string) => {
  toast.error(message, toastConfig);
};

export const showInfo = (message: string) => {
  toast(message, {
    ...toastConfig,
    icon: 'ℹ️',
  });
};

export const showWarning = (message: string) => {
  toast(message, {
    ...toastConfig,
    icon: '⚠️',
    style: {
      ...toastConfig.style,
      border: '1px solid #F59E0B',
    },
  });
};

export const showLoading = (message: string) => {
  return toast.loading(message, toastConfig);
};

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};

// =============================================================================
// WORKSPACE-SPECIFIC TOASTS
// =============================================================================

export const workspaceToasts = {
  fileCreated: (fileName: string) => showSuccess(`File "${fileName}" created successfully`),
  folderCreated: (folderName: string) => showSuccess(`Folder "${folderName}" created successfully`),
  fileDeleted: (fileName: string) => showSuccess(`File "${fileName}" deleted`),
  fileSaved: (fileName: string) => showSuccess(`File "${fileName}" saved`),
  fileRenamed: (oldName: string, newName: string) => showSuccess(`Renamed "${oldName}" to "${newName}"`),
  fileUploaded: (fileName: string) => showSuccess(`File "${fileName}" uploaded`),
  
  // Errors
  createFailed: (error: string) => showError(`Failed to create file: ${error}`),
  saveFailed: (error: string) => showError(`Failed to save file: ${error}`),
  deleteFailed: (error: string) => showError(`Failed to delete file: ${error}`),
  uploadFailed: (error: string) => showError(`Upload failed: ${error}`),
  
  // Info
  unsavedChanges: () => showWarning('You have unsaved changes'),
  readonlyFile: () => showInfo('This file is read-only'),
};
