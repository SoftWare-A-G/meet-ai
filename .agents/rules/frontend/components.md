# Components

## Guide

Each component should be created in a separate folder following PascalCase like `ComponentName`.
Folder should contain a file named like a component, e.g. `ComponentName.tsx`.
Also there should be an `index.ts` which re-exports `default` from a `ComponentName.tsx`.

## Structure

```
ComponentName/
  ComponentName.tsx
  index.ts
```

## Examples

```tsx
// ComponentName.tsx

interface ComponentNameProps {
  id: string
}

export default function ComponentName(props: ComponentNameProps) {
  return <div>{props.id}</div>
}
```

```ts
// index.ts
export { default } from './ComponentName'
```
