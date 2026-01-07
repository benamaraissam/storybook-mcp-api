#!/usr/bin/env node

/**
 * Storybook MCP API CLI
 * 
 * Unified server with REST API + MCP protocol on a single port
 * 
 * Usage:
 *   npx storybook-mcp-api [options]
 *   npx storybook-mcp-api --port 6006
 *   npx storybook-mcp-api --static ./storybook-static  # Production mode
 */

const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');
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
  .option('--static <path>', 'Serve a pre-built Storybook directory (production mode)')
  .option('-d, --dir <path>', 'Project directory (default: current directory)', process.cwd())
  .action(async (options) => {
    console.log('');
    console.log(chalk.magenta('╔═══════════════════════════════════════════════════════════╗'));
    console.log(chalk.magenta('║') + chalk.bold.white('        Storybook MCP API Server                          ') + chalk.magenta('║'));
    console.log(chalk.magenta('║') + chalk.dim('        REST API + MCP Protocol • Single Port             ') + chalk.magenta('║'));
    console.log(chalk.magenta('╚═══════════════════════════════════════════════════════════╝'));
    console.log('');

    const projectDir = options.dir;
    const port = parseInt(options.port, 10);
    
    // Check for static mode (production)
    let staticDir = null;
    if (options.static) {
      staticDir = path.resolve(options.static);
      
      // Verify the static directory exists
      if (!fs.existsSync(staticDir)) {
        console.error(chalk.red('✗') + ` Static directory not found: ${staticDir}`);
        process.exit(1);
      }
      
      // Check for index.json (required for API)
      const indexJsonPath = path.join(staticDir, 'index.json');
      if (!fs.existsSync(indexJsonPath)) {
        console.error(chalk.red('✗') + ` No index.json found in ${staticDir}`);
        console.error(chalk.dim('  Make sure you built Storybook with: npx storybook build'));
        process.exit(1);
      }
      
      console.log(chalk.green('✓') + ` Static mode: serving from ${chalk.bold(staticDir)}`);
      console.log(chalk.cyan('  Production ready - no Storybook dev server'));
    }
    
    // Only detect version/framework in non-static mode
    let version = null;
    let framework = 'unknown';
    let configDir = null;
    
    if (!staticDir) {
      // Detect Storybook version
      version = detectStorybookVersion(projectDir);
      if (version) {
        console.log(chalk.green('✓') + ` Detected Storybook version: ${chalk.bold(version)}`);
      } else {
        console.log(chalk.yellow('⚠') + ' Could not detect Storybook version');
      }

      // Detect framework
      framework = detectFramework(projectDir);
      if (framework !== 'unknown') {
        console.log(chalk.green('✓') + ` Detected framework: ${chalk.bold(framework)}`);
      } else {
        console.log(chalk.yellow('⚠') + ' Could not detect framework');
      }

      // Find Storybook config
      configDir = findStorybookConfig(projectDir);
      if (configDir) {
        console.log(chalk.green('✓') + ` Found Storybook config: ${chalk.dim(configDir)}`);
      } else {
        console.log(chalk.yellow('⚠') + ' Could not find .storybook directory');
      }
    }

    console.log('');
    console.log(chalk.blue('→') + ` Server will run on port ${chalk.bold(port)}`);
    console.log(chalk.dim(`  • REST API:  /api/*`));
    console.log(chalk.dim(`  • MCP HTTP:  /mcp`));
    console.log(chalk.dim(`  • MCP SSE:   /sse`));

    const config = {
      port,
      storybookPort: parseInt(options.storybookPort, 10),
      storybookUrl: options.storybookUrl || `http://localhost:${options.storybookPort}`,
      projectDir,
      configDir,
      proxy: staticDir ? false : (options.proxy !== false),
      staticDir,  // New: serve static build
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


