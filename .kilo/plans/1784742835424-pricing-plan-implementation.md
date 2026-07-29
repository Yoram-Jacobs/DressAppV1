# Pricing Plan Implementation Plan

**Date:** 2026-07-27
**Status:** Draft — pending review before implementation

---

## 1. Audit Findings

### AGENTS.md (`C:\DressApp_AG\.agents\AGENTS.md`)
- No reference to `Pricing-Plane.md` or any pricing workflow.
- No pricing-related skill entry in the skills table.
- No cross-link from the knowledge base to pricing documents.

### Pricing-Plane.md (`D:\ai\Emergent\Appendix\docs\Pricing-Plane.md`)
- **Duplicate sections**: Monetization Risks (section 6) and Expected Revenue Impact (section 7) each appear twice — once at line 109 and again at line 303/317.
- **Per-Seat model option**: Was listed as a model option with "Not recommended" — removed entirely since the model is settled on Hybrid (Flat + Credits) with solo owners only.
- **Enterprise tier**: Was listed in Tier Recommendations and CTA copy section — fully excised from the document.
- **Team growth triggers**: "Professional features" and "Marketplace saturation" upgrade triggers removed. "Professional features" trigger (campaign creation) is retained since campaigns are kept for local fashion businesses.
- **Target Segments**: Brands/Retailers segment removed; focus is now on solo operators and local small businesses.
- **Storage calculation**: Generic MB estimates replaced with real closet storage volume (~30.3 MB per 100 items).
- **Token metering**: Placeholder token counts replaced with production-grade estimates and testing protocol.
- **Campaigns**: Kept for local fashion businesses (Professional Stylists, Local Businesses) as confirmed by user. Campaigns column in Usage Limits table and Business tier campaign creation (3 active) remain.

---

## 3. Implementation Plan (Next Steps)

### Phase 1: Verify Pricing-Plane.md Corrections
- [ ] Verify no duplicate sections remain in the document.
- [ ] Verify Per-Seat model option is removed.
- [ ] Verify Enterprise tier references are removed.
- [ ] Verify no campaign references exist outside of local fashion businesses.
- [ ] Verify storage calculation uses real closet volume.
- [ ] Verify token metering uses P95 estimates with testing protocol.
- [ ] Verify Next Steps section is updated.

### Phase 2: Update AGENTS.md
- [ ] Add pricing-related skill entry to the skills table (e.g., `/pricing` → pricing-strategist skill).
- [ ] Add a cross-reference to `D:\ai\Emergent\Appendix\docs\Pricing-Plane.md` in the knowledge base section.

### Phase 3: Implement Token Metering System
- [ ] Define the `TokenMeter` service in the backend (`billing_service.py` extension or new `token_meter.py`).
- [ ] Map each AI operation (garment tagging, outfit recommendation, stylist chat, bookmarklet migration) to expected token ranges using P95 real-world data.
- [ ] Implement credit deduction middleware that intercepts AI API calls and deducts credits from the user's balance before execution.
- [ ] Build a credit cost estimator that shows users the estimated credit cost before expensive operations.
- [ ] Create a cost dashboard for monitoring actual vs. projected AI spend per user and per operation.

### Phase 4: Implement Credit System in Backend
- [ ] Add `ai_credits` field to user model/schema.
- [ ] Add credit balance endpoints (GET balance, POST purchase, POST deduct).
- [ ] Implement credit rollover logic (unused credits roll over 30 days).
- [ ] Implement credit pack purchase flow (25, 50, 100 credit packs at defined prices).
- [ ] Add credit overage pricing ($1.99 per 10 credits) with hard stop at 100% for free tier.

### Phase 6: Design and Build Pricing Page - i18n localized and traslated
- [ ] Design pricing page UI with 3 tiers: Free, Pro ($9.99/mo), Business ($29/mo).
- [ ] Include feature comparison table highlighting AI credits, wardrobe limits, bookmarklet migration, campaign tools, and professional directory.
- [ ] Implement annual billing discount (20% off).
- [ ] Implement PayPal Subscriptions API integration for recurring billing.
- [ ] Add trial flows: 14-day Pro trial (50 credits), 30-day Business trial (300 credits + onboarding).
- [ ] Add upgrade prompts at 80% usage thresholds.

### Phase 7: Validate and Test
- [ ] Run 100 sample operations per AI feature to collect real token counts.
- [ ] Recalculate credit costs at P95 based on actual data.
- [ ] Test credit deduction flow end-to-end (operation → token metering → credit deduction → balance update).
- [ ] Test upgrade prompt triggers at correct thresholds.
- [ ] Test credit pack purchase and rollover logic.
- [ ] Interview 10 users to validate willingness-to-pay before finalizing tiers.
- [ ] A/B test Pro price point ($7.99 vs $9.99 vs $12.99).

### Phase 8: Monitor and Iterate
- [ ] Monitor NRR monthly; target >110% by Month 6.
- [ ] Track credit consumption patterns per tier.
- [ ] Review marketplace GMV and platform fee revenue monthly.
- [ ] Adjust credit rates if AI provider pricing changes.

---

## 5. Open Questions

1. **Token metering testing methodology**: What is the exact process for running 100 sample operations per feature? Which provider(s) should be used as the baseline?
2. **Storage volume calculation**: What are the exact closet dimensions and garment photo counts that define "real closet storage"?
3. **PayPal Subscriptions API**: Is the PayPal integration already implemented in the codebase, or does it need to be built from scratch?
4. **Pricing page design**: Should the UI/UX designer skill be loaded before building the pricing page?
5. **User interviews**: Who are the 10 users to interview, and what is the recruitment method?

---

## 5. Dependencies

- Phase 1 (corrections) must complete before Phase 3 (token metering) since the metering design depends on the corrected credit model.
- Phase 2 (AGENTS.md update) is independent of all other phases.
- Phase 4 (credit system backend) depends on Phase 1 (corrected plan) and Phase 3 (token metering design).
- Phase 5 (upgrade triggers frontend) depends on Phase 4 (credit system backend).
- Phase 6 (pricing page) depends on Phase 1 (corrected plan) and Phase 4 (credit system backend).
- Phase 7 (validation) depends on all prior phases.
- Phase 8 (monitoring) depends on Phase 7 (validation).