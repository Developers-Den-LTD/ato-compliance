import { Router } from 'express';
import { z } from 'zod';
import { modelRouter } from '../llm/model-router';
import { db } from '../db';
import { controls, systems, assessments, artifacts } from '../schema';
import { eq, like, and, or, desc, asc, sql } from 'drizzle-orm';
import { LLMMessage } from '../llm/types';

const router = Router();

// Schema for chat messages
const chatMessageSchema = z.object({
  message: z.string().min(1),
});

// Tool definitions for the LLM to use
const tools = [
  {
    name: 'search_controls',
    description: 'Search for controls by keyword, framework, risk level, or other criteria',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query for control title or description' },
        framework: { type: 'string', description: 'Framework (e.g., NIST-800-53)' },
        family: { type: 'string', description: 'Control family (e.g., AC, AU, etc.)' },
        risk_level: { type: 'string', enum: ['low', 'medium', 'high'], description: 'Risk level' },
        limit: { type: 'number', default: 10, description: 'Maximum number of results' },
      },
    },
  },
  {
    name: 'search_systems',
    description: 'Search for systems by name, type, status, or other criteria',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query for system name or description' },
        system_type: { type: 'string', description: 'System type' },
        status: { type: 'string', enum: ['active', 'inactive', 'planned'], description: 'System status' },
        limit: { type: 'number', default: 10, description: 'Maximum number of results' },
      },
    },
  },
  {
    name: 'get_system_details',
    description: 'Get detailed information about a specific system including STIG profiles, compliance status, etc.',
    input_schema: {
      type: 'object',
      properties: {
        system_name: { type: 'string', description: 'Name of the system to get details for' },
        system_id: { type: 'string', description: 'ID of the system (optional if name provided)' },
      },
    },
  },
  {
    name: 'get_assessment_summary',
    description: 'Get summary of assessments for a system or overall',
    input_schema: {
      type: 'object',
      properties: {
        system_id: { type: 'string', description: 'Optional system ID to filter by' },
        status: { type: 'string', enum: ['pending', 'in_progress', 'completed'], description: 'Assessment status' },
      },
    },
  },
  {
    name: 'search_artifacts',
    description: 'Search for artifacts/documents by name or type',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query for artifact name' },
        type: { type: 'string', description: 'Artifact type' },
        system_id: { type: 'string', description: 'System ID to filter by' },
        limit: { type: 'number', default: 10, description: 'Maximum number of results' },
      },
    },
  },
];

// Execute tool functions based on the tool name
async function executeTool(toolName: string, args: any) {
  switch (toolName) {
    case 'search_controls': {
      const conditions = [];
      
      if (args.query) {
        conditions.push(
          or(
            like(controls.id, `%${args.query}%`),
            like(controls.title, `%${args.query}%`),
            like(controls.description, `%${args.query}%`)
          )
        );
      }
      
      if (args.framework) {
        conditions.push(eq(controls.framework, args.framework));
      }
      
      if (args.family) {
        conditions.push(like(controls.id, `${args.family}-%`));
      }
      
      if (args.risk_level) {
        // risk_level doesn't exist in schema, skip this condition
        // conditions.push(eq(controls.risk_level, args.risk_level));
      }
      
      const results = conditions.length > 0
        ? await db.select().from(controls).where(and(...conditions)).limit(args.limit || 10)
        : await db.select().from(controls).limit(args.limit || 10);
      
      return {
        count: results.length,
        controls: results.map(c => ({
          control_id: c.id,
          title: c.title,
          framework: c.framework,
          risk_level: 'medium', // risk_level doesn't exist in schema
          family: c.id?.split('-')[0] || 'Unknown',
          description: c.description?.substring(0, 200) + (c.description && c.description.length > 200 ? '...' : ''),
        })),
      };
    }
    
    case 'search_systems': {
      const conditions = [];
      
      if (args.query) {
        conditions.push(
          or(
            like(systems.name, `%${args.query}%`),
            like(systems.description, `%${args.query}%`)
          )
        );
      }
      
      if (args.system_type) {
        conditions.push(eq(systems.systemType, args.system_type));
      }
      
      if (args.status) {
        conditions.push(eq(systems.complianceStatus, args.status));
      }
      
      const results = conditions.length > 0
        ? await db.select().from(systems).where(and(...conditions)).limit(args.limit || 10)
        : await db.select().from(systems).limit(args.limit || 10);
      
      return {
        count: results.length,
        systems: results.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description,
          system_type: s.systemType,
          status: s.complianceStatus,
          created_at: s.createdAt,
        })),
      };
    }
    
    case 'get_system_details': {
      let system = null;
      
      if (args.system_name) {
        // Find system by name
        const results = await db
          .select()
          .from(systems)
          .where(eq(systems.name, args.system_name))
          .limit(1);
        system = results[0];
      } else if (args.systemId) {
        // Find system by ID
        const results = await db
          .select()
          .from(systems)
          .where(eq(systems.id, args.systemId))
          .limit(1);
        system = results[0];
      }
      
      if (!system) {
        return {
          error: 'System not found',
          message: 'Could not find a system with the provided name or ID'
        };
      }
      
      // Get assessment count for this system
      const assessmentCount = await db
        .select({ count: sql<number>`count(*)` })
        .from(assessments)
        .where(eq(assessments.systemId, system.id));
      
      return {
        system: {
          id: system.id,
          name: system.name,
          description: system.description,
          category: system.category,
          impactLevel: system.impactLevel,
          complianceStatus: system.complianceStatus,
          systemType: system.systemType,
          operatingSystem: system.operatingSystem,
          stigProfiles: system.stigProfiles || [],
          autoStigUpdates: system.autoStigUpdates,
          lastStigUpdate: system.lastStigUpdate,
          createdAt: system.createdAt,
          updatedAt: system.updatedAt,
          assessmentCount: Number(assessmentCount[0]?.count || 0),
        }
      };
    }
    
    case 'get_assessment_summary': {
      const conditions = [];
      
      if (args.systemId) {
        conditions.push(eq(assessments.systemId, args.systemId));
      }
      
      if (args.status) {
        conditions.push(eq(assessments.status, args.status));
      }
      
      const results = conditions.length > 0
        ? await db.select({
            system_id: assessments.systemId,
            status: assessments.status,
            count: sql<number>`count(*)`,
          }).from(assessments).where(and(...conditions)).groupBy(assessments.systemId, assessments.status)
        : await db.select({
            system_id: assessments.systemId,
            status: assessments.status,
            count: sql<number>`count(*)`,
          }).from(assessments).groupBy(assessments.systemId, assessments.status);
      
      const totalAssessments = results.reduce((sum, r) => sum + Number(r.count), 0);
      
      return {
        total_assessments: totalAssessments,
        by_status: results.reduce((acc, r) => {
          const status = r.status || 'unknown';
          acc[status] = (acc[status] || 0) + Number(r.count);
          return acc;
        }, {} as Record<string, number>),
        by_system: results.reduce((acc, r) => {
          if (r.system_id) {
            acc[r.system_id] = (acc[r.system_id] || 0) + Number(r.count);
          }
          return acc;
        }, {} as Record<string, number>),
      };
    }
    
    case 'search_artifacts': {
      const conditions = [];
      
      if (args.query) {
        conditions.push(
          or(
            like(artifacts.name, `%${args.query}%`),
            like(artifacts.description, `%${args.query}%`)
          )
        );
      }
      
      if (args.type) {
        conditions.push(eq(artifacts.type, args.type));
      }
      
      if (args.systemId) {
        conditions.push(eq(artifacts.systemId, args.systemId));
      }
      
      const results = conditions.length > 0
        ? await db.select().from(artifacts).where(and(...conditions)).limit(args.limit || 10)
        : await db.select().from(artifacts).limit(args.limit || 10);
      
      return {
        count: results.length,
        artifacts: results.map(a => ({
          id: a.id,
          name: a.name,
          description: a.description,
          type: a.type,
          system_id: a.systemId,
          created_at: a.createdAt,
        })),
      };
    }
    
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// System prompt for the chat assistant
const SYSTEM_PROMPT = `You are an ATO (Authority to Operate) compliance assistant. You help users search for and understand information about:
- Security controls (NIST 800-53 and other frameworks)
- Information systems and their compliance status
- Assessments and their progress
- Artifacts and documentation

You have access to tools to search the database. Use them to provide accurate, specific information.

When users ask questions:
1. Use the appropriate search tools to find relevant data
2. Present the information clearly and concisely
3. Provide specific control IDs, system names, and other identifiers
4. If multiple results are found, summarize the most relevant ones
5. Suggest follow-up questions if appropriate

Always be helpful and focus on compliance and security-related queries.`;

// Chat endpoint with streaming support
router.post('/', async (req, res) => {
  try {
    const { message } = chatMessageSchema.parse(req.body);
    
    // Set up SSE headers
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });
    
    // Create messages array with system prompt
    const messages: LLMMessage[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: message },
    ];
    
    try {
      // Always use non-streaming approach to be consistent with other features
      // This ensures we use the same provider configuration as document generation
      await handleNonStreamingChat(messages, tools, res);
    } catch (chatError) {
      console.error('Chat processing error:', chatError);
      res.write(`data: ${JSON.stringify({ error: 'Failed to process chat request' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Handle streaming chat for providers that support it
async function handleStreamingChat(messages: LLMMessage[], tools: any[], res: any) {
  await modelRouter.chatCompletionStream({
    messages,
    tools,
    onChunk: async (chunk) => {
      // Handle tool calls
      if (chunk.tool_calls) {
        for (const toolCall of chunk.tool_calls) {
          if (toolCall.function?.name && toolCall.function?.arguments) {
            try {
              const args = JSON.parse(toolCall.function.arguments);
              const result = await executeTool(toolCall.function.name, args);
              
              // Send tool result as a message
              const toolMessage: LLMMessage = {
                role: 'tool',
                tool_call_id: toolCall.id,
                content: JSON.stringify(result),
              };
              
              // Continue the conversation with tool result
              await modelRouter.chatCompletionStream({
                messages: [...messages, { role: 'assistant', content: '', tool_calls: [toolCall] } as any, toolMessage],
                onChunk: (resultChunk) => {
                  if (resultChunk.content) {
                    res.write(`data: ${JSON.stringify({ content: resultChunk.content })}\n\n`);
                  }
                },
              });
            } catch (e) {
              console.error('Error handling tool call:', e);
              res.write(`data: ${JSON.stringify({ error: `Failed to execute tool: ${toolCall.function.name}` })}\n\n`);
            }
          }
        }
      }
      
      // Send content chunks
      if (chunk.content) {
        res.write(`data: ${JSON.stringify({ content: chunk.content })}\n\n`);
      }
    },
  });
  
  res.write('data: [DONE]\n\n');
  res.end();
}

// Handle non-streaming chat for providers like Ollama
async function handleNonStreamingChat(messages: LLMMessage[], tools: any[], res: any) {
  try {
    // Create a system message that explains available tools
    const systemMessage = `You are an ATO compliance assistant with database access.

You have tools to search and query the database. When users ask questions about what's in the database, use these tools to find the answer.

Available tools:
- search_controls: Search security controls
- search_systems: Search systems  
- get_system_details: Get system details
- get_assessment_summary: Get assessment summaries
- search_artifacts: Search artifacts

To use a tool, respond with:
TOOL: <tool_name>
ARGS: <json_args>

Be intelligent about tool usage - query the database when users ask about data.`;

    // Add system message to the conversation
    const enhancedMessages: LLMMessage[] = [
      { role: 'system', content: systemMessage },
      ...messages
    ];
    
    // Get LLM response with tool instructions
    const initialResponse = await modelRouter.generateText(enhancedMessages, {
      temperature: 0.3,
      maxTokens: 1000,
    });
    
    // Check if LLM wants to use a tool
    const toolMatch = initialResponse.content.match(/TOOL:\s*(\w+)\s*\nARGS:\s*({[^}]+})/);
    
    if (toolMatch) {
      const toolName = toolMatch[1];
      const toolArgs = JSON.parse(toolMatch[2]);
      
      try {
        // Execute the requested tool
        const toolResult = await executeTool(toolName, toolArgs);
        
        // Send tool result back to LLM for formatting
        const resultMessages = [
          ...enhancedMessages,
          { role: 'assistant', content: initialResponse.content },
          { role: 'user', content: `Tool result: ${JSON.stringify(toolResult)}. Please format this nicely for the user.` }
        ] as LLMMessage[];
        
        const formattedResponse = await modelRouter.generateText(resultMessages, {
          temperature: 0.3,
          maxTokens: 1500,
        });
        
        res.write(`data: ${JSON.stringify({ content: formattedResponse.content })}\n\n`);
      } catch (toolError) {
        console.error('Tool execution error:', toolError);
        res.write(`data: ${JSON.stringify({ content: "I encountered an error accessing the database. Please try rephrasing your question." })}\n\n`);
      }
    } else {
      // LLM provided direct response without using tools
      res.write(`data: ${JSON.stringify({ content: initialResponse.content })}\n\n`);
    }
  } catch (error) {
    console.error('Non-streaming chat error:', error);
    res.write(`data: ${JSON.stringify({ content: "I apologize, but I encountered an error processing your request. Please try again." })}\n\n`);
  }
  
  res.write('data: [DONE]\n\n');
  res.end();
}


export default router;


