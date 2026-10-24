export interface ICDCodeItem {
  code: string;
  description: string;
  category: string;
  chapter: string;
  billable: boolean;
  commonSeverity: 'Mild' | 'Moderate' | 'Severe' | 'Acute on Chronic';
  snomedCode: string;
  isChronic: boolean;
  clinicalNotes: string;
}

export const ICD10_DATABASE: ICDCodeItem[] = [
  {
    code: 'I10',
    description: 'Essential (primary) hypertension',
    category: 'Cardiovascular',
    chapter: 'Diseases of the circulatory system (I00-I99)',
    billable: true,
    commonSeverity: 'Moderate',
    snomedCode: '59621000',
    isChronic: true,
    clinicalNotes: 'Persistent arterial blood pressure elevation requiring lifestyle and pharmacotherapy management.',
  },
  {
    code: 'I25.10',
    description: 'Atherosclerotic heart disease of native coronary artery without angina pectoris',
    category: 'Cardiovascular',
    chapter: 'Diseases of the circulatory system (I00-I99)',
    billable: true,
    commonSeverity: 'Severe',
    snomedCode: '53741008',
    isChronic: true,
    clinicalNotes: 'Coronary artery plaque buildup; monitor with ECG, troponin, and lipid panel.',
  },
  {
    code: 'I50.9',
    description: 'Heart failure, unspecified (Congestive Heart Failure)',
    category: 'Cardiovascular',
    chapter: 'Diseases of the circulatory system (I00-I99)',
    billable: true,
    commonSeverity: 'Severe',
    snomedCode: '84114007',
    isChronic: true,
    clinicalNotes: 'Impaired ventricular filling or ejection fraction; requires loop diuretics, ACEi/ARNI, beta blockers.',
  },
  {
    code: 'I48.91',
    description: 'Unspecified atrial fibrillation',
    category: 'Cardiovascular',
    chapter: 'Diseases of the circulatory system (I00-I99)',
    billable: true,
    commonSeverity: 'Moderate',
    snomedCode: '49436004',
    isChronic: true,
    clinicalNotes: 'Supraventricular tachyarrhythmia with irregular ventricular response; risk of thromboembolism.',
  },
  {
    code: 'I20.9',
    description: 'Angina pectoris, unspecified',
    category: 'Cardiovascular',
    chapter: 'Diseases of the circulatory system (I00-I99)',
    billable: true,
    commonSeverity: 'Moderate',
    snomedCode: '194828000',
    isChronic: false,
    clinicalNotes: 'Substernal chest pain induced by myocardial ischemia; evaluate with cardiac catheterization or stress test.',
  },
  {
    code: 'E11.9',
    description: 'Type 2 diabetes mellitus without complications',
    category: 'Endocrine',
    chapter: 'Endocrine, nutritional and metabolic diseases (E00-E89)',
    billable: true,
    commonSeverity: 'Moderate',
    snomedCode: '44054006',
    isChronic: true,
    clinicalNotes: 'Peripheral insulin resistance with progressive secretory defect; target HbA1c < 7.0%.',
  },
  {
    code: 'J45.909',
    description: 'Unspecified asthma, uncomplicated',
    category: 'Respiratory',
    chapter: 'Diseases of the respiratory system (J00-J99)',
    billable: true,
    commonSeverity: 'Moderate',
    snomedCode: '195967001',
    isChronic: true,
    clinicalNotes: 'Chronic bronchial airway inflammation with reversible bronchospasm; rescue SABA & maintenance ICS.',
  },
  {
    code: 'G43.909',
    description: 'Migraine, unspecified, not intractable, without status migrainosus',
    category: 'Neurology',
    chapter: 'Diseases of the nervous system (G00-G99)',
    billable: true,
    commonSeverity: 'Moderate',
    snomedCode: '37796009',
    isChronic: true,
    clinicalNotes: 'Unilateral throbbing cephalalgia with photophobia and phonophobia; abortive triptan therapy.',
  },
  {
    code: 'Z00.00',
    description: 'Encounter for general adult medical examination without abnormal findings',
    category: 'Administrative',
    chapter: 'Factors influencing health status and contact with health services (Z00-Z99)',
    billable: true,
    commonSeverity: 'Mild',
    snomedCode: '185349003',
    isChronic: false,
    clinicalNotes: 'Annual preventive wellness consultation and routine age-appropriate screening.',
  },
];

export const ICD10_COMMON_CODES = ICD10_DATABASE;
