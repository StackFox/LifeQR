import express from 'express';
import type { Request, Response } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import type { Router as ExpressRouter } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { QdrantClient } from '@qdrant/js-client-rest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const upload = multer({ dest: 'uploads/' });
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "AIzaSy_fake-gemini-key");
const qdrant = new QdrantClient({ url: 'http://localhost:6333' });

// Middleware
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ─── MOCK DATA ──────────────────────────────────────────────

const patients = [
    {
        patientId: 'P-12345',
        name: 'Jane Doe',
        dateOfBirth: '1985-04-12',
        bloodType: 'O-',
        conditions: ['Hypertension'],
        medications: [{ name: 'Lisinopril', dosage: '10mg', frequency: 'Daily' }],
        allergies: ['Penicillin', 'Peanuts'],
    },
    {
        patientId: 'P-67890',
        name: 'Robert Chen',
        dateOfBirth: '1957-11-03',
        bloodType: 'A+',
        conditions: ['Type 2 Diabetes', 'Atrial Fibrillation', 'Hypertension'],
        medications: [
            { name: 'Warfarin', dosage: '5mg', frequency: 'Daily' },
            { name: 'Metformin', dosage: '1000mg', frequency: 'Twice daily' },
        ],
        allergies: ['Penicillin', 'Sulfa drugs'],
    },
];

// In-memory storage for notifications
const notifications: Array<{
    notificationId: string;
    userId: string;
    userRole: 'PATIENT' | 'DOCTOR';
    type: 'ACCESS_LOG' | 'ACCESS_REQUEST' | 'SYSTEM';
    title: string;
    message: string;
    status: 'UNREAD' | 'READ';
    createdAt: string;
    relatedRequestId?: string;
}> = [];

// In-memory storage for access requests
const accessRequests: Array<{
    requestId: string;
    patientId: string;
    doctorId: string;
    status: 'PENDING' | 'APPROVED' | 'REJECTED';
    requestedAt: string;
    respondedAt?: string;
}> = [];

// ─── HELPER FUNCTIONS ────────────────────────────────────────

// Build AI medical summary from patient data
function buildMedicalSummary(patient: any): string {
    const parts: string[] = [];
    if (patient.conditions && patient.conditions.length > 0) {
        parts.push(`Active conditions: ${patient.conditions.join(', ')}.`);
    }
    if (patient.medications && patient.medications.length > 0) {
        const medList = patient.medications
            .map((m: any) => `${m.name} ${m.dosage}`)
            .join(', ');
        parts.push(`Currently on ${patient.medications.length} medication(s): ${medList}.`);
    }
    if (patient.allergies && patient.allergies.length > 0) {
        parts.push(`Known allergies: ${patient.allergies.join(', ')}.`);
    }
    return parts.join(' ') || 'No significant medical history recorded.';
}

// ─── ROUTES ──────────────────────────────────────────────────

// Health check
app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', version: '2.0-clean' });
});

// Get notifications for a user with optional role filter
app.get('/api/notifications/:userId', (req: Request, res: Response) => {
    const { userId } = req.params;
    const { role } = req.query;

    let userNotifications = notifications.filter(n => n.userId === userId);

    if (role && (role === 'PATIENT' || role === 'DOCTOR')) {
        userNotifications = userNotifications.filter(n => n.userRole === role);
    }

    res.json({
        userId,
        count: userNotifications.length,
        notifications: userNotifications,
    });
});

// Create a notification (used by other routes)
function createNotification(
    userId: string,
    userRole: 'PATIENT' | 'DOCTOR',
    type: 'ACCESS_LOG' | 'ACCESS_REQUEST' | 'SYSTEM',
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

// Mark notification as read
app.put('/api/notifications/:notificationId/read', (req: Request, res: Response) => {
    const { notificationId } = req.params;
    const notif = notifications.find(n => n.notificationId === notificationId);

    if (!notif) {
        res.status(404).json({ error: 'Notification not found' });
        return;
    }

    notif.status = 'READ';
    res.json({ success: true, notification: notif });
});

// Create an access request (Doctor requests patient data)
app.post('/api/access-requests', (req: Request, res: Response) => {
    const { patientId, doctorId, reason } = req.body;

    if (!patientId || !doctorId) {
        res.status(400).json({ error: 'patientId and doctorId required' });
        return;
    }

    const requestId = uuidv4();
    const request = {
        requestId,
        patientId,
        doctorId,
        status: 'PENDING' as const,
        requestedAt: new Date().toISOString(),
    };

    accessRequests.push(request);

    // Notify patient of access request
    createNotification(
        patientId,
        'PATIENT',
        'ACCESS_REQUEST',
        '🔐 Data Access Request',
        `Doctor ${doctorId} is requesting access to your medical data.`,
        requestId
    );

    // Notify doctor that request was created
    createNotification(
        doctorId,
        'DOCTOR',
        'SYSTEM',
        '✓ Request Sent',
        `Access request sent to patient ${patientId}. Awaiting approval.`,
        requestId
    );

    res.status(201).json(request);
});

// Get access requests for a patient
app.get('/api/access-requests/patient/:patientId', (req: Request, res: Response) => {
    const { patientId } = req.params;
    const requests = accessRequests.filter(r => r.patientId === patientId);

    res.json({
        patientId,
        count: requests.length,
        requests,
    });
});

// Get access requests for a doctor
app.get('/api/access-requests/doctor/:doctorId', (req: Request, res: Response) => {
    const { doctorId } = req.params;
    const requests = accessRequests.filter(r => r.doctorId === doctorId);

    res.json({
        doctorId,
        count: requests.length,
        requests,
    });
});

// Approve an access request
app.put('/api/access-requests/:requestId/approve', (req: Request, res: Response) => {
    const requestId = String(req.params['requestId']);
    const request = accessRequests.find(r => r.requestId === requestId);

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

    // Notify patient
    createNotification(
        request.patientId,
        'PATIENT',
        'SYSTEM',
        '✓ Access Approved',
        `You approved data access for Doctor ${request.doctorId}.`,
        requestId
    );

    // Notify doctor
    createNotification(
        request.doctorId,
        'DOCTOR',
        'SYSTEM',
        '✓ Access Approved',
        `Patient ${request.patientId} approved your data access request.`,
        requestId
    );

    res.json({ success: true, request });
});

// Reject an access request
app.put('/api/access-requests/:requestId/reject', (req: Request, res: Response) => {
    const requestId = String(req.params['requestId']);
    const request = accessRequests.find(r => r.requestId === requestId);

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

    // Notify patient
    createNotification(
        request.patientId,
        'PATIENT',
        'SYSTEM',
        '✗ Access Denied',
        `You denied data access for Doctor ${request.doctorId}.`,
        requestId
    );

    // Notify doctor
    createNotification(
        request.doctorId,
        'DOCTOR',
        'SYSTEM',
        '✗ Access Denied',
        `Patient ${request.patientId} denied your data access request.`,
        requestId
    );

    res.json({ success: true, request });
});

// Get patient info
app.get('/api/patients/:patientId', (req: Request, res: Response) => {
    const patientId = String(req.params['patientId']);
    const patient = patients.find(p => p.patientId === patientId);

    if (!patient) {
        res.status(404).json({ error: 'Patient not found' });
        return;
    }

    res.json(patient);
});

// Generate QR with medical summary
app.post('/api/qr/generate', (req: Request, res: Response) => {
    const { patientId } = req.body;
    const patient = patients.find(p => p.patientId === patientId);

    if (!patient) {
        res.status(404).json({ error: 'Patient not found' });
        return;
    }

    const medicalSummary = buildMedicalSummary(patient);

    const qrPayload = {
        patientId: patient.patientId,
        qrTokenId: uuidv4(),
        name: patient.name,
        dateOfBirth: patient.dateOfBirth,
        bloodType: patient.bloodType,
        conditions: patient.conditions,
        medications: patient.medications,
        allergies: patient.allergies,
        medicalSummary,
        lastUpdated: Date.now(),
        expiryTime: Date.now() + (30 * 24 * 60 * 60 * 1000),
    };

    res.json(qrPayload);
});

// Upload medical records (PDF to Qdrant)
app.post(
    '/api/patients/:patientId/upload-records',
    upload.single('record'),
    async (req: Request, res: Response) => {
        const patientId = String(req.params['patientId']);
        const patient = patients.find(p => p.patientId === patientId);

        if (!patient) {
            res.status(404).json({ error: 'Patient not found' });
            return;
        }

        if (!req.file) {
            res.status(400).json({ error: 'No file uploaded' });
            return;
        }

        try {
            const pdfBuffer = require('fs').readFileSync(req.file.path);
            const pdfData = await pdfParse(pdfBuffer);
            const textContent = pdfData.text;

            // Get embedding from Gemini
            const model = genAI.getGenerativeModel({ model: 'embedding-001' });
            const result = await model.embedContent(textContent);
            const embedding = result.embedding.values;

            // Ensure Qdrant collection exists
            try {
                await qdrant.getCollection('medical_records');
            } catch {
                await qdrant.recreateCollection('medical_records', {
                    vectors: {
                        size: embedding.length,
                        distance: 'Cosine',
                    },
                });
            }

            // Upload vector to Qdrant
            await qdrant.upsert('medical_records', {
                points: [
                    {
                        id: uuidv4(),
                        vector: embedding,
                        payload: {
                            patientId,
                            fileName: req.file.originalname || 'document',
                            uploadedAt: new Date().toISOString(),
                        },
                    },
                ],
            });

            // Create notification
            createNotification(
                patientId,
                'PATIENT',
                'SYSTEM',
                '📄 Records Uploaded',
                `Your medical records "${req.file.originalname}" have been securely uploaded and indexed.`,
                undefined
            );

            res.json({
                success: true,
                fileName: req.file.originalname,
                embeddingDimension: embedding.length,
                message: 'Record uploaded and indexed successfully',
            });
        } catch (error) {
            console.error('Upload error:', error);
            res.status(500).json({
                error: 'Failed to process PDF',
                details: (error as Error).message,
            });
        }
    }
);

// Sync access log and create notification
app.post('/api/access-logs/sync-offline', (req: Request, res: Response) => {
    const { patientId, doctorId, hospitalId } = req.body;

    if (!patientId || !doctorId || !hospitalId) {
        res.status(400).json({ error: 'patientId, doctorId, hospitalId required' });
        return;
    }

    // Create notification for patient
    createNotification(
        patientId,
        'PATIENT',
        'ACCESS_LOG',
        '👁️ Your Data Was Accessed',
        `Doctor ${doctorId} from ${hospitalId} accessed your emergency QR data at ${new Date().toLocaleTimeString()}.`,
        undefined
    );

    res.json({
        logId: uuidv4(),
        patientId,
        doctorId,
        hospitalId,
        timestamp: new Date().toISOString(),
        synced: true,
    });
});

// ─── SERVER ──────────────────────────────────────────────────

const PORT = process.env['PORT'] || 5001;

app.listen(PORT, () => {
    console.log(`✅ EHIS Backend (Clean) running on port ${PORT}`);
    console.log(`Available patients: ${patients.map(p => p.patientId).join(', ')}`);
    console.log('');
    console.log('📋 Notification Routes:');
    console.log('  GET  /api/notifications/:userId');
    console.log('  PUT  /api/notifications/:notificationId/read');
    console.log('');
    console.log('📋 Access Request Routes:');
    console.log('  POST /api/access-requests');
    console.log('  GET  /api/access-requests/patient/:patientId');
    console.log('  GET  /api/access-requests/doctor/:doctorId');
    console.log('  PUT  /api/access-requests/:requestId/approve');
    console.log('  PUT  /api/access-requests/:requestId/reject');
    console.log('');
    console.log('📋 Utility Routes:');
    console.log('  GET  /api/health');
    console.log('  GET  /api/patients/:patientId');
    console.log('  POST /api/access-logs/sync-offline');
});
