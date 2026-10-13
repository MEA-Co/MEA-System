/** Shared reference and attachment values. Serialized shapes are kept stable. */
export type ContentReference = {
  clientKey: string;
  title: string;
  selection: string;
  usage: string;
};
export type ReportAttachment = {
  clientKey: string;
  name: string;
  size: number;
  type: string;
  lastModified: number;
  path?: string;
  file?: File;
};
