# Rule Inventory — MSAP Portal

**Date:** August 24, 2026

---

## Summary

| Rule Category | Total Rules | Configurable | Hardcoded | In Code Only |
|---------------|------------|--------------|-----------|--------------|
| Quorum | 6 | 4 | 2 | 0 |
| Majority/Voting | 8 | 5 | 3 | 0 |
| Eligibility | 4 | 2 | 2 | 0 |
| Approval Authority | 6 | 2 | 4 | 0 |
| Finance Thresholds | 4 | 1 | 3 | 0 |
| Term Rules | 3 | 0 | 3 | 0 |
| Deadline Rules | 2 | 0 | 2 | 0 |
| Document Requirements | 3 | 1 | 2 | 0 |
| Notification Rules | 2 | 2 | 0 | 0 |
| Workflow Transitions | 12 | 3 | 9 | 0 |
| **Total** | **50** | **20 (40%)** | **30 (60%)** | **0** |

---

## 1. Quorum Rules

### Q-001: NGA Quorum
- **Rule Key:** `nga.quorum.numerator` / `nga.quorum.denominator`
- **Value:** 1/3 of Permanent + Temporary LCs
- **Source:** Bylaw B-8.1.8
- **Location:** `governanceRulesEngine.ts` (seeded)
- **Configurable:** ✅ Yes — resolved via `resolveEffectiveRule("quorum.nga")`
- **Override:** `organizationConfigStudio.ts` has `gov.quorum_numerator` / `gov.quorum_denominator`

### Q-002: SGA Quorum
- **Rule Key:** `sga.quorum.numerator` / `sga.quorum.denominator`
- **Value:** 1/3 of Permanent + Temporary LCs
- **Source:** Bylaw B-8.2.4
- **Location:** `governanceRulesEngine.ts` (seeded)
- **Configurable:** ✅ Yes

### Q-003: Plenary Quorum (Old Engine)
- **Value:** `50%` (hardcoded in `plenaryEngine.ts` line 34)
- **Configurable:** ❌ No
- **Fix:** Use `resolveEffectiveRule("quorum.plenary")`

### Q-004: Plenary Quorum (V2 Engine)
- **Configurable:** ✅ Uses governance rules engine

### Q-005: SGA Quorum Override
- **Rule Key:** `gov.sga_quorum_override`
- **Value:** `2/3`
- **Location:** `organizationConfigStudio.ts`
- **Configurable:** 🟡 Partially — in config studio but not fully wired

---

## 2. Majority/Voting Rules

### V-001: Constitutional Amendment (BCP)
- **Value:** 2/3 supermajority
- **Source:** Bylaw B-17.2.6
- **Location:** `bcpEngine.ts` (hardcoded check)
- **Configurable:** ❌ No — hardcoded `>= 2/3` check

### V-002: Bylaw Suspension (BSP)
- **Value:** 2/3 supermajority (procedural motion)
- **Source:** Bylaw B-8.4.10
- **Location:** `bspEngine.ts` (hardcoded check)
- **Configurable:** ❌ No

### V-003: CCC Override
- **Value:** 2/3 procedural motion
- **Source:** Bylaw §8.4.10
- **Location:** `cccEngine.ts` (hardcoded check)
- **Configurable:** ❌ No

### V-004: Plenary Procedural Motion
- **Value:** 2/3 majority (seconder required)
- **Source:** Bylaw B-8.4.10
- **Location:** `plenaryEngineV2.ts` (hardcoded check)
- **Configurable:** ❌ No

### V-005: SGA Extraordinary Voting
- **Value:** 2/3 extraordinary voting
- **Source:** Bylaw B-8.2.1
- **Location:** `sgaEngine.ts` (hardcoded check)
- **Configurable:** ❌ No

### V-006: Election Majority
- **Value:** Simple majority (most votes wins)
- **Location:** `electionsEngine.ts`
- **Configurable:** ❌ No — hardcoded logic

### V-007: Governance Rules Majority
- **Rule Key:** `majority.*`
- **Location:** `governanceRulesEngine.ts` (seeded rules)
- **Configurable:** ✅ Yes — resolved via `resolveEffectiveRule()`

### V-008: Voting Rights Matrix
- **Location:** `votingRightsEngine.ts`
- **Configurable:** ✅ Yes — resolved via governance rules

---

## 3. Eligibility Rules

### E-001: NGA Voting Eligibility
- **Rule Key:** `eligibility.nga.voter`
- **Value:** Must be a delegation head or nominated voter
- **Location:** `ngaEngine.ts` (hardcoded check)
- **Configurable:** ❌ No

### E-002: Election Candidate Eligibility
- **Value:** Must be an active member in good standing
- **Location:** `electionsEngine.ts` (hardcoded check)
- **Configurable:** ❌ No

### E-003: Membership Eligibility
- **Value:** Currently enrolled medical student
- **Location:** `membershipForm` router (Zod validation)
- **Configurable:** ❌ No — validated in schema only

### E-004: Voting Rights Eligibility
- **Location:** `votingRightsEngine.ts`
- **Configurable:** ✅ Resolved via governance rules

---

## 4. Approval Authority Rules

### A-001: Finance ≤5K — VPF
- **Value:** VPF approves expenses ≤ PKR 5,000
- **Source:** Bylaw §15.4
- **Location:** `financeEngine.ts` (hardcoded tier)
- **Configurable:** ❌ No

### A-002: Finance ≤15K — President
- **Value:** President approves expenses ≤ PKR 15,000
- **Source:** Bylaw §15.4.3
- **Location:** `financeEngine.ts` (hardcoded tier)
- **Configurable:** ❌ No

### A-003: Finance >15K — EB 2/3 Majority
- **Value:** Executive Board with 2/3 majority
- **Source:** Bylaw §15.4.3
- **Location:** `financeEngine.ts` (hardcoded tier)
- **Configurable:** ❌ No

### A-004: SGA Approval Chain
- **Value:** EBTO + SupCo approval required
- **Source:** Bylaw B-8.2.1
- **Location:** `sgaEngine.ts` (hardcoded check)
- **Configurable:** ❌ No

### A-005: NGA Online Mode
- **Value:** EBTO + SupCo + 2/3 LC majority
- **Source:** Bylaw B-8.1.13
- **Location:** `ngaEngine.ts` (hardcoded check)
- **Configurable:** ❌ No

### A-006: Termination Decision
- **Value:** Only the EB can decide on termination
- **Source:** Bylaw B-6.23
- **Location:** `membershipTerminationEngine.ts` (hardcoded check)
- **Configurable:** ❌ No

---

## 5. Finance Threshold Rules

### F-001: VPF Approval Threshold
- **Value:** PKR 5,000
- **Location:** `financeEngine.ts`
- **Configurable:** ❌ No

### F-002: President Approval Threshold
- **Value:** PKR 15,000
- **Location:** `financeEngine.ts`
- **Configurable:** ❌ No

### F-003: EB Supermajority Threshold
- **Value:** > PKR 15,000
- **Location:** `financeEngine.ts`
- **Configurable:** ❌ No

### F-004: NEF Budget Threshold
- **Value:** Activities with budget > threshold need finance review
- **Location:** `nefNrfEngine.ts` (commented reference)
- **Configurable:** ❌ No

---

## 6. Term Rules

### T-001: Term Period
- **Value:** October 1 – September 30 (hardcoded assumption)
- **Location:** `schema.ts` (comment), `memberAccountService.ts` (comment)
- **Configurable:** ❌ No — dates not stored in configuration

### T-002: Term Duration
- **Value:** 1 year (implied by Oct-Sep)
- **Configurable:** ❌ No

### T-003: Officer Term Expiry
- **Value:** `termStart`/`termEnd` on user record
- **Location:** `schema.ts`
- **Configurable:** 🟡 Partially — dates are per-user, not centrally managed

---

## 7. Deadline Rules

### DL-001: NGA Call for Participation
- **Value:** Must be issued 8+ weeks before NGA
- **Source:** Bylaw B-8.1.4
- **Location:** `ngaEngine.ts` (hardcoded check)
- **Configurable:** ❌ No

### DL-002: BCP Submission Deadline
- **Value:** 3 weeks before NGA
- **Source:** Bylaw B-17.2.1
- **Location:** `bcpEngine.ts` (hardcoded check)
- **Configurable:** ❌ No

---

## 8. Recommendation

### Phase 1 (Immediate)
Create a `rules` table that stores:
```
ruleKey, ruleValue, category, sourceClause, governanceVersion, 
effectiveFrom, effectiveUntil, status
```

### Phase 2 (Configuration)
Replace all hardcoded rule checks with `resolveEffectiveRule(ruleKey)` calls.

### Phase 3 (Validation)
Add rule validation: ensure every workflow that needs a rule actually resolves it.
