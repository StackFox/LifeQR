// backend/src/services/fhirBuilder.ts
// HL7 FHIR R4 Bundle builder for patient data export

interface PatientData {
  patientId: string;
  name: string;
  dateOfBirth: string;
  bloodType: string;
  emergencyContacts: Array<{ name: string; relationship: string; phone: string }>;
  medications: Array<{ name: string; dosage: string; frequency: string }>;
  allergies: string[];
  conditions: string[];
  implants: string[];
}

export function buildFHIRBundle(patient: PatientData) {
  const entries: any[] = [];

  // 1. Patient resource
  entries.push({
    fullUrl: `urn:uuid:patient-${patient.patientId}`,
    resource: {
      resourceType: 'Patient',
      id: patient.patientId,
      name: [{ text: patient.name, use: 'official' }],
      birthDate: patient.dateOfBirth,
      extension: [
        {
          url: 'http://hl7.org/fhir/StructureDefinition/patient-bloodType',
          valueString: patient.bloodType
        }
      ],
      contact: patient.emergencyContacts.map(ec => ({
        relationship: [{ text: ec.relationship }],
        name: { text: ec.name },
        telecom: [{ system: 'phone', value: ec.phone, use: 'mobile' }]
      }))
    }
  });

  // 2. Condition resources
  patient.conditions.forEach((condition, i) => {
    entries.push({
      fullUrl: `urn:uuid:condition-${patient.patientId}-${i}`,
      resource: {
        resourceType: 'Condition',
        id: `condition-${i}`,
        subject: { reference: `urn:uuid:patient-${patient.patientId}` },
        code: { text: condition },
        clinicalStatus: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/condition-clinical', code: 'active' }]
        }
      }
    });
  });

  // 3. MedicationStatement resources
  patient.medications.forEach((med, i) => {
    entries.push({
      fullUrl: `urn:uuid:medication-${patient.patientId}-${i}`,
      resource: {
        resourceType: 'MedicationStatement',
        id: `medication-${i}`,
        subject: { reference: `urn:uuid:patient-${patient.patientId}` },
        status: 'active',
        medicationCodeableConcept: { text: med.name },
        dosage: [{
          text: `${med.dosage} ${med.frequency}`,
          doseAndRate: [{ doseQuantity: { value: parseFloat(med.dosage) || 0, unit: 'mg' } }]
        }]
      }
    });
  });

  // 4. AllergyIntolerance resources
  patient.allergies.forEach((allergy, i) => {
    entries.push({
      fullUrl: `urn:uuid:allergy-${patient.patientId}-${i}`,
      resource: {
        resourceType: 'AllergyIntolerance',
        id: `allergy-${i}`,
        patient: { reference: `urn:uuid:patient-${patient.patientId}` },
        code: { text: allergy },
        clinicalStatus: {
          coding: [{ system: 'http://terminology.hl7.org/CodeSystem/allergyintolerance-clinical', code: 'active' }]
        },
        type: 'allergy'
      }
    });
  });

  // 5. Device resources (implants)
  patient.implants.forEach((implant, i) => {
    entries.push({
      fullUrl: `urn:uuid:device-${patient.patientId}-${i}`,
      resource: {
        resourceType: 'Device',
        id: `device-${i}`,
        patient: { reference: `urn:uuid:patient-${patient.patientId}` },
        deviceName: [{ name: implant, type: 'user-friendly-name' }],
        status: 'active'
      }
    });
  });

  return {
    resourceType: 'Bundle',
    type: 'document',
    timestamp: new Date().toISOString(),
    meta: {
      lastUpdated: new Date().toISOString(),
      profile: ['http://hl7.org/fhir/StructureDefinition/Bundle']
    },
    entry: entries
  };
}
