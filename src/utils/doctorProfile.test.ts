import assert from 'node:assert/strict';
import test from 'node:test';
import { getDoctorDegree, getDoctorDisplayName } from './doctorProfile';

test('reads credentials from existing doctor names', () => {
  const doctor = { name: 'Dr. Marcus Vance, MD, FACS' };

  assert.equal(getDoctorDegree(doctor), 'MD, FACS');
  assert.equal(getDoctorDisplayName(doctor), 'Dr. Marcus Vance');
});

test('uses saved degree metadata without changing a name that has no suffix', () => {
  const doctor = { name: 'Dr. Anita Patel', degree: 'MBBS, MD' };

  assert.equal(getDoctorDegree(doctor), 'MBBS, MD');
  assert.equal(getDoctorDisplayName(doctor), 'Dr. Anita Patel');
});
