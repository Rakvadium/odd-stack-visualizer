export type NodeKind =
  | "skill"
  | "principle"
  | "playbook"
  | "agent"
  | "trigger"
  | "external"
  | "reference"
  | "script"
  | "rule"
  | "section";

export interface Block {
  label: string;
  text: string;
  links: string[];
  template: boolean;
}

export interface GraphNode {
  id: string;
  kind: NodeKind;
  name: string;
  summary: string;
  source: string | null;
  lead: string;
  reply: string;
  blocks: Block[];
  /** When this node is a principle, the "when it applies" line from odd-mode. */
  when: string;
  group: string;
  outside: boolean;
}

export interface Route {
  title: string;
  condition: string;
  targetId: string;
  playbookId: string | null;
}

export interface EvidenceQuote {
  source: string;
  quote: string;
}

export interface Graph {
  nodes: Record<string, GraphNode>;
  routes: Route[];
  triggers: string[];
  principles: string[];
  outside: string[];
  automations: string[];
  edges: Edge[];
  keyword: {
    required: false;
    summary: string;
    cues: string[];
    evidence: EvidenceQuote[];
  };
  entry: {
    mode: boolean;
    disableModelInvocation: boolean;
    reminder: string;
  };
  hooksNote: string;
  entryId: string;
}

export interface Edge {
  from: string;
  to: string;
  where: string;
}
