import { Runner } from '@openai/agents';

import 'server-only';

export const explorationRunner = new Runner({
  tracingDisabled: true,
  traceIncludeSensitiveData: false,
  modelSettings: {
    store: false,
    timeoutMs: 50_000,
  },
});
