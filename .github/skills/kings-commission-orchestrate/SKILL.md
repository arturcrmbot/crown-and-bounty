---
name: kings-commission-orchestrate
description: >
  How to run the work on Crown & Bounty (arturcrmbot/crown-and-bounty): agree the finish line with
  Artur and keep it, one local session per issue, new ideas and balance routed rather than started,
  sessions watched from the start, and short messages. Use when coordinating work on this game,
  planning a day's work, running playtests, or running several sessions at once. Learnt the hard way
  on 29 Sep 2026.
---

# Run the work on Crown & Bounty

Artur wants to play his game. On 29 Sep, "a ridiculously painful day", he waited hours for it: the
finish line kept moving, the morning went on a cloud factory, every idea became a session at once,
and sessions ran half-hour simulations around every change. What worked: one local session per
issue, CI on each PR, sessions merging their own PRs, playtest reports recorded as issues, and one
balance session that analysed first and built after he agreed. This is how to keep what worked. Each
session builds and ships by `.github/skills/kings-commission-ship/SKILL.md`.

## The finish line first

- Before anything starts, agree with Artur what "playable" means for this batch (which issues) and
  roughly when. Then don't add gates or move it: not a test run first, then both playtests, then all
  the content. Anything new goes after it (see Scope).
- Give honest times, CI included: its PR jobs take about 10 to 15 minutes, and main deploys a few
  minutes after the merge. If a time slips, say so at once, and why.
- Never block him from playing. Main is live at https://arturcrmbot.github.io/crown-and-bounty/: tell
  him what's live now and what's coming, and let him play while the rest lands.

## The flow

1. **An issue** says what and why, with a "Done when" (the Feature form has one; give a bug one too).
2. **One local session per issue**, each in its own worktree, on Claude Opus 5.5 at max reasoning with
   long context: `create_session` with `base_branch` unset, and a kickoff (see Kickoff prompts) with
   `model: "claude-opus-5.5"`, `reasoning_effort: "max"`, `context_tier: "long_context"` and
   `mode: "autopilot"`.
3. **Cheap local checks**: the ship skill's Check step.
4. **A PR** with `Fixes #N` (or `Part of #N`).
5. **CI's three jobs green** ("Typecheck, unit tests, build", "The bot plays whole commissions",
   "Play-through and playtests"), then the session merges its own PR: `gh pr merge N --squash`.
6. **Main deploys**, and the coordinator archives the session (`archive_session`).

No cloud agents: no cloud sessions, no coding agent on GitHub, no factories. On 29 Sep a cloud factory
took the morning (approvals, holds, a sandbox without packages, Actions billing) before any game
work. Everything runs on this Mac, and nobody pushes to main.

## Scope

- Finish what's in flight before starting more.
- A new idea (Artur's, a playtest's or a session's) goes into an issue labelled `later`, not a new
  session. Ask Artur before widening the batch.
- A playtest is a session that plays main through the real UI (the ship skill's "Playtest like an
  experienced gamer") and records its report as a `playtest` issue. Then:
  - Its bugs go to one fix session for the batch, and one PR: #137 fixed the Knight playtest's three.
  - Its design changes are ranked tick boxes in that issue, for Artur's call (see #119 and #129).
    Nothing is built until he picks; each change he picks becomes its own issue, named in its box
    ("Now #124 and #125").

## Roles

- **The coordinator routes work; it doesn't design or build.** It agrees the finish line, writes the
  issues, starts and watches the sessions, and talks to Artur. It writes no game code and sets no
  numbers.
- **Design calls go to Artur**, or to a design session he's talking to.
- **Balance belongs to one balance session.** It analyses first and reports (what the numbers say, the
  options, what it would change), and builds only after Artur agrees. Every balance question goes to
  it.

## Time and cost

- **Long simulations only for changes that move balance**, with at most 10 seeds a background
  (`npm run sim -- 10`; the default is 30). UI, content and bug changes skip them: CI's bot job
  catches regressions. On 29 Sep sessions spent 18 to 30 minutes on full simulations before and after
  every change.
- **Keep PRs small:** one issue each, or one playtest's bugs.
- **Sequence sessions that would edit the same file:** the second starts once the first has merged.
- **The repo is public, so Actions is free.** If it's ever private again, watch the minutes.

## While Artur plays

No save-version bumps (`VERSION` in `src/game/save.ts`): a bump drops his game. New places reach old
saves through `withNewPlaces` (`rules/campaign.ts`), and anything else new must load from an old save
too.

## Monitoring from the start

When the first session starts, not when Artur asks, give the coordinator a session automation every
20 minutes (`save_session_automation`, `interval: "minutes"`, `every_minutes: 20`). Each time it:

- checks every session (`get_sessions_status`), and unblocks any that are waiting;
- merges green PRs (`gh pr checks N`, then `gh pr merge N --squash`);
- sends red ones back to their session with the failing log (`gh run view ID --log-failed`, then
  `send_session_message`);
- archives finished sessions, merged with nothing left in flight (Artur's standing permission);
- watches main's CI (`gh run list --branch main --limit 3`): a red main opens a `ci` issue by itself,
  and it goes to a fix session at once;
- tells Artur nothing unless it's a milestone or a call only he can make.

Clear it (`clear: true`) when the batch is done.

## Talking to Artur

- **Keep it short:** one message per milestone (something new to play, a call only he can make, the
  batch done), with the live link. No status spam.
- **Read his words exactly.** On 29 Sep "don't start until the playtest is back" was misread. If
  something is ambiguous, ask in one line.
- **Put all the context in the question** when asking with a question box (`ask_user`): the text above
  it is hidden.
- **Say so plainly when you got something wrong**, and what you're doing about it.

## Kickoff prompts

Sessions can't see the coordinator's chat, so each kickoff prompt carries:

- the full context: what Artur wants and why, in his words where you have them;
- the issue (`#N`) and its "Done when";
- these rules: start with `git fetch origin && git reset --hard origin/main`; read `AGENTS.md` and the
  ship skill first; cheap checks, and simulations only for balance, at most 10 seeds; no save-version
  bumps; a small PR with `Fixes #N`, merged by the session once CI's three jobs are green; never push
  to main;
- "Don't ask Artur": decide, and say what you assumed;
- "Report back in a few lines" once it's merged: what changed, the PR, and anything left over.
