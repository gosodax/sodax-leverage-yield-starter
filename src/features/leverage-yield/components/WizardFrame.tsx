import * as DialogPrimitive from '@radix-ui/react-dialog';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CaptionGlyph } from '../win/icons';
import { Flag } from '../win/Logo';

/**
 * Win2k wizard dialog. `banner` pages (welcome/finish) get the tall gradient bitmap on the left; interior pages
 * get the white header strip with a title, subtitle and icon. Footer holds the < Back / Next > / Cancel row.
 */
export function WizardFrame({
  open,
  onOpenChange,
  title,
  heading,
  subheading,
  icon,
  banner,
  bannerArt,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  heading: string;
  subheading?: ReactNode;
  icon?: ReactNode;
  banner?: boolean;
  bannerArt?: ReactNode;
  footer: ReactNode;
  children: ReactNode;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[var(--win-text)]/20" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="w2k w2k-window bevel-out fixed top-1/2 left-1/2 z-50 flex max-h-[calc(100dvh-16px)] w-[calc(100%-16px)] max-w-[560px] -translate-x-1/2 -translate-y-1/2 flex-col outline-none"
        >
          <div className="w2k-titlebar">
            <Flag className="h-3.5 w-4" />
            <DialogPrimitive.Title className="w2k-titlebar-text text-[11px]">{title}</DialogPrimitive.Title>
            <DialogPrimitive.Close className="w2k-caption-btn bevel-out" aria-label="Close">
              <CaptionGlyph kind="close" />
            </DialogPrimitive.Close>
          </div>

          {banner ? (
            <div className="flex min-h-0 flex-1 bg-[var(--win-window)]">
              <div className="w2k-wizard-banner relative hidden w-[150px] shrink-0 overflow-hidden sm:block">
                {bannerArt}
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-3 overflow-y-auto p-4">
                <h3 className="text-[17px] font-bold leading-tight" style={{ fontFamily: 'var(--font-sans)' }}>
                  {heading}
                </h3>
                {subheading && <div className="text-[var(--win-dark)]">{subheading}</div>}
                {children}
              </div>
            </div>
          ) : (
            <>
              <div className="w2k-wizard-header flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <h3 className="font-bold">{heading}</h3>
                  {subheading && <div className="pl-4 text-[var(--win-dark)]">{subheading}</div>}
                </div>
                {icon}
              </div>
              <div className={cn('min-h-0 flex-1 overflow-y-auto px-4 py-3')}>{children}</div>
            </>
          )}

          <div className="etched-h" />
          <div className="flex flex-wrap items-center justify-end gap-1.5 px-3 py-2.5">{footer}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
