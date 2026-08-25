export type MajorPreference = {
  major: string;
};

export type KeywordRecommendation = {
  major: string;
  keyword: string;
  summary: string;
  university: string;
  departmentName: string;
  departmentUrl: string;
  labName: string;
  labUrl: string;
};

export type KeywordRecommendationsResponse = {
  recommendations: Array<KeywordRecommendation>;
};

export type MaterialBoxMemory = {
  majorPreferences: Array<MajorPreference>;
  keyword: string;
  careerIdentity: string;
  coreValue: string;
  fieldStrength: string;
  personalStrength: string;
};
