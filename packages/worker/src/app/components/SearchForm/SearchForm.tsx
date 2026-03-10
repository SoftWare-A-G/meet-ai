import { useCallback } from 'react'
import { Label } from '../ui/label'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarInput,
} from '../ui/sidebar'
import { SearchIcon, XIcon } from 'lucide-react'

interface SearchFormProps extends React.ComponentProps<'form'> {
  value: string
  onValueChange: (value: string) => void
}

export default function SearchForm({ value, onValueChange, ...props }: SearchFormProps) {
  const handleClearMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    onValueChange('')
  }, [onValueChange])

  return (
    <form {...props} onSubmit={e => e.preventDefault()}>
      <SidebarGroup className="py-0">
        <SidebarGroupContent className="relative">
          <Label htmlFor="search" className="sr-only">
            Search
          </Label>
          <SidebarInput
            id="search"
            placeholder="Search rooms..."
            className="pl-8 pr-8"
            value={value}
            onChange={e => onValueChange(e.target.value)}
          />
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50 select-none"
          />
          {value && (
            <button
              type="button"
              aria-label="Clear search"
              className="absolute top-1/2 right-2 flex size-4 -translate-y-1/2 cursor-pointer items-center justify-center rounded-sm border-none bg-transparent text-gray-500 hover:text-gray-300"
              onMouseDown={handleClearMouseDown}
            >
              <XIcon className="size-3.5" />
            </button>
          )}
        </SidebarGroupContent>
      </SidebarGroup>
    </form>
  )
}
