import { assetUrl } from '@/brand/brand.config';

/** The desktop wallpaper, stretched like Win2k's "Stretch" display setting. */
export function Wallpaper() {
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden bg-[var(--win-desktop)]">
      <img src={assetUrl('brand/wallpaper.jpg')} alt="" className="h-full w-full object-cover" />
    </div>
  );
}
