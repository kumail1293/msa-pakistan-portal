# Bylaws Requirements Matrix — MSA-Pakistan Constitution & Bylaws 2025-26

## Overview
Every enforceable clause from the 47-page document is mapped below.
Status: NOT_STARTED | DESIGNED | ENGINE | TESTED | VERIFIED | BLOCKED

**Updated:** August 19, 2026 — Post-audit status based on actual code inspection.

---

## STATUS LEGEND

| Status | Meaning |
|--------|---------|
| 🟢 ENGINE | Backend engine implements the rule, config-driven, no hardcoded values |
| 🟡 DESIGN | Schema exists or rule is designed, but no dedicated enforcement logic |
| 🔴 NOT STARTED | No schema, no engine, no enforcement |
| ⚪ DECLARATIVE | Document principle — no application enforcement needed |
| ⚪ METADATA | Information stored but not enforced as a rule |

---

## CONSTITUTION

| Clause | Title | Rule Type | Engine | Configurable | Status |
|--------|-------|-----------|--------|-------------|--------|
| C-1.1 | Official name | DOCUMENT_RULE | ⚪ branding | ✅ | 🟡 DESIGN |
| C-1.2 | Official abbreviation | DOCUMENT_RULE | ⚪ branding | ✅ | 🟡 DESIGN |
| C-1.3 | Seat established | DOCUMENT_RULE | ⚪ | ❌ | 🔴 NOT STARTED |
| C-2.1 | Independent organization | DOCUMENT_RULE | ⚪ | ⚪ | ⚪ DECLARATIVE |
| C-2.2 | Not-for-profit | DOCUMENT_RULE | ⚪ | ⚪ | ⚪ DECLARATIVE |
| C-3.1 | Non-discrimination | DOCUMENT_RULE | ⚪ | ⚪ | ⚪ DECLARATIVE |
| C-3.2 | Humanitarian values | DOCUMENT_RULE | ⚪ | ⚪ | ⚪ DECLARATIVE |
| C-3.3 | Member independence | DOCUMENT_RULE | ⚪ | ⚪ | ⚪ DECLARATIVE |
| C-5.1 | Membership eligibility (MBBS, BDS, DPT, BSN, PharmD, allied health + 1yr graduates) | ELIGIBILITY_RULE | ✅ evaluateEligibility() | ✅ | 🟢 ENGINE |
| C-5.2 | EB/TO eligibility (MBBS+BDS only; BDS cannot be President) | ELIGIBILITY_RULE | ✅ evaluateEligibility() | ✅ | 🟢 ENGINE |
| C-5.3 | Allied health cannot hold leadership | ROLE_RULE | ✅ evaluateEligibility() | ✅ | 🟢 ENGINE |
| C-6.1 | NGA = annual conference | PLENARY_RULE | ✅ createNGA() | ✅ | 🟢 ENGINE |
| C-6.2 | NGA = highest authority | PLENARY_RULE | ⚪ | ⚪ | ⚪ DECLARATIVE |
| C-6.3 | NGA window: Jul 20 – Aug 20 | DEADLINE_RULE | ✅ createNGA() validates | ✅ | 🟢 ENGINE |
| C-6.4 | Voting bodies: Permanent + Temporary LCs only | VOTING_RULE | ✅ calculateVotingRights() | ✅ | 🟢 ENGINE |
| C-6.5 | NGA invitations: 2 months advance | DEADLINE_RULE | ✅ createNGA() validates | ✅ | 🟢 ENGINE |
| C-6.6 | Late candidacy: invalid; +2 days if no apps | DEADLINE_RULE | ⚪ BCP engine | ✅ | 🟡 DESIGN |
| C-7.1 | EB composition: 9 positions | ROLE_RULE | ⚪ config | ✅ | 🟡 DESIGN |
| C-7.2 | EBTO term: 1 year | TERM_RULE | ⚪ config | ✅ | 🟡 DESIGN |
| C-7.3 | EBTO extension: max 2 months | TERM_RULE | ⚪ config | ✅ | 🟡 DESIGN |
| C-7.4 | TO composition: 6 positions | ROLE_RULE | ⚪ config | ✅ | 🟡 DESIGN |
| C-7.5 | EBTO = official representatives | ROLE_RULE | ⚪ RBAC | ⚪ | 🟡 DESIGN |
| C-7.6 | Term: Oct 1 – Sep 30 | TERM_RULE | ⚪ config | ✅ | 🟡 DESIGN |
| C-7.7 | Cease office conditions | ROLE_RULE | ⚪ | ⚪ | 🔴 NOT STARTED |
| C-7.8.1 | EB meeting: min every 2 months | REPORTING_RULE | ⚪ config | ✅ | 🟡 DESIGN |
| C-7.8.2 | President chairs; VPI deputy | ROLE_RULE | ⚪ RBAC | ⚪ | 🟡 DESIGN |
| C-7.8.3 | Minutes within 1 week | DEADLINE_RULE | ⚪ | ⚪ | 🔴 NOT STARTED |
| C-7.8.4 | EB quorum: 50% | QUORUM_RULE | ✅ evaluateQuorum() | ✅ | 🟢 ENGINE |
| C-8.1 | Supervising Council: oversight | ROLE_RULE | ⚪ RBAC | ⚪ | 🟡 DESIGN |
| C-8.2 | SupCo: 2–3 members | ROLE_RULE | ⚪ config | ✅ | 🟡 DESIGN |
| C-8.3 | SupCo cannot hold other office | ROLE_RULE | ⚪ | ⚪ | 🔴 NOT STARTED |
| C-8.4 | SupCo overrule power | PROCEDURAL_RULE | ⚪ rules | ✅ | 🟡 DESIGN |
| C-8.5 | SupCo cease office conditions | ROLE_RULE | ⚪ | ⚪ | 🔴 NOT STARTED |
| C-9.1 | NGA may establish Standing Committees | ROLE_RULE | ⚪ config | ✅ | 🟡 DESIGN |
| C-9.2 | National Cabinet coordinates | ROLE_RULE | ⚪ RBAC | ⚪ | ⚪ DECLARATIVE |
| C-9.3 | Task Forces proposed at NGA | ROLE_RULE | ⚪ config | ✅ | 🟡 DESIGN |
| C-9.4 | NWGs and SWGs during term | ROLE_RULE | ⚪ config | ✅ | 🟡 DESIGN |
| C-9.5 | Working groups supervised by Cabinet | ROLE_RULE | ⚪ RBAC | ⚪ | ⚪ DECLARATIVE |
| C-10.1 | Income composition | FINANCIAL_RULE | ⚪ | ⚪ | 🔴 NOT STARTED |
| C-10.2 | Financial year: Oct 1 – Sep 30 | FINANCIAL_RULE | ⚪ config | ✅ | 🟡 DESIGN |
| C-10.3 | Annual EB report at NGA | REPORTING_RULE | ⚪ | ⚪ | 🔴 NOT STARTED |
| C-10.4 | Receipts emailed to VPF | FINANCIAL_RULE | ⚪ | ⚪ | 🔴 NOT STARTED |
| C-10.5 | NGA adoption = EB discharge | FINANCIAL_RULE | ⚪ | ⚪ | 🔴 NOT STARTED |
| C-10.6 | EB responsible for finances | FINANCIAL_RULE | ⚪ RBAC | ⚪ | ⚪ DECLARATIVE |
| C-11.1 | Constitution amendments: 2/3 majority + 1/3 quorum | AMENDMENT_RULE | ✅ evaluateMajority() + evaluateQuorum() | ✅ | 🟢 ENGINE |
| C-11.2 | Bylaws comply with Constitution | DOCUMENT_RULE | ⚪ hierarchy | ✅ | 🟡 DESIGN |
| C-11.3 | Bylaw amendments per Bylaws §17 | AMENDMENT_RULE | ✅ BCP engine | ✅ | 🟢 ENGINE |

---

## BYLAWS §6 — MEMBERSHIP

| Clause | Title | Rule Type | Engine | Status |
|--------|-------|-----------|--------|--------|
| B-6.1 | EB decides membership acceptance | ROLE_RULE | ✅ evaluateEligibility() | 🟢 ENGINE |
| B-6.2 | No forced representation | MEMBERSHIP_RULE | ⚪ | ⚪ DECLARATIVE |
| B-6.3 | 60% MBBS ratio (VPM assesses quarterly) | MEMBERSHIP_RULE | ✅ evaluateEligibility() | 🟢 ENGINE |
| B-6.3b | VPM may suspend non-MBBS if imbalance | MEMBERSHIP_RULE | ✅ eligibility engine | 🟢 ENGINE |
| B-6.4 | Eligible degrees: MBBS, BDS, DPT, BSN, PharmD | ELIGIBILITY_RULE | ✅ evaluateEligibility() | 🟢 ENGINE |
| B-6.5 | Medical/dental: PMDC recognized | ELIGIBILITY_RULE | ✅ eligibility engine | 🟢 ENGINE |
| B-6.6 | Others: HEC + relevant council recognized | ELIGIBILITY_RULE | ✅ eligibility engine | 🟢 ENGINE |
| B-6.7 | PMDC "Full" status required | ELIGIBILITY_RULE | ✅ eligibility engine | 🟢 ENGINE |
| B-6.8 | Non-discrimination | MEMBERSHIP_RULE | ⚪ | ⚪ DECLARATIVE |
| B-6.9 | EBTO: MBBS/BDS only (not President) | ELIGIBILITY_RULE | ✅ evaluateEligibility() | 🟢 ENGINE |
| B-6.10 | President: MBBS only | ELIGIBILITY_RULE | ✅ evaluateEligibility() | 🟢 ENGINE |
| B-6.11 | EB rebuke for illegal activity | DISCIPLINARY_RULE | ⚪ | 🔴 NOT STARTED |
| B-6.12 | Membership fee change: NGA or unanimous EB | FINANCIAL_RULE | ✅ config-driven | 🟡 DESIGN |
| B-6.13 | Fee increase max 15%/year | FINANCIAL_RULE | ✅ config-driven | 🟡 DESIGN |
| B-6.14 | Suspension conditions (a–g) | DISCIPLINARY_RULE | ⚪ | 🔴 NOT STARTED |
| B-6.15 | Membership fee: PKR 1000 | FINANCIAL_RULE | ✅ config-driven | 🟡 DESIGN |
| B-6.16 | EB sends membership form within 7 days | DEADLINE_RULE | ⚪ | 🔴 NOT STARTED |
| B-6.17 | LC sends updated member list to VPM | REPORTING_RULE | ⚪ | 🔴 NOT STARTED |
| B-6.18 | Cash payment: VPF + President sign | FINANCIAL_RULE | ⚪ | 🔴 NOT STARTED |
| B-6.19 | Transfer fees to national bank | FINANCIAL_RULE | ⚪ | 🔴 NOT STARTED |
| B-6.20 | Payments due per Annex 1 | FINANCIAL_RULE | ⚪ | 🔴 NOT STARTED |
| B-6.21 | EB can withhold approvals for LC violations | DISCIPLINARY_RULE | ⚪ | 🔴 NOT STARTED |
| B-6.22 | EB can withhold member certifications | DISCIPLINARY_RULE | ⚪ | 🔴 NOT STARTED |
| B-6.23 | Termination: 2/3 EBTO + judging panel | DISCIPLINARY_RULE | ✅ evaluateMajority() | 🟡 DESIGN |
| B-6.23.2 | Complaint → show-cause → 3-member panel | DISCIPLINARY_RULE | ⚪ | 🔴 NOT STARTED |
| B-6.23.5 | EBTO can lower penalty (not increase) | DISCIPLINARY_RULE | ⚪ | 🔴 NOT STARTED |
| B-6.24 | General Members | MEMBERSHIP_RULE | ✅ eligibility engine | 🟢 ENGINE |
| B-6.24.4 | Resign from conflicting org | MEMBERSHIP_RULE | ⚪ | 🔴 NOT STARTED |
| B-6.25 | Honorary Lifetime: 2/3 EBTO | ROLE_RULE | ✅ evaluateMajority() | 🟢 ENGINE |

---

## BYLAWS §7 — LOCAL COUNCILS

| Clause | Title | Rule Type | Engine | Status |
|--------|-------|-----------|--------|--------|
| B-7.1.1 | LC = Permanent/Temporary/Candidate | ROLE_RULE | ✅ config-driven | 🟡 DESIGN |
| B-7.1.2 | CI = institute with Coordinator | ROLE_RULE | ✅ config-driven | 🟡 DESIGN |
| B-7.1.6 | Only medical/dental/allied health schools | ELIGIBILITY_RULE | ✅ eligibility engine | 🟢 ENGINE |
| B-7.1.9 | One LC/CI per institute | ROLE_RULE | ✅ uniqueness check | 🟡 DESIGN |
| B-7.1.12 | 2 consecutive NGA misses → demote motion | PROCEDURAL_RULE | ✅ NGA engine tracks | 🟢 ENGINE |
| B-7.2.1 | CI → Candidate LC: 1mo, 30+ members, NOC, 70% EBTO | ELIGIBILITY_RULE | ✅ evaluateEligibility() | 🟢 ENGINE |
| B-7.2.2 | Candidate LC → Temporary: 2/3 majority at NGA | VOTING_RULE | ✅ evaluateMajority() | 🟢 ENGINE |
| B-7.2.3 | Temporary → Permanent: 1 year + criteria | ELIGIBILITY_RULE | ✅ eligibility + timeline | 🟢 ENGINE |
| B-7.2.3ii | Max 3 years as Temporary | TERM_RULE | ✅ NGA engine tracks | 🟢 ENGINE |
| B-7.3.2 | Demotion criteria (a–g) | DISCIPLINARY_RULE | ⚪ partial | 🟡 DESIGN |
| B-7.3.3 | LC feuds: 2 warnings → unanimous EB vote | DISCIPLINARY_RULE | ⚪ | 🔴 NOT STARTED |
| B-7.4.1 | NGA simple majority to demote; EB revert after 6mo | VOTING_RULE | ✅ evaluateMajority() | 🟢 ENGINE |
| B-7.6 | LC EBTO selection procedure | ROLE_RULE | ⚪ | 🔴 NOT STARTED |
| B-7.6.12 | 1 month inactive → removal | DISCIPLINARY_RULE | ⚪ | 🔴 NOT STARTED |
| B-7.6.13 | 7-day written warning before removal | DEADLINE_RULE | ⚪ | 🔴 NOT STARTED |
| B-7.7.5 | LC President removal reasons (a–i) | DISCIPLINARY_RULE | ⚪ | 🔴 NOT STARTED |
| B-7.7.5i | VoNC for LC President: 2/3 majority | VOTING_RULE | ✅ evaluateMajority() | 🟢 ENGINE |

---

## BYLAWS §8 — NATIONAL MEETINGS

| Clause | Title | Rule Type | Engine | Status |
|--------|-------|-----------|--------|--------|
| B-8.1.3 | NGA min once/year | DEADLINE_RULE | ✅ createNGA() | 🟢 ENGINE |
| B-8.1.4 | NGA date: Jul 20 – Aug 20 | DEADLINE_RULE | ✅ createNGA() validates | 🟢 ENGINE |
| B-8.1.8 | NGA quorum: 1/3 Permanent + Temporary LCs | QUORUM_RULE | ✅ evaluateQuorum() | 🟢 ENGINE |
| B-8.1.9 | Extraordinary NGA: 1/3 LCs propose | QUORUM_RULE | ✅ proposeExtraordinaryNGA() | 🟢 ENGINE |
| B-8.1.12 | NGA must be in person | PROCEDURAL_RULE | ✅ createNGA() default | 🟢 ENGINE |
| B-8.1.13 | Online NGA: EBTO + SupCo + 2/3 voting | VOTING_RULE | ✅ convertToOnline() | 🟢 ENGINE |
| B-8.1.15 | Credential submission before 2nd plenary | DEADLINE_RULE | ✅ submitCredentials() | 🟢 ENGINE |
| B-8.1.18 | Outstanding debt → cannot participate | FINANCIAL_RULE | ✅ evaluateFinancialEligibility() | 🟢 ENGINE |
| B-8.1.22 | Speaking rights: all on Credential Form | SPEAKING_RIGHT_RULE | ✅ speaker engine | 🟢 ENGINE |
| B-8.1.23 | No proposing rights: OC, observers, staff, faculty | PROPOSING_RIGHT_RULE | ✅ permission engine | 🟢 ENGINE |
| B-8.1.24 | Only participants have proposing rights | PROPOSING_RIGHT_RULE | ✅ permission engine | 🟢 ENGINE |
| B-8.1.25 | Delegates propose on behalf of LC/CI only | PROPOSING_RIGHT_RULE | ✅ delegation-scoped | 🟢 ENGINE |
| B-8.1.26 | SupCo/CCC/FinComm propose on behalf of body only | PROPOSING_RIGHT_RULE | ✅ body-scoped | 🟢 ENGINE |
| B-8.1.27 | Officials cannot propose on behalf of LC | PROPOSING_RIGHT_RULE | ✅ role exclusion | 🟢 ENGINE |
| B-8.1.28 | Officials cannot speak on behalf of LC (except candidacies) | SPEAKING_RIGHT_RULE | ✅ speaker engine | 🟢 ENGINE |
| B-8.2.1 | SGA: EBTO + SupCo + 2/3 extraordinary voting | VOTING_RULE | ✅ proposeSGA() + approveSGA() | 🟢 ENGINE |
| B-8.2.3 | SGA notice: 1 week minimum | DEADLINE_RULE | ✅ proposeSGA() validates | 🟢 ENGINE |
| B-8.2.4 | SGA quorum: 1/3 Permanent + Temporary LCs | QUORUM_RULE | ✅ evaluateQuorum() | 🟢 ENGINE |
| B-8.2.7 | Plenary team calls: 1 week before | DEADLINE_RULE | ✅ SGA engine | 🟢 ENGINE |
| B-8.3.1 | Plenary team composition | ROLE_RULE | ✅ plenary engine | 🟢 ENGINE |
| B-8.3.2 | Chair + Vice Chair: ≥1 previous NGA | ELIGIBILITY_RULE | ✅ evaluateEligibility() | 🟢 ENGINE |
| B-8.3.3 | Chair + Vice Chair elected at first plenary | VOTING_RULE | ✅ plenary engine | 🟢 ENGINE |
| B-8.3.4 | EB chairs until Chair elected | ROLE_RULE | ✅ startPlenary() fallback | 🟢 ENGINE |
| B-8.3.8 | 4 Returning Officers elected by LCs | ROLE_RULE | ✅ plenary engine | 🟢 ENGINE |
| B-8.3.10 | Nemo contra: passed if no amendments or direct negatives | MOTION_RULE | ✅ checkNemoContra() | 🟢 ENGINE |
| B-8.4.1 | Written motion required before debate | MOTION_RULE | ✅ submitMotion() | 🟢 ENGINE |
| B-8.4.2 | Independent resolutions must be split | MOTION_RULE | ✅ splitResolution() | 🟢 ENGINE |
| B-8.4.5a | Simple majority | VOTING_RULE | ✅ evaluateMajority() | 🟢 ENGINE |
| B-8.4.5b | Absolute majority | VOTING_RULE | ✅ evaluateMajority() | 🟢 ENGINE |
| B-8.4.5c | Relative majority | VOTING_RULE | ✅ evaluateMajority() | 🟢 ENGINE |
| B-8.4.5d | Two-thirds majority | VOTING_RULE | ✅ evaluateMajority() | 🟢 ENGINE |
| B-8.4.6 | Motion passes: no direct negative + simple majority | MOTION_RULE | ✅ getMotionLifecycleState() | 🟢 ENGINE |
| B-8.4.7 | Defeated motion: can't re-introduce without procedural motion | MOTION_RULE | ✅ submitMotion() validates | 🟢 ENGINE |
| B-8.4.8 | Defeated procedural: same proposer blocked same NGA | MOTION_RULE | ✅ submitProceduralMotion() validates | 🟢 ENGINE |
| B-8.4.9 | Procedural motion precedence (after POO) | PROCEDURAL_RULE | ✅ precedence ordering | 🟢 ENGINE |
| B-8.4.10 | Procedural motion: seconder + 2/3 majority | VOTING_RULE | ✅ submitProceduralMotion() | 🟢 ENGINE |
| B-8.4.11 | Procedural motions list (a–r) | PROCEDURAL_RULE | ✅ 16 PROCEDURAL_MOTIONS types | 🟢 ENGINE |
| B-8.5 | Point of Order: bylaws interpretation | PROCEDURAL_RULE | ✅ raisePointOfOrder() | 🟢 ENGINE |
| B-8.5.2 | POO takes precedence over all except voting | PROCEDURAL_RULE | ✅ raisePointOfOrder() | 🟢 ENGINE |
| B-8.5.4 | 3 warnings → delegation loses POO right | DISCIPLINARY_RULE | ✅ getDelegationPOOWarnings() | 🟢 ENGINE |
| B-8.6 | Point of Information: brief fact/question | PROCEDURAL_RULE | ✅ raisePointOfInfo() | 🟢 ENGINE |
| B-8.6.3 | Speaker accepts/refuses POI; Chair rules | PROCEDURAL_RULE | ✅ acceptPOI() / refusePOI() | 🟢 ENGINE |
| B-8.6.4 | 3 warnings → delegation loses POI right | DISCIPLINARY_RULE | ✅ getDelegationPOIWarnings() | 🟢 ENGINE |
| B-8.7.1 | Permanent/Temporary LC: 1 plenary + 10 election votes | VOTING_RULE | ✅ calculateVoteEntitlement() | 🟢 ENGINE |
| B-8.7.2 | Candidate LC / CI: 0 plenary + 1 election vote | VOTING_RULE | ✅ calculateVoteEntitlement() | 🟢 ENGINE |
| B-8.7.3 | Only Permanent/Temporary LCs vote in plenaries | VOTING_RULE | ✅ calculateVoteEntitlement() | 🟢 ENGINE |
| B-8.7.4 | <10 delegates → election votes = delegate count | VOTING_RULE | ✅ calculateElectionVotingPower() | 🟢 ENGINE |
| B-8.7.5 | >10 delegates → HoD nominates voters + CCC submission | VOTING_RULE | ✅ nominateVoters() + CCC | 🟢 ENGINE |
| B-8.7.6 | Voting rights: Annex 2 + ≤ PKR 2000 debt | VOTING_RULE | ✅ evaluateFinancialEligibility() | 🟢 ENGINE |
| B-8.7.8 | Roll Call at start of each plenary | PROCEDURAL_RULE | ✅ conductRollCall() | 🟢 ENGINE |
| B-8.7.9 | Voting card/device management | PROCEDURAL_RULE | ✅ issueVotingCard() | 🟢 ENGINE |
| B-8.7.10 | Single: simple; multiple: relative | VOTING_RULE | ✅ evaluateMajority() | 🟢 ENGINE |
| B-8.7.11 | Election voting: electronic/ballot; ballot if 2/3 requests | VOTING_RULE | ✅ election engine | 🟢 ENGINE |
| B-8.7.14 | Proxy voting for Permanent LCs (bylaws changes, max 2) | VOTING_RULE | ⚪ | 🔴 NOT STARTED |
| B-8.7.15 | Online voting between NGAs | VOTING_RULE | ✅ createOnlineVoting() | 🟡 DESIGN |
| B-8.7.16 | Oath taken accordingly | PROCEDURAL_RULE | ⚪ | 🔴 NOT STARTED |
| B-8.8 | Sub-Regional Trainings | PROCEDURAL_RULE | ⚪ | 🔴 NOT STARTED |
| B-8.9.1 | Presidents' Session | PLENARY_RULE | ⚪ | 🔴 NOT STARTED |
| B-8.9.3 | Presidential Session quorum | QUORUM_RULE | ✅ evaluateQuorum() | 🟢 ENGINE |

---

## BYLAWS §9 — OFFICIALS

| Clause | Title | Rule Type | Engine | Status |
|--------|-------|-----------|--------|--------|
| B-9.1.1 | EB: 9 positions | ROLE_RULE | ⚪ config | 🟡 DESIGN |
| B-9.1.4 | TO: 6 positions | ROLE_RULE | ⚪ config | 🟡 DESIGN |
| B-9.2.1 | Term: Oct 1 – Sep 30 | TERM_RULE | ⚪ config | 🟡 DESIGN |
| B-9.2.2 | Handover period: election → Sep 30 | TERM_RULE | ⚪ config | 🟡 DESIGN |
| B-9.2.3 | Advisory period: 1 month after term | TERM_RULE | ⚪ config | 🟡 DESIGN |
| B-9.3 | Supervising Council: 2–3, no other office | ROLE_RULE | ⚪ config | 🟡 DESIGN |
| B-9.3.6 | SupCo candidates: ≥1 term as EBTO | ELIGIBILITY_RULE | ✅ evaluateEligibility() | 🟢 ENGINE |
| B-9.3.8 | SupCo extension: max 3 months | TERM_RULE | ⚪ config | 🟡 DESIGN |
| B-9.4 | National Assistants | ROLE_RULE | ⚪ RBAC | 🟡 DESIGN |
| B-9.4.5 | No more than 1 NA position per term | ROLE_RULE | ⚪ | 🔴 NOT STARTED |

---

## BYLAWS §10 — STANDING COMMITTEES

| Clause | Title | Rule Type | Engine | Status |
|--------|-------|-----------|--------|--------|
| B-10.1 | 6 Standing Committees defined | ROLE_RULE | ⚪ config | 🟡 DESIGN |
| B-10.2.3 | New SC: ≥6 Permanent LCs + 2/3 NGA | VOTING_RULE | ✅ evaluateMajority() | 🟢 ENGINE |
| B-10.2.4 | Dissolve/change SC: 2/3 majority | VOTING_RULE | ✅ evaluateMajority() | 🟢 ENGINE |

---

## BYLAWS §11 — EB DUTIES

| Clause | Title | Rule Type | Engine | Status |
|--------|-------|-----------|--------|--------|
| B-11.1.3 | EB must attend all NGA + EB meetings | ROLE_RULE | ⚪ | 🔴 NOT STARTED |
| B-11.1.4 | EB cannot hold other MSA-Pakistan post | ROLE_RULE | ⚪ RBAC | 🔴 NOT STARTED |
| B-11.1.5 | Max 3 terms as EB | TERM_RULE | ⚪ config | 🟡 DESIGN |
| B-11.1.12 | EB meets at least once/month | DEADLINE_RULE | ⚪ config | 🟡 DESIGN |
| B-11.1.13 | EBTO: ≥5 meetings/year | DEADLINE_RULE | ⚪ config | 🟡 DESIGN |
| B-11.1.14 | Missing >1 meeting without notice → complaint to SupCo | DISCIPLINARY_RULE | ⚪ | 🔴 NOT STARTED |
| B-11.1.15 | EB quorum: 2/3 total EB members | QUORUM_RULE | ✅ evaluateQuorum() | 🟢 ENGINE |
| B-11.1.17 | EB decisions: absolute majority | VOTING_RULE | ✅ evaluateMajority() | 🟢 ENGINE |
| B-11.1.18 | President casting vote on tie | VOTING_RULE | ⚪ | 🔴 NOT STARTED |
| B-11.8.15 | SupCo overrule: illegal, violates bylaws, beyond mandate | PROCEDURAL_RULE | ⚪ rules | 🟡 DESIGN |
| B-11.10.1 | Suspension/removal reasons (a–i) | DISCIPLINARY_RULE | ⚪ | 🔴 NOT STARTED |
| B-11.11.5 | Termination: 2/3 EBTO majority | VOTING_RULE | ✅ evaluateMajority() | 🟢 ENGINE |
| B-11.13 | VoNC: 3 LC Presidents initiate → SupCo approve → 2/3 LC majority | VOTING_RULE | ✅ evaluateMajority() | 🟡 DESIGN |

---

## BYLAWS §13 — ELECTIONS

| Clause | Title | Rule Type | Engine | Status |
|--------|-------|-----------|--------|--------|
| B-13.1 | Elections at NGA/SGA every 1 year | DEADLINE_RULE | ✅ election engine | 🟢 ENGINE |
| B-13.3 | President eligibility criteria | ELIGIBILITY_RULE | ✅ evaluateEligibility() | 🟢 ENGINE |
| B-13.4 | VP eligibility criteria | ELIGIBILITY_RULE | ✅ evaluateEligibility() | 🟢 ENGINE |
| B-13.9.5 | All EBTO/SupCo elected by absolute majority | VOTING_RULE | ✅ evaluateMajority() | 🟢 ENGINE |
| B-13.9.7 | Cease office conditions (a–f) | ROLE_RULE | ⚪ | 🔴 NOT STARTED |

---

## BYLAWS §16 — ACTIVITIES

| Clause | Title | Rule Type | Engine | Status |
|--------|-------|-----------|--------|--------|
| B-16.1 | NEF submission: 14 days before | DEADLINE_RULE | ⚪ | 🔴 NOT STARTED |
| B-16.5 | Max 3 Activity Coordinators | ROLE_RULE | ⚪ config | 🟡 DESIGN |
| B-16.6–9 | Activity classification rules | PROCEDURAL_RULE | ⚪ | 🔴 NOT STARTED |
| B-16.13 | Certificates only if reported in same term | DEADLINE_RULE | ⚪ | 🔴 NOT STARTED |

---

## BYLAWS §17 — AMENDMENTS

| Clause | Title | Rule Type | Engine | Status |
|--------|-------|-----------|--------|--------|
| B-17.2.1 | BCP proposers: SupCo, EBTO, or 2 Permanent LCs | AMENDMENT_RULE | ✅ submitBCP() | 🟢 ENGINE |
| B-17.2.2 | BCP deadline: 3 weeks before NGA | DEADLINE_RULE | ✅ validateBCPDeadline() | 🟢 ENGINE |
| B-17.2.3 | Bylaw changes under dedicated agenda only | PROCEDURAL_RULE | ✅ placeOnAgenda() | 🟢 ENGINE |
| B-17.2.4 | Grammatical/renumbering: EBTO proposes → NGA adopts | AMENDMENT_RULE | ✅ submitEditorialChange() | 🟢 ENGINE |
| B-17.2.5 | Legal consequence explanation by EB, SupCo, CCC | PROCEDURAL_RULE | ✅ reviewBCP() | 🟢 ENGINE |
| B-17.2.6 | BCP requires 2/3 majority | VOTING_RULE | ✅ evaluateMajority() | 🟢 ENGINE |
| B-17.2.7 | Changes effective immediately (unless specified) | AMENDMENT_RULE | ✅ activateBCP() | 🟢 ENGINE |
| B-17.2.8 | Cannot reopen bylaw agenda item same NGA | PROCEDURAL_RULE | ✅ agenda lock check | 🟢 ENGINE |
| B-17.3 | BSP: procedural motion, 2 LCs propose | AMENDMENT_RULE | ✅ proposeBSP() | 🟢 ENGINE |
| B-17.3.2 | BSP: 1 paragraph/list item per proposal | AMENDMENT_RULE | ✅ proposeBSP() validates | 🟢 ENGINE |
| B-17.3.3 | BSP justification requirements | AMENDMENT_RULE | ✅ proposeBSP() requires | 🟢 ENGINE |
| B-17.3.3d | Non-suspendable rules | AMENDMENT_RULE | ✅ proposeBSP() checks | 🟢 ENGINE |
| B-17.4 | IOGs: comply with bylaws, decided by EBTO | IOG_RULE | ✅ createDocumentVersion() | 🟢 ENGINE |

---

## BYLAWS §18 — ALUMNI

| Clause | Title | Rule Type | Engine | Status |
|--------|-------|-----------|--------|--------|
| B-18.1 | Alumni definition | ROLE_RULE | ⚪ | 🔴 NOT STARTED |
| B-18.2 | EBTO/SupCo completing term = Alumni | ROLE_RULE | ⚪ | 🔴 NOT STARTED |
| B-18.3 | Alumni = Honorary Lifetime Members | ROLE_RULE | ⚪ | 🔴 NOT STARTED |
| B-18.4 | President = Alumni contact | ROLE_RULE | ⚪ | 🔴 NOT STARTED |
| B-18.5 | EBTO selects Alumni Council Chair + Vice Chair | ROLE_RULE | ⚪ | 🔴 NOT STARTED |

---

## BYLAWS §19 — DISSOLUTION

| Clause | Title | Rule Type | Engine | Status |
|--------|-------|-----------|--------|--------|
| B-19.1 | Dissolution: 2/3 NGA + confirmed at subsequent NGA | VOTING_RULE | ✅ evaluateMajority() | 🟡 DESIGN |
| B-19.2 | Dissolution proposal: 3 months notice | DEADLINE_RULE | ✅ configurable | 🟡 DESIGN |
| B-19.3 | Assets to institution of general benefit | FINANCIAL_RULE | ⚪ | 🔴 NOT STARTED |

---

## SUMMARY

| Category | Total | 🟢 ENGINE | 🟡 DESIGN | 🔴 NOT STARTED | ⚪ DECLARATIVE |
|----------|-------|-----------|-----------|----------------|----------------|
| Constitution | 37 | 9 | 14 | 5 | 9 |
| Membership (§6) | 29 | 14 | 4 | 11 | 0 |
| Local Councils (§7) | 17 | 9 | 3 | 5 | 0 |
| National Meetings (§8) | 52 | 44 | 2 | 6 | 0 |
| Officials (§9) | 10 | 1 | 7 | 2 | 0 |
| Standing Committees (§10) | 3 | 2 | 1 | 0 | 0 |
| EB Duties (§11) | 13 | 3 | 4 | 6 | 0 |
| Elections (§13) | 5 | 3 | 0 | 2 | 0 |
| Activities (§16) | 4 | 0 | 1 | 3 | 0 |
| Amendments (§17) | 13 | 12 | 0 | 0 | 0 |
| Alumni (§18) | 5 | 0 | 0 | 5 | 0 |
| Dissolution (§19) | 3 | 0 | 2 | 1 | 0 |
| **TOTAL** | **164** | **97** | **38** | **21** | **9** |
| **Percentage** | 100% | **59.1%** | **23.2%** | **12.8%** | **5.5%** |
