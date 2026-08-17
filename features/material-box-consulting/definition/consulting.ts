import { defineConsulting } from '@/features/consulting/core/consulting';
import { materialBoxMemory } from '@/features/material-box-consulting/definition/memory';
import { materialBoxProcess } from '@/features/material-box-consulting/definition/process';
import { materialBoxTasks } from '@/features/material-box-consulting/definition/tasks';
import type {
  MaterialBoxEvent,
  MaterialBoxInteraction,
  MaterialBoxMemory,
  MaterialBoxTaskOutputs,
  MaterialBoxView,
} from '@/features/material-box-consulting/model/types';

export const materialBoxConsulting = defineConsulting<
  MaterialBoxMemory,
  MaterialBoxView,
  MaterialBoxTaskOutputs,
  MaterialBoxEvent,
  MaterialBoxInteraction
>({
  memory: materialBoxMemory,
  tasks: materialBoxTasks,
  process: materialBoxProcess,
});
