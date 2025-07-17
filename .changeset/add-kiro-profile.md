---
"task-master-ai": minor
---

feat: Add Kiro editor rule profile with comprehensive rule set and MCP config

- Add Kiro IDE integration leveraging base profile's default file mapping system
- Generate complete rule set: `kiro_rules.md`, `dev_workflow.md`, `self_improve.md`, `taskmaster.md`
- Support for `.kiro/steering/` directory structure for all rule files with `.md` extension
- Custom MCP configuration in `.kiro/settings/mcp.json` with `mcpServers` format
- Enhanced MCP format with inclusion patterns using `fileMatchPattern: "**/*"`
- Minimal lifecycle function for MCP config transformation and directory setup
- Comprehensive test coverage for Kiro profile functionality