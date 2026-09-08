import { load } from 'cheerio';
import iconv from 'iconv-lite';

import type { Attachment, School } from './schema';

export const SCHOOLINFO_ORIGIN = 'https://www.schoolinfo.go.kr';
export const MAX_FILE_BYTES = 12 * 1024 * 1024;

export class ImportError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

export async function readLimited(response: Response, limit = MAX_FILE_BYTES) {
  if (!response.ok || !response.body)
    throw new ImportError('학교알리미 응답을 가져오지 못했습니다.', 502);
  if (Number(response.headers.get('content-length')) > limit)
    throw new ImportError('파일은 12MB 이하만 지원합니다.');
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new ImportError('응답 크기 제한을 초과했습니다.');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks);
}

export function decodeDocument(bytes: Buffer) {
  const utf8 = bytes.toString('utf8');
  return /charset\s*=\s*["']?\s*(euc-kr|ks_c_5601|cp949)/i.test(utf8) ||
    utf8.includes('\ufffd')
    ? iconv.decode(bytes, 'euc-kr')
    : utf8;
}

async function schoolFetch(path: string, body?: URLSearchParams | string) {
  return fetch(new URL(path, SCHOOLINFO_ORIGIN), {
    method: body ? 'POST' : 'GET',
    body,
    headers: body
      ? { 'Content-Type': 'application/x-www-form-urlencoded' }
      : undefined,
    signal: AbortSignal.timeout(25_000),
    redirect: 'error',
    cache: 'no-store',
  });
}

export async function searchSchools(
  query: string,
): Promise<{ schools: School[]; provider: string }> {
  const apiKey = process.env.SCHOOLINFO_API_KEY;
  if (apiKey) {
    const response = await schoolFetch(
      '/openApi.do',
      new URLSearchParams({ apiKey, apiType: '0', schulKndCode: '04' }),
    );
    const data = JSON.parse(decodeDocument(await readLimited(response)));
    if (data.resultCode !== 'success' || !Array.isArray(data.list))
      throw new ImportError(
        '학교알리미 API 인증키 또는 응답을 확인해 주세요.',
        502,
      );
    const schools = data.list
      .filter((r: Record<string, unknown>) =>
        String(r.SCHUL_NM ?? '').includes(query),
      )
      .map((r: Record<string, unknown>) => ({
        id: String(r.SCHUL_CODE ?? ''),
        name: String(r.SCHUL_NM ?? ''),
        address: String(r.ADRES_BRKDN ?? ''),
      }));
    // Public disclosure uses UUIDs, not the Open API's school codes.
    const publicSchools = await searchPublicSchools(query);
    return {
      schools: publicSchools.filter((s) =>
        schools.some((a: School) => a.name === s.name),
      ),
      provider: 'open_api',
    };
  }
  return {
    schools: await searchPublicSchools(query),
    provider: 'public_search',
  };
}

async function searchPublicSchools(query: string): Promise<School[]> {
  const encoded = Array.from(iconv.encode(query, 'euc-kr'))
    .map((b) => `%${b.toString(16).padStart(2, '0')}`)
    .join('');
  const response = await schoolFetch(
    '/ei/ss/pneiss_a04_s0/getSchoolList.do',
    `SEARCH_WORD=${encoded}`,
  );
  const rows: unknown = JSON.parse(decodeDocument(await readLimited(response)));
  if (!Array.isArray(rows))
    throw new ImportError('학교 검색 응답 형식이 변경되었습니다.', 502);
  return rows
    .filter((r) => r.SCHUL_KIND === '04' && typeof r.SHL_IDF_CD === 'string')
    .slice(0, 30)
    .map((r) => ({
      id: r.SHL_IDF_CD,
      name: r.SHL_NM,
      address:
        r.FULL_ADDR ??
        [r.USER_DFN_CODE_VALUE_01, r.USER_DFN_CODE_VALUE_02]
          .filter(Boolean)
          .join(' '),
    }));
}

export function attachmentScore(name: string) {
  let score = 0;
  if (/편제|배당/.test(name)) score += 100;
  if (/편성|편제/.test(name) && /운영|교육과정/.test(name)) score += 60;
  if (/교육과정|교육계획/.test(name)) score += 20;
  if (/학사일정|연간일정|평가계획/.test(name) && !/편성|편제|배당/.test(name))
    score -= 100;
  return score;
}

export function parseAttachments(
  html: string,
  schoolId: string,
  year: number,
): Attachment[] {
  const $ = load(html);
  const form = $('#eiFileDownForm');
  if (
    form.find('[name="SHL_IDF_CD"]').val() !== schoolId ||
    String(form.find('[name="JG_YEAR"]').val()) !== String(year)
  )
    throw new ImportError(
      '해당 학교·공시연도의 첨부파일을 확인할 수 없습니다.',
      502,
    );
  const params = new URLSearchParams();
  for (const key of [
    'SHL_IDF_CD',
    'JG_BURYU_CD',
    'JG_HANGMOK_CD',
    'JG_GUBUN',
    'JG_YEAR',
    'JG_CHASU',
    'USE_YN',
  ]) {
    const value = form.find(`[name="${key}"]`).val();
    if (typeof value !== 'string' || !value)
      throw new ImportError('공시 첨부파일 양식이 변경되었습니다.', 502);
    params.set(key, value);
  }
  const files: Attachment[] = [];
  $('a.file_name').each((_, element) => {
    const id = $(element)
      .attr('onclick')
      ?.match(/getEiFile14\(['"](\d+)['"]\)/)?.[1];
    if (!id) return;
    const name = $(element)
      .text()
      .replace(/\(\s*[\d,.]+\s*(?:KB|MB|B)\s*\)\s*$/i, '')
      .trim();
    const url = new URL('/servlets/EiFileDownLoad.do', SCHOOLINFO_ORIGIN);
    url.search = params.toString();
    url.searchParams.set('FILE_SEQ', id);
    files.push({ id, name, url: url.href, score: attachmentScore(name) });
  });
  return files.sort((a, b) => b.score - a.score);
}

export async function listAttachments(schoolId: string, year: number) {
  const params = new URLSearchParams({
    SHL_IDF_CD: schoolId,
    GS_HANGMOK_CD: '14',
    GS_BURYU_CD: 'JG100',
    JG_BURYU_CD: 'JG020',
    JG_HANGMOK_CD: '05',
    JG_GUBUN: '1',
    JG_YEAR: String(year),
    JG_YEAR2: String(year),
    CHOSEN_JG_YEAR: String(year),
    PRE_JG_YEAR: String(year),
    GS_TYPE: 'Y',
  });
  const response = await schoolFetch('/ei/pp/Pneipp_b14_s0p.do', params);
  return parseAttachments(
    decodeDocument(await readLimited(response)),
    schoolId,
    year,
  );
}

export async function downloadAttachment(
  schoolId: string,
  year: number,
  fileId: string,
) {
  const files = await listAttachments(schoolId, year);
  const file = files.find((f) => f.id === fileId);
  if (!file)
    throw new ImportError(
      '선택한 공시 파일이 없습니다. 파일 목록을 다시 조회해 주세요.',
    );
  return { file, bytes: await readLimited(await schoolFetch(file.url)) };
}
