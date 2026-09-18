'use server';
import { manageQuestionnaireReview } from '../lib/server';
export async function requestQuestionnaireReview(input: unknown) {
  return manageQuestionnaireReview(input, 'request');
}
export async function resolveQuestionnaireReview(input: unknown) {
  return manageQuestionnaireReview(input, 'resolve');
}
