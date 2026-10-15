// Compatibility alias. New clients use /api/questions/:questionId/reviews.
import { handleQuestionReview } from '@/app/(private)/dashboard/_views/questions/lib/reviews/server';
export const GET = handleQuestionReview;
export const POST = handleQuestionReview;
export const PATCH = handleQuestionReview;
export const PUT = handleQuestionReview;
