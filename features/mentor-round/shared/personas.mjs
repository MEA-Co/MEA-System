import catalog from './persona-catalog.json' with { type: 'json' };

/** Source-grounded components are independent, versioned units, not identities. */
/**
 * @typedef {{id:string, version:string, kind:'strategy'|'skill'|'experience', label:string, statement:string, sourceRefs:string[], provenance:{personaId:string,componentId:string,version:string}, status:'reviewed-summary', applicability:{conditions:string[],exceptions:string[],status:string}}} PersonaComponent
 * @typedef {{id:string,version:string,kind:'source-based',displayName:string,components:PersonaComponent[],limitations:string[]}} Persona
 */
export const personas = /** @type {Persona[]} */ (catalog);

/**
 * Prepare a synthetic draft for future authoring. This does not claim the
 * constituent mentors agree, validate compatibility, or enable API voting.
 * Select exact versions so historical provenance cannot silently drift.
 */
export function composePersona(id, selections) {
  if (
    typeof id !== 'string' ||
    !id.startsWith('synthetic-') ||
    !Array.isArray(selections) ||
    !selections.length
  )
    throw new Error(
      'A synthetic ID and explicit component selections are required',
    );
  const components = selections.map(({ personaId, componentId, version }) => {
    const persona = personas.find((p) => p.id === personaId);
    const component = persona?.components.find(
      (c) => c.id === componentId && c.version === version,
    );
    if (!component) throw new Error('Unknown component or version');
    return structuredClone(component);
  });
  if (new Set(components.map((c) => c.id)).size !== components.length)
    throw new Error('Duplicate component selection');
  return {
    id,
    version: '1',
    kind: 'synthetic',
    displayName: '합성 페르소나 초안',
    components,
    reviewStatus: 'needs-review',
    limitations: [
      '실존 멘토의 의견이 아닌 합성 초안입니다.',
      '구성요소 사이의 조건·충돌·상반된 조언을 사람이 검토하기 전에는 투표에 사용할 수 없습니다.',
    ],
  };
}
