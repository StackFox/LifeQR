// backend/src/services/riskEngine.ts
// Deterministic risk assessment engine with explainability

export interface RiskFactor {
  name: string;
  category: 'DEMOGRAPHIC' | 'MEDICATION' | 'CONDITION' | 'ALLERGY' | 'PROCEDURE' | 'INFORMATION_GAP';
  value: any;
  weightContribution: number;
  reasoning: string;
  relatedConditions?: string[];
}

export interface Recommendation {
  priority: 'URGENT' | 'HIGH' | 'MEDIUM' | 'LOW';
  action: string;
  reason: string;
  context: string;
}

export interface RiskAssessment {
  riskScore: number;
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  confidence: number;
  factors: RiskFactor[];
  recommendations: Recommendation[];
  calculatedAt: number;
  version: string;
  modelInputs: {
    age: number;
    conditionCount: number;
    medicationCount: number;
    allergyCount: number;
    implantDevices: string[];
  };
  limitations: string[];
}

interface PatientData {
  dateOfBirth: string;
  medications: Array<{ name: string; dosage: string; frequency: string }>;
  allergies: string[];
  conditions: string[];
  implants: string[];
}

const ANTICOAGULANTS = ['Warfarin', 'Apixaban', 'Rivaroxaban', 'Dabigatran', 'Heparin', 'Enoxaparin'];

function calculateAge(dob: string): number {
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

export function assessPatientRisk(patient: PatientData): RiskAssessment {
  const age = calculateAge(patient.dateOfBirth);
  const factors: RiskFactor[] = [];
  const recommendations: Recommendation[] = [];
  let totalRiskScore = 0;

  // 1. Age check (>= 65)
  if (age >= 65) {
    const weight = 2.1;
    totalRiskScore += weight;
    factors.push({
      name: 'Advanced Age',
      category: 'DEMOGRAPHIC',
      value: age,
      weightContribution: weight,
      reasoning: `Patient age ${age} exceeds threshold of 65; increased fall risk and complication probability`,
      relatedConditions: ['Osteoporosis', 'Cognitive decline', 'Falls']
    });
  }

  // 2. Polypharmacy (>= 5 medications)
  if (patient.medications.length >= 5) {
    const weight = 1.8;
    totalRiskScore += weight;
    factors.push({
      name: 'Polypharmacy',
      category: 'MEDICATION',
      value: patient.medications.length,
      weightContribution: weight,
      reasoning: `${patient.medications.length} medications increases risk of drug interactions and adverse events`,
      relatedConditions: ['Drug interactions', 'Medication errors']
    });
  }

  // 3. Anticoagulant check
  const anticoagulants = patient.medications.filter(m =>
    ANTICOAGULANTS.some(drug => m.name.toLowerCase().includes(drug.toLowerCase()))
  );
  if (anticoagulants.length > 0) {
    const weight = 2.2;
    totalRiskScore += weight;
    factors.push({
      name: 'Anticoagulation Therapy',
      category: 'MEDICATION',
      value: anticoagulants[0]!.name,
      weightContribution: weight,
      reasoning: `${anticoagulants[0]!.name} increases bleeding risk; prioritize IV access and hemostasis checks`,
      relatedConditions: ['Hemorrhage', 'Intracranial bleeding']
    });
  }

  // 4. Multiple allergies (>= 3)
  if (patient.allergies.length >= 3) {
    const weight = 1.5;
    totalRiskScore += weight;
    factors.push({
      name: 'Multiple Allergies',
      category: 'ALLERGY',
      value: patient.allergies.length,
      weightContribution: weight,
      reasoning: `${patient.allergies.length} documented allergies increases medication selection complexity`,
      relatedConditions: ['Anaphylaxis', 'Adverse drug reactions']
    });
  }

  // 5. Implanted devices
  if (patient.implants && patient.implants.length > 0) {
    const weight = 2.0;
    totalRiskScore += weight;
    factors.push({
      name: 'Implanted Device',
      category: 'PROCEDURE',
      value: patient.implants,
      weightContribution: weight,
      reasoning: `Patient has ${patient.implants.join(', ')}; avoid certain imaging/procedures`,
      relatedConditions: ['Device malfunction', 'Complications']
    });
  }

  // 6. Multiple conditions (>= 3)
  if (patient.conditions.length >= 3) {
    const weight = 1.6;
    totalRiskScore += weight;
    factors.push({
      name: 'Multiple Comorbidities',
      category: 'CONDITION',
      value: patient.conditions.length,
      weightContribution: weight,
      reasoning: `${patient.conditions.length} active conditions increases clinical complexity`,
      relatedConditions: ['Multi-system organ failure', 'Delayed diagnosis']
    });
  }

  // Generate recommendations
  if (totalRiskScore >= 7) {
    recommendations.push({
      priority: 'URGENT',
      action: 'Establish IV access immediately',
      reason: 'Multiple risk factors warrant rapid vascular access',
      context: factors.map(f => f.name).join(' + ')
    });
  }

  if (anticoagulants.length > 0) {
    recommendations.push({
      priority: 'HIGH',
      action: 'Check hemoglobin, INR if Warfarin; bleeding precautions',
      reason: 'Anticoagulation therapy requires baseline labs',
      context: `Patient on ${anticoagulants[0]!.name}`
    });
  }

  if (patient.allergies.length > 2) {
    recommendations.push({
      priority: 'MEDIUM',
      action: 'Cross-check all medications against allergy list',
      reason: 'Multiple allergies increase drug interaction risk',
      context: `${patient.allergies.length} documented allergies`
    });
  }

  if (age >= 65 && patient.conditions.some(c => c.toLowerCase().includes('dementia'))) {
    recommendations.push({
      priority: 'MEDIUM',
      action: 'Consider communication aids; assess baseline cognition',
      reason: 'Elderly patient with cognitive impairment',
      context: 'Age + dementia diagnosis'
    });
  }

  if (patient.conditions.some(c => c.toLowerCase().includes('diabetes'))) {
    recommendations.push({
      priority: 'HIGH',
      action: 'Check blood glucose; assess for diabetic emergencies',
      reason: 'Diabetic patients require glucose monitoring in ED',
      context: 'Active diabetes diagnosis'
    });
  }

  // Calculate confidence
  let confidence = 0.9;
  if (patient.conditions.length === 0) confidence -= 0.1;
  if (patient.medications.length === 0) confidence -= 0.05;
  confidence = Math.max(confidence, 0.5);

  // Determine risk level
  let riskLevel: RiskAssessment['riskLevel'];
  if (totalRiskScore >= 8) riskLevel = 'CRITICAL';
  else if (totalRiskScore >= 6) riskLevel = 'HIGH';
  else if (totalRiskScore >= 3) riskLevel = 'MODERATE';
  else riskLevel = 'LOW';

  return {
    riskScore: Math.min(totalRiskScore, 10),
    riskLevel,
    confidence,
    factors,
    recommendations,
    calculatedAt: Date.now(),
    version: 'risk-engine-v2.1',
    modelInputs: {
      age,
      conditionCount: patient.conditions.length,
      medicationCount: patient.medications.length,
      allergyCount: patient.allergies.length,
      implantDevices: patient.implants || []
    },
    limitations: [
      'Risk assessment is supplementary to clinical judgment',
      'Age-based models may not apply to all populations',
      'Missing data (e.g., labs) reduces model confidence',
      'Does not account for acute presenting complaint',
      'Validated only for adult patients'
    ]
  };
}
