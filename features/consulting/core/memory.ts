export interface ConsultingMemoryDefinition<Memory extends object> {
  createInitial: () => Memory;
}

export function defineConsultingMemory<Memory extends object>(
  createInitial: () => Memory,
): ConsultingMemoryDefinition<Memory> {
  return { createInitial };
}
