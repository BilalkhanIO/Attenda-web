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

export function AttendaLogoIcon({ size = 44, variant = 'dark' }: { size?: number; variant?: 'dark' | 'light' }) {
  const ringStroke   = variant === 'dark' ? '#1D4ED8' : '#1D4ED8';
  const innerFill    = variant === 'dark' ? '#1D4ED8' : '#DBEAFE';
  const innerOpacity = variant === 'dark' ? '0.15'    : '1';
  const tickMain     = variant === 'dark' ? '#3B82F6' : '#1D4ED8';
  const hourHand     = variant === 'dark' ? '#60A5FA' : '#1D4ED8';
  const minuteHand   = variant === 'dark' ? '#F1F5F9' : '#0F172A';
  const centerDot    = variant === 'dark' ? '#3B82F6' : '#1D4ED8';
  const badgeBg      = variant === 'dark' ? '#0F172A' : '#F8FAFC';

  return (
    <svg width={size} height={size} viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="22" cy="22" r="20" stroke={ringStroke} strokeWidth="2.5" />
      <circle cx="22" cy="22" r="14" fill={innerFill} opacity={innerOpacity} />
      <line x1="22" y1="9"  x2="22" y2="12" stroke={tickMain} strokeWidth="2"   strokeLinecap="round" />
      <line x1="22" y1="32" x2="22" y2="35" stroke={tickMain} strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
      <line x1="9"  y1="22" x2="12" y2="22" stroke={tickMain} strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
      <line x1="32" y1="22" x2="35" y2="22" stroke={tickMain} strokeWidth="1.2" strokeLinecap="round" opacity="0.4" />
      <line x1="22" y1="22" x2="22"   y2="15"  stroke={hourHand}   strokeWidth="2.2" strokeLinecap="round" />
      <line x1="22" y1="22" x2="27.5" y2="22"  stroke={minuteHand} strokeWidth="2.2" strokeLinecap="round" />
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
  variant = 'dark',
  className,
}: AttendaLogoProps) {
  const attColor = variant === 'dark' ? '#F1F5F9' : '#0F172A';
  const enColor  = variant === 'dark' ? '#3B82F6' : '#1D4ED8';

  return (
    <div className={cn('flex items-center gap-3.5', className)}>
      <AttendaLogoIcon size={iconSize} variant={variant} />
      {showWordmark && (
        <span
          style={{
            fontFamily: "'Space Grotesk', 'DM Sans', sans-serif",
            fontWeight: 700,
            fontSize: iconSize * 0.64,
            letterSpacing: '-0.02em',
            lineHeight: 1,
          }}
        >
          <span style={{ color: attColor }}>Att</span>
          <span style={{ color: enColor }}>en</span>
          <span style={{ color: attColor }}>da</span>
        </span>
      )}
    </div>
  );
}
