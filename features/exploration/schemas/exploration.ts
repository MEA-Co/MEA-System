import { z } from 'zod';

export const SlotStatusSchema = z.enum(['missing', 'partial', 'clear']);
export const OwnershipSchema = z.enum([
  'none',
  'assistant_suggested',
  'student_explicit',
  'student_confirmed',
]);

export const GoalSlotSchema = z.object({
  value: z.string().trim().max(500).nullable(),
  status: SlotStatusSchema,
  ownership: OwnershipSchema,
  reason: z.string().trim().min(1).max(500),
});

export const ExplorationGoalSchema = z.object({
  keyword: GoalSlotSchema,
  problem: GoalSlotSchema,
  aspect: GoalSlotSchema,
  method: GoalSlotSchema,
  ready: z.boolean(),
  nextTarget: z.enum(['keyword', 'problem', 'aspect', 'method', 'done']),
  coherenceIssue: z.string().trim().max(500).nullable(),
  feasibilityIssue: z.string().trim().max(500).nullable(),
});

export const ConversationTurnSchema = z.object({
  role: z.enum(['student', 'coach']),
  content: z.string().trim().min(1).max(2_000),
});

export const ProfileTraitSchema = z.object({
  label: z.string().trim().min(1).max(80),
  description: z.string().trim().min(1).max(500),
  evidence: z.string().trim().min(1).max(500),
});

export const CapabilityApplicationSchema = z.object({
  schoolSubject: z.string().trim().min(1).max(80),
  pureFieldFitDraft: z.string().trim().min(1).max(180),
  majorFieldFitDraft: z.string().trim().min(1).max(180),
});

export const StudentExplorationProfileSchema = z.object({
  interestKeyword: ProfileTraitSchema,
  valueOrientation: ProfileTraitSchema,
  capability: ProfileTraitSchema,
  capabilityApplication: CapabilityApplicationSchema,
});

export const KeywordItemSchema = z.object({
  keyword: z.string().trim().min(1).max(80),
  explanation: z.string().trim().min(1).max(300),
  exampleTopic: z.string().trim().min(1).max(200).nullable(),
});

export const FieldGroupSchema = z.object({
  fieldName: z.string().trim().min(1).max(80),
  explanation: z.string().trim().min(1).max(300),
  keywords: z.array(KeywordItemSchema).min(2).max(5),
});

export const DepartmentMapSchema = z.object({
  department: z.string().trim().min(1).max(120),
  overview: z.string().trim().min(1).max(500),
  fields: z.array(FieldGroupSchema).min(3).max(6),
});

export const ResearchSourceSchema = z.object({
  title: z.string().trim().min(1).max(300),
  url: z.string().trim().min(1).max(2_000),
  publisher: z.string().trim().max(200).nullable(),
  publishedAt: z.string().trim().max(80).nullable(),
  sourceType: z.enum([
    'paper',
    'government',
    'institution',
    'news',
    'other',
  ]),
});

export const CandidateIssueSchema = z.object({
  issue: z.string().trim().min(1).max(300),
  whyItMatters: z.string().trim().min(1).max(500),
  highSchoolExplanation: z.string().trim().min(1).max(500),
  possibleAspects: z.array(z.string().trim().min(1).max(160)).min(2).max(5),
  possibleMethods: z.array(z.string().trim().min(1).max(200)).min(2).max(5),
  feasibility: z.enum(['easy', 'moderate', 'challenging']),
  sources: z.array(ResearchSourceSchema).min(1).max(4),
});

export const IssueResearchSchema = z.object({
  keyword: z.string().trim().min(1).max(120),
  issues: z.array(CandidateIssueSchema).min(3).max(5),
});

export const ExplorationStateSchema = z.object({
  department: z.string().trim().min(1).max(120),
  conversation: z.array(ConversationTurnSchema).max(40),
  goal: ExplorationGoalSchema,
  profile: StudentExplorationProfileSchema.nullable(),
  departmentMap: DepartmentMapSchema.nullable(),
  latestResearch: IssueResearchSchema.nullable(),
});

export const StartExplorationRequestSchema = z.object({
  action: z.literal('start'),
  department: z.string().trim().min(1).max(120),
});

export const ContinueExplorationRequestSchema = z.object({
  action: z.literal('message'),
  state: ExplorationStateSchema,
  message: z.string().trim().min(1).max(2_000),
});

export const ExplorationRequestSchema = z.discriminatedUnion('action', [
  StartExplorationRequestSchema,
  ContinueExplorationRequestSchema,
]);

export const ExplorationResponseSchema = z.object({
  message: z.string().trim().min(1).max(4_000),
  state: ExplorationStateSchema,
});

export type GoalSlot = z.infer<typeof GoalSlotSchema>;
export type ExplorationGoal = z.infer<typeof ExplorationGoalSchema>;
export type ConversationTurn = z.infer<typeof ConversationTurnSchema>;
export type ProfileTrait = z.infer<typeof ProfileTraitSchema>;
export type StudentExplorationProfile = z.infer<
  typeof StudentExplorationProfileSchema
>;
export type DepartmentMap = z.infer<typeof DepartmentMapSchema>;
export type IssueResearch = z.infer<typeof IssueResearchSchema>;
export type ExplorationState = z.infer<typeof ExplorationStateSchema>;
export type ExplorationRequest = z.infer<typeof ExplorationRequestSchema>;
export type ExplorationResponse = z.infer<typeof ExplorationResponseSchema>;
