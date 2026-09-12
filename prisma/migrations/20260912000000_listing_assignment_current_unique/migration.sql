-- Prevent duplicate current listing assignments per research item.
-- Partial unique index: historical isCurrent = false rows remain unconstrained.
-- Local data audit (2026-09-12): 0 duplicate current assignments found.
CREATE UNIQUE INDEX "ListingAssignment_researchItemId_current_unique"
  ON "ListingAssignment" ("researchItemId")
  WHERE "isCurrent" = true;
