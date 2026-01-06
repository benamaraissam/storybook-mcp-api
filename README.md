# Storybook MCP API

**Unified Storybook server with REST API + MCP protocol on a single port**

Access your Storybook stories via REST API endpoints or MCP (Model Context Protocol) for AI assistants - all from one server!

## Features

- 🚀 **Single Port** - REST API and MCP on the same server
- 📚 **REST API** - `/api/*` endpoints for HTTP clients
- 🤖 **MCP Protocol** - `/mcp` for AI assistant integration
- 🔄 **SSE Support** - `/mcp/sse` for Server-Sent Events transport
- 📖 **Full Documentation** - Component docs, code examples, usage snippets
- 🎯 **Framework Support** - Angular, React, Vue, Svelte, Web Components
- 📦 **Storybook 8/9/10** - Works with latest Storybook versions

## Installation

```bash
npm install storybook-mcp-api
```

## Quick Start

```bash
# In your Storybook project directory
npx storybook-mcp-api

# Or with options
npx storybook-mcp-api --port 6006
```

## Endpoints

### REST API

| Endpoint | Description |
|----------|-------------|
| `GET /api` | API documentation |
| `GET /api/stories` | List all stories |
| `GET /api/stories/:storyId` | Get story details |
| `GET /api/docs/:storyId` | Get full documentation |
| `GET /api/stories/kind/:kind` | Filter by category |

### MCP Protocol

| Endpoint | Transport | Description |
|----------|-----------|-------------|
| `GET /mcp` | - | Server info |
| `POST /mcp` | HTTP Stream | JSON-RPC requests |
| `GET /mcp/sse` | SSE | Server-Sent Events |
| `GET /sse` | SSE | Alias for /mcp/sse |

### MCP Tools

- **list_stories** - List all available stories
- **get_story** - Get story details
- **get_story_docs** - Get full documentation with code examples

## Usage Examples

### REST API

```bash
# List all stories
curl http://localhost:6006/api/stories

# Get story details
curl http://localhost:6006/api/stories/example-button--primary

# Get documentation
curl http://localhost:6006/api/docs/example-button--docs
```

### MCP Protocol (HTTP Stream)

```bash
# Initialize
curl -X POST http://localhost:6006/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05"}}'

# List tools
curl -X POST http://localhost:6006/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}'

# Call tool
curl -X POST http://localhost:6006/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"list_stories","arguments":{}}}'
```

### Cursor IDE Configuration

Add to your Cursor MCP settings:

```json
{
  "mcpServers": {
    "storybook-mcp-api": {
      "url": "http://localhost:6006/sse"
    }
  }
}
```

## CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `-p, --port <number>` | Server port | `6006` |
| `-s, --storybook-port <number>` | Internal Storybook port | `6010` |
| `--no-proxy` | API only mode | - |
| `--storybook-url <url>` | External Storybook URL | - |
| `-d, --dir <path>` | Project directory | Current dir |

## Programmatic Usage

```javascript
const { createApp, startServer } = require('storybook-mcp-api');

const config = {
  port: 6006,
  storybookPort: 6010,
  storybookUrl: 'http://localhost:6010',
  projectDir: process.cwd(),
  proxy: true,
};

startServer(config);
```

## License

MIT

