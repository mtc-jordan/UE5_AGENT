/**
 * Voice Command Integration Component
 * Integrates voice commands with Workspace and handles command execution
 */
import React, { useEffect, useCallback } from 'react';
import { useVoiceCommands } from '../hooks/useVoiceCommands';
import { ParsedCommand } from '../services/command-parser';
import { actionExecutor } from '../services/action-executor';
import { voiceContextManager } from '../services/voice-context';
import { initializeVoiceCommands } from '../services/voice-commands-init';
import { VoiceControlPanel } from './VoiceControlPanel';
import * as ue5Api from '../lib/ue5-api';

interface VoiceCommandIntegrationProps {
  // Workspace state
  currentFile?: string | null;
  openFiles?: string[];
  selectedText?: string | null;
  gitBranch?: string | null;
  onlineUsers?: any[];
  
  // Command handlers
  onFileOpen?: (filename: string) => void;
  onFileSave?: () => void;
  onFileClose?: (filename?: string) => void;
  onFileCreate?: (filename: string) => void;
  onGotoLine?: (line: number) => void;
  onFind?: (text: string) => void;
  onShowPanel?: (panel: string) => void;
  onGitCommit?: (message: string) => void;
  onGitPush?: () => void;
  onGitPull?: () => void;
  onGitStatus?: () => void;
  onAIExplain?: (target: string) => void;
  onAIGenerate?: (description: string) => void;
  onAIFix?: (target: string) => void;
  onLockFile?: (filename: string) => void;
  onUnlockFile?: (filename: string) => void;
  onShowUsers?: () => void;
  
  // UI control
  showPanel?: boolean;
  className?: string;
}

export const VoiceCommandIntegration: React.FC<VoiceCommandIntegrationProps> = ({
  currentFile,
  openFiles = [],
  selectedText,
  gitBranch,
  onlineUsers = [],
  onFileOpen,
  onFileSave,
  onFileClose,
  onFileCreate,
  onGotoLine,
  onFind,
  onShowPanel,
  onGitCommit,
  onGitPush,
  onGitPull,
  onGitStatus,
  onAIExplain,
  onAIGenerate,
  onAIFix,
  onLockFile,
  onUnlockFile,
  onShowUsers,
  showPanel = true,
  className = ''
}) => {
  // Initialize voice commands on mount
  useEffect(() => {
    initializeVoiceCommands();
  }, []);

  // Update voice context when workspace state changes
  useEffect(() => {
    voiceContextManager.updateContext({
      currentFile,
      openFiles,
      selectedText,
      gitBranch,
      onlineUsers
    });
  }, [currentFile, openFiles, selectedText, gitBranch, onlineUsers]);

  // Handle UE5 command execution
  const handleUE5Command = useCallback(async (action: string, data: any) => {
    try {
      switch (action) {
        case 'spawn_actor':
          if (data.location) {
            const loc = ue5Api.parseLocation(data.location);
            await ue5Api.spawnActor(data.actorClass, loc, undefined, undefined, data.actorClass);
          }
          break;

        case 'delete_actor':
          await ue5Api.deleteActor(data.actorName);
          break;

        case 'select_actor':
          await ue5Api.selectActor(data.actorName);
          break;

        case 'move_actor':
          if (data.location) {
            const loc = ue5Api.parseLocation(data.location);
            await ue5Api.setActorTransform(data.actorName, loc);
          }
          break;

        case 'rotate_actor':
          if (data.rotation) {
            const rot = ue5Api.parseRotation(data.rotation);
            await ue5Api.setActorTransform(data.actorName, undefined, rot);
          }
          break;

        case 'scale_actor':
          if (data.scale) {
            const scl = ue5Api.parseScale(data.scale);
            await ue5Api.setActorTransform(data.actorName, undefined, undefined, scl);
          }
          break;

        case 'get_selected':
          await ue5Api.getSelectedActors();
          break;

        case 'save_level':
          await ue5Api.saveLevel();
          break;

        case 'play_in_editor':
          await ue5Api.playInEditor();
          break;

        case 'stop_play':
          await ue5Api.stopPlay();
          break;

        case 'undo':
          await ue5Api.undo();
          break;

        case 'redo':
          await ue5Api.redo();
          break;

        case 'take_screenshot':
          await ue5Api.takeScreenshot();
          break;

        case 'set_time_of_day':
          if (data.time !== undefined) {
            await ue5Api.setTimeOfDay(parseFloat(data.time));
          }
          break;

        case 'play_animation':
          await ue5Api.playAnimation(data.actorName, data.animationName);
          break;

        case 'stop_animation':
          await ue5Api.stopAnimation(data.actorName);
          break;

        default:
          console.log('UE5 command not implemented:', action, data);
      }
    } catch (error) {
      console.error('UE5 command execution failed:', error);
      throw error;
    }
  }, []);

  // Handle command execution
  const handleCommandExecuted = useCallback(async (command: ParsedCommand, _result: any) => {
    try {
      // Execute command through action executor
      const result = await actionExecutor.execute(command);

      if (!result.success) {
        console.error('Command execution failed:', result.message);
        return;
      }

      // Route command to appropriate handler based on action
      const action = result.data?.action;
      const params = command.params;

      // Check if it's a UE5 command
      if (action && action.includes('actor') || action.includes('level') || action.includes('animation') || 
          action.includes('material') || action.includes('blueprint') || action.includes('component')) {
        await handleUE5Command(action, result.data);
        return;
      }

      // Handle non-UE5 commands
      switch (action) {
        // File commands
        case 'open':
          if (onFileOpen && params.filename) {
            onFileOpen(params.filename);
          }
          break;

        case 'save':
          if (onFileSave) {
            onFileSave();
          }
          break;

        case 'close':
          if (onFileClose) {
            onFileClose(params.filename);
          }
          break;

        case 'create':
          if (onFileCreate && params.filename) {
            onFileCreate(params.filename);
          }
          break;

        // Navigation commands
        case 'goto_line':
          if (onGotoLine && params.line) {
            onGotoLine(parseInt(params.line));
          }
          break;

        case 'find':
          if (onFind && params.text) {
            onFind(params.text);
          }
          break;

        case 'show_panel':
          if (onShowPanel && params.panel) {
            onShowPanel(params.panel);
          }
          break;

        // Git commands
        case 'commit':
          if (onGitCommit && result.data?.message) {
            onGitCommit(result.data.message);
          }
          break;

        case 'push':
          if (onGitPush) {
            onGitPush();
          }
          break;

        case 'pull':
          if (onGitPull) {
            onGitPull();
          }
          break;

        case 'status':
          if (onGitStatus) {
            onGitStatus();
          }
          break;

        // AI commands
        case 'explain':
          if (onAIExplain && result.data?.target) {
            onAIExplain(result.data.target);
          }
          break;

        case 'generate':
          if (onAIGenerate && result.data?.description) {
            onAIGenerate(result.data.description);
          }
          break;

        case 'fix':
          if (onAIFix && result.data?.target) {
            onAIFix(result.data.target);
          }
          break;

        // Collaboration commands
        case 'lock':
          if (onLockFile && result.data?.filename) {
            onLockFile(result.data.filename);
          }
          break;

        case 'unlock':
          if (onUnlockFile && result.data?.filename) {
            onUnlockFile(result.data.filename);
          }
          break;

        case 'show_users':
          if (onShowUsers) {
            onShowUsers();
          }
          break;

        default:
          console.log('Command executed:', action, result);
      }
    } catch (error) {
      console.error('Error executing command:', error);
    }
  }, [
    handleUE5Command,
    onFileOpen,
    onFileSave,
    onFileClose,
    onFileCreate,
    onGotoLine,
    onFind,
    onShowPanel,
    onGitCommit,
    onGitPush,
    onGitPull,
    onGitStatus,
    onAIExplain,
    onAIGenerate,
    onAIFix,
    onLockFile,
    onUnlockFile,
    onShowUsers
  ]);

  // Handle errors
  const handleError = useCallback((error: string) => {
    console.error('Voice command error:', error);
  }, []);

  // Set up voice commands hook
  const voiceCommands = useVoiceCommands({
    enabled: true,
    hotkey: 'ctrl+shift+v',
    pushToTalk: false,
    autoStart: false,
    onCommandExecuted: handleCommandExecuted,
    onError: handleError
  });

  if (!showPanel) {
    return null;
  }

  return (
    <div className={className}>
      <VoiceControlPanel
        onCommandExecuted={handleCommandExecuted}
        onError={handleError}
      />
    </div>
  );
};
