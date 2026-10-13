import React from 'react';

interface CarbonShiftLogoProps {
  className?: string;
  size?: number | string;
  variant?: 'raster' | 'vector';
  glow?: boolean;
}

export const CarbonShiftLogo: React.FC<CarbonShiftLogoProps> = ({
  className = '',
  size = 40,
  variant = 'raster',
  glow = true,
}) => {
  const src = variant === 'vector' ? '/logo.svg' : '/logo-ultrahd.jpg';

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 rounded-full overflow-hidden ${
        glow ? 'shadow-[0_0_20px_rgba(34,197,94,0.35)] ring-1 ring-emerald-400/50' : ''
      } ${className}`}
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt="CarbonShift Logo"
        className="w-full h-full object-cover select-none"
        loading="eager"
      />
    </div>
  );
};
