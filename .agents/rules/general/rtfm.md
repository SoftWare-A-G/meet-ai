# Never Guess Library APIs — Always RTFM

## Rule

When a task depends on library internals or third-party APIs, **read the upstream docs or source code first**. Never infer, guess, or fabricate APIs.

## Process

1. Before proposing any fix that touches a library's behavior, read the library's docs or source
2. If the docs are insufficient, read the actual source code on GitHub
3. If there is no clean documented/public API for what you need, say so directly
4. Never rationalize bad casts or type erasure as "pragmatic compromises"

## What NOT to do

- Do not infer library internals from type signatures alone
- Do not fabricate wrapper types to bypass TypeScript errors (e.g., `as never`, erased interfaces)
- Do not propose fixes based on assumptions about how a library "probably" works
- Do not approve code that violates project rules (zero `as` casts) just because it "works at runtime"
