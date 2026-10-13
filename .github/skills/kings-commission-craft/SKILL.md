---
name: kings-commission-craft
description: Use when reviewing Crown & Bounty's interface aesthetics, planning screen composition or layout, adapting a screen for touch or phone scale, or claiming that an interface looks finished after polish.
---

# Judge the game interface

Judge player understanding, task success and whole-screen coherence, not pixel activity.

Use **impeccable** and its **critique**, **audit** and **adapt** guidance for design, objective checks and device/input differences. An excerpt review is not a completed command. **kings-commission-mapart** owns painted art/palette constraints; **kings-commission-ship** owns technical validation and shipping.

## Work in this order

1. **Brief.** Name two or three player decision tasks, the agreed failure and constraints from AGENTS.md and docs/BRIEF.md. Separate polish from redesign. Preserve the retro identity, art pipeline and lettering unless Artur approves otherwise.
2. **Evidence.** Record build, CSS-pixel viewport, orientation, input, state and capture provenance. Label missing metadata, synthetic facts and reported checks. Reuse captures; collect only matched desktop and sideways-phone task states plus a short interaction trace.
3. **References.** For unresolved aesthetics, curate two or three external sources with provenance, a transferable structural lesson and its limits. Use relevant game interfaces and touch layouts, not only our past work. Never copy assets or silently replace the identity.
4. **Whole before detail.** Inspect composition at actual desktop/phone scale, then hierarchy, colour roles, type, icon consistency, spacing, panels, action placement, cognitive load, touch targets and feedback along the tasks. Measure unobstructed rendered hit regions after scaling in CSS pixels; nominal sizes, framebuffer pixels and DPR are not that measurement.
5. **Priorities and directions.** Separate observations, hypotheses and preferences. Rank up to five evidenced failures with affected task, location, concrete remedy and acceptance check. Never invent five. For a broader unresolved problem, compare two structurally different directions with task tradeoffs. Artur chooses before implementation unless he explicitly delegates design decisions. With explicit delegation, choose within the agreed constraints, record why and proceed without another approval round.
6. **Compare and stop.** After authorised work, compare matched before/after builds, viewports, states and tasks against the original failures. Keep technical passes separate. One batched review, at most one correction/confirmation pass, then report limits. Accept a coherent slice without endless captures.

## Required handoff

End every review with **evidence and limits**, **priorities**, **direction and authorisation**, and **acceptance scope**. State whether the direction was approved, chosen under explicit delegation, or still awaits a decision. Mark absent references explicitly. Unresolved broader aesthetics need a sourced board and a recorded direction, not just more detail, motion or technical checks. An adequate narrow slice needs no fresh board or redesign.

## Do not mistake these for completion

| Evidence | What it does not prove |
| --- | --- |
| Tests, animation, extra detail or changed frame hashes | Better hierarchy or a successful redesign |
| A good desktop view | A usable phone layout |
| A photo or screenshot | Successful interaction, measured contrast or touch bounds |
| An intentionally retro style | A defect needing flat SaaS cards, a new font or framework |

For example, clearer figures in the same room can satisfy figure polish without resolving a broader court complaint. Name both scopes.

Guidance is not an executable guarantee or aesthetic score. Automate only objective checks; never claim unmeasured results.
