import { renderToBuffer } from '@react-pdf/renderer';
import { NextResponse } from 'next/server';

import type { MaterialBoxMemory } from '@/features/material-box-consulting/model/types';
import { materialBoxReportFileName } from '@/features/material-box-consulting/report/content';
import { createMaterialBoxReportDocument } from '@/features/material-box-consulting/report/MaterialBoxReportDocument';
import { getUserAccess, hasRole } from '@/lib/auth';

export const runtime = 'nodejs';

function isStringWithinLimit(value: unknown, maxLength = 500) {
  return (
    typeof value === 'string' &&
    value.trim().length > 0 &&
    value.length <= maxLength
  );
}

function isMaterialBoxMemory(value: unknown): value is MaterialBoxMemory {
  if (!value || typeof value !== 'object') return false;

  const candidate = value as Partial<MaterialBoxMemory>;
  const majors = candidate.majorPreferences;

  return (
    Array.isArray(majors) &&
    majors.length > 0 &&
    majors.length <= 3 &&
    majors.every(
      (preference) =>
        preference &&
        typeof preference === 'object' &&
        isStringWithinLimit(preference.major, 120),
    ) &&
    isStringWithinLimit(candidate.keyword, 200) &&
    isStringWithinLimit(candidate.careerIdentity, 80) &&
    isStringWithinLimit(candidate.coreValue, 180) &&
    isStringWithinLimit(candidate.fieldStrength, 180) &&
    isStringWithinLimit(candidate.personalStrength, 180)
  );
}

export async function POST(request: Request) {
  const access = await getUserAccess();

  if (!access.isAuthenticated) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  }

  if (!hasRole(access, ['admin'])) {
    return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: '요청 형식이 올바르지 않습니다.' },
      { status: 400 },
    );
  }

  if (!isMaterialBoxMemory(body)) {
    return NextResponse.json(
      { error: '리포트 입력값이 올바르지 않습니다.' },
      { status: 400 },
    );
  }

  try {
    const pdfBuffer = await renderToBuffer(
      createMaterialBoxReportDocument({
        memory: body,
        issuedAt: new Date(),
      }),
    );

    return new Response(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(materialBoxReportFileName)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch {
    return NextResponse.json(
      { error: 'PDF 생성 중 오류가 발생했습니다.' },
      { status: 500 },
    );
  }
}
