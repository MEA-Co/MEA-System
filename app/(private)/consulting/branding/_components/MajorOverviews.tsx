'use client';

import { Tabs } from '@base-ui/react/tabs';
import { type ReactNode, useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { getMajorOverviews } from '@/features/keywords/major-overview/actions';
import type { MajorOverview } from '@/features/keywords/major-overview/types';

import { useBrandingMajorSearchContext } from '../_context/BrandingMajorSearchContext';
import { type MajorList, majorNames } from '../_lib/plan';

import { DepartmentWebsitePreview } from './DepartmentWebsitePreview';
import { MajorKeywordCloud } from './MajorKeywordCloud';

import styles from './MajorOverviews.module.css';

export function MajorOverviews({
  majors,
  renderInput,
  completed = [],
}: {
  majors: MajorList;
  renderInput?: (name: string) => ReactNode;
  completed?: string[];
}) {
  const {
    snapshot,
    loading: catalogLoading,
    error: catalogError,
    reload,
  } = useBrandingMajorSearchContext();
  const names = majorNames(majors);
  const ids = names.map(
    (name) =>
      majors.ids?.[name] ??
      snapshot?.catalog.find((m) => m.name === name)?.id ??
      '',
  );
  const key = JSON.stringify(ids);
  const [retry, setRetry] = useState(0);
  const [state, setState] = useState<{
    key: string;
    data?: MajorOverview[];
    error?: string;
  } | null>(null);
  useEffect(() => {
    const requested = JSON.parse(key) as string[];
    if (!requested.length || requested.some((id) => !id)) return;
    let active = true;
    void getMajorOverviews(requested)
      .then((result) => {
        if (active) setState({ key, ...result });
      })
      .catch(() => {
        if (active)
          setState({
            key,
            error: '전공 자료를 불러오지 못했습니다. 다시 시도해 주세요.',
          });
      });
    return () => {
      active = false;
    };
  }, [key, retry]);
  const current = state?.key === key ? state : null;
  const error =
    catalogError ||
    current?.error ||
    (!catalogLoading && ids.some((id) => !id)
      ? '선택한 전공의 정보를 확인하지 못했습니다. 전공을 다시 선택해 주세요.'
      : '');
  const status = error ? (
    <div
      role="alert"
      className="rounded-2xl border border-violet-100 bg-white p-6"
    >
      <p className="text-sm text-slate-600">{error}</p>
      <Button
        type="button"
        variant="outline"
        className="mt-3 border-violet-200 text-violet-700"
        onClick={() => {
          setState(null);
          setRetry((n) => n + 1);
          if (catalogError) reload();
        }}
      >
        다시 시도
      </Button>
    </div>
  ) : !current?.data ? (
    <p role="status" className={`p-8 ${styles.loadingText}`}>
      전공 키워드와 학과 사이트를 불러오고 있어요
    </p>
  ) : null;
  return (
    <Tabs.Root
      key={JSON.stringify(names)}
      defaultValue={names[0]}
      className="overflow-hidden rounded-2xl border border-violet-100 bg-white"
    >
      <Tabs.List
        aria-label="희망 전공별 안내"
        activateOnFocus
        className="flex gap-1 overflow-x-auto border-b border-violet-100 bg-violet-50/50 p-2"
      >
        {names.map((name) => (
          <Tabs.Tab
            key={name}
            value={name}
            className="shrink-0 rounded-lg px-4 py-3 text-sm font-medium text-slate-500 transition-colors hover:bg-violet-100 focus-visible:outline-2 focus-visible:outline-violet-500 data-active:bg-violet-100 data-active:text-violet-800"
          >
            {name}
            {completed.includes(name) && (
              <span className="ml-2 rounded-full bg-violet-200 px-2 py-0.5 text-[11px] font-semibold text-violet-800">
                완료
              </span>
            )}
          </Tabs.Tab>
        ))}
      </Tabs.List>
      {names.map((name) => {
        const major = current?.data?.find(
          (item) => item.id === ids[names.indexOf(name)],
        );
        return (
          <Tabs.Panel
            keepMounted
            key={name}
            value={name}
            className="p-4 focus-visible:outline-2 focus-visible:outline-violet-500 sm:p-6"
          >
            {renderInput?.(name)}
            {status}
            {major && (
              <>
                <h2 className="text-xl font-semibold text-violet-950">
                  {major.name}은 무엇을 다룰까요?
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  큰 단어들은 {major.name}에서 다루는 핵심 분야들이고, 작은
                  단어들은 각 분야에 대한 이해를 돕기 위한 예시들이에요.
                  마우스를 올려 각 분야에 대한 설명을 보고, 내가 가고싶은
                  전공에서 무엇을 다루는지 알아보세요.
                </p>
                {major.keywords.length ? (
                  <MajorKeywordCloud keywords={major.keywords} />
                ) : (
                  <p className="py-12 text-center text-sm text-slate-500">
                    이 전공의 키워드는 아직 준비 중이에요.
                  </p>
                )}
                <div className="mt-4 border-t border-violet-100 pt-5">
                  <h3 className="text-sm font-semibold text-violet-900">
                    학과 홈페이지에서 더 알아보기
                  </h3>
                  {major.sites.length ? (
                    <DepartmentWebsitePreview
                      department={major.sites[0].department}
                      url={major.sites[0].url}
                      previewSites={major.sites}
                    />
                  ) : (
                    <p className="mt-3 text-sm text-slate-500">
                      이 전공의 학과별 사이트가 아직 등록되지 않았어요.
                    </p>
                  )}
                </div>
              </>
            )}
          </Tabs.Panel>
        );
      })}
    </Tabs.Root>
  );
}
