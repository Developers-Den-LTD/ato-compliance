import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';

interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
}

interface MCPServer {
  name: string;
  command: string;
  args: string[];
  client?: Client;
  transport?: StdioClientTransport;
  tools: MCPTool[];
}

export class MCPManager {
  private servers: Map<string, MCPServer> = new Map();

  async initializePostgresServer() {
    const dbUrl = process.env.DATABASE_URL || 
      `postgresql://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@postgres:5432/${process.env.POSTGRES_DB}`;

    const server: MCPServer = {
      name: 'postgres',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-postgres', dbUrl],
      tools: []
    };

    try {
      const transport = new StdioClientTransport({
        command: server.command,
        args: server.args,
      });

      const client = new Client({
        name: 'ato-chat-assistant',
        version: '1.0.0',
      }, {
        capabilities: {
          tools: {}
        }
      });

      await client.connect(transport);
      
      // List available tools
      const toolsResult = await client.listTools();
      server.tools = toolsResult.tools.map(tool => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema
      }));

      server.client = client;
      server.transport = transport;
      
      this.servers.set('postgres', server);
      
      console.log(`✅ MCP PostgreSQL server initialized with ${server.tools.length} tools`);
      return server.tools;
    } catch (error) {
      console.error('Failed to initialize PostgreSQL MCP server:', error);
      throw error;
    }
  }

  async initializeFilesystemServer() {
    const allowedDirs = [
      '/app/API-DOCUMENTATION.md',
      '/app/LLM-CONFIGURATION.md',
      '/app/server/routes',
      '/app/shared/schema.ts'
    ];

    const server: MCPServer = {
      name: 'filesystem',
      command: 'npx',
      args: ['-y', '@modelcontextprotocol/server-filesystem', ...allowedDirs],
      tools: []
    };

    try {
      const transport = new StdioClientTransport({
        command: server.command,
        args: server.args,
      });

      const client = new Client({
        name: 'ato-chat-assistant',
        version: '1.0.0',
      }, {
        capabilities: {
          tools: {}
        }
      });

      await client.connect(transport);
      
      const toolsResult = await client.listTools();
      server.tools = toolsResult.tools.map(tool => ({
        name: tool.name,
        description: tool.description || '',
        inputSchema: tool.inputSchema
      }));

      server.client = client;
      server.transport = transport;
      
      this.servers.set('filesystem', server);
      
      console.log(`✅ MCP Filesystem server initialized with ${server.tools.length} tools`);
      return server.tools;
    } catch (error) {
      console.error('Failed to initialize Filesystem MCP server:', error);
      throw error;
    }
  }

  async executeTool(serverName: string, toolName: string, args: any): Promise<any> {
    const server = this.servers.get(serverName);
    
    if (!server || !server.client) {
      throw new Error(`MCP server '${serverName}' not initialized`);
    }

    try {
      const result = await server.client.callTool({
        name: toolName,
        arguments: args
      });

      return result;
    } catch (error) {
      console.error(`Error executing tool ${toolName} on ${serverName}:`, error);
      throw error;
    }
  }

  getAllTools(): MCPTool[] {
    const allTools: MCPTool[] = [];
    
    for (const [serverName, server] of this.servers) {
      for (const tool of server.tools) {
        allTools.push({
          name: `${serverName}_${tool.name}`,
          description: `[${serverName}] ${tool.description}`,
          inputSchema: tool.inputSchema
        });
      }
    }
    
    return allTools;
  }

  async shutdown() {
    for (const [name, server] of this.servers) {
      if (server.client) {
        await server.client.close();
      }
      console.log(`✅ MCP server '${name}' shut down`);
    }
    this.servers.clear();
  }
}

// Singleton instance
export const mcpManager = new MCPManager();
