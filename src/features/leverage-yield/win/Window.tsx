import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { CaptionGlyph } from './icons';

/** Classic Win2k window: 3D frame, gradient title bar with caption buttons, optional menu, body and status bar. */
export function Window({
  title,
  icon,
  active = true,
  onMinimize,
  onMaximize,
  maximized,
  onClose,
  onHelp,
  menu,
  toolbar,
  status,
  className,
  bodyClassName,
  children,
  id,
  onFocus,
}: {
  title: ReactNode;
  icon?: ReactNode;
  active?: boolean;
  onMinimize?: () => void;
  onMaximize?: () => void;
  maximized?: boolean;
  onClose?: () => void;
  onHelp?: () => void;
  menu?: ReactNode;
  toolbar?: ReactNode;
  status?: ReactNode;
  className?: string;
  bodyClassName?: string;
  children: ReactNode;
  id?: string;
  onFocus?: () => void;
}) {
  return (
    <section
      id={id}
      aria-label={typeof title === 'string' ? title : undefined}
      className={cn('w2k-window bevel-out flex min-w-0 flex-col', className)}
      onPointerDown={onFocus}
    >
      <header className="w2k-titlebar" data-inactive={active ? undefined : 'true'}>
        {icon}
        <h2 className="w2k-titlebar-text text-[11px]">{title}</h2>
        <div className="flex items-center">
          {onHelp && (
            <button type="button" className="w2k-caption-btn bevel-out mr-0.5" onClick={onHelp} aria-label="Help">
              <CaptionGlyph kind="help" />
            </button>
          )}
          {onMinimize && (
            <button type="button" className="w2k-caption-btn bevel-out" onClick={onMinimize} aria-label="Minimize">
              <CaptionGlyph kind="min" />
            </button>
          )}
          {onMaximize && (
            <button
              type="button"
              className="w2k-caption-btn bevel-out"
              onClick={onMaximize}
              aria-label={maximized ? 'Restore' : 'Maximize'}
            >
              <CaptionGlyph kind={maximized ? 'restore' : 'max'} />
            </button>
          )}
          {onClose && (
            <button type="button" className="w2k-caption-btn bevel-out ml-0.5" onClick={onClose} aria-label="Close">
              <CaptionGlyph kind="close" />
            </button>
          )}
        </div>
      </header>
      {menu && <nav className="w2k-menubar">{menu}</nav>}
      {toolbar && (
        <>
          <div className="etched-h" />
          <div className="flex flex-wrap items-stretch gap-0.5 px-0.5 py-0.5">{toolbar}</div>
          <div className="etched-h" />
        </>
      )}
      <div className={cn('min-h-0 flex-1', bodyClassName)}>{children}</div>
      {status && (
        <footer className="w2k-statusbar">
          {status}
          <span className="w2k-sizegrip" aria-hidden="true" />
        </footer>
      )}
    </section>
  );
}
