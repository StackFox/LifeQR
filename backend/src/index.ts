import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import multer from 'multer';
import path from 'path';
import fs from 'node:fs';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { QdrantClient } from '@qdrant/js-client-rest';
import { PDFParse } from 'pdf-parse';
import { assessPatientRisk } from './services/riskEngine.js';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type UserRole = 'PATIENT' | 'DOCTOR';
type NotificationType = 'ACCESS_LOG' | 'ACCESS_REQUEST' | 'SYSTEM';
type AccessRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type ConsentLevel = 'FULL' | 'ANONYMIZED' | 'EMERGENCY_ONLY';

interface Medication {
    name: string;
    dosage: string;
    frequency: string;
}

interface EmergencyContact {
    name: string;
    relationship: string;
    phone: string;
}

interface UploadedDocument {
    id: string;
    name: string;
    url: string;
    uploadedAt: string;
}

interface Patient {
    patientId: string;
    name: string;
    dateOfBirth: string;
    bloodType: string;
    emergencyContacts: EmergencyContact[];
    conditions: string[];
    medications: Medication[];
    allergies: string[];
    implants: string[];
    documents: UploadedDocument[];
}

interface NotificationRecord {
    notificationId: string;
    userId: string;
    userRole: UserRole;
    type: NotificationType;
    title: string;
    message: string;
    status: 'UNREAD' | 'READ';
    createdAt: string;
    relatedRequestId?: string;
}

interface AccessRequest {
    requestId: string;
    patientId: string;
    doctorId: string;
    status: AccessRequestStatus;
    requestedAt: string;
    respondedAt?: string;
    reason?: string;
}

interface VerifiedDoctor {
    doctorId: string;
    name: string;
    hospitalId: string;
    isVerified: boolean;
    licenseId: string;
}

interface NetworkHospital {
    hospitalId: string;
    hospitalName: string;
    ehrSystem: string;
    city: string;
    state: string;
    isActive: boolean;
}

interface NetworkEnrollment {
    patientId: string;
    enrolledAt: string;
    consentLevel: ConsentLevel;
    dataSharedWith: string[];
}

interface Network {
    networkId: string;
    name: string;
    description: string;
    hospitals: NetworkHospital[];
    patients: NetworkEnrollment[];
}

interface AccessLogRecord {
    logId: string;
    patientId: string;
    doctorId: string;
    hospitalId: string;
    qrTokenId: string;
    scanTimestamp: number;
    syncedAt: string;
}

interface QRSession {
    qrTokenId: string;
    patientId: string;
    createdAt: number;
    expiresAt: number;
    status: 'ACTIVE' | 'REVOKED';
}

interface NFCSession {
    nfcTokenId: string;
    patientId: string;
    patientAccessId: string;
    fallbackCode: string;
    createdAt: number;
    expiresAt: number;
    status: 'ACTIVE' | 'REVOKED';
}

interface VectorIndexResult {
    attempted: boolean;
    indexed: boolean;
    collection: string;
    chunksIndexed: number;
    embeddingDimension: number | null;
    error?: string;
}

const app = express();
const upload = multer({ dest: 'uploads/' });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const qdrant = new QdrantClient({ url: process.env.QDRANT_URL || 'http://localhost:6333' });
const EMBEDDING_MODEL = 'text-embedding-004';
const SUMMARY_MODEL = 'gemini-1.5-flash';
const MEDICAL_VECTOR_COLLECTION = 'medical_records_rag_v1';

// CORS Configuration
const corsOptions = {
    origin: [
        'https://life-qr-frontend.vercel.app',
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:8081',
        process.env.FRONTEND_URL || 'http://localhost:3000'
    ],
    credentials: true,
    optionsSuccessStatus: 200
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Mock data
const patients: Patient[] = [
    {
        patientId: 'P-12345',
        name: 'Jane Doe',
        dateOfBirth: '1985-04-12',
        bloodType: 'O-',
        emergencyContacts: [{ name: 'John Doe', relationship: 'Spouse', phone: '555-0199' }],
        conditions: ['Hypertension'],
        medications: [{ name: 'Lisinopril', dosage: '10mg', frequency: 'Daily' }],
        allergies: ['Penicillin', 'Peanuts'],
        implants: [],
        documents: [],
    },
    {
        patientId: 'P-67890',
        name: 'Robert Chen',
        dateOfBirth: '1957-11-03',
        bloodType: 'A+',
        emergencyContacts: [
            { name: 'Linda Chen', relationship: 'Wife', phone: '555-0234' },
            { name: 'Michael Chen', relationship: 'Son', phone: '555-0235' },
        ],
        conditions: ['Type 2 Diabetes', 'Atrial Fibrillation', 'Hypertension', 'Coronary Artery Disease'],
        medications: [
            { name: 'Warfarin', dosage: '5mg', frequency: 'Daily' },
            { name: 'Metformin', dosage: '1000mg', frequency: 'Twice daily' },
            { name: 'Lisinopril', dosage: '20mg', frequency: 'Daily' },
            { name: 'Atorvastatin', dosage: '40mg', frequency: 'Daily' },
        ],
        allergies: ['Penicillin', 'Sulfa drugs', 'Iodine contrast'],
        implants: ['Pacemaker (Medtronic, 2022)'],
        documents: [],
    },
];

const verifiedDoctors: VerifiedDoctor[] = [
    {
        doctorId: 'DOC-CHEN',
        name: 'Dr. Robert Chen',
        hospitalId: 'H-001',
        isVerified: true,
        licenseId: 'NMC-987654',
    },
    {
        doctorId: 'DOC-DEMO',
        name: 'Dr. Demo User',
        hospitalId: 'H-002',
        isVerified: true,
        licenseId: 'NMC-123123',
    },
    {
        doctorId: 'DOC-UNVERIFIED',
        name: 'Pending Verification',
        hospitalId: 'H-001',
        isVerified: false,
        licenseId: 'NMC-PENDING',
    },
];

const networks: Network[] = [
    {
        networkId: 'network_northeast_alliance',
        name: 'Northeast Emergency Alliance',
        description: 'Regional emergency data sharing network',
        hospitals: [
            {
                hospitalId: 'H-001',
                hospitalName: 'Mass General Hospital',
                ehrSystem: 'EPIC',
                city: 'Boston',
                state: 'MA',
                isActive: true,
            },
            {
                hospitalId: 'H-002',
                hospitalName: 'NYU Langone',
                ehrSystem: 'EPIC',
                city: 'New York',
                state: 'NY',
                isActive: true,
            },
            {
                hospitalId: 'H-003',
                hospitalName: 'Yale New Haven',
                ehrSystem: 'CERNER',
                city: 'New Haven',
                state: 'CT',
                isActive: true,
            },
        ],
        patients: [
            {
                patientId: 'P-12345',
                enrolledAt: new Date().toISOString(),
                consentLevel: 'FULL',
                dataSharedWith: ['H-001', 'H-002', 'H-003'],
            },
            {
                patientId: 'P-67890',
                enrolledAt: new Date().toISOString(),
                consentLevel: 'FULL',
                dataSharedWith: ['H-001', 'H-002', 'H-003'],
            },
        ],
    },
];

const notifications: NotificationRecord[] = [];
const accessRequests: AccessRequest[] = [];
const accessLogs: AccessLogRecord[] = [];
const qrSessions: QRSession[] = [];
const nfcSessions: NFCSession[] = [];

// Helpers
function buildMedicalSummary(patient: Patient): string {
    const parts: string[] = [];
    if (patient.conditions.length > 0) {
        parts.push(`Active conditions: ${patient.conditions.join(', ')}.`);
    }
    if (patient.medications.length > 0) {
        const medList = patient.medications.map((m) => `${m.name} ${m.dosage}`).join(', ');
        parts.push(`Currently on ${patient.medications.length} medication(s): ${medList}.`);
    }
    if (patient.allergies.length > 0) {
        parts.push(`Known allergies: ${patient.allergies.join(', ')}.`);
    }
    if (patient.implants.length > 0) {
        parts.push(`Implanted devices: ${patient.implants.join(', ')}.`);
    }
    return parts.join(' ') || 'No significant medical history recorded.';
}

function createNotification(
    userId: string,
    userRole: UserRole,
    type: NotificationType,
    title: string,
    message: string,
    relatedRequestId?: string
): void {
    notifications.push({
        notificationId: uuidv4(),
        userId,
        userRole,
        type,
        title,
        message,
        status: 'UNREAD',
        createdAt: new Date().toISOString(),
        relatedRequestId,
    });
}

function findNetworkEnrollment(patientId: string): { network: Network; enrollment: NetworkEnrollment } | null {
    for (const network of networks) {
        const enrollment = network.patients.find((p) => p.patientId === patientId);
        if (enrollment) {
            return { network, enrollment };
        }
    }
    return null;
}

function buildPatientSnapshot(patient: Patient, consentLevel: ConsentLevel) {
    const riskAssessment = assessPatientRisk({
        dateOfBirth: patient.dateOfBirth,
        medications: patient.medications,
        allergies: patient.allergies,
        conditions: patient.conditions,
        implants: patient.implants,
    });

    const isAnonymized = consentLevel === 'ANONYMIZED';
    const isEmergencyOnly = consentLevel === 'EMERGENCY_ONLY';

    return {
        patientId: patient.patientId,
        qrTokenId: null,
        name: isAnonymized ? 'Redacted Patient' : patient.name,
        dateOfBirth: isAnonymized ? 'Redacted' : patient.dateOfBirth,
        bloodType: patient.bloodType,
        emergencyContacts: isEmergencyOnly ? [] : patient.emergencyContacts,
        conditions: patient.conditions,
        medications: isAnonymized ? [] : patient.medications,
        allergies: patient.allergies,
        implants: patient.implants,
        medicalSummary: buildMedicalSummary(patient),
        riskAssessment,
        lastUpdated: Date.now(),
        expiryTime: Date.now() + 30 * 24 * 60 * 60 * 1000,
        consentLevel,
        encryptionVersion: 'tokenized-v2',
    };
}

function getVerifiedDoctor(doctorId: string, hospitalId: string): VerifiedDoctor | null {
    const doctor = verifiedDoctors.find((d) => d.doctorId === doctorId && d.hospitalId === hospitalId);
    if (!doctor || !doctor.isVerified) {
        return null;
    }
    return doctor;
}

function hasUsableGeminiKey(): boolean {
    const key = String(process.env.GEMINI_API_KEY || '').trim();
    return key.length > 0 && !key.toLowerCase().includes('fake');
}

function splitTextIntoChunks(text: string, maxLen = 1200, overlap = 120): string[] {
    const cleanText = text.replace(/\s+/g, ' ').trim();
    if (!cleanText) {
        return [];
    }

    if (cleanText.length <= maxLen) {
        return [cleanText];
    }

    const chunks: string[] = [];
    let start = 0;
    while (start < cleanText.length) {
        const end = Math.min(start + maxLen, cleanText.length);
        chunks.push(cleanText.slice(start, end));
        if (end === cleanText.length) {
            break;
        }
        start = Math.max(0, end - overlap);
    }
    return chunks;
}

function generateFallbackCode(): string {
    return String(Math.floor(100000 + Math.random() * 900000));
}

function buildFallbackEmbedding(text: string, dimension = 768): number[] {
    const vector = new Array<number>(dimension).fill(0);
    const normalizedText = text.toLowerCase();

    for (let i = 0; i < normalizedText.length; i++) {
        const code = normalizedText.charCodeAt(i);
        const idx = code % dimension;
        vector[idx] += 1;

        // Add a lightweight rolling context signal for nearby character patterns.
        const contextIdx = (idx + (i % 31)) % dimension;
        vector[contextIdx] += 0.25;
    }

    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (magnitude > 0) {
        for (let i = 0; i < vector.length; i++) {
            vector[i] = vector[i] / magnitude;
        }
    }

    return vector;
}

function createAccessSession(patientId: string, ttlMs = 15 * 60 * 1000): QRSession {
    const now = Date.now();
    const session: QRSession = {
        qrTokenId: uuidv4(),
        patientId,
        createdAt: now,
        expiresAt: now + ttlMs,
        status: 'ACTIVE',
    };
    qrSessions.push(session);
    return session;
}

async function embedText(text: string): Promise<number[]> {
    if (hasUsableGeminiKey()) {
        const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL });
        const result = await embeddingModel.embedContent(text);
        const values = (result as { embedding?: { values?: number[] } }).embedding?.values;
        if (!values || values.length === 0) {
            throw new Error('Embedding model returned empty vector values.');
        }
        return values;
    }

    return buildFallbackEmbedding(text, 768);
}

async function ensureVectorCollection(vectorSize: number): Promise<void> {
    try {
        await qdrant.getCollection(MEDICAL_VECTOR_COLLECTION);
    } catch {
        await qdrant.createCollection(MEDICAL_VECTOR_COLLECTION, {
            vectors: {
                size: vectorSize,
                distance: 'Cosine',
            },
        });
    }
}

async function indexPdfToVectorDb(
    patientId: string,
    fileName: string,
    documentId: string,
    textContent: string
): Promise<VectorIndexResult> {
    const result: VectorIndexResult = {
        attempted: false,
        indexed: false,
        collection: MEDICAL_VECTOR_COLLECTION,
        chunksIndexed: 0,
        embeddingDimension: null,
    };

    const chunks = splitTextIntoChunks(textContent, 1200, 120).slice(0, 20);
    if (chunks.length === 0) {
        return result;
    }

    result.attempted = true;

    try {
        const vectors: number[][] = [];
        for (const chunk of chunks) {
            const vector = await embedText(chunk);
            vectors.push(vector);
        }

        const vectorSize = vectors[0]?.length ?? 0;
        if (vectorSize <= 0) {
            throw new Error('Unable to compute embedding dimension from generated vectors.');
        }

        result.embeddingDimension = vectorSize;
        await ensureVectorCollection(vectorSize);

        await qdrant.upsert(MEDICAL_VECTOR_COLLECTION, {
            points: vectors.map((vector, index) => ({
                id: uuidv4(),
                vector,
                payload: {
                    patientId,
                    documentId,
                    fileName,
                    chunkIndex: index,
                    textChunk: chunks[index],
                    uploadedAt: new Date().toISOString(),
                },
            })),
        });

        result.indexed = true;
        result.chunksIndexed = vectors.length;
        return result;
    } catch (error) {
        result.error = (error as Error).message;
        return result;
    }
}

function decodePatientAccessToken(
    resolvedTokenId: string,
    doctorId: string,
    hospitalId: string,
    patientId?: string
): { status: number; body: Record<string, unknown> } {
    const doctor = getVerifiedDoctor(doctorId, hospitalId);
    if (!doctor) {
        return {
            status: 403,
            body: { error: 'Doctor is not verified for this hospital' },
        };
    }

    const qrSession = qrSessions.find((s) => {
        const tokenMatches = s.qrTokenId === resolvedTokenId;
        const patientMatches = !patientId || s.patientId === patientId;
        return tokenMatches && patientMatches && s.status === 'ACTIVE';
    });

    if (!qrSession) {
        return {
            status: 404,
            body: { error: 'QR session not found or revoked' },
        };
    }

    const resolvedPatientId = qrSession.patientId;
    if (qrSession.expiresAt < Date.now()) {
        qrSession.status = 'REVOKED';
        return {
            status: 410,
            body: { error: 'QR session expired. Ask patient to generate a new QR.' },
        };
    }

    const networkContext = findNetworkEnrollment(resolvedPatientId);
    if (!networkContext) {
        return {
            status: 403,
            body: { error: 'Patient is not enrolled in a shareable network' },
        };
    }

    if (!networkContext.enrollment.dataSharedWith.includes(hospitalId)) {
        return {
            status: 403,
            body: { error: 'Patient opted out of sharing data with this hospital' },
        };
    }

    const patient = patients.find((p) => p.patientId === resolvedPatientId);
    if (!patient) {
        return {
            status: 404,
            body: { error: 'Patient not found' },
        };
    }

    const payload = {
        ...buildPatientSnapshot(patient, networkContext.enrollment.consentLevel),
        qrTokenId: resolvedTokenId,
        accessedBy: {
            doctorId: doctor.doctorId,
            name: doctor.name,
            hospitalId: doctor.hospitalId,
            licenseId: doctor.licenseId,
            isVerified: true,
        },
    };

    accessLogs.push({
        logId: uuidv4(),
        patientId: resolvedPatientId,
        doctorId,
        hospitalId,
        qrTokenId: resolvedTokenId,
        scanTimestamp: Date.now(),
        syncedAt: new Date().toISOString(),
    });

    createNotification(
        resolvedPatientId,
        'PATIENT',
        'ACCESS_LOG',
        'Your Data Was Accessed',
        `Doctor ${doctorId} from ${hospitalId} accessed your emergency profile.`
    );

    createNotification(
        doctorId,
        'DOCTOR',
        'ACCESS_LOG',
        'Patient Data Retrieved',
        `Emergency profile for patient ${resolvedPatientId} was shared successfully.`
    );

    return {
        status: 200,
        body: {
            success: true,
            patientData: payload,
            doctorVerified: true,
        },
    };
}

// Routes
app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'ok', version: '2.1-tokenized-qr' });
});

app.get('/api/doctors/:doctorId/verification', (req: Request, res: Response) => {
    const { doctorId } = req.params;
    const hospitalId = String(req.query['hospitalId'] || '');

    const doctor = verifiedDoctors.find((d) => d.doctorId === doctorId && (!hospitalId || d.hospitalId === hospitalId));

    if (!doctor) {
        res.json({
            doctorId,
            hospitalId,
            isVerified: false,
            name: null,
            licenseId: null,
        });
        return;
    }

    res.json({
        doctorId: doctor.doctorId,
        hospitalId: doctor.hospitalId,
        isVerified: doctor.isVerified,
        name: doctor.name,
        licenseId: doctor.licenseId,
    });
});

app.get('/api/notifications/:userId', (req: Request, res: Response) => {
    const { userId } = req.params;
    const role = req.query['role'];

    let userNotifications = notifications.filter((n) => n.userId === userId);
    if (role === 'PATIENT' || role === 'DOCTOR') {
        userNotifications = userNotifications.filter((n) => n.userRole === role);
    }

    res.json({
        userId,
        count: userNotifications.length,
        notifications: userNotifications,
    });
});

app.put('/api/notifications/:notificationId/read', (req: Request, res: Response) => {
    const { notificationId } = req.params;
    const notif = notifications.find((n) => n.notificationId === notificationId);

    if (!notif) {
        res.status(404).json({ error: 'Notification not found' });
        return;
    }

    notif.status = 'READ';
    res.json({ success: true, notification: notif });
});

app.post('/api/access-requests', (req: Request, res: Response) => {
    const { patientId, doctorId, reason } = req.body as {
        patientId?: string;
        doctorId?: string;
        reason?: string;
    };

    if (!patientId || !doctorId) {
        res.status(400).json({ error: 'patientId and doctorId required' });
        return;
    }

    const patient = patients.find((p) => p.patientId === patientId);
    if (!patient) {
        res.status(404).json({ error: 'Patient not found' });
        return;
    }

    const requestId = uuidv4();
    const request: AccessRequest = {
        requestId,
        patientId,
        doctorId,
        status: 'PENDING',
        requestedAt: new Date().toISOString(),
        reason,
    };

    accessRequests.push(request);

    createNotification(
        patientId,
        'PATIENT',
        'ACCESS_REQUEST',
        'Data Access Request',
        `Doctor ${doctorId} requested access to your emergency data.`,
        requestId
    );

    createNotification(
        doctorId,
        'DOCTOR',
        'SYSTEM',
        'Request Sent',
        `Access request sent to patient ${patientId}.`,
        requestId
    );

    res.status(201).json(request);
});

app.get('/api/access-requests/patient/:patientId', (req: Request, res: Response) => {
    const { patientId } = req.params;
    const requests = accessRequests.filter((r) => r.patientId === patientId);

    res.json({
        patientId,
        count: requests.length,
        requests,
    });
});

app.get('/api/access-requests/doctor/:doctorId', (req: Request, res: Response) => {
    const { doctorId } = req.params;
    const requests = accessRequests.filter((r) => r.doctorId === doctorId);

    res.json({
        doctorId,
        count: requests.length,
        requests,
    });
});

app.put('/api/access-requests/:requestId/approve', (req: Request, res: Response) => {
    const requestId = String(req.params['requestId']);
    const request = accessRequests.find((r) => r.requestId === requestId);

    if (!request) {
        res.status(404).json({ error: 'Access request not found' });
        return;
    }

    if (request.status !== 'PENDING') {
        res.status(400).json({ error: `Cannot approve request with status: ${request.status}` });
        return;
    }

    request.status = 'APPROVED';
    request.respondedAt = new Date().toISOString();

    createNotification(
        request.patientId,
        'PATIENT',
        'SYSTEM',
        'Access Approved',
        `You approved data access for doctor ${request.doctorId}.`,
        requestId
    );

    createNotification(
        request.doctorId,
        'DOCTOR',
        'SYSTEM',
        'Access Approved',
        `Patient ${request.patientId} approved your access request.`,
        requestId
    );

    res.json({ success: true, request });
});

app.put('/api/access-requests/:requestId/reject', (req: Request, res: Response) => {
    const requestId = String(req.params['requestId']);
    const request = accessRequests.find((r) => r.requestId === requestId);

    if (!request) {
        res.status(404).json({ error: 'Access request not found' });
        return;
    }

    if (request.status !== 'PENDING') {
        res.status(400).json({ error: `Cannot reject request with status: ${request.status}` });
        return;
    }

    request.status = 'REJECTED';
    request.respondedAt = new Date().toISOString();

    createNotification(
        request.patientId,
        'PATIENT',
        'SYSTEM',
        'Access Denied',
        `You denied data access for doctor ${request.doctorId}.`,
        requestId
    );

    createNotification(
        request.doctorId,
        'DOCTOR',
        'SYSTEM',
        'Access Denied',
        `Patient ${request.patientId} denied your access request.`,
        requestId
    );

    res.json({ success: true, request });
});

app.get('/api/patients', (_req: Request, res: Response) => {
    res.json(
        patients.map((patient) => ({
            patientId: patient.patientId,
            name: patient.name,
            bloodType: patient.bloodType,
            conditionCount: patient.conditions.length,
            medicationCount: patient.medications.length,
            allergyCount: patient.allergies.length,
        }))
    );
});

app.get('/api/patients/:patientId', (req: Request, res: Response) => {
    const patientId = String(req.params['patientId']);
    const patient = patients.find((p) => p.patientId === patientId);

    if (!patient) {
        res.status(404).json({ error: 'Patient not found' });
        return;
    }

    const networkContext = findNetworkEnrollment(patientId);
    const consentLevel = networkContext?.enrollment.consentLevel ?? 'FULL';
    const snapshot = buildPatientSnapshot(patient, consentLevel);

    res.json({ ...snapshot, documents: patient.documents });
});

// Redesigned QR: QR contains only one access identifier.
app.post('/api/qr/generate', (req: Request, res: Response) => {
    const { patientId } = req.body as { patientId?: string };

    if (!patientId) {
        res.status(400).json({ error: 'patientId is required' });
        return;
    }

    const patient = patients.find((p) => p.patientId === patientId);
    if (!patient) {
        res.status(404).json({ error: 'Patient not found' });
        return;
    }

    const qrSession = createAccessSession(patientId);
    const qrTokenId = qrSession.qrTokenId;
    const expiresAt = qrSession.expiresAt;

    const networkContext = findNetworkEnrollment(patientId);
    const consentLevel = networkContext?.enrollment.consentLevel ?? 'FULL';

    res.json({
        patientId,
        patientAccessId: qrTokenId,
        expiresAt,
        qrPayload: { patientAccessId: qrTokenId },
        preview: {
            ...buildPatientSnapshot(patient, consentLevel),
            qrTokenId,
            expiryTime: expiresAt,
        },
    });
});

// Doctor scans QR, backend verifies doctor and hospital policy before returning data.
app.post('/api/qr/decode', (req: Request, res: Response) => {
    const { patientAccessId, patientId, qrTokenId, doctorId, hospitalId } = req.body as {
        patientAccessId?: string;
        patientId?: string;
        qrTokenId?: string;
        doctorId?: string;
        hospitalId?: string;
    };

    if (!doctorId || !hospitalId) {
        res.status(400).json({ error: 'doctorId and hospitalId are required' });
        return;
    }

    const resolvedTokenId = patientAccessId || qrTokenId;
    if (!resolvedTokenId) {
        res.status(400).json({ error: 'patientAccessId is required' });
        return;
    }

    const decoded = decodePatientAccessToken(resolvedTokenId, doctorId, hospitalId, patientId);
    res.status(decoded.status).json(decoded.body);
});

app.get('/api/qr/sessions/:patientId', (req: Request, res: Response) => {
    const patientId = String(req.params['patientId']);
    const now = Date.now();

    const sessions = qrSessions
        .filter((session) => session.patientId === patientId)
        .map((session) => {
            if (session.status === 'ACTIVE' && session.expiresAt < now) {
                session.status = 'REVOKED';
            }
            return {
                patientAccessId: session.qrTokenId,
                status: session.status,
                createdAt: session.createdAt,
                expiresAt: session.expiresAt,
                msRemaining: Math.max(0, session.expiresAt - now),
            };
        })
        .sort((a, b) => b.createdAt - a.createdAt);

    res.json({
        patientId,
        activeCount: sessions.filter((session) => session.status === 'ACTIVE').length,
        sessions,
    });
});

app.put('/api/qr/revoke', (req: Request, res: Response) => {
    const { patientAccessId } = req.body as { patientAccessId?: string };

    if (!patientAccessId) {
        res.status(400).json({ error: 'patientAccessId is required' });
        return;
    }

    const session = qrSessions.find((item) => item.qrTokenId === patientAccessId);
    if (!session) {
        res.status(404).json({ error: 'QR session not found' });
        return;
    }

    session.status = 'REVOKED';

    nfcSessions
        .filter((item) => item.patientAccessId === patientAccessId)
        .forEach((item) => {
            item.status = 'REVOKED';
        });

    res.json({ success: true, patientAccessId, status: session.status });
});

app.post('/api/nfc/generate', (req: Request, res: Response) => {
    const { patientId } = req.body as { patientId?: string };

    if (!patientId) {
        res.status(400).json({ error: 'patientId is required' });
        return;
    }

    const patient = patients.find((item) => item.patientId === patientId);
    if (!patient) {
        res.status(404).json({ error: 'Patient not found' });
        return;
    }

    const accessSession = createAccessSession(patientId, 8 * 60 * 60 * 1000);
    const nfcSession: NFCSession = {
        nfcTokenId: uuidv4(),
        patientId,
        patientAccessId: accessSession.qrTokenId,
        fallbackCode: generateFallbackCode(),
        createdAt: Date.now(),
        expiresAt: accessSession.expiresAt,
        status: 'ACTIVE',
    };

    nfcSessions.push(nfcSession);

    const nfcPayload = {
        nfcTokenId: nfcSession.nfcTokenId,
        patientAccessId: nfcSession.patientAccessId,
        fallbackCode: nfcSession.fallbackCode,
    };

    res.json({
        success: true,
        patientId,
        nfcTokenId: nfcSession.nfcTokenId,
        patientAccessId: nfcSession.patientAccessId,
        fallbackCode: nfcSession.fallbackCode,
        expiresAt: nfcSession.expiresAt,
        nfcPayload,
        nfcPayloadText: JSON.stringify(nfcPayload),
        message: 'Write nfcPayloadText into an NFC NDEF text record for locked-device emergency access.',
    });
});

app.post('/api/nfc/decode', (req: Request, res: Response) => {
    const { nfcTokenId, patientAccessId, fallbackCode, doctorId, hospitalId, patientId } = req.body as {
        nfcTokenId?: string;
        patientAccessId?: string;
        fallbackCode?: string;
        doctorId?: string;
        hospitalId?: string;
        patientId?: string;
    };

    if (!doctorId || !hospitalId) {
        res.status(400).json({ error: 'doctorId and hospitalId are required' });
        return;
    }

    if (!nfcTokenId && !patientAccessId) {
        res.status(400).json({ error: 'nfcTokenId or patientAccessId is required' });
        return;
    }

    let resolvedPatientAccessId = patientAccessId;

    if (nfcTokenId) {
        const nfcSession = nfcSessions.find((item) => item.nfcTokenId === nfcTokenId && item.status === 'ACTIVE');
        if (!nfcSession) {
            res.status(404).json({ error: 'NFC session not found or revoked' });
            return;
        }

        if (nfcSession.expiresAt < Date.now()) {
            nfcSession.status = 'REVOKED';
            res.status(410).json({ error: 'NFC pass expired. Patient must generate a new pass.' });
            return;
        }

        if (fallbackCode && fallbackCode !== nfcSession.fallbackCode) {
            res.status(403).json({ error: 'Invalid NFC fallback code' });
            return;
        }

        resolvedPatientAccessId = nfcSession.patientAccessId;
    }

    if (!resolvedPatientAccessId) {
        res.status(400).json({ error: 'Unable to resolve patientAccessId from NFC payload' });
        return;
    }

    const decoded = decodePatientAccessToken(resolvedPatientAccessId, doctorId, hospitalId, patientId);
    res.status(decoded.status).json({ ...decoded.body, accessMode: 'NFC' });
});

app.post('/api/patients/:patientId/upload-records', upload.single('record'), async (req: Request, res: Response) => {
    const patientId = String(req.params['patientId']);
    const patient = patients.find((p) => p.patientId === patientId);

    if (!patient) {
        res.status(404).json({ error: 'Patient not found' });
        return;
    }

    if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
    }

    try {
        const pdfBuffer = fs.readFileSync(req.file.path);
        const pdfParser = new PDFParse({ data: pdfBuffer });
        const pdfData = await pdfParser.getText();
        await pdfParser.destroy();
        const textContent = String(pdfData.text || '');

        const document: UploadedDocument = {
            id: uuidv4(),
            name: req.file.originalname || 'medical-record.pdf',
            url: `/uploads/${req.file.filename}`,
            uploadedAt: new Date().toISOString(),
        };

        patient.documents.push(document);

        const vectorIndex = await indexPdfToVectorDb(patientId, document.name, document.id, textContent);

        createNotification(
            patientId,
            'PATIENT',
            'SYSTEM',
            'Records Uploaded',
            `Your medical record "${document.name}" was uploaded successfully.`
        );

        res.json({
            success: true,
            fileName: document.name,
            document,
            vectorIndex,
            textLength: textContent.length,
            message: vectorIndex.indexed
                ? `Record uploaded and indexed into ${vectorIndex.collection}.`
                : hasUsableGeminiKey()
                    ? `Record uploaded, but vector indexing failed: ${vectorIndex.error || 'unknown vector indexing issue'}`
                    : 'Record uploaded. Set GEMINI_API_KEY to enable embeddings and vector indexing.',
        });
    } catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({
            error: 'Failed to process PDF',
            details: (error as Error).message,
        });
    }
});

app.post('/api/patients/:patientId/ai-summary', async (req: Request, res: Response) => {
    const patientId = String(req.params['patientId']);
    const patient = patients.find((item) => item.patientId === patientId);

    if (!patient) {
        res.status(404).json({ error: 'Patient not found' });
        return;
    }

    const question = String(
        (req.body as { question?: string })?.question ||
        'Provide concise emergency clinical insights and immediate care priorities for this patient.'
    );

    const networkContext = findNetworkEnrollment(patientId);
    const consentLevel = networkContext?.enrollment.consentLevel ?? 'FULL';
    const snapshot = buildPatientSnapshot(patient, consentLevel);

    const ragSources: Array<{
        score: number | null;
        fileName: string;
        snippet: string;
    }> = [];

    let ragError: string | null = null;
    let summary = '';

    try {
        const queryVector = await embedText(question.substring(0, 2000));
        await ensureVectorCollection(queryVector.length);

        const searchResults = await qdrant.search(MEDICAL_VECTOR_COLLECTION, {
            vector: queryVector,
            limit: 6,
            with_payload: true,
            filter: {
                must: [{ key: 'patientId', match: { value: patientId } }],
            },
        });

        const contexts: string[] = [];
        for (const item of searchResults) {
            const payload = (item.payload || {}) as Record<string, unknown>;
            const textChunk = String(payload['textChunk'] || '').trim();
            if (!textChunk) {
                continue;
            }

            contexts.push(textChunk);
            ragSources.push({
                score: typeof item.score === 'number' ? item.score : null,
                fileName: String(payload['fileName'] || 'Uploaded Document'),
                snippet: textChunk.substring(0, 240),
            });
        }

        if (contexts.length > 0) {
            if (hasUsableGeminiKey()) {
                const model = genAI.getGenerativeModel({ model: SUMMARY_MODEL });
                const prompt = [
                    'You are an emergency clinical assistant. Use only the provided context and patient snapshot.',
                    'Return concise bullet points for immediate care, risk flags, medication/allergy concerns, and follow-up checks.',
                    'If uncertain, say so explicitly.',
                    `Question: ${question}`,
                    `Patient Snapshot: ${JSON.stringify({
                        patientId: snapshot.patientId,
                        name: snapshot.name,
                        riskLevel: snapshot.riskAssessment.riskLevel,
                        riskScore: snapshot.riskAssessment.riskScore,
                        bloodType: snapshot.bloodType,
                        allergies: snapshot.allergies,
                        medications: snapshot.medications,
                        conditions: snapshot.conditions,
                        consentLevel: snapshot.consentLevel,
                    })}`,
                    `Retrieved Context:\n${contexts.join('\n\n---\n\n')}`,
                ].join('\n\n');

                const summaryResponse = await model.generateContent(prompt);
                summary = summaryResponse.response.text().trim();
            } else {
                const topContext = contexts.slice(0, 3).join(' ');
                summary = [
                    `RAG evidence found for patient ${snapshot.patientId}.`,
                    `Immediate concern baseline: ${snapshot.riskAssessment.riskLevel} risk (${snapshot.riskAssessment.riskScore.toFixed(1)}/10).`,
                    `Top extracted context: ${topContext.substring(0, 700)}`,
                    'Note: LLM synthesis disabled because GEMINI_API_KEY is not configured; using retrieval-only insight mode.',
                ].join('\n');
            }
        }
    } catch (error) {
        ragError = (error as Error).message;
    }

    if (!summary) {
        summary = [
            `Patient ${snapshot.name} (${snapshot.patientId}) has ${snapshot.riskAssessment.riskLevel} risk (${snapshot.riskAssessment.riskScore.toFixed(1)}/10).`,
            `Conditions: ${patient.conditions.join(', ') || 'None listed'}.`,
            `Medications: ${patient.medications.map((item) => `${item.name} ${item.dosage}`).join(', ') || 'None listed'}.`,
            `Allergies: ${patient.allergies.join(', ') || 'None listed'}.`,
            `Clinical Summary: ${buildMedicalSummary(patient)}`,
            hasUsableGeminiKey()
                ? 'No indexed vector context was found; this response is based on the current structured profile only.'
                : 'GEMINI_API_KEY missing or invalid; vector-backed RAG summary unavailable.',
        ].join('\n');
    }

    const insights = summary
        .split(/\n+/)
        .map((line) => line.replace(/^[\-\*•\d\.)\s]+/, '').trim())
        .filter((line) => line.length > 0)
        .slice(0, 8);

    res.json({
        success: true,
        patientId,
        question,
        summary,
        insights,
        sources: ragSources,
        rag: {
            used: ragSources.length > 0,
            sourceCount: ragSources.length,
            collection: MEDICAL_VECTOR_COLLECTION,
            error: ragError,
        },
        snapshot: {
            riskLevel: snapshot.riskAssessment.riskLevel,
            riskScore: snapshot.riskAssessment.riskScore,
            consentLevel: snapshot.consentLevel,
        },
    });
});

app.get('/api/networks/my-enrollment/:patientId', (req: Request, res: Response) => {
    const patientId = String(req.params['patientId']);
    const context = findNetworkEnrollment(patientId);

    if (!context) {
        res.json({ enrolled: false, enrollment: null, accessHistory: [] });
        return;
    }

    const enrollment = context.enrollment;
    const hospitals = context.network.hospitals.map((hospital) => ({
        ...hospital,
        isSharingAllowed: enrollment.dataSharedWith.includes(hospital.hospitalId),
    }));

    res.json({
        enrolled: true,
        enrollment: {
            networkId: context.network.networkId,
            networkName: context.network.name,
            consentLevel: enrollment.consentLevel,
            sharedDataTypes: ['MEDICATIONS', 'ALLERGIES', 'CONDITIONS', 'VITAL_SIGNS'],
            hospitalCount: hospitals.length,
            hospitals,
        },
        accessHistory: accessLogs.filter((log) => log.patientId === patientId),
    });
});

app.put('/api/networks/update-consent', (req: Request, res: Response) => {
    const { patientId, consentLevel } = req.body as {
        patientId?: string;
        consentLevel?: ConsentLevel;
    };

    if (!patientId || !consentLevel) {
        res.status(400).json({ error: 'patientId and consentLevel are required' });
        return;
    }

    if (!['FULL', 'ANONYMIZED', 'EMERGENCY_ONLY'].includes(consentLevel)) {
        res.status(400).json({ error: 'Invalid consent level' });
        return;
    }

    const context = findNetworkEnrollment(patientId);
    if (!context) {
        res.status(404).json({ error: 'Network enrollment not found' });
        return;
    }

    context.enrollment.consentLevel = consentLevel;

    createNotification(
        patientId,
        'PATIENT',
        'SYSTEM',
        'Consent Updated',
        `Your sharing consent was updated to ${consentLevel}.`
    );

    res.json({ success: true, consentLevel });
});

// Opt in/out for a specific hospital.
app.put('/api/networks/hospital-sharing', (req: Request, res: Response) => {
    const { patientId, hospitalId, allowSharing } = req.body as {
        patientId?: string;
        hospitalId?: string;
        allowSharing?: boolean;
    };

    if (!patientId || !hospitalId || typeof allowSharing !== 'boolean') {
        res.status(400).json({ error: 'patientId, hospitalId, allowSharing are required' });
        return;
    }

    const context = findNetworkEnrollment(patientId);
    if (!context) {
        res.status(404).json({ error: 'Network enrollment not found' });
        return;
    }

    const hospitalExists = context.network.hospitals.some((h) => h.hospitalId === hospitalId);
    if (!hospitalExists) {
        res.status(404).json({ error: 'Hospital not found in patient network' });
        return;
    }

    const existing = context.enrollment.dataSharedWith.includes(hospitalId);
    if (allowSharing && !existing) {
        context.enrollment.dataSharedWith.push(hospitalId);
    }
    if (!allowSharing && existing) {
        context.enrollment.dataSharedWith = context.enrollment.dataSharedWith.filter((id) => id !== hospitalId);
    }

    createNotification(
        patientId,
        'PATIENT',
        'SYSTEM',
        allowSharing ? 'Hospital Sharing Enabled' : 'Hospital Sharing Disabled',
        `${allowSharing ? 'Enabled' : 'Disabled'} data sharing with hospital ${hospitalId}.`
    );

    res.json({
        success: true,
        patientId,
        hospitalId,
        allowSharing,
        dataSharedWith: context.enrollment.dataSharedWith,
    });
});

app.post('/api/networks/leave', (req: Request, res: Response) => {
    const { patientId } = req.body as { patientId?: string };
    if (!patientId) {
        res.status(400).json({ error: 'patientId required' });
        return;
    }

    const context = findNetworkEnrollment(patientId);
    if (!context) {
        res.status(404).json({ error: 'Network enrollment not found' });
        return;
    }

    context.network.patients = context.network.patients.filter((p) => p.patientId !== patientId);
    res.json({ success: true });
});

app.post('/api/access-logs/sync-offline', (req: Request, res: Response) => {
    const { qrTokenId, patientId, doctorId, hospitalId } = req.body as {
        qrTokenId?: string;
        patientId?: string;
        doctorId?: string;
        hospitalId?: string;
    };

    if (!patientId || !doctorId || !hospitalId) {
        res.status(400).json({ error: 'patientId, doctorId, hospitalId required' });
        return;
    }

    const logId = uuidv4();
    accessLogs.push({
        logId,
        patientId,
        doctorId,
        hospitalId,
        qrTokenId: qrTokenId || 'legacy-offline-token',
        scanTimestamp: Date.now(),
        syncedAt: new Date().toISOString(),
    });

    createNotification(
        patientId,
        'PATIENT',
        'ACCESS_LOG',
        'Your Data Was Accessed',
        `Doctor ${doctorId} from ${hospitalId} accessed your emergency profile.`
    );

    res.json({
        logId,
        patientId,
        doctorId,
        hospitalId,
        timestamp: new Date().toISOString(),
        synced: true,
    });
});

const PORT = process.env['PORT'] || 5000;

app.listen(PORT, () => {
    console.log(`EHIS Backend running on port ${PORT}`);
    console.log(`Available patients: ${patients.map((p) => p.patientId).join(', ')}`);
    console.log('');
    console.log('Routes:');
    console.log('  GET  /api/health');
    console.log('  GET  /api/patients');
    console.log('  GET  /api/doctors/:doctorId/verification');
    console.log('  GET  /api/notifications/:userId');
    console.log('  POST /api/qr/generate');
    console.log('  POST /api/qr/decode');
    console.log('  GET  /api/qr/sessions/:patientId');
    console.log('  PUT  /api/qr/revoke');
    console.log('  POST /api/nfc/generate');
    console.log('  POST /api/nfc/decode');
    console.log('  POST /api/patients/:patientId/ai-summary');
    console.log('  PUT  /api/networks/hospital-sharing');
    console.log('  GET  /api/networks/my-enrollment/:patientId');
});
