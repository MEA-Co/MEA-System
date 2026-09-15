export type MajorKeyword = {
  id: string;
  name: string;
  description: string | null;
  examples: { id: string; label: string }[];
};
export type MajorOverview = {
  id: string;
  name: string;
  keywords: MajorKeyword[];
  sites: { department: string; url: string }[];
};
