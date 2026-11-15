# Field Shift — start here

Handoff prepared 14 November 2026 from the repository's implementation, readiness
audit and pilot-validation documents. This file summarizes recorded status; it is
not a new test run or scientific validation. No chat history is required.

## Read in this order

1. `../AGENTS.md` and both files in `context/` — mandatory requirements.
2. `IMPLEMENTATION_PLAN.md` — dated implementation and verification record. Read
   the latest applicable entries; historical blockers may already be resolved.
3. `READINESS_AUDIT.md` — requirement-by-requirement gaps and actual claim limits.
4. `PILOT_VALIDATION_PLAN.md` — external validation gates G0–G5 and completion criteria.
5. `ATLAS_MODEL_CONTRACT.md` and relevant `../backend/atlas/*EVIDENCE.md` documents
   before changing scientific calculations or acquisition.

The readiness audit and pilot-validation plan already exist. Do not restart those
deliverables merely because an older prompt asks to create them.

## Completed versus remaining

| Area | Recorded status | Remaining work |
|---|---|---|
| Comparison and farmer workflow | Four fixed rotation templates; common four-year horizon; feasibility, preferences, trade-offs, independent selection, export and offline operation; evidence-linked per-strategy rationale (`strategy-rationale-v1`); editable enterprise budgets (`enterprise-inputs-v1`) with review flag | Real field/constraint confirmation with farmers/advisers; validated local quotes (not software defaults) |
| Weather and field history | POWER 2005–2024 context; separate unchanged simulation forcing; Landsat dates, farmer-reviewed windows, MODIS/SSURGO/NASADEM context | Fuller multi-season cover history and independently evaluated crop/residue labels; no automatic bare-soil classifier |
| SMAP/IMERG | All March–November 2024 packages acquired, processed, replayed and application-verified | Local moisture/gauge evaluation; nearest-pilot L3 has zero accepted retrievals and must stay withheld |
| ECOSTRESS | Dated thermal/ET evidence workflow delivered | Sparse usable dates; June ET/ESI withheld; independent LST/ET evaluation |
| GRACE/GRACE-FO | Regional 2005–2024 storage context, gaps, native support and offline workflow | Remains regional TWS, not field moisture or direct groundwater depletion |
| Requirements/scientific audit | `READINESS_AUDIT.md` exists; identified defects and fixes documented | Revisit partial requirements; update audit after changes |
| Agronomic validity | Explicit scenario assumptions and limitations | Calibration, independent predictive evaluation and multi-season alternative-rotation evidence |
| Usability | Automated browser checks documented | Actual farmer/adviser sessions, consent and comprehension evaluation |
| Production | Local prototype; not deployed | G5 identity/access, privacy, durable storage, retention, monitoring, backup/recovery and ownership |

Software verification is recorded in `IMPLEMENTATION_PLAN.md`; do not count passing
tests as field accuracy, farmer usability or calibrated uncertainty. Repeat checks
appropriate to new changes and the receiving environment.

## Next work, in priority order

1. **Verify handoff environment (ongoing on each machine).** Review Git state and
   run the documented local workflow. Identify absent private caches, ignored
   artifacts and temporary Python environments. Recreate dependencies from pinned
   files as necessary; do not assume `/tmp/fieldshift-evidence-env` exists on
   another machine. Do not repeat the bulk seasonal download if verified archives
   are already available.
2. **~~Evidence-linked per-strategy rationale~~ — software delivered 14 Nov 2026.**
   Each strategy carries `strategy-rationale-v1` in compare, UI and export.
   Mismatched evidence withheld; scoring unchanged.
3. **~~Usable reviewed local enterprise inputs~~ — software delivered 14 Nov 2026.**
   `enterprise-inputs-v1` lets operators edit crop prices/costs, clover N-credit
   range and N credit USD/kg, with reviewed flag and note. Catalog defaults remain
   labeled unvalidated; legacy saves migrate without inventing review. Validated
   market quotes still require human sources (G0).
4. **Prepare a real supervised pilot (G0/G3).** Owner must arrange farmer/adviser
   participation, consent, field boundaries and actual management/constraint inputs.
   Done means the documented gate criteria are met with real records, not fixtures.
   **External blocker:** agent cannot recruit participants or invent consent records.
5. **Collect and independently evaluate labels/measurements (G1/G2/G4).** Follow the
   validation plan before activating cover classification, accuracy claims, benefit
   probabilities or quantitative farm guidance. This requires people, instruments
   and seasons; an agent cannot manufacture completion.
6. **Production only if chosen (G5).** Define deployment scope and operational owner
   before implementing hosting-specific controls. Handoff does not authorize public
   deployment, account creation, contacting participants or purchasing services.

There is no defensible overall completion percentage: local demonstration software
is largely delivered, while scientific and production gates remain open. Track the
requirements and G0–G5 evidence rather than a growing test count.

## Prompt for the receiving agent

```text
Continue Field Shift using docs/HANDOFF.md as the entry point.
Read its linked mandatory context, current implementation record,
READINESS_AUDIT.md and PILOT_VALIDATION_PLAN.md. Verify actual code and
environment before relying on recorded status. Preserve user changes.

Do not repeat completed audits, mission integrations or bulk acquisition.
First report the current partial/unmet requirements and select the next
software-addressable item in the handoff priority order. Implement it,
run relevant checks and verify the changed farmer workflow.

Evidence-linked rationale and editable enterprise inputs are delivered.
Next software-only items are limited (e.g. evaluation dataset contracts);
prefer fixing material defects, then report G0/G3 external dependencies
rather than inventing pilot records.
Separate observed environmental context from crop mechanisms and unvalidated
benefit projections. Preserve QA withholding and boundary/time applicability.

Continue through reversible software work without asking for a new prompt
at each step. Before expanding scope, state what acceptance criterion it serves.
When work requires people, consent, measurements or additional seasons, report
the exact dependency, responsible human role and completion evidence needed;
do not invent records or mark the gate passed.

After each completed task update HANDOFF.md, IMPLEMENTATION_PLAN.md and the
relevant readiness row. Finish each report with: completed, verified, remaining,
external blockers and the exact next action. Do not deploy or purchase services.
```

## Transfer and maintenance

- Main status record: `IMPLEMENTATION_PLAN.md`; requirements ledger:
  `READINESS_AUDIT.md`; external gate criteria: `PILOT_VALIDATION_PLAN.md`.
- Transfer committed code and intended evidence archives. Ignored raw provider
  caches, browser artifacts and `/tmp` environments do not automatically travel
  with Git; identify what is required for each reproduction command.
- Credentials stay private. The new operator configures their own Earthdata
  environment using `../backend/atlas/EARTHDATA_SETUP.md`. Do not transfer `.env`
  or secrets through Git or chat.
- Replace this summary as work completes; retain dated verification and evidence
  references. Explicitly distinguish done, partial, externally blocked and deferred.
