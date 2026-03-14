# Paperclip Priorities For Meet AI

## Context

This document turns the Paperclip research into a ranked recommendation list for Meet AI. It captures where the research agents agreed, where they disagreed, and what should actually make the roadmap.

Inputs:

- upstream Paperclip docs and repo surfaces
- [docs/research/paperclip-features.md](/Users/isnifer/www/meet-ai/docs/research/paperclip-features.md)
- [docs/research/paperclip-priority-list.md](/Users/isnifer/www/meet-ai/docs/research/paperclip-priority-list.md)
- room discussion from `researcher-1` and `researcher-2` on March 14, 2026

This file is the final Codex synthesis. It uses the researcher outputs as inputs, but it is not required to mirror their ranking exactly.

## Ranking Rubric

Every feature below was ranked against five questions:

1. Does this solve a real operator pain in Meet AI today?
2. Does it fit the existing room-first architecture?
3. Can it ship without introducing a second product inside Meet AI?
4. Does it increase visibility, control, or coordination quality?
5. Is the implementation cost proportionate to the user value?

## Discussion Summary

### Clear agreement

The research tracks converged on these themes:

- cost tracking is the highest-value missing surface
- Meet AI needs a durable activity log, not just ephemeral raw logs
- task ownership and priority should be stronger than they are today
- quote reply is preferable to full threading for the current room UX
- Paperclip's full heartbeat/org-chart/company model should not be copied
- approvals are worth extending because Meet AI already has review primitives

### Real debates

#### Threaded replies vs quote replies

One view favored threaded replies because room traffic can interleave badly. The counterpoint was that full threading is heavy for Meet AI's current chat model. Resolution: keep the recommendation lightweight and frame it as quote reply or message references rather than deep nested threads.

#### Atomic checkout priority

One view treated duplicate work prevention as medium value; another argued orchestration already reduces collisions. Resolution: keep checkout protection in the top 10, but place it near the bottom because it matters more after task ownership becomes richer.

#### New ideas raised during discussion

`researcher-1` proposed:

- system prompt versioning
- command palette
- room templates

These are reasonable ideas, but they are not the strongest Paperclip-derived opportunities for Meet AI right now. They did not make the final top 10.
System prompt versioning is the one idea from this set that is still worth keeping as an honorable mention for a later pass.

#### Intentional ranking differences

The researcher consensus ultimately elevated `@mention` routing and system prompt versioning into the top 10. This synthesis keeps them below the cut line because it optimizes for the shortest path from Meet AI's current room/task/review surfaces to higher operator leverage, with the least product-model drift.

## Top 10 Features

### 1. Lightweight cost tracking

Why it ranks first:

- highest operator value
- zero ambiguity about user demand
- directly inspired by Paperclip's strong cost visibility
- fits Meet AI without forcing budget hierarchies yet

### 2. Structured activity and audit log

Why it ranks second:

- complements chat rather than replacing it
- gives rooms a durable operational history
- pairs naturally with tasks, approvals, and agent presence

### 3. Richer tasks with priority, assignee, timestamps, sub-task support, and claim semantics

Why it ranks third:

- builds on an existing Meet AI surface
- captures one of Paperclip's best lessons without copying its full issue tracker
- immediately improves multi-agent coordination inside a room

### 4. Dashboard and room-health metrics

Why it ranks fourth:

- creates an at-a-glance operator view
- low product risk
- becomes much more valuable once cost/activity/task data is stronger

### 5. Goal and context alignment for rooms and tasks

Why it ranks fifth:

- adapts Paperclip's goal ancestry into a form that fits Meet AI
- improves agent behavior without introducing company abstractions
- gives rooms a clearer operating brief

### 6. Operator controls for pause, reassign, and block

Why it ranks sixth:

- strong fit with Meet AI's human-in-the-loop posture
- extends current plan/permission review ideas
- useful once agent status and task ownership are clearer

### 7. Extended approval gates

Why it ranks seventh:

- existing plan and permission review endpoints make this a natural extension
- higher leverage than importing a separate governance subsystem
- should stay scoped to concrete risky actions

### 8. Task-level trace view

Why it ranks eighth:

- borrows the best part of Paperclip's run/transcript visibility
- keeps execution detail attached to the work item that matters
- more useful after activity and tasks become canonical

### 9. Quote reply or message reference support

Why it ranks ninth:

- solves a real room-clarity problem
- does not require a full threaded-chat rewrite
- useful, but less strategic than task/control-plane improvements

### 10. Atomic task checkout

Why it ranks tenth:

- good safety feature
- limited value until tasks are richer and more actively claimed by multiple agents
- still worth keeping on the roadmap to prevent duplicate work

## Top 5 To Start With

If Meet AI only takes five things from Paperclip, they should be:

1. Lightweight cost tracking
2. Structured activity and audit log
3. Richer task model
4. Dashboard and room-health metrics
5. Goal/context alignment

This set gives the largest operator benefit with the least product-model drift.

## Features Explicitly Rejected

### Heartbeat protocol as the default model

Meet AI should stay interactive and room-driven rather than schedule-driven.

### Org chart and reporting hierarchy

This is too heavy for the current product and would distort the room-centric UX.

### Company and board metaphor

Useful mechanics are already captured by approvals and operator controls. The metaphor itself is not needed.

### Full issue tracker, Kanban board, and Linear-style expansion

This would create a second product inside Meet AI and weaken the chat-first model.

### Agent adapter platform

Paperclip's adapter registry is valuable for Paperclip, but Meet AI should remain communication-first rather than runtime-governance-first.

### Secrets management as product work

Not worth pulling into scope.

### Company templates and multi-company portfolio management

Too far from current Meet AI usage and too expensive in platform surface area.

### Better Auth migration just because Paperclip uses it

The auth stack is not the lesson to copy here.

## Honorable Mentions

- system prompt versioning
- `@mention` targeting improvements
- command palette polish
- room or workflow templates

## Recommended Rollout Order

### Phase 1

- richer tasks
- cost tracking
- activity log

### Phase 2

- dashboard metrics
- goal/context alignment
- operator controls

### Phase 3

- extended approval gates
- task-level trace view
- quote reply support
- atomic checkout

## Final Recommendation

Meet AI should copy Paperclip's control-plane discipline, not its full product shape.

The right strategy is:

- keep rooms as the core primitive
- make tasks more canonical
- make operator visibility much stronger
- add lightweight governance where Meet AI already has review surfaces
- reject the impulse to become a company-OS clone
