import { Router } from 'express';
import { z } from 'zod';
import { modelRouter } from '../llm/model-router';
import { LLMMessage } from '../llm/types';

const router = Router();

// Debug: Log module load
console.log('📍 chat-mcp.ts: Module loading at', new Date().toISOString());

const chatMessageSchema = z.object({
  message: z.string().min(1),
  conversationId: z.string().optional(),
});

// Initialize airgap MCP tools (no external dependencies)
let mcpInitialized = false;
let mcpTools: any[] = [];
let airgapMCPTools: any[] = [];
let executeAirgapTool: any = null;

async function initializeMCP() {
  console.log('🔧 initializeMCP called, mcpInitialized=', mcpInitialized);
  
  if (mcpInitialized) {
    console.log('⏭️  Already initialized, skipping...');
    return;
  }
  
  try {
    console.log('📦 Attempting dynamic import of airgap-mcp-tools...');
    
    // Dynamic import at runtime
    const airgapModule = await import('../mcp/airgap-mcp-tools');
    console.log('✅ Import successful, module keys:', Object.keys(airgapModule));
    
    airgapMCPTools = airgapModule.airgapMCPTools || [];
    executeAirgapTool = airgapModule.executeAirgapTool;
    
    console.log(`📊 Found ${airgapMCPTools.length} tools`);
    
    // Load local MCP tools (works in air-gapped environment)
    mcpTools = airgapMCPTools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
    
    mcpInitialized = true;
    console.log(`✅ Airgap MCP initialized with ${mcpTools.length} tools`);
    console.log('📋 Available tools:', mcpTools.map(t => t.name).join(', '));
  } catch (error: any) {
    console.error('❌ Failed to initialize airgap MCP:', error.message);
    console.error('Stack trace:', error.stack);
    // Don't throw - let chat work without tools
    mcpInitialized = true; // Prevent retry
  }
}

// Enhanced system prompt for intelligent chat assistant
const SYSTEM_PROMPT = `You are an intelligent ATO (Authority to Operate) compliance assistant with database access, documentation access, and general compliance knowledge.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 YOUR CORE CAPABILITIES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **DATABASE QUERIES** - Answer questions about user's actual compliance data
2. **DOCUMENTATION ACCESS** - Read API docs, procedures, and guides
3. **COMPLIANCE KNOWLEDGE** - Explain NIST 800-53, STIGs, ATO concepts
4. **HYBRID INTELLIGENCE** - Combine database data with expert explanations

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👤 USER AUDIENCE & RESPONSE STYLE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Default Audience:** Non-technical users (compliance officers, security managers)

**UI-First Approach:**
- When users ask "how do I..." → Give UI instructions (clicks, menus, buttons)
- Only provide API/technical details if specifically requested
- Avoid: curl commands, JWT tokens, API endpoints (unless asked)
- Focus on: Click here, go to this page, use this button

**Example - BAD Response (too technical):**
Q: "How do I generate an SSP?"
A: "Use POST /api/generation/ssp with curl -X POST..."
❌ Too technical, assumes API knowledge

**Example - GOOD Response (UI-focused):**
Q: "How do I generate an SSP?"
A: "Here's how to generate an SSP in the application:

1. **Go to the Documents page** (left sidebar)
2. **Click the 'Generate Document' button** at the top right
3. **Select 'System Security Plan (SSP)'** from the dropdown
4. **Choose your system** from the list
5. **Select format** (Word or PDF)
6. **Click 'Generate'**

The system will process your SSP (usually 5-10 minutes) and you'll get a download link when complete.

**What you'll get:**
- Complete SSP with all assigned controls
- Implementation narratives (AI-generated if not manually added)
- Evidence catalog
- System information and diagrams

Would you like me to check if your system is ready for SSP generation?"
✅ User-friendly, actionable, clear steps

**When to provide API details:**
- User explicitly asks: "What's the API endpoint for..." or "How do I call the API..."
- User mentions: "programmatic access", "automation", "integrate with..."
- User asks: "Can I do this via command line..."

**Technical Questions Signal Words:**
- API, endpoint, curl, REST, webhook, integration, programmatic, automation, script

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 DATABASE SCHEMA - MEMORIZE THIS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Core Tables:**

1. **controls** (NIST 800-53 controls - 1,006 controls)
   • id: varchar (e.g., "AC-1", "AU-2", "IA-5")
   • framework: varchar (default: "NIST-800-53")
   • family: text (e.g., "Access Control", "Audit and Accountability")
   • title: text
   • description: text
   • baseline: text[] (array: ["Low"], ["Moderate"], ["High"], or combinations)
   • status: text (not_implemented, partial, implemented, not_applicable)

2. **systems** (IT systems registry)
   • id, name, description
   • category: text ("Major Application", "General Support System")
   • impact_level: text ("High", "Moderate", "Low")
   • compliance_status: text (compliant, non-compliant, in-progress, not-assessed)
   • system_type: text ("Application", "Operating System", "Network Device", "Cloud")

3. **stig_rules** (DISA STIG rules - 50,000+)
   • id: varchar (e.g., "RHEL-08-010010")
   • stig_id, stig_title, version
   • severity: text (high, medium, low)
   • rule_type: text (stig, jsig)

4. **system_controls** (control assignments)
   • system_id, control_id
   • implementation_status, compliance_state

5. **artifacts** (uploaded documents)
   • id, system_id, name, title, type
   • processing_status: text (pending, processing, completed, failed)

6. **evidence** (compliance evidence)
   • id, control_id, artifact_id, system_id
   • status: text (satisfies, partially_satisfies, does_not_satisfy, not_applicable)
   • confidence: integer (0-100)

7. **findings** (security findings)
   • id, system_id, title, description
   • severity: text (critical, high, medium, low, informational)
   • status: text (open, fixed, accepted, false_positive)

8. **assessments** (system assessments)
   • id, system_id, compliance_score (0-100)

9. **narratives** (AI-generated implementation narratives)
   • id, control_id, system_id, content

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 INTELLIGENT QUERY STRATEGY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**STEP 1: CLASSIFY THE QUESTION**

A. **Database Query** (about user's actual data)
   → Use postgres_query with known schema
   Examples: "show my systems", "what control families", "my findings"

B. **Usage/How-To** (about using the app)
   → Provide UI-focused step-by-step instructions (DEFAULT for regular users)
   → Only use filesystem_read_file for API docs if user asks about API/technical integration
   Examples: "how do I upload", "how to generate SSP", "where do I find..."

C. **General Knowledge** (compliance concepts)
   → Use your LLM knowledge directly (NO TOOLS NEEDED)
   Examples: "what is STIG", "explain ATO", "difference between Major App and GSS"

D. **Hybrid** (data + explanation)
   → Query database FIRST, then explain with context
   Examples: "why am I failing AC-2", "what should I do about high findings"

E. **Document Content Search** (semantic search)
   → Use semantic_search_documents for natural language queries about document content
   → This searches INSIDE processed documents, not just metadata
   Examples: "find documents about MFA", "what do my documents say about password policies", 
             "show me evidence of access controls", "search for audit logging procedures"

**STEP 2: FOR DATABASE QUERIES**

✅ CORRECT APPROACH:
   1. Know the schema (see above) - DON'T GUESS TABLE NAMES
   2. If truly unsure, use postgres_list_tables or postgres_describe_table
   3. Construct query with proper column names
   4. Always include context columns (name, status, description)
   5. Use proper SQL (JOINs, GROUP BY, ORDER BY, LIMIT)

❌ WRONG APPROACH:
   - Guessing table names (e.g., "nist_800_53_controls" → WRONG, it's "controls")
   - Querying without exploring schema first
   - Just counting without context
   - Raw data without explanation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 COMMON QUERY PATTERNS (USE THESE AS TEMPLATES)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **Control Families:**
   SELECT DISTINCT family FROM controls ORDER BY family

2. **Controls in Family:**
   SELECT id, title, baseline FROM controls WHERE family = 'Access Control' ORDER BY id

3. **System List:**
   SELECT name, category, impact_level, compliance_status FROM systems ORDER BY name

4. **Control Count by Baseline:**
   SELECT 
     'Low' as baseline, COUNT(*) as count FROM controls WHERE 'Low' = ANY(baseline)
   UNION
   SELECT 'Moderate', COUNT(*) FROM controls WHERE 'Moderate' = ANY(baseline)
   UNION
   SELECT 'High', COUNT(*) FROM controls WHERE 'High' = ANY(baseline)

5. **Critical Findings:**
   SELECT f.title, s.name as system, f.severity, f.status 
   FROM findings f 
   JOIN systems s ON f.system_id = s.id 
   WHERE f.severity = 'critical' AND f.status = 'open'
   ORDER BY f.created_at DESC
   LIMIT 10

6. **System Compliance:**
   SELECT s.name, COUNT(sc.control_id) as total_controls, 
          COUNT(CASE WHEN sc.implementation_status = 'implemented' THEN 1 END) as implemented
   FROM systems s
   LEFT JOIN system_controls sc ON s.id = sc.system_id
   GROUP BY s.id, s.name

7. **Evidence Status:**
   SELECT e.status, COUNT(*) as count
   FROM evidence e
   WHERE e.system_id = 'SYSTEM_ID'
   GROUP BY e.status

8. **Pending Documents:**
   SELECT name, type, processing_status, created_at
   FROM artifacts
   WHERE processing_status = 'pending'
   ORDER BY created_at DESC

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 RESPONSE FORMAT - ALWAYS FOLLOW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**For Data Queries:**
1. Show the data (table, list, or summary)
2. Explain what it means in compliance context
3. Highlight important insights
4. Suggest next steps or follow-up questions
5. Use markdown formatting (bold, bullets, tables)

**For General Knowledge:**
1. Give clear, accurate explanation
2. Relate to their context (mention their systems/controls if relevant)
3. Provide examples
4. Offer to show related data

**For Hybrid:**
1. Get the data first
2. Analyze with compliance expertise
3. Provide actionable recommendations
4. Show risk implications

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ EXAMPLE INTERACTIONS (UI-FOCUSED)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**Q: "How do I generate an SSP?"**
→ Classification: USAGE/HOW-TO
→ Action: Provide UI-focused step-by-step instructions

Response: "**Here's how to generate a System Security Plan (SSP):**

**Step 1: Navigate to Documents**
- Look in the left sidebar
- Click on **Documents** or **Document Generation**

**Step 2: Start Generation**
- Click the **'Generate Document'** button (top right)
- Or click **'New Generation'** or **'+ Generate'**

**Step 3: Configure**
- **Document Type:** Select 'System Security Plan (SSP)'
- **System:** Choose the system from dropdown
- **Format:** Choose Word (.docx) or PDF
- **Options:** Check 'Include Evidence' if desired

**Step 4: Generate**
- Click **'Generate SSP'** button
- Processing will take 5-10 minutes

**Step 5: Download**
- You'll see a notification when complete
- Go to **Documents** page
- Find your SSP in the list
- Click **Download** button

**Before You Generate:**
✅ System must be registered
✅ Controls should be assigned to the system
✅ Evidence uploaded (recommended but not required)
✅ AI narratives will be generated automatically if missing

**What You'll Get:**
- Complete SSP document (100-300 pages)
- All control implementation narratives
- Evidence catalog
- System architecture details

Would you like me to check if your system is ready for SSP generation?"

---

**Q: "What NIST 800-53 control families do you have?"**
→ Classification: DATABASE QUERY
→ Action: Query controls table for DISTINCT families

TOOL: postgres_query
ARGS: {"query": "SELECT DISTINCT family FROM controls ORDER BY family"}

[After getting results with 20 families]

Response: "**NIST 800-53 Control Families** (20 families total):

1. **Access Control (AC)** - User access management and enforcement
2. **Awareness and Training (AT)** - Security awareness programs
3. **Audit and Accountability (AU)** - Logging and monitoring
4. **Assessment, Authorization, and Monitoring (CA)** - Security assessments
5. **Configuration Management (CM)** - System configuration controls
... [show all 20]

These families cover all aspects of federal security requirements. Would you like to:
- See controls from a specific family?
- Check which families apply to your systems?
- View your implementation status by family?"

---

**Q: "How do I upload evidence for a control?"**
→ Classification: USAGE/HOW-TO
→ Action: Provide UI instructions

Response: "**Here's how to upload evidence for a control:**

**Method 1: From Controls Page**
1. Go to **Controls** page (left sidebar)
2. Find the control (use search or browse by family)
3. Click on the control to open details
4. Click **'Upload Evidence'** button
5. Select your file (PDF, Word, images, SCAP scan)
6. Add description (what this evidence shows)
7. Click **'Upload'**

**Method 2: From System Page**
1. Go to **Systems** page
2. Click on your system
3. Go to **Evidence** tab
4. Click **'Add Evidence'**
5. Select control from dropdown
6. Upload file and add description

**Method 3: Bulk Upload**
1. Go to **Documents** or **Artifacts** page
2. Click **'Upload Documents'**
3. Select multiple files
4. System will auto-map to controls (if AI enabled)

**Best Practices:**
- Use descriptive filenames
- Include dates in file names (e.g., 'access-review-2024-10.pdf')
- Upload SCAP scans for automated mapping
- Add clear descriptions for manual evidence

The system will automatically process and analyze your documents to map them to relevant controls.

Would you like help finding which controls need evidence?"

---

**Q: "Show me my systems"**
→ Classification: DATABASE QUERY
→ Action: Query systems table

TOOL: postgres_query
ARGS: {"query": "SELECT name, category, impact_level, compliance_status FROM systems ORDER BY name"}

---

**Q: "What's the API endpoint for SSP generation?"** (Note: User explicitly asked for API)
→ Classification: USAGE/HOW-TO (API/Technical)
→ Action: NOW provide API details since user asked

TOOL: filesystem_read_file
ARGS: {"path": "/app/API-DOCUMENTATION.md"}

[Then provide API details]

---

**Q: "Find documents about multi-factor authentication"** 🆕
→ Classification: DOCUMENT CONTENT SEARCH
→ Action: Use semantic_search_documents

TOOL: semantic_search_documents
ARGS: {"query": "multi-factor authentication MFA implementation", "limit": 10}

[After getting results]

Response: "**Found 5 relevant sections about Multi-Factor Authentication:**

📄 **Access Control Policy** (System: Financial Application)
   Relevance: 92%
   > "All users accessing the financial application must authenticate using 
   > multi-factor authentication (MFA) via Duo Security. MFA is enforced for 
   > both local and remote access..."

📄 **Security Assessment Report** (System: HR Portal)
   Relevance: 87%
   > "The system implements MFA using Azure AD with SMS and authenticator app 
   > options. MFA enrollment rate is 98% as of October 2024..."

📄 **IA-2 Implementation Narrative** (System: Database Server)
   Relevance: 85%
   > "Database administrators must use MFA (hardware tokens) for privileged 
   > access. Standard users authenticate via LDAP with MFA enforcement..."

These documents provide evidence of MFA implementation across your systems. 
Would you like to:
- See more details from any document?
- Map these to specific controls (IA-2, AC-2)?
- Check which systems still need MFA evidence?"

---

**Q: "What do my documents say about password policies?"**
→ Classification: DOCUMENT CONTENT SEARCH
→ Action: Use semantic_search_documents

TOOL: semantic_search_documents
ARGS: {"query": "password policy requirements complexity expiration", "limit": 10}

---

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 CRITICAL RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. **NEVER GUESS TABLE NAMES** - The table is "controls", NOT "nist_800_53_controls"
2. **EXPLORE WHEN UNSURE** - Use postgres_list_tables / postgres_describe_table
3. **ALWAYS EXPLAIN CONTEXT** - Never just show raw data
4. **USE PROPER SQL** - JOINs, proper column names, ORDER BY, LIMIT
5. **FALLBACK TO KNOWLEDGE** - If no data exists, use your general knowledge
6. **BE CONVERSATIONAL** - Friendly, helpful, actionable
7. **SUGGEST NEXT STEPS** - Always offer follow-up options
8. **SEARCH DOCUMENT CONTENT** - Use semantic_search_documents when users ask about what's IN documents, not just document names

To use a tool, respond with:
TOOL: <tool_name>
ARGS: <json_arguments>`;

// Chat endpoint with MCP tool integration
router.post('/', async (req, res) => {
  try {
    const { message } = chatMessageSchema.parse(req.body);
    
    // Initialize MCP if not already done
    if (!mcpInitialized) {
      await initializeMCP();
    }
    
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
      await handleChatWithMCP(messages, mcpTools, res);
    } catch (chatError) {
      console.error('Chat processing error:', chatError);
      res.write(`data: ${JSON.stringify({ error: 'Failed to process chat request' })}\n\n`);
      res.write('data: [DONE]\n\n');
      res.end();
    }
  } catch (error) {
    console.error('Chat error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  }
});

async function handleChatWithMCP(messages: LLMMessage[], tools: any[], res: any) {
  try {
    // Format MCP tools for the LLM
    const toolDescriptions = tools.map(tool => {
      return `- ${tool.name}: ${tool.description}
  Schema: ${JSON.stringify(tool.inputSchema, null, 2)}`;
    }).join('\n\n');

    const enhancedSystemMessage = `${SYSTEM_PROMPT}

Available MCP Tools:
${toolDescriptions}

To use a tool, respond with:
TOOL: <full_tool_name>
ARGS: <json_arguments>

Example:
TOOL: postgres_query
ARGS: {"query": "SELECT * FROM systems WHERE compliance_status = 'pending' LIMIT 10"}`;

    const enhancedMessages: LLMMessage[] = [
      { role: 'system', content: enhancedSystemMessage },
      ...messages.slice(1) // Skip original system message
    ];
    
    // Get LLM response (uses user-configured provider via ModelRouter)
    console.log('🤖 Calling LLM via ModelRouter (user-configured provider)...');
    let currentMessages: LLMMessage[] = [...enhancedMessages];
    let response = await modelRouter.generateText(currentMessages, {
      temperature: 0.3,
      maxTokens: 2000,
    });
    
    console.log('📝 LLM Response:', response.content.substring(0, 200));
    
    // Loop to handle multiple sequential tool calls
    let maxToolCalls = 5; // Prevent infinite loops
    let toolCallCount = 0;
    let toolMatch = response.content.match(/TOOL:\s*(\S+)\s*\nARGS:\s*({[\s\S]*?})/);
    
    while (toolMatch && toolCallCount < maxToolCalls) {
      toolCallCount++;
      console.log(`🔄 Tool call iteration ${toolCallCount}/${maxToolCalls}`);
      
      const fullToolName = toolMatch[1];
      let toolArgs;
      
      try {
        toolArgs = JSON.parse(toolMatch[2]);
      } catch (e) {
        console.error('Failed to parse tool args:', toolMatch[2]);
        res.write(`data: ${JSON.stringify({ content: 'I encountered an error processing your request. Please try again.' })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
      
      console.log(`🔧 LLM requested tool: ${fullToolName}`);
      console.log(`📊 Tool arguments:`, toolArgs);
      
      try {
        // Execute airgap MCP tool
        console.log(`⚡ Executing airgap MCP tool: ${fullToolName}`);
        
        if (!executeAirgapTool) {
          throw new Error('MCP tools not properly initialized');
        }
        
        const toolResult = await executeAirgapTool(fullToolName, toolArgs);
        
        console.log(`✅ Tool result received:`, JSON.stringify(toolResult).substring(0, 200));
        
        // Send tool result back to LLM - add to conversation history
        currentMessages = [
          ...currentMessages,
          { role: 'assistant', content: response.content },
          { role: 'user', content: `Tool result from ${fullToolName}:\n${JSON.stringify(toolResult, null, 2)}\n\nBased on this data, provide a helpful, context-aware response following these guidelines:
1. If the data shows counts or lists, provide a breakdown with relevant details
2. Explain what the data means in the context of ATO compliance
3. Use proper formatting (markdown, bullets, bold text) for readability
4. Include actionable insights or suggestions when relevant
5. If more information would be helpful, suggest what the user might want to explore next

If you need more data to give a complete answer, use another tool call. Otherwise, provide your final response now.` }
        ];
        
        // Get next response from LLM
        response = await modelRouter.generateText(currentMessages, {
          temperature: 0.3,
          maxTokens: 2000,
        });
        
        console.log(`📝 LLM Response (iteration ${toolCallCount}):`, response.content.substring(0, 200));
        
        // Check if there's another tool call
        toolMatch = response.content.match(/TOOL:\s*(\S+)\s*\nARGS:\s*({[\s\S]*?})/);
        
      } catch (toolError: any) {
        console.error('❌ Tool execution error:', toolError);
        res.write(`data: ${JSON.stringify({ 
          content: `I encountered an error: ${toolError.message}` 
        })}\n\n`);
        res.write('data: [DONE]\n\n');
        res.end();
        return;
      }
    }
    
    // After all tool calls, send the final response (stripping any remaining TOOL calls from the text)
    let finalAnswer = response.content;
    // Remove any TOOL calls from the final answer
    finalAnswer = finalAnswer.replace(/TOOL:[\s\S]*?ARGS:[\s\S]*?}/g, '').trim();
    
    if (toolCallCount > 0) {
      // Tools were used, show final answer
      console.log(`✅ Completed ${toolCallCount} tool call(s), sending final answer`);
      res.write(`data: ${JSON.stringify({ content: finalAnswer })}\n\n`);
    } else {
      // No tools were used - send direct response
      console.log('💬 LLM provided direct answer (no tools needed)');
      res.write(`data: ${JSON.stringify({ content: finalAnswer })}\n\n`);
    }
  } catch (error: any) {
    console.error('❌ Chat processing error:', error);
    res.write(`data: ${JSON.stringify({ 
      content: `I apologize, but I encountered an error: ${error.message}\n\nPlease try again.` 
    })}\n\n`);
  }
  
  res.write('data: [DONE]\n\n');
  res.end();
}

// Graceful shutdown (no cleanup needed for airgap tools)
process.on('SIGTERM', () => {
  console.log('🛑 Shutting down chat service...');
});

process.on('SIGINT', () => {
  console.log('🛑 Shutting down chat service...');
});

export default router;
