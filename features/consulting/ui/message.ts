export type ConsultingMessageEmphasis = 'strong' | 'accent' | 'muted';

export type ConsultingMessageSegment = {
  text: string;
  emphasis?: ConsultingMessageEmphasis;
};

export type ConsultingMessage =
  string | ReadonlyArray<ConsultingMessageSegment>;
