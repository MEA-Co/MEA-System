import { Megaphone, X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  type AnnouncementColor,
  announcementTheme,
} from '@/lib/announcements/colors';

export function AnnouncementBanner({
  title,
  body,
  color,
  onClose,
}: {
  title: string;
  body: string;
  color?: AnnouncementColor;
  onClose?: () => void;
}) {
  const theme = announcementTheme(color);
  return (
    <div className={`border-b ${theme.surface}`}>
      <div
        className="flex items-center justify-center gap-3 px-4 py-2 sm:px-6"
        style={{
          backgroundImage:
            'repeating-linear-gradient(45deg, transparent, transparent 10px, rgb(128 128 128 / 0.035) 10px, rgb(128 128 128 / 0.035) 20px)',
        }}
      >
        <Megaphone
          aria-hidden="true"
          className={`size-4 shrink-0 ${theme.icon}`}
        />
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          className="min-w-0 max-w-6xl overflow-y-auto text-sm leading-6 max-h-[20dvh] wrap-anywhere"
        >
          <span className="font-semibold">{title}</span>
          <span aria-hidden="true" className="mx-2 text-muted-foreground">
            ·
          </span>
          <span className="whitespace-pre-wrap text-muted-foreground">
            {body}
          </span>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-7 shrink-0"
          aria-label="공지 닫기"
          type="button"
          onClick={onClose}
        >
          <X />
        </Button>
      </div>
    </div>
  );
}
