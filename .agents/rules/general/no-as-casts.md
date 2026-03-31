# No `as` Type Casts

## Rule

Never use `as` type assertions in TypeScript. They bypass the compiler's type checking and hide bugs.

## What is forbidden

```ts
// ❌ All of these are banned
const data = response as UserData
const input = parsed as unknown as PermissionRequestInput
const result = value as any
```

## What to do instead

### Use Zod schemas + `safeParse` for external data

```ts
// ✅ Schema validates at runtime, type is inferred
const result = UserDataSchema.safeParse(response)
if (!result.success) return Result.err(new ValidationError({ ... }))
const data = result.data // correctly typed
```

### Use type guards for narrowing

```ts
// ✅ Runtime check that satisfies the compiler
if (Result.isOk(result)) {
  result.value // correctly narrowed
}
```

### Use `satisfies` for type checking without assertion

```ts
// ✅ Checks the type without widening or asserting
const config = { ... } satisfies AppConfig
```

## Why

- `as` casts tell the compiler "trust me" — but the compiler is smarter than us
- They hide shape mismatches that Zod schemas would catch at runtime
- They make refactoring dangerous — renaming a field won't produce a type error if `as` was used
- In the `packages/domain` package especially, schema-first parsing with `z.infer` types eliminates all need for `as` casts

## Exceptions

- `export { default as Name }` re-export aliases are NOT type casts — these are fine
- `as const` assertions are fine — they narrow types, not widen them
