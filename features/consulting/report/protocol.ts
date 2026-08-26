export type ConsultingReportMetadata = {
  title: string;
  author: string;
  subject: string;
  language: string;
  creator: string;
};

export type ConsultingReportMetaItem = {
  label: string;
  value: string;
};

export type ConsultingReportOverviewCard = {
  label: string;
  values: Array<string>;
};

export type ConsultingReportSection = {
  number?: string;
  eyebrow?: string;
  title: string;
  content: string;
};

export type ConsultingReportSectionGroup = {
  title: string;
  caption?: string;
  sections: Array<ConsultingReportSection>;
};

export type ConsultingReportCallout = {
  label?: string;
  title: string;
  content: string;
};

export type ConsultingReportStep = {
  number?: string;
  title: string;
  description: string;
};

export type ConsultingReportDocument = {
  metadata: ConsultingReportMetadata;
  header: {
    brand: string;
    label: string;
  };
  footer: string;
  hero: {
    eyebrow?: string;
    title: string;
    description?: string;
    meta?: Array<ConsultingReportMetaItem>;
  };
  overview?: {
    title: string;
    caption?: string;
    cards: Array<ConsultingReportOverviewCard>;
  };
  sectionGroups: Array<ConsultingReportSectionGroup>;
  callout?: ConsultingReportCallout;
  nextSteps?: {
    title: string;
    caption?: string;
    items: Array<ConsultingReportStep>;
  };
};

export type ConsultingReportRequest = {
  fileName: string;
  document: ConsultingReportDocument;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isText(value: unknown, maxLength: number): value is string {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

function isOptionalText(value: unknown, maxLength: number) {
  return value === undefined || isText(value, maxLength);
}

function isMetadata(value: unknown): value is ConsultingReportMetadata {
  if (!isRecord(value)) return false;

  return (
    isText(value.title, 180) &&
    isText(value.author, 120) &&
    isText(value.subject, 240) &&
    isText(value.language, 20) &&
    isText(value.creator, 120)
  );
}

function isMetaItem(value: unknown): value is ConsultingReportMetaItem {
  return isRecord(value) && isText(value.label, 80) && isText(value.value, 500);
}

function isOverviewCard(value: unknown): value is ConsultingReportOverviewCard {
  if (!isRecord(value) || !isText(value.label, 80)) return false;

  return (
    Array.isArray(value.values) &&
    value.values.length > 0 &&
    value.values.length <= 10 &&
    value.values.every((item) => isText(item, 500))
  );
}

function isSection(value: unknown): value is ConsultingReportSection {
  return (
    isRecord(value) &&
    isOptionalText(value.number, 20) &&
    isOptionalText(value.eyebrow, 80) &&
    isText(value.title, 180) &&
    isText(value.content, 5_000)
  );
}

function isSectionGroup(value: unknown): value is ConsultingReportSectionGroup {
  if (
    !isRecord(value) ||
    !isText(value.title, 180) ||
    !isOptionalText(value.caption, 100)
  ) {
    return false;
  }

  return (
    Array.isArray(value.sections) &&
    value.sections.length > 0 &&
    value.sections.length <= 20 &&
    value.sections.every(isSection)
  );
}

function isCallout(value: unknown): value is ConsultingReportCallout {
  return (
    isRecord(value) &&
    isOptionalText(value.label, 80) &&
    isText(value.title, 180) &&
    isText(value.content, 5_000)
  );
}

function isStep(value: unknown): value is ConsultingReportStep {
  return (
    isRecord(value) &&
    isOptionalText(value.number, 20) &&
    isText(value.title, 180) &&
    isText(value.description, 2_000)
  );
}

function isDocument(value: unknown): value is ConsultingReportDocument {
  if (!isRecord(value) || !isMetadata(value.metadata)) return false;

  const { header, hero, overview, sectionGroups, callout, nextSteps } = value;
  if (
    !isRecord(header) ||
    !isText(header.brand, 40) ||
    !isText(header.label, 120) ||
    !isText(value.footer, 180) ||
    !isRecord(hero) ||
    !isOptionalText(hero.eyebrow, 80) ||
    !isText(hero.title, 500) ||
    !isOptionalText(hero.description, 500) ||
    (hero.meta !== undefined &&
      (!Array.isArray(hero.meta) ||
        hero.meta.length > 6 ||
        !hero.meta.every(isMetaItem))) ||
    !Array.isArray(sectionGroups) ||
    sectionGroups.length > 12 ||
    !sectionGroups.every(isSectionGroup) ||
    (callout !== undefined && !isCallout(callout))
  ) {
    return false;
  }

  if (overview !== undefined) {
    if (
      !isRecord(overview) ||
      !isText(overview.title, 180) ||
      !isOptionalText(overview.caption, 100) ||
      !Array.isArray(overview.cards) ||
      overview.cards.length === 0 ||
      overview.cards.length > 6 ||
      !overview.cards.every(isOverviewCard)
    ) {
      return false;
    }
  }

  if (nextSteps !== undefined) {
    if (
      !isRecord(nextSteps) ||
      !isText(nextSteps.title, 180) ||
      !isOptionalText(nextSteps.caption, 100) ||
      !Array.isArray(nextSteps.items) ||
      nextSteps.items.length === 0 ||
      nextSteps.items.length > 20 ||
      !nextSteps.items.every(isStep)
    ) {
      return false;
    }
  }

  return true;
}

function isPdfFileName(value: unknown): value is string {
  return (
    isText(value, 180) &&
    value.toLocaleLowerCase('en-US').endsWith('.pdf') &&
    !/[\\/\u0000-\u001f\u007f]/.test(value)
  );
}

export function isConsultingReportRequest(
  value: unknown,
): value is ConsultingReportRequest {
  return (
    isRecord(value) &&
    isPdfFileName(value.fileName) &&
    isDocument(value.document)
  );
}
