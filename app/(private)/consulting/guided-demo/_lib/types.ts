export type StudyRoutineContext = {
  goal: string;
  availableTime: string;
  suggestedRoutine: string;
  adjustment: string;
  finalRoutine: string;
};

export type StudyRoutineTools = {
  suggestRoutine: (
    input: { goal: string; availableTime: string },
    options: { signal: AbortSignal },
  ) => Promise<string>;
};
