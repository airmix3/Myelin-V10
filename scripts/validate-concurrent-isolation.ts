/**
 * Validates concurrent MCP isolation per D-02.
 *
 * Creates two MCP servers with different ToolContexts (CTO vs CMO),
 * writes memory concurrently via the closure-bound tools, reads back,
 * and verifies each agent's memory is isolated.
 *
 * Run: npx tsx scripts/validate-concurrent-isolation.ts
 */
import { buildMyelinMcpServer } from '../src/lib/mcp/server';
import { createToolContext } from '../src/lib/mcp/tool-context';
import { mkdirSync, rmSync, readFileSync } from 'fs';
import { resolve } from 'path';

// Ensure clean test directories
const dataDir = resolve(process.cwd(), 'data', 'agents');
const ctoDirPath = resolve(dataDir, 'test-cto');
const cmoDirPath = resolve(dataDir, 'test-cmo');

async function cleanup() {
  try { rmSync(ctoDirPath, { recursive: true, force: true }); } catch { /* ignore */ }
  try { rmSync(cmoDirPath, { recursive: true, force: true }); } catch { /* ignore */ }
}

async function main() {
  await cleanup();
  mkdirSync(ctoDirPath, { recursive: true });
  mkdirSync(cmoDirPath, { recursive: true });

  console.log('=== D-02: Concurrent MCP Isolation Validation ===\n');

  // Create two distinct ToolContexts
  const ctxCTO = createToolContext({
    taskId: 'test-task-cto',
    agentId: 'test-cto',
    department: 'tech',
    deskDir: '/tmp/test-desk-cto',
    delivDir: '/tmp/test-deliv-cto',
    manifestPath: '/tmp/test-deliv-cto/deliverable_manifest.json',
  });

  const ctxCMO = createToolContext({
    taskId: 'test-task-cmo',
    agentId: 'test-cmo',
    department: 'marketing',
    deskDir: '/tmp/test-desk-cmo',
    delivDir: '/tmp/test-deliv-cmo',
    manifestPath: '/tmp/test-deliv-cmo/deliverable_manifest.json',
  });

  // Create two MCP servers with different contexts
  const serverA = buildMyelinMcpServer(ctxCTO);
  const serverB = buildMyelinMcpServer(ctxCMO);

  console.log('1. Created two MCP servers with distinct ToolContexts');
  console.log(`   Server A: agentId=test-cto, department=tech`);
  console.log(`   Server B: agentId=test-cmo, department=marketing`);

  // Extract tool handlers from the server instances
  // The McpServer instance is on the _serverInstance property
  const mcpA = serverA._serverInstance;
  const mcpB = serverB._serverInstance;

  // Access the registered tools -- MCP SDK stores them internally
  // We'll call tools via the tool handlers directly by invoking the server's callTool method
  // But since we can't easily call through the MCP protocol without a client,
  // let's verify isolation through the filesystem approach:
  // Each server's tools close over a different ctx, so write_memory writes to different paths.

  // Test: Write memory concurrently via both contexts
  const ctoMemPath = resolve(dataDir, 'test-cto', 'MEMORY.md');
  const cmoMemPath = resolve(dataDir, 'test-cmo', 'MEMORY.md');

  // Since we can't directly call MCP tool handlers through the server protocol easily,
  // let's verify the core isolation mechanism: the ToolContext closure.
  // The key question is whether two createMemoryTools(ctx) calls with different ctx
  // produce independent handlers that write to different paths.

  // Import the tools directly to test closure isolation
  const { createMemoryTools } = await import('../src/lib/mcp/tools/memory');

  const toolsCTO = createMemoryTools(ctxCTO);
  const toolsCMO = createMemoryTools(ctxCMO);

  // Extract write_memory and read_memory handlers
  // tool() returns SdkMcpToolDefinition objects with a .handler property
  const writeMemCTO = (toolsCTO[1] as { handler: (args: { content: string }, extra: unknown) => Promise<{ content: Array<{ type: string; text: string }> }> }).handler;
  const writeMemCMO = (toolsCMO[1] as { handler: (args: { content: string }, extra: unknown) => Promise<{ content: Array<{ type: string; text: string }> }> }).handler;
  const readMemCTO = (toolsCTO[0] as { handler: (args: Record<string, never>, extra: unknown) => Promise<{ content: Array<{ type: string; text: string }> }> }).handler;
  const readMemCMO = (toolsCMO[0] as { handler: (args: Record<string, never>, extra: unknown) => Promise<{ content: Array<{ type: string; text: string }> }> }).handler;

  console.log('\n2. Writing memory concurrently (Promise.all)...');

  // Write concurrently
  await Promise.all([
    writeMemCTO({ content: '# CTO Memory\n\nThis is CTO-specific data. Task: test-task-cto' }, {}),
    writeMemCMO({ content: '# CMO Memory\n\nThis is CMO-specific data. Task: test-task-cmo' }, {}),
  ]);

  console.log('   Both writes completed.');

  // Read back concurrently
  console.log('\n3. Reading memory concurrently (Promise.all)...');

  const [resultCTO, resultCMO] = await Promise.all([
    readMemCTO({} as Record<string, never>, {}),
    readMemCMO({} as Record<string, never>, {}),
  ]);

  const ctoContent = resultCTO.content[0].text;
  const cmoContent = resultCMO.content[0].text;

  console.log(`   CTO read: "${ctoContent.substring(0, 50)}..."`);
  console.log(`   CMO read: "${cmoContent.substring(0, 50)}..."`);

  // Validate isolation
  let passed = true;

  console.log('\n4. Validating isolation...');

  if (!ctoContent.includes('CTO-specific data')) {
    console.error('   FAIL: CTO memory does not contain CTO-specific data');
    passed = false;
  } else {
    console.log('   PASS: CTO memory contains CTO-specific data');
  }

  if (!cmoContent.includes('CMO-specific data')) {
    console.error('   FAIL: CMO memory does not contain CMO-specific data');
    passed = false;
  } else {
    console.log('   PASS: CMO memory contains CMO-specific data');
  }

  if (ctoContent.includes('CMO-specific data')) {
    console.error('   FAIL: CTO memory contains CMO data (leak!)');
    passed = false;
  } else {
    console.log('   PASS: CTO memory does NOT contain CMO data');
  }

  if (cmoContent.includes('CTO-specific data')) {
    console.error('   FAIL: CMO memory contains CTO data (leak!)');
    passed = false;
  } else {
    console.log('   PASS: CMO memory does NOT contain CTO data');
  }

  // Also verify at filesystem level
  const ctoFile = readFileSync(ctoMemPath, 'utf-8');
  const cmoFile = readFileSync(cmoMemPath, 'utf-8');

  if (ctoFile !== cmoFile) {
    console.log('   PASS: Filesystem files are distinct');
  } else {
    console.error('   FAIL: Filesystem files are identical (should be different)');
    passed = false;
  }

  // Verify servers are different objects
  if (serverA !== serverB) {
    console.log('   PASS: MCP server instances are distinct objects');
  } else {
    console.error('   FAIL: MCP server instances are the same object');
    passed = false;
  }

  console.log('\n' + '='.repeat(50));
  if (passed) {
    console.log('PASS: Concurrent isolation verified (D-02)');
    console.log('Two agents with independent ToolContexts produce isolated tool state.');
  } else {
    console.error('FAIL: Concurrent isolation BROKEN -- replanning required before Wave 3');
  }
  console.log('='.repeat(50));

  // Cleanup test data
  await cleanup();

  process.exit(passed ? 0 : 1);
}

main().catch(err => {
  console.error('Validation script failed:', err);
  process.exit(1);
});
