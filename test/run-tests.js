#!/usr/bin/env node

/**
 * Test suite for Storybook MCP API
 * 
 * Tests both REST API and MCP protocol endpoints
 */

const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const TEST_PORT = 6099;
const BASE_URL = `http://localhost:${TEST_PORT}`;

// Test results tracking
let passed = 0;
let failed = 0;
const results = [];

/**
 * Make HTTP request
 */
function request(options) {
  return new Promise((resolve, reject) => {
    const url = new URL(options.path, BASE_URL);
    const reqOptions = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    };

    const req = http.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null,
            raw: data,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: null,
            raw: data,
          });
        }
      });
    });

    req.on('error', reject);

    if (options.body) {
      req.write(JSON.stringify(options.body));
    }

    req.end();
  });
}

/**
 * Test assertion helper
 */
function test(name, fn) {
  return async () => {
    try {
      await fn();
      passed++;
      results.push({ name, status: 'PASS' });
      console.log(`  ✓ ${name}`);
    } catch (error) {
      failed++;
      results.push({ name, status: 'FAIL', error: error.message });
      console.log(`  ✗ ${name}`);
      console.log(`    Error: ${error.message}`);
    }
  };
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(message || `Expected ${expected}, got ${actual}`);
  }
}

function assertContains(obj, key, message) {
  if (!(key in obj)) {
    throw new Error(message || `Expected object to contain key "${key}"`);
  }
}

// ============================================
// REST API Tests
// ============================================

const restTests = [
  test('GET /api returns documentation', async () => {
    const res = await request({ path: '/api' });
    assertEqual(res.status, 200, 'Status should be 200');
    assert(res.body.success, 'Response should have success: true');
    assertEqual(res.body.name, 'Storybook MCP API', 'Should return correct name');
    assertContains(res.body, 'endpoints', 'Should have endpoints');
    assertContains(res.body.endpoints, 'rest', 'Should have REST endpoints');
    assertContains(res.body.endpoints, 'mcp', 'Should have MCP endpoints');
  }),

  test('GET /api/stories returns stories list', async () => {
    const res = await request({ path: '/api/stories' });
    // May return 503 if Storybook not running, that's OK for this test
    assert(res.status === 200 || res.status === 503, 'Status should be 200 or 503');
    assertContains(res.body, 'success', 'Should have success field');
  }),

  test('GET /api/stories/:storyId handles missing story', async () => {
    const res = await request({ path: '/api/stories/non-existent-story' });
    // Either 404 (not found) or 503 (Storybook not ready)
    assert(res.status === 404 || res.status === 503, 'Status should be 404 or 503');
  }),

  test('GET /api/docs/:storyId handles missing story', async () => {
    const res = await request({ path: '/api/docs/non-existent-story' });
    assert(res.status === 404 || res.status === 503, 'Status should be 404 or 503');
  }),
];

// ============================================
// MCP Protocol Tests
// ============================================

const mcpTests = [
  test('GET /mcp returns server info', async () => {
    const res = await request({ path: '/mcp' });
    assertEqual(res.status, 200, 'Status should be 200');
    assertEqual(res.body.name, 'storybook-mcp-api', 'Should return correct name');
    assertContains(res.body, 'protocolVersion', 'Should have protocol version');
    assertContains(res.body, 'tools', 'Should have tools list');
    assertContains(res.body, 'transports', 'Should have transports info');
  }),

  test('POST /mcp initialize request', async () => {
    const res = await request({
      path: '/mcp',
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: {},
          clientInfo: { name: 'test', version: '1.0.0' },
        },
      },
    });
    assertEqual(res.status, 200, 'Status should be 200');
    assertEqual(res.body.jsonrpc, '2.0', 'Should be JSON-RPC 2.0');
    assertEqual(res.body.id, 1, 'Should echo request ID');
    assertContains(res.body, 'result', 'Should have result');
    assertContains(res.body.result, 'capabilities', 'Should have capabilities');
    assertContains(res.body.result, 'serverInfo', 'Should have serverInfo');
  }),

  test('POST /mcp tools/list request', async () => {
    const res = await request({
      path: '/mcp',
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/list',
      },
    });
    assertEqual(res.status, 200, 'Status should be 200');
    assertContains(res.body, 'result', 'Should have result');
    assertContains(res.body.result, 'tools', 'Should have tools array');
    assert(Array.isArray(res.body.result.tools), 'Tools should be array');
    assert(res.body.result.tools.length >= 3, 'Should have at least 3 tools');
    
    const toolNames = res.body.result.tools.map(t => t.name);
    assert(toolNames.includes('list_stories'), 'Should have list_stories tool');
    assert(toolNames.includes('get_story'), 'Should have get_story tool');
    assert(toolNames.includes('get_story_docs'), 'Should have get_story_docs tool');
  }),

  test('POST /mcp tools/call list_stories', async () => {
    const res = await request({
      path: '/mcp',
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: {
          name: 'list_stories',
          arguments: {},
        },
      },
    });
    assertEqual(res.status, 200, 'Status should be 200');
    assertContains(res.body, 'result', 'Should have result');
    assertContains(res.body.result, 'content', 'Should have content');
    assert(Array.isArray(res.body.result.content), 'Content should be array');
    assertEqual(res.body.result.content[0].type, 'text', 'Content type should be text');
  }),

  test('POST /mcp resources/list request', async () => {
    const res = await request({
      path: '/mcp',
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: 4,
        method: 'resources/list',
      },
    });
    assertEqual(res.status, 200, 'Status should be 200');
    assertContains(res.body, 'result', 'Should have result');
    assertContains(res.body.result, 'resources', 'Should have resources array');
    assert(Array.isArray(res.body.result.resources), 'Resources should be array');
  }),

  test('POST /mcp ping request', async () => {
    const res = await request({
      path: '/mcp',
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: 5,
        method: 'ping',
      },
    });
    assertEqual(res.status, 200, 'Status should be 200');
    assertContains(res.body, 'result', 'Should have result');
  }),

  test('POST /mcp unknown method returns error', async () => {
    const res = await request({
      path: '/mcp',
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: 6,
        method: 'unknown/method',
      },
    });
    assertEqual(res.status, 200, 'Status should be 200');
    assertContains(res.body, 'error', 'Should have error');
    assertEqual(res.body.error.code, -32601, 'Should be method not found error');
  }),

  test('POST /mcp tools/call unknown tool returns error', async () => {
    const res = await request({
      path: '/mcp',
      method: 'POST',
      body: {
        jsonrpc: '2.0',
        id: 7,
        method: 'tools/call',
        params: {
          name: 'unknown_tool',
          arguments: {},
        },
      },
    });
    assertEqual(res.status, 200, 'Status should be 200');
    assertContains(res.body, 'error', 'Should have error');
  }),
];

// ============================================
// SSE Transport Tests
// ============================================

const sseTests = [
  test('GET /sse redirects to /mcp/sse', async () => {
    const res = await request({ path: '/sse' });
    // Express redirect returns 302
    assert(res.status === 302 || res.status === 200, 'Should redirect or serve SSE');
  }),

  test('GET /mcp/sse returns SSE stream', async () => {
    return new Promise((resolve, reject) => {
      const url = new URL('/mcp/sse', BASE_URL);
      const req = http.get(url, (res) => {
        assertEqual(res.statusCode, 200, 'Status should be 200');
        assertEqual(res.headers['content-type'], 'text/event-stream', 'Should be event-stream');
        
        let data = '';
        res.on('data', chunk => {
          data += chunk.toString();
          // Check for endpoint event
          if (data.includes('event: endpoint')) {
            req.destroy();
            resolve();
          }
        });

        // Timeout after 2 seconds
        setTimeout(() => {
          req.destroy();
          if (data.includes('event: endpoint')) {
            resolve();
          } else {
            reject(new Error('Did not receive endpoint event'));
          }
        }, 2000);
      });

      req.on('error', (err) => {
        if (err.code !== 'ECONNRESET') {
          reject(err);
        }
      });
    });
  }),
];

// ============================================
// Run Tests
// ============================================

async function runTests() {
  console.log('\n🧪 Storybook MCP API Test Suite\n');
  console.log('='.repeat(50));

  // Start the server
  console.log('\n📦 Starting test server...\n');
  
  const serverProcess = spawn('node', [
    path.join(__dirname, '..', 'src', 'cli.js'),
    '--port', TEST_PORT.toString(),
    '--no-proxy',
    '--storybook-url', 'http://localhost:6010',
  ], {
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe',
  });

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    // Run REST API tests
    console.log('\n📡 REST API Tests\n');
    for (const testFn of restTests) {
      await testFn();
    }

    // Run MCP tests
    console.log('\n🤖 MCP Protocol Tests\n');
    for (const testFn of mcpTests) {
      await testFn();
    }

    // Run SSE tests
    console.log('\n🔄 SSE Transport Tests\n');
    for (const testFn of sseTests) {
      await testFn();
    }

  } finally {
    // Stop the server
    serverProcess.kill();
  }

  // Print summary
  console.log('\n' + '='.repeat(50));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);

  if (failed > 0) {
    console.log('Failed tests:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  - ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    console.log('✅ All tests passed!\n');
    process.exit(0);
  }
}

runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});

