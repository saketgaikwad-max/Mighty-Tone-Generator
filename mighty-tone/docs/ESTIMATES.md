# Mighty Tone Generator — Estimates

Companion to [PLAN.md](./PLAN.md) §7.

## Assumptions

1. **Token definition:** total input + output tokens processed by all agents, including re-reading files and test
   output, *excluding* the multiplier from prompt-cache reads. Usage dashboards that count cache reads
   can show 3–8× higher "processed" totals for long agentic sessions; billed cost is usually much closer to these
   numbers because cache reads are cheap.
2. **Effort levels:** high = deeper reasoning, more verification loops (~1.5–2× tokens of medium for the same task).
3. **Parallel overhead:** 15–25% added per phase for ORCH coordination, contract reading by each worker,
   duplicated context, merge conflict resolution and QA reviews (inside the 10–30% band given earlier; at the low
   end for serial phases, high end for P1–P3 with 4 concurrent workers).
4. **Wall-clock** = agent working time with up to 4 workers in parallel; it excludes waiting on user checkpoints.
   Calendar time depends mostly on how quickly U1/U3/U4/U7 happen.
5. Scope = everything in PLAN.md Phases 0–6; parked items excluded. Knowledge content (references, vocabulary,
   rules) is the most elastic line: ±40%.
6. One rework loop per gate is assumed (typical: codec offset fix after U3, engine tuning after U4).

## Per-phase estimate

| Phase | Main workers (effort) | Agent wall-clock | Tokens (M) | Notes |
| --- | --- | --- | --- | --- |
| P0 Setup & spikes | W1 (M), W2 (H), W8 (M), ORCH (H) | 3–6 h | 0.6–1.0 | Spikes are cheap but decisive. |
| P1 Foundations | W2 (H), W5 (M), W6 (M), W7 (H), QA (H) | 6–12 h | 2.0–3.5 | Codec + DSP core dominate; includes U3 rework loop. |
| P2 Engine MVP + core loop | W3 (H), W4 (H), W6 (H), QA (H) | 8–16 h | 2.8–4.8 | Largest phase; eval suite v1 (~80 cases). |
| P3 Iteration/versions/library/profile | W3 (H), W4 (M), W5 (M), W6 (H), QA (H) | 8–14 h | 2.2–3.8 | Timeline/diff/branch UI is the costliest UI. |
| P4 References & LLM | W8 (M), W4 (H), W6 (M), QA (M) | 4–8 h | 1.2–2.2 | Reference library content is elastic. Runs in parallel with P3. |
| P5 IR prep & IR flow | W7 (H), W6 (M), W8 (M), QA (H) | 6–12 h | 1.6–3.0 | WLS FIR + verification corpus. Runs in parallel with P3/P4. |
| P6 Hardening & release | W1 (M), W6 (M), ORCH (M), QA (H) | 4–8 h | 1.0–2.0 | Final audit, docs, release. |
| **Total** | | **sum 39–76 h; critical path ≈ 30–56 h** | **11.4–20.3** | Central estimate ≈ 15 M. |

Breakdown of the central ~15 M by role: workers ≈ 10.5 M (70%), QA ≈ 2.3 M (15%), ORCH ≈ 1.5 M (10%),
rework buffer ≈ 0.7 M (5%).

## Why higher than the earlier 8–15 M guidance

| Added scope | Δ tokens (central) |
| --- | --- |
| IR prep DSP (WLS FIR, min-phase, resampler, residual EQ, chart, verification corpus) | +1.8 M |
| Version DAG, diffs, branching, lock-a-block UI | +1.0 M |
| Variants with diversity selection | +0.4 M |
| Delay helper with per-model tables and BPM-only edits | +0.3 M |
| Built-in reference library + Gemini/handoff/paste-back | +0.9 M |
| Traceability + UX checks by a dedicated QA agent | +0.6 M |

## Ways to reduce cost

- Run P4/P5 at medium effort except W7's FIR design and QA DSP verification (−1.0 to −1.5 M).
- Cap the initial reference library at 40 entries and grow it later via the data files (−0.4 M).
- Keep max concurrency at 3 in P1–P3 (−5–8% overhead, +15–20% wall-clock).
- Reuse Playwright screenshot baselines instead of re-generating per phase.

## Calendar

With prompt user checkpoints: about 2 weeks. With typical delays (amp testing at weekends, Mighty Editor sessions):
3–4 weeks. Earliest usable build (core loop on iPhone, no IR tool/LLM): end of Phase 2, roughly 20–35 agent hours
from start.
