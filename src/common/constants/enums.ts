/**
 * Domain enumerations shared across modules.
 *
 * Stored as human-readable string unions (e.g. 'GitHub', 'Not Started') so the
 * API stays self-describing for the frontend / mobile clients and MongoDB
 * documents remain readable without a lookup table.
 */

export const ResourceType = {
  GITHUB: 'GitHub',
  PDF: 'PDF',
  DOCUMENTATION: 'Documentation',
  YOUTUBE: 'YouTube',
  INSTAGRAM: 'Instagram',
  LINKEDIN: 'LinkedIn',
  SUBSTACK: 'Substack',
  WEBSITE: 'Website',
  RESEARCH_PAPER: 'Research Paper',
  DOC: 'DOC',
  DOCX: 'DOCX',
  OTHER: 'Other',
} as const;
export type ResourceType = (typeof ResourceType)[keyof typeof ResourceType];

export const ResourceDifficulty = {
  BEGINNER: 'Beginner',
  INTERMEDIATE: 'Intermediate',
  ADVANCED: 'Advanced',
} as const;
export type ResourceDifficulty =
  (typeof ResourceDifficulty)[keyof typeof ResourceDifficulty];

export const ResourcePriority = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
} as const;
export type ResourcePriority =
  (typeof ResourcePriority)[keyof typeof ResourcePriority];

export const ResourceStatus = {
  NOT_STARTED: 'Not Started',
  READING: 'Reading',
  COMPLETED: 'Completed',
} as const;
export type ResourceStatus =
  (typeof ResourceStatus)[keyof typeof ResourceStatus];

export const TodoStatus = {
  NOT_STARTED: 'Not Started',
  STUDYING: 'Studying',
  READING: 'Reading',
  COMPLETED: 'Completed',
} as const;
export type TodoStatus = (typeof TodoStatus)[keyof typeof TodoStatus];

export const TodoEstimatedTime = {
  MINS_30: '30 mins',
  HOUR_1: '1 hour',
  HOURS_2: '2 hours',
  CUSTOM: 'Custom',
} as const;
export type TodoEstimatedTime =
  (typeof TodoEstimatedTime)[keyof typeof TodoEstimatedTime];

export const NotePriority = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  CRITICAL: 'Critical',
} as const;
export type NotePriority = (typeof NotePriority)[keyof typeof NotePriority];

export const NoteStatus = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked',
  COMPLETED: 'Completed',
} as const;
export type NoteStatus = (typeof NoteStatus)[keyof typeof NoteStatus];

/** Resource types that open in the integrated document reader. */
export const DOCUMENT_TYPES: ReadonlySet<ResourceType> = new Set<ResourceType>([
  ResourceType.PDF,
  ResourceType.DOC,
  ResourceType.DOCX,
  ResourceType.RESEARCH_PAPER,
  ResourceType.DOCUMENTATION,
]);

export function isDocumentType(type: ResourceType): boolean {
  return DOCUMENT_TYPES.has(type);
}

/** Sort options accepted by the Resources query endpoint. */
export const ResourceSort = {
  NEWEST: 'newest',
  OLDEST: 'oldest',
  RECENTLY_READ: 'recentlyRead',
  ALPHABETICAL: 'alphabetical',
  PRIORITY: 'priority',
  PROGRESS: 'progress',
} as const;
export type ResourceSort = (typeof ResourceSort)[keyof typeof ResourceSort];

/** Stable priority ranking used for sorting (higher = more urgent). */
export const PRIORITY_RANK: Record<string, number> = {
  Critical: 4,
  High: 3,
  Medium: 2,
  Low: 1,
};
