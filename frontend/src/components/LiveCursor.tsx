/**
 * LiveCursor Component
 * Renders other users' cursors and selections in Monaco editor
 */
import React, { useEffect, useRef } from 'react';
import * as monaco from 'monaco-editor';
import { CursorUpdate } from '../lib/collaboration-api';

interface LiveCursorProps {
  editor: monaco.editor.IStandaloneCodeEditor | null;
  cursors: Map<number, CursorUpdate>;
  currentFileId: number | null;
}

export const LiveCursor: React.FC<LiveCursorProps> = ({
  editor,
  cursors,
  currentFileId,
}) => {
  const decorationsRef = useRef<Map<number, string[]>>(new Map());

  useEffect(() => {
    if (!editor) return;

    // Clear all decorations
    const clearDecorations = () => {
      decorationsRef.current.forEach((decorationIds) => {
        editor.deltaDecorations(decorationIds, []);
      });
      decorationsRef.current.clear();
    };

    // Update decorations for all cursors
    const updateDecorations = () => {
      const newDecorations = new Map<number, monaco.editor.IModelDeltaDecoration[]>();

      cursors.forEach((cursor, userId) => {
        if (!cursor.cursor_position) return;

        const decorations: monaco.editor.IModelDeltaDecoration[] = [];

        // Cursor decoration
        decorations.push({
          range: new monaco.Range(
            cursor.cursor_position.line,
            cursor.cursor_position.column,
            cursor.cursor_position.line,
            cursor.cursor_position.column
          ),
          options: {
            className: `live-cursor-${userId}`,
            stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
            beforeContentClassName: `live-cursor-caret`,
            hoverMessage: {
              value: `**${cursor.username}**`,
            },
          },
        });

        // Selection decoration
        if (cursor.selection) {
          decorations.push({
            range: new monaco.Range(
              cursor.selection.start.line,
              cursor.selection.start.column,
              cursor.selection.end.line,
              cursor.selection.end.column
            ),
            options: {
              className: `live-cursor-selection-${userId}`,
              stickiness: monaco.editor.TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
            },
          });
        }

        newDecorations.set(userId, decorations);
      });

      // Apply decorations
      newDecorations.forEach((decorations, userId) => {
        const oldDecorationIds = decorationsRef.current.get(userId) || [];
        const newDecorationIds = editor.deltaDecorations(oldDecorationIds, decorations);
        decorationsRef.current.set(userId, newDecorationIds);
      });

      // Remove decorations for users no longer present
      decorationsRef.current.forEach((decorationIds, userId) => {
        if (!newDecorations.has(userId)) {
          editor.deltaDecorations(decorationIds, []);
          decorationsRef.current.delete(userId);
        }
      });
    };

    // Inject CSS for cursor styles
    const injectStyles = () => {
      const styleId = 'live-cursor-styles';
      if (document.getElementById(styleId)) return;

      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = `
        /* Cursor caret */
        .live-cursor-caret {
          content: '';
          position: absolute;
          width: 2px;
          height: 1.2em;
          background-color: currentColor;
          animation: blink 1s step-end infinite;
        }

        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }

        /* Generate styles for each user */
        ${Array.from(cursors.entries())
          .map(
            ([userId, cursor]) => `
          .live-cursor-${userId} {
            color: ${cursor.color};
          }
          .live-cursor-selection-${userId} {
            background-color: ${cursor.color}33; /* 20% opacity */
          }
        `
          )
          .join('\n')}
      `;
      document.head.appendChild(style);
    };

    injectStyles();
    updateDecorations();

    // Cleanup
    return () => {
      clearDecorations();
    };
  }, [editor, cursors, currentFileId]);

  return null; // This component doesn't render anything directly
};

export default LiveCursor;
