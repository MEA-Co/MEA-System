import { NextResponse } from 'next/server';

import { createMaterialBoxReportDocument } from '@/app/(private)/consulting/material-box/_report/document';
import { isMaterialBoxReportRequest } from '@/app/(private)/consulting/material-box/_report/protocol';
import { createPdfDownloadResponse } from '@/features/consulting/report/server';
import { getUserAccess, hasRole } from '@/lib/auth';
import { MEMBER_ROLES } from '@/lib/profile';

export const runtime = 'nodejs';

const MAX_REQUEST_LENGTH = 128_000;

export async function POST(request: Request) {
  const access = await getUserAccess();

  if (!access.isAuthenticated) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  if (!hasRole(access, MEMBER_ROLES)) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  const rawBody = await request.text();
  if (!rawBody || rawBody.length > MAX_REQUEST_LENGTH) {
    return NextResponse.json(
      { error: 'PDF 요청 크기가 올바르지 않습니다.' },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      { error: '요청 형식이 올바르지 않습니다.' },
      { status: 400 },
    );
  }

  if (!isMaterialBoxReportRequest(body)) {
    return NextResponse.json(
      { error: 'PDF 입력값이 올바르지 않습니다.' },
      { status: 400 },
    );
  }

  try {
    return await createPdfDownloadResponse(
      createMaterialBoxReportDocument(body.report),
      body.fileName,
    );
  } catch {
    return NextResponse.json(
      { error: 'PDF 생성 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
