import { ArrowLeft } from 'lucide-react';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { isMaterialBoxProgressScreenData } from '@/app/(private)/consulting/material-box/_lib/types';
import { MaterialBoxCompleteScreen } from '@/app/(private)/consulting/material-box/_screens/report/MaterialBoxCompleteScreen';
import { Button } from '@/components/ui/button';
import {
  MATERIAL_BOX_CONSULTING_ID,
  MATERIAL_BOX_CONSULTING_TITLE,
  TEMP_STUDENT_CONSULTING_RESULTS_TABLE,
  type TempStudentConsultingResultRow,
} from '@/features/consulting/completion';
import { requireUserAccess } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function MaterialBoxResultPage() {
  const { user } = await requireUserAccess({ allowedRoles: ['student'] });
  const supabase = createClient(await cookies());
  const result = await supabase
    .from(TEMP_STUDENT_CONSULTING_RESULTS_TABLE)
    .select('result_data')
    .eq('student_id', user.id)
    .eq('consulting_id', MATERIAL_BOX_CONSULTING_ID)
    .maybeSingle<Pick<TempStudentConsultingResultRow, 'result_data'>>();

  if (result.error) {
    throw new Error('Failed to load the completed consulting result.', {
      cause: result.error,
    });
  }
  if (
    !result.data ||
    !isMaterialBoxProgressScreenData(result.data.result_data)
  ) {
    redirect('/consulting/material-box');
  }

  return (
    <main className="min-h-svh bg-muted/30">
      <header className="border-b bg-background">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center gap-3 px-4 py-3 md:px-6 lg:px-8">
          <Button
            render={<Link href="/dashboard?view=consulting" />}
            nativeButton={false}
            variant="ghost"
            size="icon-sm"
            aria-label="컨설팅 목록으로 돌아가기"
          >
            <ArrowLeft />
          </Button>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">
              {MATERIAL_BOX_CONSULTING_TITLE}
            </p>
            <p className="text-xs text-muted-foreground">완료 결과</p>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-5 md:px-6 md:py-7 lg:px-8">
        <MaterialBoxCompleteScreen
          completion={null}
          data={result.data.result_data}
          showExampleReports={false}
        />
      </div>
    </main>
  );
}
