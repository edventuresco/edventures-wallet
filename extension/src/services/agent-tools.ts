/**
 * Agent Tool System
 *
 * Defines tools that the voice agent can call to interact with the wallet UI.
 * Tools enable bidirectional communication:
 * - Agent → UI: Tool calls trigger UI actions
 * - UI → Agent: Events notify agent of user actions
 */

/**
 * Tool parameter schema following JSON Schema format
 */
export interface ToolParameterProperty {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  enum?: string[];
  items?: ToolParameterProperty;
  properties?: Record<string, ToolParameterProperty>;
}

export interface ToolParameters {
  type: 'object';
  properties: Record<string, ToolParameterProperty>;
  required?: string[];
}

/**
 * Tool definition for agent
 */
export interface AgentTool {
  name: string;              // e.g., "open_send_money"
  description: string;       // For AI understanding of when to use this tool
  parameters: ToolParameters; // JSON Schema for parameters
  handler: (params: any) => Promise<any>; // Function that executes the tool
}

/**
 * Event sent from UI to agent
 */
export interface AgentEvent {
  type: string;              // e.g., "send_initiated", "balance_updated"
  timestamp: number;
  data: Record<string, any>; // Event-specific payload
  context?: Record<string, any>; // Current UI context
}

/**
 * Result of tool execution
 */
export interface ToolExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Wallet operation tools
 */

/**
 * Tool: Open send money dialog with optional pre-fill
 */
export const openSendMoneyTool: AgentTool = {
  name: 'openSendMoney',
  description: 'Opens the send money dialog. Can optionally pre-fill recipient address and amount. Use this when user wants to send cryptocurrency.',
  parameters: {
    type: 'object',
    properties: {
      recipient: {
        type: 'string',
        description: 'Recipient wallet address (optional). If provided, pre-fills the recipient field.',
      },
      amount: {
        type: 'number',
        description: 'Amount to send in SOL (optional). If provided, pre-fills the amount field.',
      },
      asset: {
        type: 'string',
        description: 'Asset to send (e.g., "SOL", "USDC"). Currently only SOL is supported.',
        enum: ['SOL'],
      },
    },
    required: [], // All properties are optional
  },
  handler: async (_params) => {
    // Handler will be set by popup when registering tools
    throw new Error('Handler not implemented - should be set during tool registration');
  },
};

/**
 * Tool: Get current wallet balance
 */
export const getBalanceTool: AgentTool = {
  name: 'get_balance',
  description: 'Gets the current SOL balance of the wallet with USD value. Returns balance in SOL (2 decimal places) and equivalent USD amount. Use this when user asks about their balance or how much money they have.',
  parameters: {
    type: 'object',
    properties: {},
  },
  handler: async () => {
    throw new Error('Handler not implemented - should be set during tool registration');
  },
};

/**
 * Tool: Get wallet address
 */
export const getAddressTool: AgentTool = {
  name: 'get_address',
  description: 'Gets the wallet public address. Use this when user asks for their wallet address or wants to receive funds.',
  parameters: {
    type: 'object',
    properties: {},
  },
  handler: async () => {
    throw new Error('Handler not implemented - should be set during tool registration');
  },
};

/**
 * Tool: Copy address to clipboard
 */
export const copyAddressTool: AgentTool = {
  name: 'copy_address',
  description: 'Copies the wallet address to clipboard. Use this when user wants to copy their address.',
  parameters: {
    type: 'object',
    properties: {},
  },
  handler: async () => {
    throw new Error('Handler not implemented - should be set during tool registration');
  },
};

/**
 * Tool: Refresh balance
 */
export const refreshBalanceTool: AgentTool = {
  name: 'refresh_balance',
  description: 'Refreshes the wallet balance from the blockchain and returns current balance with USD value. Returns balance in SOL (2 decimal places) and equivalent USD amount. Use this when user wants an updated balance.',
  parameters: {
    type: 'object',
    properties: {},
  },
  handler: async () => {
    throw new Error('Handler not implemented - should be set during tool registration');
  },
};

/**
 * Default tool registry
 */
export const defaultTools: AgentTool[] = [
  openSendMoneyTool,
  getBalanceTool,
  getAddressTool,
  copyAddressTool,
  refreshBalanceTool,
];

/**
 * Tool Registry - manages available tools
 */
export class ToolRegistry {
  private tools: Map<string, AgentTool> = new Map();

  /**
   * Register a tool
   */
  register(tool: AgentTool): void {
    this.tools.set(tool.name, tool);
  }

  /**
   * Register multiple tools
   */
  registerAll(tools: AgentTool[]): void {
    tools.forEach((tool) => this.register(tool));
  }

  /**
   * Get tool by name
   */
  get(name: string): AgentTool | undefined {
    return this.tools.get(name);
  }

  /**
   * Get all tools
   */
  getAll(): AgentTool[] {
    return Array.from(this.tools.values());
  }

  /**
   * Execute tool by name
   */
  async execute(name: string, params: any): Promise<ToolExecutionResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        success: false,
        error: `Tool not found: ${name}`,
      };
    }

    try {
      const data = await tool.handler(params);
      return {
        success: true,
        data,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || String(error),
      };
    }
  }

  /**
   * Get tool definitions in OpenAI function calling format
   */
  getOpenAIFunctions(): Array<{
    type: 'function';
    function: {
      name: string;
      description: string;
      parameters: any;
    };
  }> {
    return this.getAll().map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      },
    }));
  }

  /**
   * Clear all tools
   */
  clear(): void {
    this.tools.clear();
  }
}

/**
 * Event bus for agent events
 */
export class AgentEventBus {
  private listeners: Array<(event: AgentEvent) => void> = [];

  /**
   * Subscribe to events
   */
  subscribe(listener: (event: AgentEvent) => void): () => void {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  /**
   * Emit event to all listeners
   */
  emit(event: AgentEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        console.error('[AgentEventBus] Error in event listener:', error);
      }
    });
  }

  /**
   * Create and emit event
   */
  send(type: string, data: Record<string, any>, context?: Record<string, any>): void {
    this.emit({
      type,
      timestamp: Date.now(),
      data,
      context,
    });
  }

  /**
   * Clear all listeners
   */
  clear(): void {
    this.listeners = [];
  }
}
