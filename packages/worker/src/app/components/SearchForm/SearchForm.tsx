import { Label } from '../ui/label'
import {
  SidebarGroup,
  SidebarGroupContent,
  SidebarInput,
} from '../ui/sidebar'
import { SearchIcon } from 'lucide-react'

interface SearchFormProps extends React.ComponentProps<'form'> {
  value: string
  onValueChange: (value: string) => void
}

export default function SearchForm({ value, onValueChange, ...props }: SearchFormProps) {
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
            className="pl-8"
            value={value}
            onChange={e => onValueChange(e.target.value)}
          />
          <SearchIcon
            className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 opacity-50 select-none"
          />
        </SidebarGroupContent>
      </SidebarGroup>
    </form>
  )
}
