export type Permission = 'read' | 'write' | 'execute' | 'network' | 'database' | 'external_action';

export type RiskLevel = 'low' | 'medium' | 'high';

export type ToolSecurityProfile = {
  name: string;
  permissions: Permission[];
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  description: string;
};

/**
 * Central registry of tool risk / permission metadata.
 */
export const TOOL_SECURITY: Record<string, ToolSecurityProfile> = {
  calculator: {
    name: 'calculator',
    permissions: ['execute'],
    riskLevel: 'low',
    requiresApproval: false,
    description: 'Evaluate basic math expressions',
  },
  datetime: {
    name: 'datetime',
    permissions: ['read'],
    riskLevel: 'low',
    requiresApproval: false,
    description: 'Read current date/time',
  },
  web_search: {
    name: 'web_search',
    permissions: ['network', 'read'],
    riskLevel: 'medium',
    requiresApproval: false,
    description: 'Search public web / Wikipedia',
  },
  web_fetch: {
    name: 'web_fetch',
    permissions: ['network', 'read'],
    riskLevel: 'high',
    requiresApproval: true,
    description: 'Fetch arbitrary public URL content',
  },
  code: {
    name: 'code',
    permissions: ['execute', 'write'],
    riskLevel: 'high',
    requiresApproval: true,
    description: 'Code execution / modification (Phase 8)',
  },
};

export function getToolSecurity(toolName: string): ToolSecurityProfile {
  return (
    TOOL_SECURITY[toolName] ?? {
      name: toolName,
      permissions: ['execute'],
      riskLevel: 'high',
      requiresApproval: true,
      description: 'Unknown tool — treat as high risk',
    }
  );
}

/**
 * When AGENTOS_REQUIRE_APPROVAL=true, high-risk tools need an approved Approval row.
 */
export function approvalsEnforced(): boolean {
  return process.env.AGENTOS_REQUIRE_APPROVAL === 'true';
}

export function toolNeedsApproval(toolName: string): boolean {
  if (!approvalsEnforced()) return false;
  return getToolSecurity(toolName).requiresApproval;
}
