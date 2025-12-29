# Quick-Start Guide: Follow Mode & Actor Locking

> **UE5 AI Agent Platform - Real-time Collaboration Features**

This guide will help you get started with two essential collaboration features: **Follow Mode** and **Actor Locking**. These features enable seamless teamwork when multiple users are working on the same UE5 project.

---

## Table of Contents

1. [Overview](#overview)
2. [Follow Mode](#follow-mode)
   - [What is Follow Mode?](#what-is-follow-mode)
   - [How to Use Follow Mode](#how-to-use-follow-mode)
   - [Voice Commands for Follow Mode](#voice-commands-for-follow-mode)
3. [Actor Locking](#actor-locking)
   - [What is Actor Locking?](#what-is-actor-locking)
   - [How to Lock an Actor](#how-to-lock-an-actor)
   - [How to Unlock an Actor](#how-to-unlock-an-actor)
   - [Voice Commands for Actor Locking](#voice-commands-for-actor-locking)
4. [Best Practices](#best-practices)
5. [Troubleshooting](#troubleshooting)

---

## Overview

The Real-time Collaboration panel is located at the bottom of the **AI Commands** tab in the UE5 Connection Hub. It displays:

- **Team members** currently in the session
- **Activity feed** showing recent actions
- **Team chat** for communication
- **Locked actors** indicator

![Collaboration Panel Location](https://placeholder.com/collaboration-panel.png)

---

## Follow Mode

### What is Follow Mode?

**Follow Mode** allows you to synchronize your viewport camera with a teammate's view. This is incredibly useful for:

- **Code reviews** - Watch as a teammate demonstrates their work
- **Training sessions** - Guide new team members through the project
- **Debugging** - See exactly what another user is seeing
- **Presentations** - Share your viewport during team meetings

When you follow someone, your camera automatically moves to match their position and rotation in real-time.

### How to Use Follow Mode

#### Starting Follow Mode (UI Method)

1. Navigate to the **AI Commands** tab in UE5 Connection Hub
2. Scroll down to the **Team Collaboration** panel
3. Find the team member you want to follow in the **Team** tab
4. Click the **👁️ Follow** button (eye icon) next to their name
5. Your viewport will now sync with theirs

#### Visual Indicators

When Follow Mode is active:
- A **purple border** appears around the followed user's avatar
- A **"Following [Name]"** banner appears at the top of your viewport
- The follow button changes to **"Stop Following"**

#### Stopping Follow Mode

To stop following a teammate:
- Click the **"Stop Following"** button next to their name
- Or click anywhere in your viewport to take manual control
- Or use the voice command "Stop following"

### Voice Commands for Follow Mode

| Voice Command | Action |
|---------------|--------|
| "Follow Sarah" | Start following user named Sarah |
| "Follow [name]" | Start following any team member by name |
| "Stop following" | Stop following the current user |
| "Who am I following" | Check who you're currently following |

**Example Usage:**
> 🎤 "Follow Sarah"
> 
> ✅ "Now following Sarah Chen's viewport"

---

## Actor Locking

### What is Actor Locking?

**Actor Locking** prevents multiple users from editing the same actor simultaneously, avoiding conflicts and accidental overwrites. When you lock an actor:

- Only you can modify the locked actor
- Other team members can view but not edit it
- A lock icon appears on the actor in the outliner
- The lock is visible to all team members

### How to Lock an Actor

#### Method 1: Using the UI

1. Select the actor(s) you want to lock in UE5
2. Go to the **Team Collaboration** panel
3. Click the **🔒 Lock Selection** button in the toolbar
4. The actor is now locked to you

#### Method 2: Using Voice Commands

1. Select the actor in UE5
2. Say **"Lock this actor"** or **"Lock selection"**
3. The system confirms the lock

#### Method 3: Right-Click Context Menu

1. Right-click on an actor in the Outliner
2. Select **"Lock for Editing"**
3. The actor is locked to you

### How to Unlock an Actor

#### Method 1: Using the UI

1. Go to the **Team Collaboration** panel
2. Click the **"X Locked Actors"** button to see all locks
3. Find your locked actor in the list
4. Click the **🔓 Unlock** button

#### Method 2: Using Voice Commands

Say **"Unlock actor"** or **"Unlock selection"**

#### Method 3: Automatic Unlock

Locks are automatically released when:
- You leave the collaboration session
- You disconnect from the server
- The session ends

### Voice Commands for Actor Locking

| Voice Command | Action |
|---------------|--------|
| "Lock this actor" | Lock the currently selected actor |
| "Lock selection" | Lock all selected actors |
| "Unlock actor" | Unlock your locked actor |
| "Unlock selection" | Unlock all your locked actors |
| "Show locked actors" | Display list of all locked actors |
| "Who locked [actor name]" | Check who locked a specific actor |

**Example Usage:**
> 🎤 "Lock this actor"
> 
> ✅ "BP_Player is now locked. Only you can edit it."

---

## Best Practices

### Follow Mode Best Practices

| ✅ Do | ❌ Don't |
|-------|----------|
| Ask permission before following someone | Follow without notice during focused work |
| Use for training and demonstrations | Leave follow mode on indefinitely |
| Communicate via chat while following | Make changes while following |
| Stop following when done | Assume the other person knows you're following |

### Actor Locking Best Practices

| ✅ Do | ❌ Don't |
|-------|----------|
| Lock only what you're actively editing | Lock entire levels or large groups |
| Unlock when you're done editing | Keep actors locked during breaks |
| Communicate lock intentions in chat | Lock actors others are waiting for |
| Check locked actors before starting work | Ignore lock notifications |

### Communication Tips

1. **Announce your intentions** in team chat before locking critical actors
2. **Use the activity feed** to stay aware of team actions
3. **Set your status** (Online/Away/Busy) to help teammates know your availability
4. **Request locks politely** if someone has what you need locked

---

## Troubleshooting

### Follow Mode Issues

| Problem | Solution |
|---------|----------|
| Can't find Follow button | Ensure the user is online (green status indicator) |
| Viewport not syncing | Check your network connection; try stopping and restarting follow |
| Following causes lag | The followed user may have a complex scene; ask them to simplify the view |
| Lost follow connection | The user may have gone offline; check their status |

### Actor Locking Issues

| Problem | Solution |
|---------|----------|
| Can't lock an actor | Another user may already have it locked; check the Locked Actors list |
| Lock not releasing | Try manually unlocking via the UI; if stuck, refresh the page |
| Can't edit a locked actor | Verify you're the one who locked it; check the lock owner in the list |
| Lock icon not showing | Refresh the outliner or reconnect to the session |

### General Troubleshooting

1. **Refresh the page** if collaboration features stop responding
2. **Check your connection** status in the header (should show "Connected")
3. **Rejoin the session** if you experience persistent issues
4. **Contact support** if problems continue

---

## Quick Reference Card

### Follow Mode Shortcuts

```
Voice: "Follow [name]"     → Start following
Voice: "Stop following"    → Stop following
UI:    Click 👁️ button    → Toggle follow
```

### Actor Locking Shortcuts

```
Voice: "Lock this actor"   → Lock selection
Voice: "Unlock actor"      → Unlock selection
UI:    Click 🔒 button     → Lock selected
UI:    Click 🔓 button     → Unlock actor
```

### Status Indicators

```
🟢 Online    → Available for collaboration
🟡 Away      → Temporarily unavailable
🔴 Busy      → Do not disturb
⚫ Offline   → Not connected
🔒 Locked    → Actor is locked for editing
```

---

## Need Help?

- **In-app Help**: Click the **Help** tab in UE5 Connection Hub
- **Voice Command**: Say **"Help with collaboration"**
- **Documentation**: Visit our full documentation at `/docs`
- **Support**: Contact support@ue5-ai-studio.com

---

*Last updated: December 2024*
*UE5 AI Agent Platform v1.0*
