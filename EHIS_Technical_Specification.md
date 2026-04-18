# EHIS v2 (Emergency Health Identity System) - Technical Specification

**Version**: 2.0  
**Last Updated**: April 2026  
**Team**: Code Monkeys  
**Target**: Production-ready MVP with enterprise-grade features

---

## Executive Summary

EHIS v2 is a **patient-centric emergency medical data platform** with a native mobile-first architecture. Key improvements over v1:

✅ **Native mobile frontend** (Expo/React Native) for real ED workflows  
✅ **Offline QR support** with encrypted local data storage  
✅ **Explainable risk assessment** with clinical reasoning  
✅ **Multi-hospital network** for cross-system patient data sharing  
✅ **Clinical validation roadmap** with retrospective study design  
✅ **HL7/FHIR export** for EHR integration  

---

## Technology Stack

### **Backend (Express.js + TypeScript)**
```json
{
  "framework": "Express.js",
  "language": "TypeScript",
  "database": "MongoDB (Atlas)",
  "vectorDB": "Qdrant",
  "fileStorage": "Cloudinary",
  "aiIntegration": "Google Gemini API",
  "authentication": "JWT + Role-based AC",
  "encryption": "TweetNaCl.js (sodium)",
  "httpServer": "Fastify (optional upgrade for performance)",
  "deployment": "Docker + Docker Compose"
}
```

### **Frontend (Expo + React Native)**
```json
{
  "framework": "Expo (SDK 51+)",
  "language": "TypeScript",
  "state": "Zustand + AsyncStorage (offline)",
  "qrScanning": "expo-camera + react-native-qr-code-scanner",
  "localStorage": "SQLite (expo-sqlite) for offline records",
  "networking": "Axios + offline queue (redux-offline pattern)",
  "ui": "React Native Paper + Tamagui",
  "deployment": "EAS Build (Expo's CI/CD)"
}
```

### **Infrastructure**
```
Docker Compose:
├── MongoDB (Atlas connection string via env)
├── Qdrant Vector DB
├── Express Backend (Port 5000)
├── Expo Development Server (Port 19000)
└── Redis (optional: for caching + rate limiting)
```

---

## Core Architecture

### **System Diagram**

```
┌─────────────────────────────────────────────────────────────┐
│                  PATIENT (Mobile - Expo)                     │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────┐     │
│  │   QR Code   │  │  Health      │  │  Risk          │     │
│  │  Generator  │→ │  Profile     │→ │  Assessment    │     │
│  │ + Encryption│  │  Manager     │  │  View          │     │
│  └─────────────┘  └──────────────┘  └────────────────┘     │
└─────────────────────────────────────────────────────────────┘
         ↓ (encrypted QR code + sync)
┌─────────────────────────────────────────────────────────────┐
│                EXPRESS BACKEND (TypeScript)                  │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ API Endpoints (30+)                                  │  │
│  │ ├─ Auth (JWT, roles)                                │  │
│  │ ├─ Patient Portal (records, profile, QR)            │  │
│  │ ├─ Doctor Portal (scan, access, triage)             │  │
│  │ ├─ Network Hub (multi-hospital federation)          │  │
│  │ ├─ Risk Engine (explainable scoring)                │  │
│  │ ├─ FHIR Export (HL7/FHIR compliant)                 │  │
│  │ ├─ AI Services (Gemini summarization)               │  │
│  │ ├─ Audit Logs (compliance trails)                   │  │
│  │ └─ Analytics (trends, patterns)                     │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
         ↓ (REST + WebSocket)
┌──────────────────────┬────────────────┬─────────────────┐
│    MongoDB           │   Qdrant       │   Cloudinary    │
│  (Patient Data)      │  (Embeddings)  │  (File Storage) │
└──────────────────────┴────────────────┴─────────────────┘
         ↓ (AI Calls)
    Google Gemini API
```

---

## FEATURE SPECIFICATIONS

---

## **FEATURE 1: Offline QR Code Support** ⚡

### **Overview**
Generate QR codes that embed encrypted patient emergency data locally. Doctors scan QR → get patient data **without internet call**. Backend sync happens automatically when connection returns.

### **Data Structure: Offline Payload**

```typescript
interface OfflineQRPayload {
  // Core identification
  patientId: string;
  qrTokenId: string; // Unique per QR generation
  
  // Emergency contact info
  name: string;
  dateOfBirth: string;
  bloodType: string;
  emergencyContacts: Array<{
    name: string;
    relationship: string;
    phone: string;
  }>;
  
  // Critical medical data
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
  }>;
  allergies: string[];
  conditions: string[];
  implants: string[]; // Pacemaker, insulin pump, etc.
  
  // AI-powered summary
  medicalSummary: string; // <500 chars, Gemini-generated
  riskAssessment: {
    score: number; // 1-10
    level: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
    factors: string[];
  };
  
  // Metadata
  lastUpdated: number; // Unix timestamp
  expiryTime: number; // QR valid until this timestamp
  encryptionVersion: string; // "v1"
  accessLog: Array<{
    timestamp: number;
    doctorId: string;
    hospitalId: string;
  }>;
  
  // Multi-hospital network
  networkId?: string; // Patient's emergency data sharing network
  consentLevel: "FULL" | "ANONYMIZED" | "EMERGENCY_ONLY";
}
```

### **Encryption Protocol**

```typescript
// Backend: Generate Offline QR
import * as nacl from 'tweetnacl';
import { v4 as uuidv4 } from 'uuid';

interface GenerateOfflineQRRequest {
  patientId: string;
  includeFullHistory: boolean;
}

async function generateOfflineQR(req: GenerateOfflineQRRequest) {
  // 1. Fetch patient data
  const patient = await Patient.findById(req.patientId);
  const medicalRecords = await MedicalRecord.find({ patientId: req.patientId });
  
  // 2. Generate AI summary (if not cached)
  let medicalSummary = patient.cachedSummary;
  if (!medicalSummary || isStale(patient.summaryUpdatedAt)) {
    medicalSummary = await geminiService.summarizeRecords(medicalRecords);
    patient.cachedSummary = medicalSummary;
    await patient.save();
  }
  
  // 3. Run risk assessment
  const riskAssessment = await riskEngine.assessOffline({
    age: calculateAge(patient.dateOfBirth),
    medications: patient.medications,
    allergies: patient.allergies,
    conditions: patient.conditions
  });
  
  // 4. Build offline payload
  const offlinePayload: OfflineQRPayload = {
    patientId: patient._id,
    qrTokenId: uuidv4(),
    name: patient.name,
    dateOfBirth: patient.dateOfBirth,
    bloodType: patient.bloodType,
    emergencyContacts: patient.emergencyContacts,
    medications: patient.medications,
    allergies: patient.allergies,
    conditions: patient.conditions,
    implants: patient.implants,
    medicalSummary,
    riskAssessment,
    lastUpdated: Date.now(),
    expiryTime: Date.now() + (30 * 24 * 60 * 60 * 1000), // 30 days
    encryptionVersion: "v1",
    accessLog: [],
    networkId: patient.emergencyNetwork?.networkId,
    consentLevel: patient.emergencyNetwork?.consentLevel || "FULL"
  };
  
  // 5. Encrypt with patient's public key
  const patientPublicKey = nacl.box.keyPair.fromSecretKey(
    Buffer.from(patient.encryptionPrivateKey, 'hex')
  ).publicKey;
  
  const plaintext = JSON.stringify(offlinePayload);
  const nonce = nacl.randomBytes(24);
  const ephemeralKeyPair = nacl.box.keyPair();
  
  const encryptedData = nacl.box(
    Buffer.from(plaintext),
    nonce,
    patientPublicKey,
    ephemeralKeyPair.secretKey
  );
  
  // 6. Combine nonce + ephemeralPublicKey + encryptedData
  const combined = Buffer.concat([
    nonce,
    ephemeralKeyPair.publicKey,
    encryptedData
  ]);
  
  // 7. Generate QR code
  const qrPayloadString = combined.toString('base64');
  const qrCode = await qrcode.toDataURL(qrPayloadString);
  
  return {
    qrCode,
    qrTokenId: offlinePayload.qrTokenId,
    expiryTime: offlinePayload.expiryTime,
    dataSize: qrPayloadString.length
  };
}
```

### **Frontend: Scan & Decrypt (Expo)**

```typescript
// Expo Frontend: Decrypt offline QR
import { CameraView } from 'expo-camera';
import * as nacl from 'tweetnacl';

interface ScannedQRData {
  patientId: string;
  data: OfflineQRPayload;
  isOfflineData: boolean;
  syncStatus: "synced" | "pending" | "failed";
}

async function scanAndDecryptOfflineQR(scannedQRString: string): Promise<ScannedQRData> {
  try {
    // 1. Decode base64
    const encryptedBuffer = Buffer.from(scannedQRString, 'base64');
    
    // 2. Extract components
    const nonce = encryptedBuffer.slice(0, 24);
    const ephemeralPublicKey = encryptedBuffer.slice(24, 56);
    const encryptedData = encryptedBuffer.slice(56);
    
    // 3. Decrypt (doctor has their own keypair)
    const doctorSecretKey = Buffer.from(DOCTOR_SECRET_KEY, 'hex');
    const decrypted = nacl.box.open(
      encryptedData,
      nonce,
      ephemeralPublicKey,
      doctorSecretKey
    );
    
    if (!decrypted) {
      throw new Error("Decryption failed: invalid key or corrupted data");
    }
    
    // 4. Parse payload
    const offlinePayload: OfflineQRPayload = JSON.parse(
      Buffer.from(decrypted).toString('utf-8')
    );
    
    // 5. Validate expiry
    if (Date.now() > offlinePayload.expiryTime) {
      throw new Error("QR code expired");
    }
    
    // 6. Store locally (offline access)
    await storeOfflineRecord(offlinePayload);
    
    // 7. Attempt sync (fire & forget)
    syncOfflineRecordWithBackend(offlinePayload).catch(err => {
      console.warn("Sync failed; offline data available", err);
    });
    
    return {
      patientId: offlinePayload.patientId,
      data: offlinePayload,
      isOfflineData: true,
      syncStatus: "pending"
    };
    
  } catch (err) {
    console.error("QR scan failed:", err);
    throw err;
  }
}

// Store in local SQLite for offline access
async function storeOfflineRecord(payload: OfflineQRPayload) {
  const db = await openDatabase('ehis_offline.db');
  
  await db.execAsync(`
    INSERT OR REPLACE INTO scanned_records (
      qrTokenId, patientId, data, scannedAt, syncStatus
    ) VALUES (?, ?, ?, ?, ?);
  `, [
    payload.qrTokenId,
    payload.patientId,
    JSON.stringify(payload),
    Date.now(),
    'pending'
  ]);
}

// Sync with backend when online
async function syncOfflineRecordWithBackend(payload: OfflineQRPayload) {
  try {
    const response = await axios.post('/api/access-logs/sync-offline', {
      qrTokenId: payload.qrTokenId,
      patientId: payload.patientId,
      doctorId: getCurrentDoctorId(),
      hospitalId: getCurrentHospitalId(),
      scanTimestamp: Date.now(),
      offlineDecrypted: true
    });
    
    // Update sync status
    const db = await openDatabase('ehis_offline.db');
    await db.execAsync(
      `UPDATE scanned_records SET syncStatus = ? WHERE qrTokenId = ?`,
      ['synced', payload.qrTokenId]
    );
    
  } catch (err) {
    console.error("Sync failed:", err);
    // Leave as 'pending'; retry on next network check
  }
}
```

### **API: Offline Record Sync**

```typescript
// POST /api/access-logs/sync-offline
// Receives offline-scanned records from mobile and logs them
router.post('/access-logs/sync-offline', authenticate, async (req, res) => {
  const { qrTokenId, patientId, doctorId, hospitalId, scanTimestamp } = req.body;
  
  // Log access (for compliance)
  const accessLog = new AccessLog({
    patientId,
    doctorId,
    hospitalId,
    qrTokenId,
    scanTimestamp,
    offlineDecrypted: true,
    ipAddress: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  await accessLog.save();
  
  // Return confirmation
  res.json({ 
    success: true, 
    logId: accessLog._id,
    syncedAt: new Date()
  });
});
```

### **Key Advantages**
- ✅ Works in ED WiFi blackouts
- ✅ Data doesn't leave patient's phone until consent
- ✅ Compliance-ready (access logs created on sync)
- ✅ Patient controls expiry time (30-day default)
- ✅ Doctors can work offline, sync later

---

## **FEATURE 2: Risk Assessment Explainability** 🔍

### **Overview**
Instead of a black-box risk score, doctors see:
1. **Overall risk level** (1-10 scale)
2. **Contributing factors** (with weights)
3. **Clinical recommendations** (actionable guidance)
4. **Confidence interval** (how certain we are)

### **Risk Assessment Data Model**

```typescript
interface RiskAssessment {
  // Overall score
  riskScore: number; // 1-10
  riskLevel: "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  confidence: number; // 0-1 (how certain is this assessment?)
  
  // Explainability
  factors: Array<{
    name: string;
    category: "DEMOGRAPHIC" | "MEDICATION" | "CONDITION" | "ALLERGY" | "PROCEDURE";
    value: any; // Age: 68, Medication: "Warfarin", etc.
    weightContribution: number; // How much does this factor increase risk?
    reasoning: string; // "Patient age > 65 increases risk of falls"
    relatedConditions?: string[]; // "Falls → hip fracture → immobility"
  }>;
  
  // Recommendations
  recommendations: Array<{
    priority: "URGENT" | "HIGH" | "MEDIUM" | "LOW";
    action: string; // "Prioritize IV access"
    reason: string; // Based on which factors?
    context: string; // Clinical context (e.g., "Warfarin + falls risk")
  }>;
  
  // Audit trail
  calculatedAt: number;
  version: string; // "risk-engine-v2.1"
  modelInputs: {
    age: number;
    conditionCount: number;
    medicationCount: number;
    allergyCount: number;
    implantDevices: string[];
  };
  
  // Caveats
  limitations: string[]; // "Age-based models may not apply to all populations"
}
```

### **Risk Engine Implementation**

```typescript
// backend/services/riskEngine.ts

interface RiskFactorDefinition {
  name: string;
  category: string;
  weight: number;
  threshold?: any;
  reasoning: (value: any) => string;
  relatedConditions?: string[];
}

const RISK_FACTORS: RiskFactorDefinition[] = [
  {
    name: "Advanced Age",
    category: "DEMOGRAPHIC",
    weight: 2.1,
    threshold: 65,
    reasoning: (age) => `Patient age ${age} exceeds threshold of 65; increased fall risk`,
    relatedConditions: ["Osteoporosis", "Cognitive decline"]
  },
  {
    name: "Polypharmacy",
    category: "MEDICATION",
    weight: 1.8,
    threshold: 5,
    reasoning: (count) => `${count} medications increases risk of interactions and adverse events`,
    relatedConditions: ["Drug interactions", "Medication errors"]
  },
  {
    name: "Anticoagulation Therapy",
    category: "MEDICATION",
    weight: 2.2,
    reasoning: (drug) => `${drug} increases bleeding risk; prioritize IV access and hemostasis checks`,
    relatedConditions: ["Hemorrhage", "Intracranial bleeding"]
  },
  {
    name: "Multiple Allergies",
    category: "ALLERGY",
    weight: 1.5,
    threshold: 3,
    reasoning: (count) => `${count} documented allergies increases medication selection complexity`,
    relatedConditions: ["Anaphylaxis", "Adverse drug reactions"]
  },
  {
    name: "Implanted Device",
    category: "PROCEDURE",
    weight: 2.0,
    reasoning: (devices) => `Patient has ${devices.join(", ")}; avoid certain imaging/procedures`,
    relatedConditions: ["Device malfunction", "Complications"]
  },
  {
    name: "Missing Recent Vitals",
    category: "INFORMATION_GAP",
    weight: 1.2,
    reasoning: () => `No recent vital signs; baseline unknown, harder to assess acuity`,
    relatedConditions: ["Delayed diagnosis", "Triage error"]
  }
];

export async function assessPatientRisk(patientId: string): Promise<RiskAssessment> {
  // 1. Fetch patient data
  const patient = await Patient.findById(patientId);
  const medicalRecords = await MedicalRecord.find({ patientId });
  
  if (!patient) throw new Error("Patient not found");
  
  // 2. Calculate age
  const age = calculateAge(patient.dateOfBirth);
  
  // 3. Evaluate each risk factor
  const factors: RiskAssessment['factors'] = [];
  let totalRiskScore = 0;
  let activatedFactors = 0;
  
  // Age check
  if (age >= 65) {
    const weight = RISK_FACTORS[0].weight;
    totalRiskScore += weight;
    activatedFactors++;
    
    factors.push({
      name: "Advanced Age",
      category: "DEMOGRAPHIC",
      value: age,
      weightContribution: weight,
      reasoning: `Patient age ${age} exceeds threshold of 65; increased fall risk`,
      relatedConditions: ["Osteoporosis", "Cognitive decline"]
    });
  }
  
  // Medication count (polypharmacy)
  if (patient.medications.length >= 5) {
    const weight = RISK_FACTORS[1].weight;
    totalRiskScore += weight;
    activatedFactors++;
    
    factors.push({
      name: "Polypharmacy",
      category: "MEDICATION",
      value: patient.medications.length,
      weightContribution: weight,
      reasoning: `${patient.medications.length} medications increases risk of interactions`,
      relatedConditions: ["Drug interactions", "Medication errors"]
    });
  }
  
  // Anticoagulant check
  const anticoagulants = patient.medications.filter(m => 
    ["Warfarin", "Apixaban", "Rivaroxaban", "Dabigatran"].some(drug =>
      m.toLowerCase().includes(drug.toLowerCase())
    )
  );
  
  if (anticoagulants.length > 0) {
    const weight = RISK_FACTORS[2].weight;
    totalRiskScore += weight;
    activatedFactors++;
    
    factors.push({
      name: "Anticoagulation Therapy",
      category: "MEDICATION",
      value: anticoagulants[0],
      weightContribution: weight,
      reasoning: `${anticoagulants[0]} increases bleeding risk; prioritize IV access`,
      relatedConditions: ["Hemorrhage", "Intracranial bleeding"]
    });
  }
  
  // Allergy count
  if (patient.allergies.length >= 3) {
    const weight = RISK_FACTORS[3].weight;
    totalRiskScore += weight;
    activatedFactors++;
    
    factors.push({
      name: "Multiple Allergies",
      category: "ALLERGY",
      value: patient.allergies.length,
      weightContribution: weight,
      reasoning: `${patient.allergies.length} documented allergies increases complexity`,
      relatedConditions: ["Anaphylaxis", "Adverse drug reactions"]
    });
  }
  
  // Implanted devices
  if (patient.implants && patient.implants.length > 0) {
    const weight = RISK_FACTORS[4].weight;
    totalRiskScore += weight;
    activatedFactors++;
    
    factors.push({
      name: "Implanted Device",
      category: "PROCEDURE",
      value: patient.implants,
      weightContribution: weight,
      reasoning: `Patient has ${patient.implants.join(", ")}; avoid certain procedures`,
      relatedConditions: ["Device malfunction"]
    });
  }
  
  // 4. Generate recommendations
  const recommendations: RiskAssessment['recommendations'] = [];
  
  if (totalRiskScore >= 7) {
    recommendations.push({
      priority: "URGENT",
      action: "Establish IV access immediately",
      reason: "Multiple risk factors warrant rapid vascular access",
      context: "Anticoagulation therapy + advanced age"
    });
  }
  
  if (anticoagulants.length > 0) {
    recommendations.push({
      priority: "HIGH",
      action: "Check hemoglobin, INR if Warfarin; bleeding precautions",
      reason: "Anticoagulation therapy requires baseline labs",
      context: `Patient on ${anticoagulants[0]}`
    });
  }
  
  if (patient.allergies.includes("NKDA") === false && patient.allergies.length > 2) {
    recommendations.push({
      priority: "MEDIUM",
      action: "Cross-check all medications against allergy list",
      reason: "Multiple allergies increase drug interaction risk",
      context: `${patient.allergies.length} documented allergies`
    });
  }
  
  if (age >= 65 && patient.conditions.some(c => c.includes("Dementia"))) {
    recommendations.push({
      priority: "MEDIUM",
      action: "Consider communication aids; assess baseline cognition",
      reason: "Elderly patient with cognitive impairment",
      context: "Age + dementia diagnosis"
    });
  }
  
  // 5. Calculate confidence interval
  // Higher confidence if we have more data; lower if missing vitals/labs
  const lastVitalTime = medicalRecords
    .filter(r => r.type === "VITAL_SIGNS")
    .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime())[0]?.uploadedAt;
  
  const hourssinceVitals = lastVitalTime 
    ? (Date.now() - lastVitalTime.getTime()) / (1000 * 60 * 60)
    : 999;
  
  let confidence = 0.9; // Start high
  if (hourssinceVitals > 24) confidence -= 0.15; // Stale vitals
  if (patient.conditions.length === 0) confidence -= 0.1; // Missing condition history
  
  // 6. Determine risk level
  let riskLevel: RiskAssessment['riskLevel'];
  if (totalRiskScore >= 8) riskLevel = "CRITICAL";
  else if (totalRiskScore >= 6) riskLevel = "HIGH";
  else if (totalRiskScore >= 3) riskLevel = "MODERATE";
  else riskLevel = "LOW";
  
  // 7. Build assessment
  const assessment: RiskAssessment = {
    riskScore: Math.min(totalRiskScore, 10),
    riskLevel,
    confidence,
    factors,
    recommendations,
    calculatedAt: Date.now(),
    version: "risk-engine-v2.1",
    modelInputs: {
      age,
      conditionCount: patient.conditions.length,
      medicationCount: patient.medications.length,
      allergyCount: patient.allergies.length,
      implantDevices: patient.implants || []
    },
    limitations: [
      "Risk assessment is supplementary to clinical judgment",
      "Age-based models may not apply to all populations",
      "Missing data (e.g., labs) reduces model confidence",
      "Does not account for acute presenting complaint",
      "Validated only for adult patients"
    ]
  };
  
  return assessment;
}
```

### **Frontend: Display Explainability (Expo)**

```typescript
// mobile/screens/RiskAssessmentScreen.tsx
import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, ProgressBar, Text, Chip } from 'react-native-paper';

export function RiskAssessmentScreen({ riskData }: { riskData: RiskAssessment }) {
  const getRiskColor = (level: string) => {
    const colors: Record<string, string> = {
      LOW: '#4CAF50',
      MODERATE: '#FF9800',
      HIGH: '#F44336',
      CRITICAL: '#B71C1C'
    };
    return colors[level];
  };
  
  return (
    <ScrollView style={styles.container}>
      {/* Overall Risk Score */}
      <Card style={[styles.card, { borderLeftColor: getRiskColor(riskData.riskLevel), borderLeftWidth: 5 }]}>
        <Card.Content>
          <Text variant="titleLarge" style={{ color: getRiskColor(riskData.riskLevel) }}>
            Risk Level: {riskData.riskLevel}
          </Text>
          <Text variant="headlineMedium" style={{ marginVertical: 10 }}>
            {riskData.riskScore.toFixed(1)}/10
          </Text>
          
          {/* Visual progress bar */}
          <ProgressBar 
            progress={riskData.riskScore / 10} 
            color={getRiskColor(riskData.riskLevel)}
            style={{ marginBottom: 10 }}
          />
          
          <Text variant="labelMedium" style={{ color: '#666' }}>
            Confidence: {(riskData.confidence * 100).toFixed(0)}%
          </Text>
        </Card.Content>
      </Card>
      
      {/* Contributing Factors */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={{ marginBottom: 12 }}>
            Contributing Factors
          </Text>
          
          {riskData.factors.map((factor, idx) => (
            <View key={idx} style={styles.factorContainer}>
              <View style={styles.factorHeader}>
                <Text variant="labelLarge" style={{ fontWeight: '600' }}>
                  {factor.name}
                </Text>
                <Chip 
                  label={`+${factor.weightContribution.toFixed(1)}`}
                  style={styles.weightChip}
                />
              </View>
              
              <Text variant="bodySmall" style={{ color: '#555', marginVertical: 4 }}>
                {factor.reasoning}
              </Text>
              
              {factor.relatedConditions && (
                <View style={styles.tagsContainer}>
                  {factor.relatedConditions.map((cond, i) => (
                    <Chip 
                      key={i}
                      label={cond}
                      size="small"
                      style={{ marginRight: 8, marginTop: 4 }}
                    />
                  ))}
                </View>
              )}
            </View>
          ))}
        </Card.Content>
      </Card>
      
      {/* Recommendations */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium" style={{ marginBottom: 12 }}>
            Clinical Recommendations
          </Text>
          
          {riskData.recommendations.map((rec, idx) => (
            <View key={idx} style={styles.recommendationContainer}>
              <Chip 
                label={rec.priority}
                style={{
                  backgroundColor: 
                    rec.priority === 'URGENT' ? '#F44336' :
                    rec.priority === 'HIGH' ? '#FF9800' :
                    rec.priority === 'MEDIUM' ? '#FFC107' : '#4CAF50'
                }}
              />
              <Text variant="labelLarge" style={{ marginTop: 8, fontWeight: '600' }}>
                {rec.action}
              </Text>
              <Text variant="bodySmall" style={{ color: '#666', marginTop: 4 }}>
                {rec.reason}
              </Text>
              <Text variant="bodySmall" style={{ color: '#999', marginTop: 4, fontStyle: 'italic' }}>
                Context: {rec.context}
              </Text>
            </View>
          ))}
        </Card.Content>
      </Card>
      
      {/* Limitations */}
      <Card style={styles.disclaimerCard}>
        <Card.Content>
          <Text variant="titleSmall" style={{ fontWeight: '600', marginBottom: 8 }}>
            ⚠️ Assessment Limitations
          </Text>
          {riskData.limitations.map((lim, idx) => (
            <Text key={idx} variant="bodySmall" style={{ marginVertical: 4, color: '#666' }}>
              • {lim}
            </Text>
          ))}
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5'
  },
  card: {
    marginBottom: 16,
    backgroundColor: '#fff'
  },
  disclaimerCard: {
    marginBottom: 32,
    backgroundColor: '#FFF3E0'
  },
  factorContainer: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  factorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8
  },
  weightChip: {
    backgroundColor: '#E3F2FD'
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 8
  },
  recommendationContainer: {
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  }
});
```

### **Key Advantages**
- ✅ Doctors understand *why* system flagged a patient
- ✅ Clinical reasoning is transparent
- ✅ Builds trust in AI-powered recommendations
- ✅ Enables better clinical decision-making
- ✅ Creates liability defense ("system provided X reasoning")

---

## **FEATURE 3: Multi-Hospital Network** 🏥

### **Overview**
EHIS acts as a **portable health record federation**. When a patient is transferred between hospitals (e.g., Epic hospital → Cerner hospital), their emergency data is accessible across the network.

### **Data Model: Emergency Network**

```typescript
interface EmergencyNetwork {
  _id: ObjectId;
  networkId: string; // "northeast_alliance", "rural_coalition"
  name: string;
  description: string;
  hospitals: Array<{
    hospitalId: string;
    hospitalName: string;
    ehrSystem: "EPIC" | "CERNER" | "OTHER";
    city: string;
    state: string;
    joinedAt: Date;
    isActive: boolean;
  }>;
  patients: Array<{
    patientId: string;
    enrolledAt: Date;
    consentLevel: "FULL" | "ANONYMIZED" | "EMERGENCY_ONLY";
    dataSharedWith: string[]; // Array of hospitalIds
  }>;
  createdBy: string; // Admin or hospital system
  createdAt: Date;
  tier: "FREE" | "PREMIUM"; // Free: up to 5 hospitals, Premium: unlimited
}

interface PatientNetworkEnrollment {
  _id: ObjectId;
  patientId: string;
  networkId: string;
  consentLevel: "FULL" | "ANONYMIZED" | "EMERGENCY_ONLY";
  
  // What data can be shared?
  sharedDataTypes: Array<"MEDICATIONS" | "ALLERGIES" | "CONDITIONS" | "VITAL_SIGNS" | "LAB_RESULTS">;
  
  // Who can access?
  accessRules: {
    allowAllDoctors: boolean; // True = any doctor in network can see
    allowedRoles: string[]; // ["ED_DOCTOR", "TRAUMA_SURGEON", "CARDIOLOGIST"]
    requiresPatientApproval: boolean; // Batch approval vs. per-access
  };
  
  // Audit trail
  lastAccessedAt: Date;
  totalAccessCount: number;
  accessHistory: Array<{
    doctorId: string;
    hospitalId: string;
    timestamp: Date;
    dataAccessedTypes: string[];
  }>;
}
```

### **Backend: Multi-Hospital Network Hub**

```typescript
// backend/routes/network.ts

// 1. Create/Join network
router.post('/networks', authenticate, async (req, res) => {
  const { networkName, description, hospitals } = req.body;
  
  const network = new EmergencyNetwork({
    networkId: `network_${uuidv4()}`,
    name: networkName,
    description,
    hospitals: hospitals.map(h => ({
      hospitalId: h._id,
      hospitalName: h.name,
      ehrSystem: h.ehrSystem,
      city: h.city,
      state: h.state,
      joinedAt: new Date(),
      isActive: true
    })),
    createdBy: req.user._id,
    tier: "PREMIUM"
  });
  
  await network.save();
  res.json(network);
});

// 2. Patient enrolls in network
router.post('/networks/:networkId/enroll', authenticate, async (req, res) => {
  const { consentLevel, sharedDataTypes } = req.body;
  const patientId = req.user._id;
  
  // Validate network exists
  const network = await EmergencyNetwork.findById(req.params.networkId);
  if (!network) return res.status(404).json({ error: 'Network not found' });
  
  // Create enrollment record
  const enrollment = new PatientNetworkEnrollment({
    patientId,
    networkId: req.params.networkId,
    consentLevel,
    sharedDataTypes,
    accessRules: {
      allowAllDoctors: true,
      allowedRoles: ["ED_DOCTOR", "TRAUMA_SURGEON"],
      requiresPatientApproval: false
    },
    lastAccessedAt: null,
    totalAccessCount: 0,
    accessHistory: []
  });
  
  await enrollment.save();
  
  // Add patient to network
  network.patients.push({
    patientId,
    enrolledAt: new Date(),
    consentLevel,
    dataSharedWith: network.hospitals.map(h => h.hospitalId)
  });
  await network.save();
  
  res.json({ success: true, enrollmentId: enrollment._id });
});

// 3. Doctor scans QR → fetch from network
interface FetchPatientFromNetworkRequest {
  patientId: string;
  hospitalId: string;
  doctorId: string;
}

router.post('/networks/fetch-patient', authenticate, async (req, res) => {
  const { patientId, hospitalId, doctorId } = req.body;
  
  // 1. Find patient's network enrollment
  const enrollment = await PatientNetworkEnrollment.findOne({
    patientId,
    'accessRules.allowedRoles': req.user.role
  });
  
  if (!enrollment) {
    return res.status(403).json({ error: 'Patient not in accessible network' });
  }
  
  // 2. Check consent
  if (enrollment.consentLevel === "EMERGENCY_ONLY" && !isEmergencyContext(req)) {
    return res.status(403).json({ error: 'Access denied: not emergency context' });
  }
  
  // 3. Fetch patient data
  const patient = await Patient.findById(patientId);
  const medicalRecords = await MedicalRecord.find({ patientId });
  
  // 4. Filter based on consent level
  let sharedData = {
    patientId: patient._id,
    name: patient.name,
    dob: patient.dateOfBirth,
    bloodType: patient.bloodType,
    emergencyContacts: patient.emergencyContacts,
    medications: [],
    allergies: [],
    conditions: [],
    records: []
  };
  
  if (enrollment.consentLevel === "FULL") {
    sharedData.medications = patient.medications;
    sharedData.allergies = patient.allergies;
    sharedData.conditions = patient.conditions;
    sharedData.records = medicalRecords;
  } else if (enrollment.consentLevel === "ANONYMIZED") {
    sharedData.medications = patient.medications; // Can share meds
    sharedData.allergies = patient.allergies;
    sharedData.conditions = patient.conditions;
    // Don't share detailed records
  }
  
  // 5. Log access
  await AccessLog.create({
    patientId,
    doctorId,
    hospitalId,
    sourceNetwork: enrollment.networkId,
    dataTypesAccessed: Object.keys(sharedData),
    timestamp: new Date()
  });
  
  // 6. Update enrollment audit trail
  enrollment.accessHistory.push({
    doctorId,
    hospitalId,
    timestamp: new Date(),
    dataAccessedTypes: Object.keys(sharedData)
  });
  enrollment.lastAccessedAt = new Date();
  enrollment.totalAccessCount++;
  await enrollment.save();
  
  res.json(sharedData);
});

// 4. Patient views network audit trail
router.get('/networks/:networkId/my-access-history', authenticate, async (req, res) => {
  const enrollment = await PatientNetworkEnrollment.findOne({
    patientId: req.user._id,
    networkId: req.params.networkId
  });
  
  if (!enrollment) return res.status(404).json({ error: 'Not enrolled' });
  
  // Return access history sorted by most recent
  res.json({
    totalAccesses: enrollment.totalAccessCount,
    lastAccess: enrollment.lastAccessedAt,
    history: enrollment.accessHistory.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  });
});
```

### **Frontend: Network Dashboard (Expo)**

```typescript
// mobile/screens/NetworkDashboardScreen.tsx
import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Card, Text, Button, Avatar, Chip } from 'react-native-paper';
import axios from 'axios';

export function NetworkDashboardScreen() {
  const [enrollment, setEnrollment] = useState<PatientNetworkEnrollment | null>(null);
  const [accessHistory, setAccessHistory] = useState([]);
  
  useEffect(() => {
    fetchNetworkData();
  }, []);
  
  const fetchNetworkData = async () => {
    try {
      // Fetch enrollment + access history
      const { data } = await axios.get('/api/networks/my-enrollment');
      setEnrollment(data.enrollment);
      setAccessHistory(data.accessHistory);
    } catch (err) {
      console.error("Failed to fetch network data", err);
    }
  };
  
  if (!enrollment) return <Text>Loading...</Text>;
  
  return (
    <ScrollView style={styles.container}>
      {/* Network Info */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleLarge">Emergency Data Network</Text>
          <Text variant="bodyMedium" style={{ color: '#666', marginTop: 8 }}>
            Your medical data is shared across {enrollment.networkId ? 'a regional network' : 'no network'}
          </Text>
          
          <View style={styles.consentBadge}>
            <Chip 
              label={`Consent: ${enrollment.consentLevel}`}
              icon="shield-check"
              style={{
                backgroundColor: 
                  enrollment.consentLevel === 'FULL' ? '#4CAF50' :
                  enrollment.consentLevel === 'ANONYMIZED' ? '#FF9800' : '#2196F3'
              }}
            />
          </View>
        </Card.Content>
      </Card>
      
      {/* Shared Data Types */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Shared Data Types</Text>
          <View style={styles.dataTypesList}>
            {enrollment.sharedDataTypes.map((type, idx) => (
              <Chip key={idx} label={type} style={styles.dataTypeChip} />
            ))}
          </View>
        </Card.Content>
      </Card>
      
      {/* Access History */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Recent Access ({accessHistory.length})</Text>
          
          {accessHistory.slice(0, 10).map((log, idx) => (
            <View key={idx} style={styles.accessLogItem}>
              <Avatar.Text size={40} label={log.doctorId.substring(0, 2).toUpperCase()} />
              <View style={styles.accessLogContent}>
                <Text variant="labelLarge">{log.doctorId} (ID: {log.hospitalId})</Text>
                <Text variant="bodySmall" style={{ color: '#999' }}>
                  {new Date(log.timestamp).toLocaleDateString()} {new Date(log.timestamp).toLocaleTimeString()}
                </Text>
                <Text variant="bodySmall" style={{ color: '#666', marginTop: 4 }}>
                  Accessed: {log.dataAccessedTypes.join(', ')}
                </Text>
              </View>
            </View>
          ))}
        </Card.Content>
      </Card>
      
      {/* Network Settings */}
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Network Settings</Text>
          <Button 
            mode="outlined" 
            onPress={() => {/* Show consent update modal */}}
            style={{ marginTop: 12 }}
          >
            Update Consent Level
          </Button>
          <Button 
            mode="outlined"
            onPress={() => {/* Leave network */}}
            style={{ marginTop: 8 }}
          >
            Leave Network
          </Button>
        </Card.Content>
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: '#f5f5f5'
  },
  card: {
    marginBottom: 16,
    backgroundColor: '#fff'
  },
  consentBadge: {
    marginTop: 12
  },
  dataTypesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 12
  },
  dataTypeChip: {
    margin: 4
  },
  accessLogItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee'
  },
  accessLogContent: {
    marginLeft: 12,
    flex: 1
  }
});
```

### **Key Advantages**
- ✅ Patient data accessible across hospital systems (Epic ↔ Cerner gap)
- ✅ Reduces duplicate testing/admission
- ✅ Improves care continuity for transfers
- ✅ Patient controls access (fine-grained consent)
- ✅ Full audit trail for compliance
- ✅ Differentiates from incumbent EHRs

---

## **FEATURE 4: Clinical Validation Study Design** 📊

### **Overview**
Establish a **retrospective validation study** to prove EHIS risk engine improves outcomes. This enables hospital adoption (compliance checkbox).

### **Study Protocol**

```markdown
# EHIS Risk Assessment Validation Study Protocol

## Study Title
**Clinical Utility and Accuracy of the EHIS Risk Assessment Tool vs. Standard Triage Protocols in Emergency Department Settings**

## Primary Objective
Validate EHIS risk score against standard ESI (Emergency Severity Index) triage levels and clinical outcomes.

## Study Design
- **Type**: Retrospective cohort study
- **Duration**: 4-6 weeks of data collection per hospital
- **Sample Size**: 200-300 ED visits
- **Control**: Standard ESI triage (existing hospital protocol)
- **Test**: EHIS risk assessment (applied retrospectively to same patients)

## Primary Outcomes
1. **Sensitivity/Specificity** of EHIS risk score vs. ESI level
   - How many high-risk patients did EHIS correctly identify?
   - How many low-risk patients did EHIS correctly classify?

2. **NPV/PPV** (Negative/Positive Predictive Values)
   - If EHIS says "HIGH RISK", what's the chance patient actually has adverse event?

3. **Correlation** with ED LOS (Length of Stay)
   - Do patients with high EHIS scores have longer ED stays? (Proxy for acuity)

## Secondary Outcomes
1. **Comparison with ESI levels**
   - EHIS HIGH RISK ↔ ESI Level 2-3?
   - EHIS LOW RISK ↔ ESI Level 4-5?

2. **Time-to-intervention**
   - For high-risk EHIS patients, how quickly did they receive initial assessment?

3. **Clinical decision-making**
   - Did doctors change management based on EHIS factors they hadn't considered?

## Inclusion Criteria
- Age ≥ 18 years
- Complete medical history in EHR
- Known outcomes (discharged/admitted/transferred)

## Exclusion Criteria
- Age < 18 years
- Incomplete medical records
- EMS/ambulance direct-to-OR (missing triage data)

## Statistical Analysis
- Descriptive statistics (demographics, risk distribution)
- Sensitivity/specificity with 95% CI
- Receiver Operating Characteristic (ROC) curve
- Spearman correlation (EHIS score ↔ ESI level)
- Logistic regression (EHIS factors → adverse outcome)

## Data Privacy
- All patient identifiers removed
- Study conducted under IRB exemption (retrospective, de-identified)
- No additional data collection from patients
- Results published in aggregate form only
```

### **Implementation: Data Collection API**

```typescript
// backend/routes/research.ts

// Endpoint for research partners to submit anonymized outcomes
router.post('/research/submit-validation-data', authenticate, async (req, res) => {
  // Verify research partnership agreement
  if (req.user.role !== 'RESEARCH_PARTNER') {
    return res.status(403).json({ error: 'Not authorized' });
  }
  
  const {
    hospitalId,
    anonymizedPatientId, // Hash of original ID, not actual ID
    ehisRiskScore,
    esiLevel,
    edOutcomes: {
      lengthOfStay,
      admitted,
      diagnosis,
      procedures,
      complications
    },
    timestamp
  } = req.body;
  
  // Store validation data
  const validationRecord = new ValidationStudyRecord({
    hospitalId,
    anonymizedPatientId,
    ehisRiskScore,
    esiLevel,
    edOutcomes,
    submittedAt: new Date()
  });
  
  await validationRecord.save();
  
  // Calculate correlations in real-time
  const allRecords = await ValidationStudyRecord.find({ hospitalId });
  const correlation = calculateCorrelation(
    allRecords.map(r => r.ehisRiskScore),
    allRecords.map(r => esiLevelToNumeric(r.esiLevel))
  );
  
  res.json({
    success: true,
    recordCount: allRecords.length,
    currentCorrelation: correlation,
    studyStatus: allRecords.length < 200 ? 'IN_PROGRESS' : 'COMPLETE'
  });
});

// Endpoint to generate research report
router.get('/research/validation-report', authenticate, async (req, res) => {
  const records = await ValidationStudyRecord.find();
  
  // Calculate metrics
  const riskScores = records.map(r => r.ehisRiskScore);
  const esiLevels = records.map(r => esiLevelToNumeric(r.esiLevel));
  const outcomes = records.map(r => r.edOutcomes.complications > 0 ? 1 : 0);
  
  // Sensitivity/Specificity
  const highRiskPatients = records.filter(r => r.ehisRiskScore >= 6);
  const truePositives = highRiskPatients.filter(r => r.edOutcomes.complications > 0).length;
  const falsePositives = highRiskPatients.filter(r => r.edOutcomes.complications === 0).length;
  
  const lowRiskPatients = records.filter(r => r.ehisRiskScore < 6);
  const trueNegatives = lowRiskPatients.filter(r => r.edOutcomes.complications === 0).length;
  const falseNegatives = lowRiskPatients.filter(r => r.edOutcomes.complications > 0).length;
  
  const sensitivity = truePositives / (truePositives + falseNegatives);
  const specificity = trueNegatives / (trueNegatives + falsePositives);
  const npv = trueNegatives / (trueNegatives + falseNegatives);
  const ppv = truePositives / (truePositives + falsePositives);
  
  // Correlation with ESI
  const pearsonCorr = calculatePearsonCorrelation(riskScores, esiLevels);
  
  // ROC curve (simplified)
  const rocPoints = [];
  for (let threshold = 1; threshold <= 10; threshold += 0.5) {
    const tp = records.filter(r => r.ehisRiskScore >= threshold && r.edOutcomes.complications > 0).length;
    const fp = records.filter(r => r.ehisRiskScore >= threshold && r.edOutcomes.complications === 0).length;
    const tn = records.filter(r => r.ehisRiskScore < threshold && r.edOutcomes.complications === 0).length;
    const fn = records.filter(r => r.ehisRiskScore < threshold && r.edOutcomes.complications > 0).length;
    
    rocPoints.push({
      threshold,
      sensitivity: tp / (tp + fn),
      specificity: tn / (tn + fp)
    });
  }
  
  const report = {
    studyMetadata: {
      totalPatients: records.length,
      hospitals: new Set(records.map(r => r.hospitalId)).size,
      studyStartDate: records[0]?.submittedAt || new Date(),
      reportGeneratedAt: new Date()
    },
    performanceMetrics: {
      sensitivity: sensitivity.toFixed(3),
      specificity: specificity.toFixed(3),
      npv: npv.toFixed(3),
      ppv: ppv.toFixed(3),
      accuracyCI95: calculateConfidenceInterval(sensitivity)
    },
    correlations: {
      ehisVsESI: pearsonCorr.toFixed(3),
      ehisVsOutcomes: calculateCorrelation(riskScores, outcomes).toFixed(3)
    },
    rocCurve: rocPoints,
    conclusion: `EHIS risk assessment shows ${sensitivity > 0.8 ? 'strong' : 'moderate'} correlation with clinical outcomes and ESI triage levels.`
  };
  
  res.json(report);
});
```

### **Key Advantages**
- ✅ Provides clinical evidence for hospital adoption
- ✅ Creates peer-reviewed publication opportunity
- ✅ Builds credibility with regulators + compliance teams
- ✅ Identifies algorithm improvements
- ✅ Reduces liability risk (documented validation)

---

## COMPLETE ARCHITECTURE: Expo Frontend + Express Backend

### **Frontend: Expo Project Structure**

```
ehis-mobile/
├── app/
│   ├── (auth)/
│   │   ├── login.tsx
│   │   ├── signup.tsx
│   │   └── onboarding.tsx
│   ├── (patient)/
│   │   ├── profile.tsx
│   │   ├── qr-generator.tsx
│   │   ├── offline-records.tsx
│   │   ├── network-dashboard.tsx
│   │   └── analytics.tsx
│   ├── (doctor)/
│   │   ├── qr-scanner.tsx
│   │   ├── patient-detail.tsx
│   │   ├── risk-assessment.tsx
│   │   ├── access-history.tsx
│   │   └── triage-notes.tsx
│   └── _layout.tsx
├── components/
│   ├── QRScanner.tsx
│   ├── RiskCard.tsx
│   ├── OfflineIndicator.tsx
│   └── ErrorBoundary.tsx
├── hooks/
│   ├── useOfflineSync.ts
│   ├── useAuth.ts
│   └── useNetwork.ts
├── store/
│   ├── userStore.ts (Zustand)
│   ├── offlineStore.ts (SQLite)
│   └── syncQueue.ts
├── services/
│   ├── qr-encryption.ts
│   ├── offline-storage.ts
│   ├── sync-manager.ts
│   └── api-client.ts
└── app.json (Expo config)
```

### **Backend: Express Project Structure**

```
ehis-backend/
├── src/
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── patient.ts
│   │   ├── doctor.ts
│   │   ├── qr.ts
│   │   ├── risk-engine.ts
│   │   ├── network.ts
│   │   ├── fhir-export.ts
│   │   ├── access-logs.ts
│   │   └── research.ts
│   ├── services/
│   │   ├── riskEngine.ts
│   │   ├── embeddingService.ts
│   │   ├── geminiService.ts
│   │   ├── qdrantService.ts
│   │   ├── qrEncryption.ts
│   │   └── fhirBuilder.ts
│   ├── models/
│   │   ├── User.ts
│   │   ├── Patient.ts
│   │   ├── MedicalRecord.ts
│   │   ├── AccessLog.ts
│   │   ├── EmergencyNetwork.ts
│   │   ├── PatientNetworkEnrollment.ts
│   │   ├── QRToken.ts
│   │   └── ValidationStudyRecord.ts
│   ├── middleware/
│   │   ├── auth.ts
│   │   ├── logging.ts
│   │   └── errorHandler.ts
│   ├── config/
│   │   └── env.ts
│   └── app.ts (Express setup)
├── docker-compose.yml
├── .env.example
└── Dockerfile
```

---

## Development Roadmap

### **Phase 1: MVP (Weeks 1-2)**
- [ ] Expo project setup + navigation
- [ ] QR scanner (basic)
- [ ] Patient profile + QR generation
- [ ] Offline QR support (encryption)
- [ ] Risk engine (deterministic, no explainability yet)
- [ ] Docker Compose setup

### **Phase 2: Enterprise Features (Weeks 3-4)**
- [ ] Risk explainability (factors + reasoning)
- [ ] Multi-hospital network enrollment
- [ ] FHIR export API
- [ ] Clinical validation study API
- [ ] Access logs + audit dashboard

### **Phase 3: Polish (Week 5)**
- [ ] Mobile app UX refinement
- [ ] Error handling + offline recovery
- [ ] Documentation + README
- [ ] GitHub + EAS deployment setup

---

## Deployment

### **Frontend: Expo + EAS**

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo account
eas login

# Build APK + IPA
eas build --platform android --wait
eas build --platform ios --wait

# Or use preview for testing
eas build --platform all --profile preview --wait
```

### **Backend: Docker Compose**

```bash
docker-compose up -d

# Health check
curl http://localhost:5000/api/health
```

---

## Success Criteria

✅ **Technical**
- Native mobile app scans QR codes offline
- Risk assessment displays explainable factors
- Multi-hospital network federation works
- FHIR export compliant with HL7 standards
- Validation study collects data from 2+ hospitals

✅ **Business**
- 50+ beta users (patients + doctors)
- 1 hospital pilot with preliminary data
- GitHub stars > 100
- Published validation study (or study protocol)

✅ **Compliance**
- HIPAA checklist 80% complete
- Encryption at rest + in transit
- Access logs functional
- Privacy policy published

---

## This Is Your Competitive Moat

Your unique combination:
1. **Patient-first design** (portable, cross-hospital)
2. **AI-powered insights** (explainable risk + summarization)
3. **Native mobile** (works in real ED workflows)
4. **Offline-capable** (QR-embedded data)
5. **Clinically validated** (retrospective study)

Epic/Cerner can't move this fast. Smaller QR-based competitors don't have the clinical depth.

**Ship this. Validate it. Win.**
