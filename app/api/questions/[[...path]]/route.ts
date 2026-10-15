import { handleQuestionRequest } from '@/app/(private)/dashboard/_views/questions/lib/question-server';

export const dynamic = 'force-dynamic';
export const GET = handleQuestionRequest;
export const POST = handleQuestionRequest;
export const PUT = handleQuestionRequest;
export const DELETE = handleQuestionRequest;
