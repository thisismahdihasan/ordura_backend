-- Prevent duplicate current design assignments per research item.
-- Partial unique index: enforces uniqueness only when isCurrent = true.
-- Historical isCurrent = false rows remain completely unconstrained.
-- Production data audit (2026-09-11): 0 duplicate current assignments found — safe to apply.
CREATE UNIQUE INDEX "DesignAssignment_researchItemId_current_unique"
  ON "DesignAssignment" ("researchItemId")
  WHERE "isCurrent" = true;
