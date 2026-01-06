#!/usr/bin/env node

/**
 * Storybook MCP API CLI
 * 
 * Unified server with REST API + MCP protocol on a single port
 * 
 * Usage:
 *   npx storybook-mcp-api [options]
 *   npx storybook-mcp-api --port 6006
 */

const { Command } = require('commander');
const chalk = require('chalk');
const { startServer } = require('./server');
const { detectStorybookVersion, findStorybookConfig, detectFramework } = require('./utils');

const program = new Command();

program
  .name('storybook-mcp-api')
  .description('Unified Storybook server with REST API + MCP protocol on a single port')
  .version('1.0.0')
  .option('-p, --port <number>', 'Port to run the server on', '6006')
  .option('-s, --storybook-port <number>', 'Internal port for Storybook', '6010')
  .option('--no-proxy', 'Run API only (don\'t start/proxy Storybook)')
  .option('--storybook-url <url>', 'URL of running Storybook instance')
  .option('-d, --dir <path>', 'Project directory (default: current directory)', process.cwd())
  .action(async (options) => {
    console.log('');
    console.log(chalk.magenta('╔═══════════════════════════════════════════════════════════╗'));
    console.log(chalk.magenta('║') + chalk.bold.white('        Storybook MCP API Server                          ') + chalk.magenta('║'));
    console.log(chalk.magenta('║') + chalk.dim('        REST API + MCP Protocol • Single Port             ') + chalk.magenta('║'));
    console.log(chalk.magenta('╚═══════════════════════════════════════════════════════════╝'));
    console.log('');

    const projectDir = options.dir;
    
    // Detect Storybook version
    const version = detectStorybookVersion(projectDir);
    if (version) {
      console.log(chalk.green('✓') + ` Detected Storybook version: ${chalk.bold(version)}`);
    } else {
      console.log(chalk.yellow('⚠') + ' Could not detect Storybook version');
    }

    // Detect framework
    const framework = detectFramework(projectDir);
    if (framework !== 'unknown') {
      console.log(chalk.green('✓') + ` Detected framework: ${chalk.bold(framework)}`);
    } else {
      console.log(chalk.yellow('⚠') + ' Could not detect framework');
    }

    // Find Storybook config
    const configDir = findStorybookConfig(projectDir);
    if (configDir) {
      console.log(chalk.green('✓') + ` Found Storybook config: ${chalk.dim(configDir)}`);
    } else {
      console.log(chalk.yellow('⚠') + ' Could not find .storybook directory');
    }

    const port = parseInt(options.port, 10);
    console.log('');
    console.log(chalk.blue('→') + ` Server will run on port ${chalk.bold(port)}`);
    console.log(chalk.dim(`  • REST API:  /api/*`));
    console.log(chalk.dim(`  • MCP HTTP:  /mcp`));
    console.log(chalk.dim(`  • MCP SSE:   /mcp/sse or /sse`));

    const config = {
      port,
      storybookPort: parseInt(options.storybookPort, 10),
      storybookUrl: options.storybookUrl || `http://localhost:${options.storybookPort}`,
      projectDir,
      configDir,
      proxy: options.proxy !== false,
      version,
      framework,
    };

    try {
      await startServer(config);
    } catch (error) {
      console.error(chalk.red('Error starting server:'), error.message);
      process.exit(1);
    }
  });

program.parse();

