# 06B Phase 4A-2 Independent Validation

Validation-only branch based on PR #67 source HEAD `216eceb7bdb9266d77d0536f802b1112b7a650ac`.

This branch does not modify production implementation. It adds only independent adversarial tests, a temporary validation workflow, and validation documentation.

Primary gates: conservation, finite/non-negative transport, no source overdraw, deterministic order invariance, large-dt anti-overshoot, explicit directed/open routing, sealed no-loss behavior, generated SpeciesId compatibility, diagnostics consistency, cross-phase regression, full test suite and build.
