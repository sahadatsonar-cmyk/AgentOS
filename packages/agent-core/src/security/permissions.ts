export type Permission = 'read' | 'write' | 'execute' | 'network' | 'database' | 'external_action';

export type RiskLevel = 'low' | 'medium' | 'high';

export type ToolSecurityProfile = {
  name: string;
  permissions: Permission[];
  riskLevel: RiskLevel;
  requiresApproval: boolean;
  description: string;
};

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
  code_analyze: {
    name: 'code_analyze',
    permissions: ['read'],
    riskLevel: 'low',
    requiresApproval: false,
    description: 'Static code analysis only',
  },
  propose_patch: {
    name: 'propose_patch',
    permissions: ['read'],
    riskLevel: 'medium',
    requiresApproval: false,
    description: 'Propose file change plan (does not write)',
  },
  github_get_file: {
    name: 'github_get_file',
    permissions: ['network', 'read'],
    riskLevel: 'medium',
    requiresApproval: false,
    description: 'Read file from GitHub repo',
  },
  github_list_dir: {
    name: 'github_list_dir',
    permissions: ['network', 'read'],
    riskLevel: 'medium',
    requiresApproval: false,
    description: 'List GitHub repo directory',
  },
  shell: {
    name: 'shell',
    permissions: ['execute'],
    riskLevel: 'high',
    requiresApproval: true,
    description: 'Restricted shell (disabled on serverless)',
  },
  code: {
    name: 'code',
    permissions: ['execute', 'write'],
    riskLevel: 'high',
    requiresApproval: true,
    description: 'Legacy coding tool alias',
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

export function approvalsEnforced(): boolean {
  return process.env.AGENTOS_REQUIRE_APPROVAL === 'true';
}

export function toolNeedsApproval(toolName: string): boolean {
  if (!approvalsEnforced()) return false;
  return getToolSecurity(toolName).requiresApproval;
}
