// Air-gapped MCP Tools Implementation
// Implements MCP-like tools without external dependencies

import { db } from '../db';
import { sql } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: any;
  execute: (args: any) => Promise<any>;
}

// PostgreSQL Query Tool
const postgresQueryTool: MCPTool = {
  name: 'postgres_query',
  description: 'Execute a SELECT query on the PostgreSQL database. Only SELECT queries are allowed.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'SQL SELECT query to execute'
      }
    },
    required: ['query']
  },
  execute: async (args: { query: string }) => {
    const query = args.query.trim();
    
    // Security: Only allow SELECT queries
    if (!query.toLowerCase().startsWith('select')) {
      throw new Error('Only SELECT queries are allowed');
    }
    
    // Execute query
    const result = await db.execute(sql.raw(query));
    
    return {
      rows: result.rows,
      rowCount: result.rows.length
    };
  }
};

// List Tables Tool
const postgresListTablesTool: MCPTool = {
  name: 'postgres_list_tables',
  description: 'List all tables in the database',
  inputSchema: {
    type: 'object',
    properties: {}
  },
  execute: async () => {
    const result = await db.execute(sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    return {
      tables: result.rows.map((r: any) => r.table_name)
    };
  }
};

// Describe Table Tool
const postgresDescribeTableTool: MCPTool = {
  name: 'postgres_describe_table',
  description: 'Get the schema/structure of a specific table',
  inputSchema: {
    type: 'object',
    properties: {
      table: {
        type: 'string',
        description: 'Name of the table to describe'
      }
    },
    required: ['table']
  },
  execute: async (args: { table: string }) => {
    const result = await db.execute(sql`
      SELECT 
        column_name,
        data_type,
        is_nullable,
        column_default
      FROM information_schema.columns
      WHERE table_schema = 'public' 
        AND table_name = ${args.table}
      ORDER BY ordinal_position
    `);
    
    return {
      table: args.table,
      columns: result.rows
    };
  }
};

// Read File Tool
const filesystemReadFileTool: MCPTool = {
  name: 'filesystem_read_file',
  description: 'Read documentation files and API guides. Use this to answer "how to" questions about using the application, API endpoints, procedures, and workflows. API documentation is at /app/API-DOCUMENTATION.md',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the file to read (e.g., /app/API-DOCUMENTATION.md for API usage questions)'
      }
    },
    required: ['path']
  },
  execute: async (args: { path: string }) => {
    const allowedPaths = [
      '/app/API-DOCUMENTATION.md',
      '/app/LLM-CONFIGURATION.md',
      '/app/shared/schema.ts'
    ];
    
    const allowedDirs = [
      '/app/server/routes'
    ];
    
    const filePath = path.resolve(args.path);
    
    // Check if path is allowed
    const isAllowed = allowedPaths.includes(filePath) || 
      allowedDirs.some(dir => filePath.startsWith(dir));
    
    if (!isAllowed) {
      throw new Error('Access to this file is not allowed');
    }
    
    const content = await fs.readFile(filePath, 'utf-8');
    
    return {
      path: filePath,
      content
    };
  }
};

// List Directory Tool
const filesystemListDirectoryTool: MCPTool = {
  name: 'filesystem_list_directory',
  description: 'List files in a directory (only allowed paths)',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Path to the directory'
      }
    },
    required: ['path']
  },
  execute: async (args: { path: string }) => {
    const allowedDirs = [
      '/app/server/routes'
    ];
    
    const dirPath = path.resolve(args.path);
    
    // Check if path is allowed
    const isAllowed = allowedDirs.some(dir => dirPath.startsWith(dir));
    
    if (!isAllowed) {
      throw new Error('Access to this directory is not allowed');
    }
    
    const files = await fs.readdir(dirPath);
    
    return {
      path: dirPath,
      files
    };
  }
};

// Semantic Search Tool for Documents
const semanticSearchDocumentsTool: MCPTool = {
  name: 'semantic_search_documents',
  description: 'Search processed documents using natural language queries. Finds relevant sections in uploaded documents using AI-powered semantic search. Use this when users ask questions about document content or want to find specific information in their uploaded evidence/documents.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Natural language search query (e.g., "documents about MFA", "password policy implementation", "access control procedures")'
      },
      systemId: {
        type: 'string',
        description: 'Optional: Filter by specific system ID to search only that system\'s documents'
      },
      limit: {
        type: 'number',
        description: 'Maximum number of results to return (default: 10, max: 50)',
        default: 10
      },
      minRelevance: {
        type: 'number',
        description: 'Minimum relevance score 0-100 (default: 50)',
        default: 50
      }
    },
    required: ['query']
  },
  execute: async (args: { query: string; systemId?: string; limit?: number; minRelevance?: number }) => {
    try {
      // Import services dynamically to avoid circular dependencies
      const { storage } = await import('../storage');
      const { embeddingService } = await import('../services/embedding.service');
      
      const limit = Math.min(args.limit || 10, 50);
      const minRelevance = args.minRelevance || 50;
      const minSimilarity = minRelevance / 100; // Convert to 0-1 scale
      
      // Generate embedding for the search query
      const queryEmbedding = await embeddingService.generateEmbedding(args.query);
      
      // Search semantic_chunks table using vector similarity
      let chunks;
      if (args.systemId) {
        chunks = await storage.findSimilarChunks(queryEmbedding, args.systemId, limit, minSimilarity);
      } else {
        // Search across all systems (no system filter)
        const allChunks = await db.execute(sql`
          SELECT 
            sc.*,
            a.name as document_name,
            a.type as document_type,
            s.name as system_name,
            1 - (sc.embedding <-> ${JSON.stringify(queryEmbedding)}::vector) as similarity
          FROM semantic_chunks sc
          JOIN artifacts a ON sc.artifact_id = a.id
          JOIN systems s ON sc.system_id = s.id
          WHERE 1 - (sc.embedding <-> ${JSON.stringify(queryEmbedding)}::vector) >= ${minSimilarity}
          ORDER BY similarity DESC
          LIMIT ${limit}
        `);
        chunks = allChunks.rows;
      }
      
      if (chunks.length === 0) {
        return {
          results: [],
          count: 0,
          message: 'No relevant documents found. Try rephrasing your query or lowering the relevance threshold.'
        };
      }
      
      // Format results with context
      const results = chunks.map((chunk: any) => ({
        documentName: chunk.document_name || chunk.name,
        documentType: chunk.document_type || chunk.type,
        systemName: chunk.system_name,
        content: chunk.content,
        relevance: Math.round((chunk.similarity || 0) * 100),
        chunkIndex: chunk.chunk_index,
        metadata: chunk.metadata
      }));
      
      return {
        query: args.query,
        count: results.length,
        results,
        summary: `Found ${results.length} relevant section(s) across your processed documents.`
      };
      
    } catch (error: any) {
      // If vector search fails (e.g., embeddings not set up), provide helpful error
      if (error.message?.includes('vector') || error.message?.includes('embedding')) {
        return {
          error: 'Vector search not available',
          message: 'Semantic search requires documents to be processed with AI enabled. Make sure documents have been uploaded and processed.',
          fallback: 'You can search document names and metadata using postgres_query on the artifacts table.'
        };
      }
      throw error;
    }
  }
};

// Export all tools
export const airgapMCPTools: MCPTool[] = [
  postgresQueryTool,
  postgresListTablesTool,
  postgresDescribeTableTool,
  filesystemReadFileTool,
  filesystemListDirectoryTool,
  semanticSearchDocumentsTool
];

// Helper to get tool by name
export function getAirgapTool(name: string): MCPTool | undefined {
  return airgapMCPTools.find(tool => tool.name === name);
}

// Helper to execute tool
export async function executeAirgapTool(name: string, args: any): Promise<any> {
  const tool = getAirgapTool(name);
  
  if (!tool) {
    throw new Error(`Tool '${name}' not found`);
  }
  
  return await tool.execute(args);
}
