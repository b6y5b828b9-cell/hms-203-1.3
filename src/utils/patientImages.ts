// Real medical patient portrait photography
export const PATIENT_PORTRAITS: Record<string, string> = {
  'PT-10492': 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=250', // Eleanor Pemberton, 58, Female
  'PT-10493': 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250', // Mateo Rodriguez, 42, Male
  'PT-10494': 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250', // Amara Okonkwo, 29, Female
  'PT-10495': 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=250', // Benjamin Hayes, 67, Male
  'PT-10496': 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=250', // Samantha Reed, 34, Female
  'PT-10497': 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=250', // Chloe Kim, 24, Female
  'PT-10498': 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=250', // Harrison Brooks, 51, Male
  'PT-10499': 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=250', // Sofia Rodriguez, 19, Female
  'PT-10500': 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=250', // David Pemberton, 60, Male
  'PT-10501': 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=250', // Clara Brooks, 48, Female
  'PT-10502': 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=250', // Chinedu Okonkwo, 32, Male
};

const FEMALE_AVATARS = [
  'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&q=80&w=250',
];

const MALE_AVATARS = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&q=80&w=250',
  'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?auto=format&fit=crop&q=80&w=250',
];

export function getPatientPhoto(
  patientId?: string,
  patientName?: string,
  gender?: string
): string {
  if (patientId && PATIENT_PORTRAITS[patientId]) {
    return PATIENT_PORTRAITS[patientId];
  }
  if (patientName) {
    const lower = patientName.toLowerCase();
    if (lower.includes('eleanor')) return PATIENT_PORTRAITS['PT-10492'];
    if (lower.includes('mateo')) return PATIENT_PORTRAITS['PT-10493'];
    if (lower.includes('amara')) return PATIENT_PORTRAITS['PT-10494'];
    if (lower.includes('benjamin')) return PATIENT_PORTRAITS['PT-10495'];
    if (lower.includes('samantha')) return PATIENT_PORTRAITS['PT-10496'];
    if (lower.includes('chloe')) return PATIENT_PORTRAITS['PT-10497'];
    if (lower.includes('harrison')) return PATIENT_PORTRAITS['PT-10498'];
    if (lower.includes('sofia')) return PATIENT_PORTRAITS['PT-10499'];
    if (lower.includes('david')) return PATIENT_PORTRAITS['PT-10500'];
    if (lower.includes('clara')) return PATIENT_PORTRAITS['PT-10501'];
    if (lower.includes('chinedu')) return PATIENT_PORTRAITS['PT-10502'];
  }

  const hashString = (patientId || patientName || 'PT-DEFAULT').split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const isFemale = gender ? gender.toLowerCase() === 'female' : hashString % 2 === 0;

  if (isFemale) {
    return FEMALE_AVATARS[hashString % FEMALE_AVATARS.length];
  }
  return MALE_AVATARS[hashString % MALE_AVATARS.length];
}
