'use client';
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  ConnectionMode,
  type Edge,
  EdgeLabelRenderer,
  type EdgeProps,
  getBezierPath,
  Handle,
  MarkerType,
  type Node,
  type NodeProps,
  Panel,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useNodesInitialized,
  useReactFlow,
  type XYPosition,
} from '@xyflow/react';
import { Maximize, Minus, Plus, X } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { useEffect, useId, useRef, useState } from 'react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Exploration } from '@/lib/exploration/fields';

import { useSkillDiscard } from '../hooks/useSkillDiscard';
import { canConnectLink } from '../lib/link-graph';
import { explorationTitle } from '../lib/list-model';

import { ExplorationLinkSkillPicker } from './ExplorationLinkSkillPicker';
import { ExplorationSkillEditDialog } from './ExplorationSkillEditDialog';

import '@xyflow/react/dist/style.css';

export type LinkNode = {
  activity: Exploration;
  column: number;
  position?: XYPosition;
};
export type LinkSkillset = {
  id: string;
  name: string;
  description: string;
  updatedAt?: string;
};
export type LinkEdge = {
  skillId?: string;
  from: string;
  to: string;
  sourceHandle?: string;
  targetHandle?: string;
};
export type LinkGraph = {
  nodes: LinkNode[];
  edges: LinkEdge[];
  skills?: LinkSkillset[];
};
type Props = {
  userId: string;
  readOnly?: boolean;
  graph: LinkGraph;
  onDraftChange: (dirty: boolean) => void;
  onAdd: () => void;
  onConnect: (edge: LinkEdge) => void;
  onRemove: (id: string) => void;
  onDisconnect: (edge: LinkEdge) => void;
  onSkillsetChange: (edge: LinkEdge, skillset: LinkSkillset) => void;
  onReuseSkill: (edge: LinkEdge, skillId: string) => void;
  onDetachSkill: (edge: LinkEdge) => void;
  onMove: (positions: { id: string; position: XYPosition }[]) => void;
};
type ActivityNode = Node<
  {
    title: string;
    readOnly: boolean;
    onRemove: Props['onRemove'];
    connecting: boolean;
    canTarget: boolean;
    onTarget: (id: string) => void;
    onPort: (id: string, side: string, element: HTMLElement) => void;
  },
  'activity'
>;
type SkillEdge = Edge<
  {
    label: string;
    readOnly: boolean;
    removeLabel: string;
    skillsetName?: string;
    onDetachSkill: () => void;
    hideControls: boolean;
    onOpen: () => void;
    onRemove: () => void;
  },
  'skill'
>;

function ActivityCard({
  id,
  data,
  selected,
  dragging,
}: NodeProps<ActivityNode>) {
  return (
    <div
      data-link-card="true"
      data-link-id={id}
      onClick={(event) => {
        if (
          data.connecting &&
          !(event.target as Element).closest('button,[data-link-port]')
        ) {
          event.stopPropagation();
          data.onTarget(id);
        }
      }}
      onKeyDown={(event) => {
        if (
          data.connecting &&
          event.target === event.currentTarget &&
          (event.key === 'Enter' || event.key === ' ')
        ) {
          event.preventDefault();
          event.stopPropagation();
          data.onTarget(id);
        }
      }}
      tabIndex={data.connecting ? 0 : undefined}
      role={data.connecting ? 'button' : undefined}
      aria-label={
        data.connecting
          ? `${data.title} 후속 탐구로 연결${data.canTarget ? '' : ' 불가'}`
          : undefined
      }
      className={`relative flex h-[88px] w-60 rounded-lg border bg-card shadow-sm transition-colors ${data.canTarget ? 'cursor-pointer border-border hover:border-blue-500 hover:ring-1 hover:ring-blue-500 focus-visible:border-blue-500 focus-visible:ring-1 focus-visible:ring-blue-500' : 'cursor-grab border-border active:cursor-grabbing'}`}
      style={{
        outline:
          selected && !data.connecting ? '2px solid var(--ring)' : undefined,
        cursor: data.connecting
          ? data.canTarget
            ? 'pointer'
            : 'not-allowed'
          : dragging
            ? 'grabbing'
            : 'grab',
      }}
    >
      <Handle
        id="left"
        type="target"
        position={Position.Left}
        isConnectable={false}
        className="pointer-events-none opacity-0"
      />
      <Handle
        id="right"
        type="source"
        position={Position.Right}
        isConnectable={false}
        className="pointer-events-none opacity-0"
        style={{ top: 'calc(50% + 16px)' }}
      />
      <div className="flex min-w-0 flex-1 items-center justify-center px-4 py-3">
        <p
          className="line-clamp-3 break-words text-center text-sm font-medium"
          title={data.title}
        >
          {data.title}
        </p>
      </div>
      <div
        className={
          data.readOnly
            ? 'hidden'
            : 'flex w-8 shrink-0 flex-col overflow-hidden rounded-r-[7px] border-l border-border'
        }
      >
        <Button
          variant="ghost"
          size="icon-xs"
          className="nodrag nopan size-8 shrink-0 rounded-none border-0 border-b border-border bg-red-100 text-red-700 hover:bg-red-200"
          aria-label={`${data.title} 줄기에서 제거`}
          onClick={(event) => {
            event.stopPropagation();
            data.onRemove(id);
          }}
        >
          <X />
        </Button>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <Button
                  variant="ghost"
                  data-link-port="true"
                  className="nodrag nopan h-auto w-full flex-1 cursor-pointer rounded-none border-0 px-0 hover:bg-blue-500 hover:text-white focus-visible:bg-blue-500 focus-visible:text-white"
                  aria-label={`${data.title}에서 후속 탐구 연결`}
                  onClick={(event) => {
                    event.stopPropagation();
                    data.onPort(id, 'right', event.currentTarget);
                  }}
                />
              }
            >
              <Plus />
            </TooltipTrigger>
            <TooltipContent side="right">후속 탐구 연결하기</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  );
}

function SkillConnection(props: EdgeProps<SkillEdge>) {
  const reducedMotion = useReducedMotion();
  const [path, x, y] = getBezierPath(props);
  const skillButton = (
    <Button
      variant="outline"
      size={props.data?.skillsetName ? 'sm' : 'icon-sm'}
      className={`group/skill-name nodrag nopan rounded-full transition-colors border-blue-600 bg-blue-600 text-white shadow-sm hover:border-blue-700 hover:bg-blue-700 hover:text-white ${props.data?.skillsetName ? 'w-max max-w-none' : ''}`}
      aria-label={props.data?.label}
      aria-haspopup="dialog"
      onClick={props.data?.onOpen}
    >
      {props.data?.skillsetName ? (
        <span className="grid w-max grid-cols-[max-content] text-center">
          <span className="col-start-1 row-start-1 whitespace-nowrap group-hover/skill-name:invisible group-focus-visible/skill-name:invisible">
            {props.data.skillsetName}
          </span>
          <span
            aria-hidden="true"
            className="invisible col-start-1 row-start-1 group-hover/skill-name:visible group-focus-visible/skill-name:visible"
          >
            수정하기
          </span>
        </span>
      ) : (
        <Plus />
      )}
    </Button>
  );
  return (
    <>
      <BaseEdge
        id={props.id}
        path={path}
        interactionWidth={0}
        markerEnd={props.markerEnd}
        style={{
          stroke: 'var(--muted-foreground)',
          strokeWidth: 1.5,
          pointerEvents: 'none',
        }}
      />
      <EdgeLabelRenderer>
        {props.data?.readOnly && props.data.skillsetName && (
          <button
            className="absolute rounded-full bg-blue-600 px-3 py-1 text-sm text-white"
            style={{
              pointerEvents: 'all',
              transform: `translate(-50%, -50%) translate(${x}px,${y - 40}px)`,
            }}
            onClick={props.data.onOpen}
          >
            {props.data.skillsetName}
          </button>
        )}
        {!props.data?.readOnly && !props.data?.hideControls && (
          <motion.div
            className="absolute left-0 top-0"
            initial={{ opacity: 0, y: reducedMotion ? 0 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: reducedMotion ? 0 : 0.18,
              delay: reducedMotion ? 0 : 0.06,
            }}
          >
            <Button
              variant="outline"
              size="icon-xs"
              className="nodrag nopan absolute rounded-full transition-colors bg-background hover:border-red-300 hover:bg-red-50 hover:text-red-700"
              style={{
                pointerEvents: 'all',
                transform: `translate(-50%, -50%) translate(${x}px,${y}px)`,
              }}
              aria-label={props.data?.removeLabel}
              title="연결 제거"
              onClick={props.data?.onRemove}
            >
              <Minus />
            </Button>
            <div
              className="group/skill nodrag nopan absolute"
              style={{
                pointerEvents: 'all',
                transform: `translate(-50%, -50%) translate(${x}px,${y - 40}px)`,
              }}
            >
              {props.data?.skillsetName ? (
                <>
                  {skillButton}
                  <Button
                    variant="outline"
                    size="icon-xs"
                    className="nodrag nopan absolute -right-2 -top-2 rounded-full border-border bg-white text-muted-foreground opacity-0 pointer-events-none transition-opacity group-hover/skill:opacity-100 group-hover/skill:pointer-events-auto group-focus-within/skill:opacity-100 group-focus-within/skill:pointer-events-auto hover:bg-white hover:text-red-600 [@media(hover:none)]:opacity-100 [@media(hover:none)]:pointer-events-auto"
                    aria-label={`${props.data.skillsetName} 이 연결에서 제거`}
                    onClick={(event) => {
                      event.stopPropagation();
                      props.data?.onDetachSkill();
                    }}
                  >
                    <X />
                  </Button>
                </>
              ) : (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger render={skillButton} />
                    <TooltipContent>연계 스킬 추가</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </motion.div>
        )}
      </EdgeLabelRenderer>
    </>
  );
}
const nodeTypes = { activity: ActivityCard };
const edgeTypes = { skill: SkillConnection };

function CanvasControls({ count }: { count: number }) {
  const { zoomIn, zoomOut, fitView } = useReactFlow();
  const initialized = useNodesInitialized();
  const fittedCount = useRef(0);
  useEffect(() => {
    if (!count) fittedCount.current = 0;
    if (initialized && count && fittedCount.current !== count) {
      fittedCount.current = count;
      void fitView({ padding: 0.2, maxZoom: 1 });
    }
  }, [count, initialized, fitView]);
  return (
    <Panel position="bottom-left">
      <div className="flex gap-1 rounded-lg border bg-background p-1 shadow-sm">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="확대"
          onClick={() => void zoomIn()}
        >
          <Plus />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="축소"
          onClick={() => void zoomOut()}
        >
          <Minus />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="전체 탐구줄기 보기"
          onClick={() => void fitView({ padding: 0.2, maxZoom: 1 })}
        >
          <Maximize />
        </Button>
      </div>
    </Panel>
  );
}

export function linkNodePosition(
  node: LinkNode,
  nodes: LinkNode[],
): XYPosition {
  return (
    node.position ?? {
      x: node.column * 400,
      y:
        nodes.filter((item) => item.column === node.column).indexOf(node) * 160,
    }
  );
}

export function ExplorationLinkGraph({
  userId,
  readOnly = false,
  graph,
  onDraftChange,
  onAdd,
  onRemove,
  onDisconnect,
  onSkillsetChange,
  onDetachSkill,
  onConnect,
  onMove,
}: Props) {
  const reducedMotion = useReducedMotion();
  const canvasRef = useRef<HTMLDivElement>(null);
  const previewId = useId().replaceAll(':', '');
  const [pending, setPending] = useState<{
    id: string;
    side: string;
    zoom: number;
    x: number;
    y: number;
  } | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  useEffect(() => {
    if (!pending) return;
    const cancelOutside = (event: PointerEvent) => {
      if (
        !(event.target instanceof Element) ||
        (!event.target.closest('[data-link-port]') &&
          (!event.target.closest('[data-link-card]') ||
            !!event.target.closest('button')))
      )
        setPending(null);
    };
    const cancel = () => setPending(null);
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') cancel();
    };
    document.addEventListener('pointerdown', cancelOutside, true);
    document.addEventListener('keydown', key);
    document.addEventListener('wheel', cancel, true);
    window.addEventListener('resize', cancel);
    window.addEventListener('scroll', cancel, true);
    return () => {
      document.removeEventListener('pointerdown', cancelOutside, true);
      document.removeEventListener('keydown', key);
      document.removeEventListener('wheel', cancel, true);
      window.removeEventListener('resize', cancel);
      window.removeEventListener('scroll', cancel, true);
    };
  }, [pending]);
  function selectPort(id: string, side: string, element: HTMLElement) {
    if (pending?.id === id) {
      setPending(null);
      return;
    }
    const bounds = canvasRef.current?.getBoundingClientRect();
    if (!bounds) return;
    const port = element.getBoundingClientRect();
    const point = {
      x: port.right - bounds.left,
      y: port.top + port.height / 2 - bounds.top,
    };
    const zoom =
      (element.closest('[data-link-card]')?.getBoundingClientRect().height ??
        88) / 88;
    setPending({ id, side, zoom, ...point });
    setPointer(point);
  }
  function connectTarget(id: string) {
    if (pending && canConnectLink(graph.edges, pending.id, id))
      onConnect({
        from: pending.id,
        to: id,
        sourceHandle: 'right',
        targetHandle: 'left',
      });
    setPending(null);
  }
  const [dimensions, setDimensions] = useState<
    Record<string, { width: number; height: number }>
  >({});
  const [draggingIds, setDraggingIds] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [skillMode, setSkillMode] = useState<'existing' | 'new' | 'edit'>(
    'existing',
  );
  const [skillsetName, setSkillsetName] = useState('');
  const [skillsetDescription, setSkillsetDescription] = useState('');
  const [selectedEdge, setSelectedEdge] = useState<LinkEdge | null>(null);
  const [editDirty, setEditDirty] = useState(false);
  const newDirty =
    !!selectedEdge &&
    skillMode !== 'edit' &&
    (!!skillsetName || !!skillsetDescription);
  const { requestDiscard, discardDialog } = useSkillDiscard(newDirty);
  useEffect(() => {
    onDraftChange(newDirty || editDirty);
  }, [newDirty, editDirty, onDraftChange]);

  const positions = new Map(
    graph.nodes.map((node) => [
      node.activity.clientKey,
      linkNodePosition(node, graph.nodes),
    ]),
  );
  const nodes: ActivityNode[] = graph.nodes.map((node) => ({
    id: node.activity.clientKey,
    type: 'activity',
    width: 240,
    height: 88,
    measured: dimensions[node.activity.clientKey],
    selected: selectedIds.includes(node.activity.clientKey),
    position: positions.get(node.activity.clientKey)!,
    data: {
      readOnly,
      title: explorationTitle(node.activity),
      onRemove,
      onPort: selectPort,
      connecting: !!pending,
      canTarget:
        !!pending &&
        canConnectLink(graph.edges, pending.id, node.activity.clientKey),
      onTarget: connectTarget,
    },
    ariaLabel: `${explorationTitle(node.activity)}. 방향키로 카드를 이동할 수 있습니다.`,
  }));
  const edges: SkillEdge[] = graph.edges.map((edge) => {
    const skill = graph.skills?.find((item) => item.id === edge.skillId);
    const fromTitle = nodes.find((node) => node.id === edge.from)!.data.title;
    const toTitle = nodes.find((node) => node.id === edge.to)!.data.title;
    return {
      id: `${edge.from}:${edge.to}`,
      type: 'skill',
      selectable: false,
      focusable: false,
      style: { pointerEvents: 'none' },
      source: edge.from,
      target: edge.to,
      sourceHandle: 'right',
      targetHandle: 'left',
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: 'var(--muted-foreground)',
      },
      data: {
        readOnly,
        label: skill
          ? `${fromTitle}에서 ${toTitle} 연계 스킬 ${skill.name} 수정`
          : `${fromTitle}에서 ${toTitle} 연계 스킬 추가`,
        hideControls:
          draggingIds.includes(edge.from) || draggingIds.includes(edge.to),
        skillsetName: skill?.name,
        onDetachSkill: () => {
          onDetachSkill(edge);
          setSelectedEdge(null);
        },
        onOpen: () => {
          setSkillMode(
            skill ? 'edit' : graph.skills?.length ? 'existing' : 'new',
          );
          setSkillsetName('');
          setSkillsetDescription('');
          setSelectedEdge(edge);
        },
        removeLabel: `${fromTitle}에서 ${toTitle} 연결 제거`,
        onRemove: () => {
          onDisconnect(edge);
          setSelectedEdge(null);
        },
      },
    };
  });
  const selectedSkill = graph.skills?.find(
    (skill) => skill.id === selectedEdge?.skillId,
  );
  const selectedSource = graph.nodes.find(
    (node) => node.activity.clientKey === selectedEdge?.from,
  );
  const selectedTarget = graph.nodes.find(
    (node) => node.activity.clientKey === selectedEdge?.to,
  );
  return (
    <>
      <div
        ref={canvasRef}
        onPointerMove={(event) => {
          if (pending && canvasRef.current) {
            const bounds = canvasRef.current.getBoundingClientRect();
            const target = (event.target as Element).closest<HTMLElement>(
              '[data-link-card]',
            );
            const id = target?.dataset.linkId;
            const targetBounds =
              id && canConnectLink(graph.edges, pending.id, id)
                ? target?.getBoundingClientRect()
                : undefined;
            setPointer({
              x: targetBounds
                ? targetBounds.left - bounds.left
                : event.clientX - bounds.left,
              y: targetBounds
                ? targetBounds.top + targetBounds.height / 2 - bounds.top
                : event.clientY - bounds.top,
            });
          }
        }}
        className="relative h-[520px] w-full cursor-grab overflow-hidden rounded-lg border bg-muted sm:h-[600px]"
        role="region"
        aria-label="확대·축소와 카드 이동이 가능한 탐구줄기 캔버스"
      >
        <ReactFlowProvider>
          <ReactFlow<ActivityNode, SkillEdge>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            onNodeDragStart={(_event, node, nodes) =>
              setDraggingIds(
                nodes.length ? nodes.map((item) => item.id) : [node.id],
              )
            }
            onNodeDragStop={() => setDraggingIds([])}
            onSelectionDragStart={(_event, nodes) =>
              setDraggingIds(nodes.map((node) => node.id))
            }
            onSelectionDragStop={() => setDraggingIds([])}
            onNodesChange={(changes) => {
              const measured = changes.filter(
                (change) => change.type === 'dimensions',
              );
              if (measured.length)
                setDimensions((current) => {
                  let next = current;
                  for (const change of measured) {
                    const size = change.dimensions;
                    if (!size) continue;
                    if (
                      current[change.id]?.width === size.width &&
                      current[change.id]?.height === size.height
                    )
                      continue;
                    if (next === current) next = { ...current };
                    next[change.id] = size;
                  }
                  return next;
                });
              const selections = changes.filter(
                (change) => change.type === 'select',
              );
              if (selections.length)
                setSelectedIds((ids) => {
                  const next = new Set(ids);
                  for (const change of selections) {
                    if (change.selected) next.add(change.id);
                    else next.delete(change.id);
                  }
                  return [...next];
                });
              const moved = changes.flatMap((change) =>
                change.type === 'position' && change.position
                  ? [{ id: change.id, position: change.position }]
                  : [],
              );
              if (moved.length) onMove(moved);
            }}
            fitView
            minZoom={0.2}
            maxZoom={2}
            fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
            connectionMode={ConnectionMode.Loose}
            connectOnClick={false}
            nodesDraggable={!pending}
            isValidConnection={(connection) =>
              !!connection.source &&
              !!connection.target &&
              canConnectLink(graph.edges, connection.source, connection.target)
            }
            onConnect={(connection) => {
              if (connection.source && connection.target)
                onConnect({
                  from: connection.source,
                  to: connection.target,
                  sourceHandle: connection.sourceHandle ?? undefined,
                  targetHandle: connection.targetHandle ?? undefined,
                });
            }}
            edgesFocusable={false}
            deleteKeyCode={null}
            panOnScroll={false}
            zoomOnScroll={false}
            zoomOnPinch
            preventScrolling={false}
            ariaLabelConfig={{
              'node.a11yDescription.default':
                'Enter로 카드를 선택하고 방향키로 이동하세요. Escape로 선택을 해제합니다.',
              'node.a11yDescription.keyboardDisabled':
                '카드를 드래그하여 이동하세요.',
            }}
          >
            <Background
              variant={BackgroundVariant.Lines}
              bgColor="var(--muted)"
              color="var(--border)"
              gap={24}
              lineWidth={0.5}
            />
            <CanvasControls count={nodes.length} />
            <Panel
              position="top-right"
              style={readOnly ? { display: 'none' } : undefined}
            >
              <Button variant="outline" onClick={onAdd}>
                <Plus />
                탐구활동 배치하기
              </Button>
            </Panel>
          </ReactFlow>
        </ReactFlowProvider>
        {pending && (
          <svg
            className="pointer-events-none absolute inset-0 z-10 h-full w-full"
            aria-hidden="true"
          >
            <defs>
              <marker
                id={previewId}
                viewBox="0 0 10 10"
                refX="9"
                refY="5"
                markerWidth="7"
                markerHeight="7"
                orient="auto"
              >
                <path
                  d="M 0 0 L 10 5 L 0 10 z"
                  fill="var(--muted-foreground)"
                />
              </marker>
            </defs>
            <path
              d={
                getBezierPath({
                  sourceX: pending.x / pending.zoom,
                  sourceY: pending.y / pending.zoom,
                  targetX: pointer.x / pending.zoom,
                  targetY: pointer.y / pending.zoom,
                  sourcePosition: Position.Right,
                  targetPosition: Position.Left,
                })[0]
              }
              transform={`scale(${pending.zoom})`}
              fill="none"
              stroke="var(--muted-foreground)"
              strokeWidth="1.5"
              markerEnd={`url(#${previewId})`}
            />
          </svg>
        )}
        <span className="sr-only" role="status">
          {pending
            ? '후속 탐구 카드를 누르세요. 다른 곳을 누르거나 Escape를 누르면 취소됩니다.'
            : ''}
        </span>
      </div>
      {readOnly && selectedSkill && (
        <Dialog
          open
          onOpenChange={(open) => {
            if (!open) setSelectedEdge(null);
          }}
        >
          <DialogContent className="sm:max-w-xl">
            <DialogHeader>
              <DialogTitle>{selectedSkill.name}</DialogTitle>
            </DialogHeader>
            <p className="whitespace-pre-wrap">{selectedSkill.description}</p>
          </DialogContent>
        </Dialog>
      )}
      {!readOnly &&
        skillMode === 'edit' &&
        selectedEdge &&
        selectedSkill &&
        selectedSource &&
        selectedTarget && (
          <ExplorationSkillEditDialog
            onDirtyChange={setEditDirty}
            key={selectedSkill.id}
            skill={selectedSkill}
            usageCount={
              graph.edges.filter((edge) => edge.skillId === selectedSkill.id)
                .length
            }
            onClose={() => setSelectedEdge(null)}
            onSave={(skill) => {
              onSkillsetChange(selectedEdge, skill);
              setSelectedEdge(null);
            }}
            onReplace={() => {
              setSkillMode('existing');
            }}
          />
        )}
      {discardDialog}
      <Dialog
        open={
          skillMode !== 'edit' &&
          !!selectedEdge &&
          !!selectedSource &&
          !!selectedTarget
        }
        onOpenChange={(open) => {
          if (!open) requestDiscard(() => setSelectedEdge(null));
        }}
      >
        <DialogContent className="max-h-[85dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>탐구활동 연계 스킬셋</DialogTitle>
          </DialogHeader>
          <div
            className="flex gap-2"
            role="group"
            aria-label="연계 스킬 선택 방식"
          >
            <Button
              variant={skillMode === 'existing' ? 'secondary' : 'ghost'}
              aria-pressed={skillMode === 'existing'}
              onClick={() => setSkillMode('existing')}
            >
              기존 스킬 선택
            </Button>
            <Button
              variant={skillMode === 'new' ? 'secondary' : 'ghost'}
              aria-pressed={skillMode === 'new'}
              onClick={() => {
                setSkillMode('new');
              }}
            >
              새 스킬 만들기
            </Button>
          </div>
          <motion.div
            initial={false}
            animate={{ height: skillMode === 'existing' ? 416 : 344 }}
            transition={{
              duration: reducedMotion ? 0 : 0.22,
              ease: 'easeInOut',
            }}
            className="overflow-hidden"
          >
            {skillMode === 'existing' ? (
              <ExplorationLinkSkillPicker
                userId={userId}
                local={graph.skills ?? []}
                onSelect={(skill) =>
                  requestDiscard(() => {
                    if (selectedEdge) onSkillsetChange(selectedEdge, skill);
                    setSelectedEdge(null);
                  })
                }
              />
            ) : (
              <>
                <form
                  className="flex h-full min-h-0 flex-col gap-5"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (
                      !selectedEdge ||
                      !skillsetName.trim() ||
                      !skillsetDescription.trim()
                    )
                      return;
                    onSkillsetChange(selectedEdge, {
                      id: crypto.randomUUID(),
                      name: skillsetName.trim(),
                      description: skillsetDescription.trim(),
                    });
                    setSelectedEdge(null);
                  }}
                >
                  <div className="space-y-2">
                    <Label htmlFor={`${previewId}-skillset-name`}>
                      연계 스킬 이름 <span className="text-destructive">*</span>
                      <span className="sr-only">필수</span>
                    </Label>
                    <Input
                      id={`${previewId}-skillset-name`}
                      required
                      maxLength={200}
                      value={skillsetName}
                      onChange={(event) => setSkillsetName(event.target.value)}
                      placeholder="예: 이론 to 사례"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor={`${previewId}-skillset-description`}>
                      설명 <span className="text-destructive">*</span>
                      <span className="sr-only">필수</span>
                    </Label>
                    <Textarea
                      id={`${previewId}-skillset-description`}
                      required
                      maxLength={5000}
                      value={skillsetDescription}
                      onChange={(event) =>
                        setSkillsetDescription(event.target.value)
                      }
                      placeholder="기초 이론, 기반이 되는 배경 이론 등을 탐구한 후 해당 이론이 적용된 실제 사례 탐구/실험/개발로 후속 연계"
                      className="h-32 resize-none"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        requestDiscard(() => setSelectedEdge(null))
                      }
                    >
                      취소
                    </Button>
                    <Button
                      type="submit"
                      disabled={
                        !skillsetName.trim() || !skillsetDescription.trim()
                      }
                    >
                      저장하기
                    </Button>
                  </div>
                </form>
              </>
            )}
          </motion.div>
        </DialogContent>
      </Dialog>
    </>
  );
}
