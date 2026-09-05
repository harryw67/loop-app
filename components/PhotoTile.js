export default function PhotoTile({ url, style }) {
  if (url) {
    return <div style={{ ...style, background: `url(${url}) center/cover no-repeat`, backgroundSize: 'cover' }} />;
  }
  return (
    <div style={{ ...style, background: 'var(--cream-2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="34%" height="34%" viewBox="0 0 100 100" style={{ opacity: 0.35 }}>
        <circle cx="50" cy="24" r="10" fill="none" stroke="var(--ink-faint)" strokeWidth="6" />
        <path d="M50 34 L20 72 L80 72 Z" fill="none" stroke="var(--ink-faint)" strokeWidth="6" strokeLinejoin="round" strokeLinecap="round" />
      </svg>
    </div>
  );
}
