# EHIS HIPAA Compliance Roadmap

**Status**: ⚠️ Pre-HIPAA — Compliance roadmap in progress  
**Last Updated**: April 2026  
**Team**: Code Monkeys

---

## 1. Encryption

| Requirement | Status | Implementation |
|---|---|---|
| Encryption at rest | ✅ Done | Patient data encrypted with NaCl box (TweetNaCl.js) before QR embedding |
| Encryption in transit | ✅ Done | HTTPS enforced on all API endpoints |
| Key management | ⚠️ Partial | Per-patient keypairs generated; rotation policy needed |
| Key rotation | ❌ TODO | Implement 90-day key rotation with re-encryption pipeline |

## 2. Access Control

| Requirement | Status | Implementation |
|---|---|---|
| Role-based access control (RBAC) | ✅ Done | JWT tokens with role claims (PATIENT, DOCTOR, ADMIN, RESEARCH_PARTNER) |
| Minimum necessary access | ✅ Done | Consent levels (FULL, ANONYMIZED, EMERGENCY_ONLY) control data visibility |
| User authentication | ✅ Done | JWT-based auth with bcrypt password hashing |
| Session management | ⚠️ Partial | Token expiry set; refresh token flow needed |
| Multi-factor auth (MFA) | ❌ TODO | Plan: TOTP-based MFA for doctor accounts |

## 3. Audit Logging

| Requirement | Status | Implementation |
|---|---|---|
| Access logs | ✅ Done | Every QR scan logged with doctor ID, hospital ID, timestamp |
| Offline audit trail | ✅ Done | SQLite stores scanned records; syncs to backend when online |
| Tamper-proof logs | ❌ TODO | Plan: Write-once log storage with hash chaining |
| Log retention | ⚠️ Partial | Logs retained indefinitely; 7-year retention policy needed |

## 4. Data Privacy

| Requirement | Status | Implementation |
|---|---|---|
| Patient consent management | ✅ Done | Fine-grained consent (FULL/ANONYMIZED/EMERGENCY_ONLY) per network |
| Data minimization | ✅ Done | QR contains only emergency-relevant data, not full EHR |
| Right to access | ⚠️ Partial | Patients can view their data; export endpoint needed |
| Right to delete | ❌ TODO | Plan: Patient-initiated data deletion with cascade |
| De-identification | ✅ Done | Research data uses anonymized patient IDs |

## 5. Administrative Safeguards

| Requirement | Status | Notes |
|---|---|---|
| Security officer designation | ❌ TODO | Required for covered entities |
| Risk analysis (annual) | ❌ TODO | Formal risk assessment document needed |
| Employee training | ❌ TODO | HIPAA training program for all team members |
| Incident response plan | ❌ TODO | Breach notification within 60 days of discovery |
| Business Associate Agreements | ❌ TODO | Required: Cloudinary BAA, Google Gemini BAA, MongoDB Atlas BAA |

## 6. Technical Safeguards

| Requirement | Status | Implementation |
|---|---|---|
| Unique user identification | ✅ Done | UUID-based patient/doctor IDs |
| Automatic logoff | ⚠️ Partial | JWT expiry; app-level timeout needed |
| Emergency access procedure | ✅ Done | EMERGENCY_ONLY consent level bypasses normal access rules |
| Integrity controls | ⚠️ Partial | NaCl encryption detects tampering; checksum verification needed |

## 7. Required BAAs (Business Associate Agreements)

1. **MongoDB Atlas** — Database hosting (patient PHI stored here)
2. **Cloudinary** — File storage (medical document uploads)
3. **Google Cloud / Gemini API** — AI processing (medical summarization)
4. **Qdrant** — Vector database (medical record embeddings)

## Next Steps

1. [ ] Engage HIPAA compliance consultant for formal gap analysis
2. [ ] Sign BAAs with all cloud service providers
3. [ ] Implement key rotation pipeline
4. [ ] Add MFA for doctor accounts
5. [ ] Create formal incident response procedure
6. [ ] Schedule first annual risk assessment
7. [ ] Develop employee HIPAA training materials
