import { NextResponse } from 'next/server';
import { z } from 'zod';

import { extractCurriculum } from '@/features/subject-selection/extract';
import {
  downloadAttachment,
  ImportError,
  listAttachments,
  MAX_FILE_BYTES,
  searchSchools,
} from '@/features/subject-selection/schoolinfo';
import { getUserAccess, hasRole } from '@/lib/auth';
import { MEMBER_ROLES } from '@/lib/profile';

export const runtime = 'nodejs';
export const maxDuration = 180;
const schoolIdSchema = z.string().uuid();
const yearSchema = z.coerce.number().int().min(2000).max(2100);
const contextSchema = z.object({
  school: z.string().trim().min(1).max(100),
  cohort: yearSchema,
  sourceYear: yearSchema,
  track: z.string().trim().max(100).optional().default(''),
});
const activeUsers = new Set<string>();

async function authorize() {
  const access = await getUserAccess();
  if (!access.user) throw new ImportError('로그인이 필요합니다.', 401);
  if (!hasRole(access, MEMBER_ROLES))
    throw new ImportError('접근 권한이 없습니다.', 403);
  return access.user.id;
}

function failure(error: unknown) {
  return NextResponse.json(
    {
      error:
        error instanceof ImportError
          ? error.message
          : error instanceof z.ZodError
            ? '입력값을 확인해 주세요.'
            : '가져오기에 실패했습니다. 학교알리미 연결 또는 분석 설정을 확인한 뒤 다시 시도해 주세요.',
    },
    {
      status:
        error instanceof ImportError
          ? error.status
          : error instanceof z.ZodError
            ? 400
            : 502,
    },
  );
}

export async function GET(request: Request) {
  try {
    await authorize();
    const params = new URL(request.url).searchParams;
    const schoolId = params.get('schoolId');
    const data = schoolId
      ? {
          files: await listAttachments(
            schoolIdSchema.parse(schoolId),
            yearSchema.parse(params.get('year')),
          ),
        }
      : await searchSchools(
          z.string().trim().min(2).max(60).parse(params.get('q')),
        );
    return NextResponse.json(data, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return failure(error);
  }
}

export async function POST(request: Request) {
  let userId: string | undefined;
  try {
    const authorizedId = await authorize();
    if (activeUsers.has(authorizedId))
      throw new ImportError(
        '진행 중인 분석이 있습니다. 완료 후 다시 시도해 주세요.',
        429,
      );
    activeUsers.add(authorizedId);
    userId = authorizedId;
    if (Number(request.headers.get('content-length')) > MAX_FILE_BYTES + 64_000)
      throw new ImportError('파일은 12MB 이하만 지원합니다.');
    let bytes: Buffer;
    let source: { name: string; url: string | null };
    let context: z.infer<typeof contextSchema>;
    if (request.headers.get('content-type')?.includes('multipart/form-data')) {
      // Bound the streamed body before multipart parsing, including chunked requests.
      const reader = request.body?.getReader();
      if (!reader) throw new ImportError('파일이 없습니다.');
      const chunks: Uint8Array[] = [];
      let size = 0;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          size += value.length;
          if (size > MAX_FILE_BYTES + 64_000)
            throw new ImportError('파일은 12MB 이하만 지원합니다.');
          chunks.push(value);
        }
      } finally {
        await reader.cancel();
      }
      const form = await new Response(Buffer.concat(chunks), {
        headers: { 'Content-Type': request.headers.get('content-type')! },
      }).formData();
      context = contextSchema.parse(
        Object.fromEntries(
          ['school', 'cohort', 'sourceYear', 'track'].map((key) => [
            key,
            form.get(key) ?? undefined,
          ]),
        ),
      );
      const file = form.get('file');
      if (!(file instanceof File) || !file.size || file.size > MAX_FILE_BYTES)
        throw new ImportError('12MB 이하의 편제표 파일을 선택해 주세요.');
      bytes = Buffer.from(await file.arrayBuffer());
      source = { name: file.name.slice(0, 200), url: null };
    } else {
      const raw = await request.text();
      if (raw.length > 4000) throw new ImportError('요청이 너무 큽니다.');
      const body = JSON.parse(raw);
      context = contextSchema.parse(body);
      const { file, bytes: downloaded } = await downloadAttachment(
        schoolIdSchema.parse(body.schoolId),
        context.sourceYear,
        z
          .string()
          .regex(/^\d{1,6}$/)
          .parse(body.fileId),
      );
      bytes = downloaded;
      source = { name: file.name, url: file.url };
    }
    return NextResponse.json(await extractCurriculum(bytes, source, context), {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return failure(error);
  } finally {
    if (userId) activeUsers.delete(userId);
  }
}
