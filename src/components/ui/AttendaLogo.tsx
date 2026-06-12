import { cn } from '@/lib/utils';

interface AttendaLogoProps {
  /** Icon size in px (default 44) */
  iconSize?: number;
  /** Show wordmark next to icon (default true) */
  showWordmark?: boolean;
  /** 'dark' = white/blue wordmark for dark bg; 'light' = navy/blue for light bg */
  variant?: 'dark' | 'light';
  className?: string;
}

export function AttendaLogoIcon({ size = 44 }: { size?: number; variant?: 'dark' | 'light' }) {
  const ringStroke   = '#00C896';
  const innerFill    = '#00C896';
  const innerOpacity = '0.1';
  const tickMain     = '#00E5FF';
  const hourHand     = '#00C896';
  const minuteHand   = '#FFFFFF';
  const centerDot    = '#00E5FF';
  const badgeBg      = '#04141A';

  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="22" cy="22" r="20" stroke={ringStroke} strokeWidth="2.5" />
      <circle cx="22" cy="22" r="14" fill={innerFill} opacity={innerOpacity} className="animate-logo-pulse" />
      <line x1="22" y1="9"  x2="22" y2="12" stroke={tickMain} strokeWidth="2"   strokeLinecap="round" />
      <line x1="22" y1="32" x2="22" y2="35" stroke={tickMain} strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
      <line x1="9"  y1="22" x2="12" y2="22" stroke={tickMain} strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
      <line x1="32" y1="22" x2="35" y2="22" stroke={tickMain} strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
      <line x1="22" y1="22" x2="22"   y2="15"  stroke={hourHand}   strokeWidth="2.2" strokeLinecap="round" className="animate-logo-spin-slow" />
      <line x1="22" y1="22" x2="27.5" y2="22"  stroke={minuteHand} strokeWidth="2.2" strokeLinecap="round" className="animate-logo-spin-fast" />
      <circle cx="22" cy="22" r="2.2" fill={centerDot} />
      <circle cx="33" cy="33" r="7" fill={badgeBg} />
      <circle cx="33" cy="33" r="6" fill="#10B981" />
      <polyline points="29.5,33 32,35.5 36.5,30.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  );
}

export default function AttendaLogo({
  iconSize = 44,
  showWordmark = true,
  className,
}: AttendaLogoProps) {
  const attColor = '#FFFFFF';
  const enColor  = '#00C896';

  return (
    <div className={cn('flex items-center gap-3.5 group', className)}>
      <div className="transition-transform duration-500 group-hover:rotate-12 group-hover:scale-110">
        <AttendaLogoIcon size={iconSize} />
      </div>
      {showWordmark && (
        <span
          className="tracking-tighter"
          style={{
            fontFamily: "'Space Grotesk', 'DM Sans', sans-serif",
            fontWeight: 800,
            fontSize: iconSize * 0.68,
            lineHeight: 1,
          }}
        >
          <span style={{ color: attColor }}>Att</span>
          <span style={{ color: enColor }}>en</span>
          <span style={{ color: attColor }}>da</span>
          <span style={{ color: enColor }}>.</span>
        </span>
      )}
    </div>
  );
}
