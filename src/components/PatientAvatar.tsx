import React from 'react';
import { getPatientPhoto } from '../utils/patientImages';

interface PatientAvatarProps {
  patientId?: string;
  name: string;
  gender?: string;
  imageUrl?: string;
  size?: 'sm' | 'md' | 'lg';
}

const avatarSizes = {
  sm: 'h-8 w-8 text-[10px]',
  md: 'h-10 w-10 text-xs',
  lg: 'h-14 w-14 text-sm',
};

export const PatientAvatar: React.FC<PatientAvatarProps> = ({
  patientId,
  name,
  gender,
  imageUrl,
  size = 'md',
}) => {
  const image = imageUrl || getPatientPhoto(patientId, name, gender);
  const initials = name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();

  return (
    <span role="img" aria-label={`${name} patient photo`} className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--brand-border)] bg-[var(--brand-tint)] font-bold text-[var(--brand-primary)] ${avatarSizes[size]}`}>
      <span aria-hidden="true">{initials || 'PT'}</span>
      <img
        src={image}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        onError={(event) => { event.currentTarget.style.display = 'none'; }}
        className="absolute inset-0 h-full w-full object-cover"
      />
    </span>
  );
};