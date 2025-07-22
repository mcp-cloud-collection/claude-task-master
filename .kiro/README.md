# Kiro Hooks for Taskmaster Integration

This directory contains Kiro Agent Hooks that automate Taskmaster workflows using natural language prompts.

## What are Kiro Hooks?

Kiro hooks are automated workflows that trigger when specific events occur in your IDE:
- **File Save**: When you save a file
- **File Create**: When you create a new file  
- **File Delete**: When you delete a file
- **Manual**: When you explicitly run them

Each hook sends a natural language prompt to Kiro's AI agent, which then executes the requested actions.

## Installation

1. **Install Kiro IDE** from [kiro.dev](https://kiro.dev)
2. **Open your Taskmaster project** in Kiro
3. **Hooks are automatically loaded** from `.kiro/hooks/*.kiro.hook` files
   - They appear in Kiro's Agent Hooks panel
   - Enable/disable hooks as needed for your workflow

## Philosophy: Hook-Driven Task Management

Traditional task management requires manual status updates - you complete work, then remember to mark tasks done. Taskmaster's Kiro hooks flip this model:

**Old Way**: Code → Test → Remember to update task → Mark as done → Check dependencies → Start next task

**Hook Way**: Code → Test → Hooks detect completion → Auto-update → Auto-progress

This creates a truly autonomous workflow where task management happens naturally as you work!

## Available Hooks

### 🔄 [TM] Task Dependency Auto-Progression
- **File**: `tm-task-dependency-auto-progression.kiro.hook`
- **Trigger**: Save `.taskmaster/tasks/tasks.json`
- **Action**: Automatically starts tasks when their dependencies are completed
- **Use**: Just mark a task as done - dependent tasks start automatically!

### 📝 [TM] Code Change Task Tracker  
- **File**: `tm-code-change-task-tracker.kiro.hook`
- **Trigger**: Save any source code file
- **Action**: Updates in-progress tasks with implementation notes
- **Use**: Your progress is automatically tracked as you code

### ✅ [TM] Test Success Task Completer
- **File**: `tm-test-success-task-completer.kiro.hook`
- **Trigger**: Save test files
- **Action**: Suggests marking tasks as done when tests pass
- **Use**: Complete tasks by making tests green - no manual status updates!

### 🏗️ [TM] New File Boilerplate
- **File**: `tm-new-file-boilerplate.kiro.hook`
- **Trigger**: Create new source file
- **Action**: Generates language-appropriate boilerplate and links to relevant task
- **Use**: Smart scaffolding for any programming language

### ☀️ [TM] Daily Standup Assistant
- **File**: `tm-daily-standup-assistant.kiro.hook`
- **Trigger**: Manual (userTriggered)
- **Action**: Shows completed, in-progress, and suggested next tasks
- **Use**: Run each morning for a personalized standup

### 🚀 [TM] PR Readiness Checker
- **File**: `tm-pr-readiness-checker.kiro.hook`
- **Trigger**: Manual (userTriggered)
- **Action**: Validates all tasks are complete before PR
- **Use**: Run before creating pull requests

### 🧹 [TM] Import Cleanup on Delete
- **File**: `tm-import-cleanup-on-delete.kiro.hook`
- **Trigger**: Delete a source file
- **Action**: Removes/comments related imports automatically
- **Use**: Keep codebase clean when refactoring

### 📊 [TM] Complexity Analyzer
- **File**: `tm-complexity-analyzer.kiro.hook`
- **Trigger**: Save tasks.json (disabled by default)
- **Action**: Auto-expands complex tasks into subtasks
- **Use**: Enable for automatic task breakdown

### 🔗 [TM] Git Commit Task Linker
- **File**: `tm-git-commit-task-linker.kiro.hook`
- **Trigger**: Manual (userTriggered)
- **Action**: Links commits to tasks and generates messages
- **Use**: Maintain task-commit traceability

## Creating Custom Hooks

1. Open Kiro's Agent Hooks panel
2. Click "+" to create a new hook
3. Write your prompt in natural language, for example:

```
When I save a markdown file in the docs folder, check if any 
tasks mention documentation updates. If so, add a note to those 
tasks saying which doc was updated and mark any documentation 
tasks as complete if appropriate.
```

## Best Practices

1. **Start Simple**: Begin with one or two hooks and expand gradually
2. **Test First**: Test hooks on a feature branch before enabling globally
3. **Be Specific**: Clear, detailed prompts give better results
4. **Use Task IDs**: Reference specific task IDs in your prompts when possible
5. **Safety First**: Always include safety checks for destructive operations

## Hook Configuration

Each `.kiro.hook` file contains:
- `name`: Display name in Kiro
- `description`: What the hook does
- `version`: Hook format version
- `enabled`: Whether it's active
- `when`: Trigger configuration
  - `type`: `fileEdited`, `fileCreated`, `fileDeleted`, or `manual`
  - `patterns`: File glob patterns (for file-based triggers)
- `then`: Action configuration
  - `type`: `askAgent` (sends prompt to AI)
  - `prompt`: Natural language instructions for the AI

## Customization

To customize a hook:
1. Open the Agent Hooks panel in Kiro
2. Select the hook to edit
3. Modify the prompt to match your workflow
4. Save and test the changes

## Team Sharing

Share hooks with your team:
1. Commit the `.kiro/hooks/` directory to version control
2. Team members pull the changes
3. Hooks are automatically available in their Kiro IDE

## Troubleshooting

- **Hook not triggering?** Check file patterns match your files
- **Unexpected behavior?** Review and clarify the prompt
- **Performance issues?** Disable resource-intensive hooks
- **Need help?** Check Kiro docs at [kiro.dev/docs/hooks](https://kiro.dev/docs/hooks)

## Examples in Action

### Example 1: Auto-progression
```
1. You complete Task 1: "Set up database schema"
2. Save tasks.json with status: "done"
3. Hook detects Task 2 "Create API endpoints" depends only on Task 1
4. Automatically runs: tm set-status --id=2 --status=in-progress
5. You get a notification: "Task 2 is ready to start!"
```

### Example 2: Progress Tracking
```
1. You're working on Task 3: "Implement user authentication"
2. You save src/auth/login.js
3. Hook detects the in-progress task
4. Automatically adds note: "Implemented login functionality in auth/login.js"
5. Your task history is maintained automatically
```

## Integration with Taskmaster

These hooks use Taskmaster CLI commands:
- `tm list` - List tasks
- `tm next` - Get next task
- `tm set-status` - Update task status
- `tm update-task` - Add task notes
- `tm analyze-complexity` - Check task complexity

Make sure Taskmaster CLI is installed and accessible in your terminal.

## Next Steps

1. Enable the hooks that match your workflow
2. Run the Daily Standup Assistant to see your tasks
3. Start coding and watch the automation work!
4. Create custom hooks for your specific needs
5. Share successful hooks with your team

Happy automating! 🚀