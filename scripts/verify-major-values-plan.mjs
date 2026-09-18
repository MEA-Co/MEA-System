import { createRequire } from 'node:module';
import { resolve } from 'node:path';
const require = createRequire(
  resolve(
    process.env.TEST_TOOLS || '/tmp/major-search-validation',
    'package.json',
  ),
);
const { build } = require('esbuild');
const root = process.cwd();
const bundle = await build({
  stdin: {
    resolveDir: root,
    loader: 'ts',
    contents: `
import assert from 'node:assert/strict';
import { createConsultingAgent } from './features/consulting/core/agent';
import { createConsultingToolRuntime } from './features/consulting/core/tools';
import { brandingPlan, brandingTools } from './app/(private)/consulting/branding/_lib/plan';
import { resumeBrandingValues } from './app/(private)/consulting/branding/_lib/resume';
import { createValuesContext, initialValuesState } from './features/major-values/domain';
const majors={first:'컴퓨터공학',second:'심리학',ids:{컴퓨터공학:'00000000-0000-4000-8000-000000000001',심리학:'00000000-0000-4000-8000-000000000002'}};
const keywords='[컴퓨터공학]\\nHCI\\n그래픽\\n\\n[심리학]\\n인지';
const saved=initialValuesState(createValuesContext(majors,keywords));
const plan=resumeBrandingValues(saved);
const agent=createConsultingAgent(plan,createConsultingToolRuntime(brandingTools));
assert.equal(agent.getSnapshot().currentNodeId,'values');
const data=agent.getSnapshot().screen.renderTarget.data;
assert.deepEqual(createValuesContext(data.majors,data.outputs.keywords),saved.context);
assert.equal(data.majors.second,'심리학');
let outputs={...data.outputs,values:'원리를 이해하는 데 의미를 둔다.'};
agent.send({type:'user.submit',value:JSON.stringify({direction:'next',outputs})});
assert.equal(agent.getSnapshot().currentNodeId,'competencies');
assert.equal(agent.getSnapshot().screen.renderTarget.data.outputs.values,outputs.values);
agent.send({type:'user.submit',value:JSON.stringify({direction:'back',outputs})});
assert.equal(agent.getSnapshot().currentNodeId,'values');
agent.send({type:'user.submit',value:JSON.stringify({direction:'back',outputs})});
assert.equal(agent.getSnapshot().currentNodeId,'keywords');
agent.send({type:'user.submit',value:JSON.stringify({direction:'next',outputs})});
assert.equal(agent.getSnapshot().currentNodeId,'values-guide');
agent.send({type:'user.submit',value:JSON.stringify({direction:'next',outputs})});
assert.equal(agent.getSnapshot().currentNodeId,'values');
assert.equal(agent.getSnapshot().screen.renderTarget.data.outputs.keywords,keywords);
agent.dispose();
console.log('PASS: resume without reselecting inputs; values → competencies → values → keywords → guide → values preserves ranked majors and outputs');
`,
  },
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'node',
  packages: 'external',
  alias: { '@': root },
});
new Function('require', bundle.outputFiles[0].text)(
  createRequire(resolve(root, 'package.json')),
);
