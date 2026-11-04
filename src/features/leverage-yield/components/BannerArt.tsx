import { SodaCan } from './SodaCan';

/** Left bitmap for welcome/finish wizard pages: a bottle on the navy gradient with the flag watermark. */
export function BannerArt({ color, colorDark, label }: { color: string; colorDark: string; label: string }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-end pb-6">
      <div
        className="absolute inset-x-0 top-6 text-center text-[var(--win-highlight)] opacity-90"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        <p className="text-[18px] font-semibold leading-none">HazyVault</p>
        <p className="text-[18px] font-light leading-none">2000</p>
      </div>
      <div className="h-56">
        <SodaCan level={0.78} bubbles={12} color={color} colorDark={colorDark} label={label} />
      </div>
    </div>
  );
}
