import { Doctor } from '../types';

type DoctorIdentity = Pick<Doctor, 'name' | 'degree'>;

export const getDoctorDegree = ({ name, degree }: DoctorIdentity): string => {
  const savedDegree = degree?.trim();
  if (savedDegree) return savedDegree;

  const commaIndex = name.indexOf(',');
  return commaIndex < 0 ? '' : name.slice(commaIndex + 1).trim();
};

export const getDoctorDisplayName = (doctor: DoctorIdentity): string => {
  const name = doctor.name.trim();
  const degree = getDoctorDegree(doctor);
  const degreeSuffix = `, ${degree}`;
  return degree && name.endsWith(degreeSuffix)
    ? name.slice(0, -degreeSuffix.length).trim()
    : name;
};
