export type Kind = "playbook" | "skill" | "principle" | "tool" | "agent" | "doc";

export type EntityKey = `${Kind}:${string}`;

export interface Entity {
  key: EntityKey;
  kind: Kind;
  id: string;
  name: string;
  summary: string;
  /** Repo-relative path, or null for tools that live outside this repo. */
  path: string | null;
  /** Where an outside tool comes from, e.g. "cursor-team-kit plugin". */
  origin: string | null;
  source: string | null;
}

/** One stop on a path: a numbered playbook step or a skill phase. */
export interface Station {
  label: string;
  /** A few words, sized for a diagram node. */
  short: string;
  title: string;
  body: string;
  refs: EntityKey[];
}

export interface Section {
  title: string;
  body: string;
  refs: EntityKey[];
}

/** A playbook or skill read as an ordered path of stations. */
export interface Flow {
  key: EntityKey;
  title: string;
  path: string;
  owns: string | null;
  ownsDetail: string;
  intro: Section[];
  stations: Station[];
  notes: Section[];
  reply: string | null;
}

export interface Route {
  key: EntityKey;
  name: string;
  when: string;
  phrases: string[];
}

export interface Trigger {
  when: string;
  then: string;
  refs: EntityKey[];
}

export interface Principle {
  key: EntityKey;
  name: string;
  group: string;
  when: string;
}

/** Where a flow mentions an entity. `station` is null for intro, notes, and reply text. */
export interface Usage {
  flow: EntityKey;
  station: number | null;
}

export interface ModeDoc {
  reminder: string;
  routingIntro: string;
  autonomy: string;
  subagents: string;
  reply: string;
  comments: string;
}
