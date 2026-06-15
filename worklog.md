---
Task ID: 1
Agent: Main Agent
Task: Review and perfect AI agents (Orion, Atlas, Sara) implementation in Academia Helm

Work Log:
- Explored entire project structure to find all AI agent related files
- Identified 2 api-server versions: primary (api-server/) and enhanced (apps/api-server/)
- Found critical bug: orion-intelligence.service.ts had wrong relative import paths (../ instead of ../../)
- Fixed import paths in apps/api-server/src/orion/services/orion-intelligence.service.ts
- Fixed Vercel OOM build error by increasing heap from 3072MB to 6144MB
- Enhanced SARA in primary api-server with comprehensive Closer Senior #1 system prompt
- Enhanced SARA in apps/api-server with same professional closer capabilities
- Enhanced ATLAS in primary api-server with detailed execution engine prompt
- Enhanced AI Gateway prompts for all 3 agents with structured sections
- Enhanced SaraWidget on web app landing page with conversation history, quick suggestions, better UX
- Updated Sara API client to support conversation history and in-app guide endpoint
- Removed redundant PrismaService from AtlasModule (it's global via DatabaseModule)

Stage Summary:
- Fixed critical deployment crash (wrong import paths causing MODULE_NOT_FOUND)
- Fixed Vercel OOM by increasing Node.js heap from 3GB to 6GB
- SARA now has comprehensive Closer Senior #1 prompts with closing techniques, pricing, product knowledge
- ATLAS now has detailed execution capabilities with document types and workflows
- ORION system prompt enhanced with structured analysis domains
- AI Gateway prompts completely rewritten with structured sections for all 3 agents
- SaraWidget enhanced with quick suggestions, conversation history, better animations
- Ready for commit and push
