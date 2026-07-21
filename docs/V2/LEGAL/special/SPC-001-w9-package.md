# SPC-001 — W-9 Package

## Document metadata (Template Engine)

| # | Field | Value |
|---|-------|-------|
| 1 | **Official name** | Miami DJ Beat LLC — W-9 Collection & Certification Package |
| 2 | **Internal code** | SPC-001 |
| 3 | **Objective** | Collect IRS Form W-9 from US payees before reportable payouts |
| 4 | **Parties** | Miami DJ Beat LLC · Payee (Performer or Vendor) |
| 5 | **Structure** | Instructions · IRS W-9 reference · MDJB certification · Security notice · Staff review · Signatures |
| 6 | **Index** | §1–8 |
| 7 | **Mandatory sections** | Instructions · Payee certification · TIN collection · Privacy/security |
| 8 | **Special clauses** | **Does not reproduce IRS form** — links to official IRS PDF; MDJB wrapper only |
| 9 | **Dynamic fields** | `{payee_legal_name}` `{business_name}` `{tax_classification}` `{address}` `{tin_type}` `{tin_value}` `{certification_date}` |
| 10 | **Signature requirements** | Payee certification signature under penalties of perjury (IRS language); staff approval separate |
| 11 | **Legal dependencies** | LGL-002; LGL-004 §8; CTR-001, CTR-003 |
| 12 | **Template Engine** | `template_id=SPC-001` · `classification=FISCAL_CRITICAL` · `gate=payout` |

**Document No:** MDJB-SPC-001-v1.0-DRAFT  

---

## FULL TEXT — DRAFT

**W-9 COLLECTION PACKAGE**

**Miami DJ Beat LLC — Payee Tax Information**

> **Note:** This package accompanies the official **IRS Form W-9 (Rev. October 2023 or current)**. MDJB does not alter IRS form text. Download official form: https://www.irs.gov/forms-pubs/about-form-w-9

### 1. Purpose

Federal law requires Miami DJ Beat LLC to obtain correct Taxpayer Identification Number (TIN) before paying reportable income. Payouts may be blocked until W-9 is **APPROVED**.

### 2. Payee Instructions

Complete all IRS W-9 fields accurately using **legal name** (not stage name unless sole proprietorship DBA). Submit through secure Platform portal only — never email TIN in plain text.

### 3. MDJB Certification Addendum

I, **{payee_legal_name}**, certify under penalties of perjury that:

(a) The TIN provided is correct;  
(b) I am not subject to backup withholding (or I am and IRS has notified);  
(c) I am a US person as defined by IRS;  
(d) Information is accurate for 1099 reporting.

### 4. Tax Classification (select one)

☐ Individual/Sole proprietor · ☐ C Corp · ☐ S Corp · ☐ Partnership · ☐ LLC · ☐ Other ___

### 5. Dynamic Fields (secure capture)

| Field | Value |
|-------|-------|
| Legal name (Line 1) | {payee_legal_name} |
| Business name (Line 2) | {business_name} |
| Address | {address} |
| TIN type | SSN / EIN |
| TIN | {encrypted — never logged} |

### 6. Security

TIN stored encrypted. Staff access masked except authorized tax role. See LGL-002 and LEGAL README § W-9 controls.

### 7. Staff Review

Status: ☐ APPROVED ☐ REJECTED — Reason: ___________

Reviewer: _________________ Date: _________

### 8. Payee Signature

Signature: _________________________ Date: {certification_date}

**Under penalties of perjury, I certify the information on this form is correct.**
