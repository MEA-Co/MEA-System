'use client';

import { Bot } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '@/components/ui/drawer';

type ConsultingAdviceProps = {
  children?: ReactNode;
};

export function ConsultingAdvice({ children }: ConsultingAdviceProps) {
  return (
    <Drawer>
      <DrawerTrigger render={<Button variant="outline" />}>
        <Bot />
        AI 조언
      </DrawerTrigger>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>AI 조언</DrawerTitle>
          <DrawerDescription>
            컨설팅 진행에 필요한 조언이 표시됩니다.
          </DrawerDescription>
        </DrawerHeader>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">
          {children}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
