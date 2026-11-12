import React from 'react';

interface DoctorAvatarProps {
  name: string;
  imageUrl?: string;
  size?: 'sm' | 'md';
}

const avatarSizes = {
  sm: 'h-9 w-9 text-[10px]',
  md: 'h-12 w-12 text-xs',
};

export const DoctorAvatar: React.FC<DoctorAvatarProps> = ({ name, imageUrl, size = 'md' }) => {
  const initials = name
    .replace(/^Dr\.?\s*/i, '')
    .split(',')[0]
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();

  return (
    <span role="img" aria-label={`${name} doctor photo`} className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-teal-200 bg-teal-50 font-bold text-teal-800 ${avatarSizes[size]}`}>
      <span aria-hidden="true">{initials || 'DR'}</span>
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          onError={(event) => { event.currentTarget.style.display = 'none'; }}
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </span>
  );
};
