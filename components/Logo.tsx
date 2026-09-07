// The "K" badge shown next to the KURS wordmark — landing page header,
// customer cabinet, and admin panel all render THIS component instead of
// duplicating the markup, so changing the logo here changes it everywhere
// at once.
//
// To swap the letter badge for an image logo:
// 1. Upload your logo file to the /public folder (e.g. /public/logo.png).
// 2. Replace the <span>...</span> below with:
//      <img src="/logo.png" alt="KURS" style={{ width: size, height: size, borderRadius: size * 0.3, objectFit: 'cover' }} />
export function LogoMark({ size = 26 }: { size?: number }) {
  return (
    <span
      className="k"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        background: 'var(--amber)',
        color: 'var(--ink)',
        display: 'grid',
        placeItems: 'center',
        fontSize: size * 0.58,
        fontWeight: 800,
        flex: 'none',
      }}
    >
      K
    </span>
  );
}
