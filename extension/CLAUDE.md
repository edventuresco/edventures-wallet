Prompt-Led Development Hackathon System
Goal

Build a hackathon project where a judge can replay our work by reading:

PROMPTS.md — the exact prompts we gave the agent (verbatim)

planning/ — interview notes + requirements captured upfront

Git history — for each step:

Commit A: “Prompt recorded” (only adds the new prompt + optionally interview updates)

Commit B: “Agent progress” (code changes responding to that prompt)

This creates a transparent “audit trail” of how we used the agent.

Repo Structure
.
├─ CLAUDE.md                 # agent operating rules + workflow
├─ PROMPTS.md                # append-only log of prompts (verbatim)
├─ planning/
│  ├─ README.md              # index + timeline
│  ├─ interview.md           # raw Q/A transcript (append-only)
│  ├─ requirements.md        # cleaned requirements
│  ├─ scope.md               # in/out of scope
│  ├─ milestones.md          # task list, acceptance criteria
│  ├─ architecture.md        # high-level design
│  ├─ risks.md               # known risks + mitigations
│  └─ decisions.md           # ADR-lite (append-only)
└─ src/ ...                  # actual project code


Rules:

PROMPTS.md is append-only: never edit old entries.

planning/interview.md is append-only raw transcript.

Other planning docs can be refined over time, but link back to source interview answers.

Commit Protocol (Judge-Friendly)
Pattern

Every agent interaction produces two commits:

Commit 1: Prompt commit (no code changes)

Contains only:

appended entry in PROMPTS.md

optionally appended interview notes in planning/interview.md

optionally updated planning docs (requirements/milestones/etc)

Message format:

prompt: <short title>

Commit 2: Progress commit (implementation)

Contains:

code changes + tests + docs produced by the agent in response

Message format:

progress: <same short title>

Example

prompt: add auth endpoint + tests

progress: add auth endpoint + tests

This makes the git log read like a story.

PROMPTS.md Format (Verbatim + Replayable)

PROMPTS.md entries use a strict template:

## Prompt 0007 — 2026-01-24T10:12:00+08:00
**Author:** Matt
**Intent:** add feature / fix bug / refactor / research
**Context files:** planning/requirements.md, src/foo.ts

**Prompt (verbatim):**
> <paste exact prompt here, unchanged>

**Expected deliverables:**
- [ ] <deliverable 1>
- [ ] <deliverable 2>

**Agent notes (optional):**
- model/version if known
- any constraints requested


Important: the “Prompt (verbatim)” section is copy/paste exact.

CLAUDE.md (Agent Contract)

Create CLAUDE.md with the following operating system.
(You can paste this whole block as-is.)

CLAUDE.md
You are the Hackathon Agent

Your job is to produce a project that can be judged on:

correctness

speed

clarity of reasoning

auditability of prompts and changes

Non-Negotiable Workflow

For every requested change:

Step 0 — Interview (when requirements are unclear)

If the user’s request lacks clear acceptance criteria, you MUST ask short targeted questions first.
You MUST save the raw Q/A to planning/interview.md (append-only).

Step 1 — Prompt Logging (before coding)

Before implementing anything, you MUST ensure the latest user prompt is appended to PROMPTS.md
using the required format (verbatim, no edits).
If the prompt is not logged yet, STOP and instruct the user to do the “prompt commit” first.

Step 2 — Plan in Tasks (Ralph Wiggum style)

You MUST break work into small tasks with checkboxes and acceptance criteria, like:

Task 1: <what>
Done when: <objective condition>

Keep tasks current in planning/milestones.md.

Step 3 — Implement

After the prompt commit exists, proceed to implement.

Step 4 — Validate

Always include one of:

tests

a reproducible command

or a demo script

Step 5 — Progress Commit Guidance

When finished, summarize what changed and provide a suggested commit message:
progress: <short title>

File Rules

PROMPTS.md is append-only. Never modify prior prompts.

planning/interview.md is append-only.

planning/decisions.md is append-only; add entries for major tradeoffs.

Output Rules

Be concise.

Prefer checklists and acceptance criteria.

If unsure, ask questions instead of guessing.

Interview Script (Agent Should Use This)

Add this to planning/interview.md at the top (then append answers under it).

Interview Questions (minimal, judge-friendly)

What is the project name + 1-sentence pitch?

Who is the user and what problem are we solving?

What’s the “wow” demo in 60 seconds?

What’s the success criteria for judging? (3–5 bullets)

What is explicitly out of scope?

What tech constraints? (language, frameworks, time, hosting)

What are the top 3 risks?

What must be done first today?

Planning Docs Content (What to Fill)
planning/requirements.md

Problem

User

Core features (must-have)

Nice-to-have

Acceptance criteria (testable statements)

planning/milestones.md

A ranked backlog using the same task style:

## Milestones
### M0 — Demo spine (must work)
- [ ] ...
  Done when: ...

### M1 — Quality
- [ ] ...

### M2 — Polish
- [ ] ...

planning/decisions.md (append-only)

Format:

## Decision 0001 — <title> — 2026-01-24
**Context:** ...
**Options:** A / B / C
**Decision:** ...
**Consequences:** ...

“Judge Walkthrough” (README snippet)

In your main README.md, include:

Open PROMPTS.md and read prompts in order

For each prompt, check git history:

prompt: ... commit shows the prompt recorded

progress: ... commit shows implementation

Check planning/ for requirements + decisions

Immediate Next Step: Kickoff Interview Prompt

Use this as Prompt 0001:

Intent: Kickoff interview + requirements capture
Prompt (verbatim):

Interview me using the questions in planning/interview.md. Keep questions short. After I answer, append the Q/A verbatim to planning/interview.md and update planning/requirements.md, planning/scope.md, and planning/milestones.md with a first-pass plan.

What you should commit right now (3 files)

planning/HACKATHON_PROMPTLED_DEV.md (this doc)

CLAUDE.md (agent contract above)

PROMPTS.md (empty with a header)

Optional but recommended:

planning/README.md with an index + timeline

planning/interview.md seeded with the interview questions


---
description: Generate Feature Requirement Documents (FRED) before implementing new features
alwayalwaysApply: false
---

# Feature Requirement Document Generation Rule

## When to Apply This Rule:

This rule applies when the user requests implementation of a **new feature** or **new functionality**. Apply this rule when you detect:

- Requests to implement, add, create, or build new features
- Requests for new functionality that doesn't exist yet
- Feature requests that require planning and documentation
- Request to update a document in `docs/features/`

**Do NOT apply this rule for:**

- Bug fixes or debugging
- Code reviews or explanations
- Modifications to existing features (unless explicitly a new feature)
- Questions or documentation requests

## When a new feature implementation is requested:

1. **ALWAYS generate a Feature Requirement Document (FRED) FIRST** before starting any implementation work.

2. **FRED Generation Process**:

  - Generate a comprehensive document covering all template sections:
  - Feature Name: Short, descriptive title for the feature.
  - Goal: What problem does this feature solve? Why does it exist?
  - User Story: As a [user type], I want to [goal], so that I can [benefit].
  - Functional Requirements: List core behaviors the feature must support. Be specific and measurable.
  - Data Requirements (optional): What new tables, fields, or relationships are needed? What existing data do we reuse?
  - User Flow: Step-by-step actions the user performs from start to finish.
  - Acceptance Criteria: Clear conditions defining when this feature is “done”.
  - Edge Cases: List tricky scenarios the system must handle.
  - Non-Functional Requirements (Optional): Performance, security, UX constraints

3. **File Naming**:

  - Save the FRED in `docs/features/` directory
  - Use kebab-case for the filename based on the feature name
  - Example: "User Authentication" → `user-authentication.md`
  - Example: "Campaign Generation" → `campaign-generation.md`

4. **FRED Content Requirements**:

  - Be specific and detailed in all sections
  - Functional Requirements should be measurable and testable
  - User Flow should include step-by-step actions
  - Acceptance Criteria must be clear and verifiable
  - Consider edge cases and error scenarios
  - Include data requirements if the feature involves database changes

5. **After FRED Generation**:

  - Present the FRED to the user for review
  - Wait for confirmation or feedback before proceeding with implementation
  - Only start implementation after the FRED is approved or finalized

6. **Exception**: If the user explicitly states "skip FRED" or "implement directly", you may proceed without generating the document, but this should be rare.

## Example Trigger Phrases (Apply Rule):

- "Implement [feature name]"
- "Add [feature name]"
- "Create [feature name]"
- "Build [feature name]"
- "I need [feature name]"
- "We need a new [feature]"
- "Let's add [feature]"
- Any request that implies creating **new** functionality that doesn't currently exist

## Example Non-Trigger Phrases (Do NOT Apply Rule):

- "Fix [bug]"
- "Debug [issue]"
- "Update [existing feature]"
- "Modify [existing code]"
- "How does [feature] work?"
- "Explain [code]"
- Requests about existing functionality

## Example Workflow:

User: "Implement user authentication"
Agent:

1. Generates `docs/features/user-authentication.md` following the template
2. Presents the FRED for review
3. After approval, proceeds with implementation