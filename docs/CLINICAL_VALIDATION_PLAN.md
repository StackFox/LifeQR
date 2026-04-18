# EHIS Clinical Validation Study Plan

**Status**: Protocol Design Phase  
**Version**: 1.0  
**Target Completion**: Q3 2026

---

## Study Title

**Clinical Utility and Accuracy of the EHIS Risk Assessment Tool vs. Standard Triage Protocols in Emergency Department Settings**

## Primary Objective

Validate EHIS risk score (deterministic rule-based engine v2.1) against standard ESI (Emergency Severity Index) triage levels and clinical outcomes.

## Study Design

- **Type**: Retrospective cohort study
- **Duration**: 4-6 weeks of data collection per hospital
- **Sample Size**: 200-300 ED visits (power analysis: 80% power, α=0.05)
- **Control**: Standard ESI triage (existing hospital protocol)
- **Test**: EHIS risk assessment (applied retrospectively to same patients)

## Primary Outcomes

1. **Sensitivity/Specificity** of EHIS risk score vs. ESI level
2. **NPV/PPV** (Negative/Positive Predictive Values)
3. **Correlation** with ED Length of Stay

## Secondary Outcomes

1. EHIS HIGH ↔ ESI Level 2-3 concordance
2. Time-to-intervention for high-risk EHIS patients
3. Clinical decision impact — did factors surface new considerations?

## Inclusion Criteria

- Age ≥ 18 years
- Complete medical history in EHR
- Known outcomes (discharged/admitted/transferred)

## Exclusion Criteria

- Age < 18 years
- Incomplete medical records
- EMS direct-to-OR (missing triage data)

## Statistical Analysis

- Descriptive statistics (demographics, risk distribution)
- Sensitivity/specificity with 95% CI
- ROC curve analysis
- Spearman correlation (EHIS score ↔ ESI level)
- Logistic regression (EHIS factors → adverse outcome)

## Data Privacy

- All patient identifiers removed
- IRB exemption (retrospective, de-identified)
- No additional data collection from patients
- Results published in aggregate only

## Implementation

- Validation data API: `POST /api/research/submit-validation-data`
- Report generation: `GET /api/research/validation-report`
- Both endpoints require `RESEARCH_PARTNER` role

## Risk Engine Under Validation

Current EHIS risk engine v2.1 evaluates:

| Factor | Weight | Threshold |
|---|---|---|
| Advanced Age (≥65) | 2.1 | Age ≥ 65 |
| Polypharmacy | 1.8 | ≥ 5 medications |
| Anticoagulation | 2.2 | Any anticoagulant detected |
| Multiple Allergies | 1.5 | ≥ 3 allergies |
| Implanted Devices | 2.0 | Any implant |
| Multiple Comorbidities | 1.6 | ≥ 3 conditions |

## Timeline

| Phase | Duration | Activities |
|---|---|---|
| Protocol approval | 2 weeks | IRB submission, partner identification |
| Data collection | 4-6 weeks | Retrospective data from partner hospitals |
| Analysis | 2 weeks | Statistical analysis, ROC curves |
| Report | 1 week | Publication draft, GitHub release |

## Partner Hospitals (Target)

- 1-2 rural hospitals or urgent care clinics
- 10-20 willing patients per site
- 4-week pilot measuring ED wait time reduction
