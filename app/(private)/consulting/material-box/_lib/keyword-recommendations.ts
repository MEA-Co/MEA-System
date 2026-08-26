export type MaterialBoxKeywordRecommendation = {
  major: string;
  keyword: string;
  summary: string;
  university: string;
  departmentName: string;
  departmentUrl: string;
  labName: string;
  labUrl: string;
};

export type MaterialBoxKeywordRecommendationsResponse = {
  recommendations: Array<MaterialBoxKeywordRecommendation>;
};
