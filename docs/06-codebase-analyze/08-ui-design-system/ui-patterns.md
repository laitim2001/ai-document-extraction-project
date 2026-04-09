# UI Design System & Frontend Patterns Analysis

> Analyzed: 2026-04-09 | Source: Verified from codebase

---

## 1. Design System Foundation

### Tailwind Configuration (`tailwind.config.ts`)

- **Dark mode**: Class-based (`darkMode: ['class']`)
- **Plugin**: `tailwindcss-animate` (animation utilities for Radix transitions)
- **Border radius**: CSS variable-driven (`--radius: 0.5rem`), with `lg/md/sm` computed offsets
- **Custom colors**: All semantic colors reference HSL CSS variables (e.g., `hsl(var(--primary))`)
- **Domain-specific tokens**: `confidence.high/medium/low` colors for the triple-encoding confidence system

### CSS Variables (`src/app/globals.css`)

Two complete HSL palettes defined: `:root` (light) and `.dark` (dark mode). Key variables:

| Token | Light | Dark |
|-------|-------|------|
| `--background` | `0 0% 100%` (white) | `222.2 84% 4.9%` (near-black) |
| `--primary` | `222.2 47.4% 11.2%` (dark blue) | `210 40% 98%` (near-white) |
| `--destructive` | `0 84.2% 60.2%` (red) | `0 62.8% 30.6%` (dark red) |

Custom confidence-level CSS variables with separate `bg` and `text` variants for both themes. A `confidence-pulse` keyframe animation draws attention to low-confidence items.

### Theme Provider (`src/providers/ThemeProvider.tsx`)

Wraps `next-themes` with `attribute="class"`, `defaultTheme="system"`, `enableSystem`, and `disableTransitionOnChange`. Rendered in root layout.

### Icons

**lucide-react v0.561** is the sole icon library. Icons are imported individually per component (no barrel import). Standard sizing: `h-4 w-4` for inline, `h-5 w-5` for navigation/toolbar.

### Utility: `cn()` (`src/lib/utils.ts`)

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

Used universally across all components for conditional class merging with Tailwind conflict resolution.

---

## 2. shadcn/ui Configuration

### Config (`components.json`)

- **Style**: `default` | **Base color**: `slate` | **CSS variables**: enabled | **RSC**: true
- **Aliases**: `@/components`, `@/components/ui`, `@/lib`, `@/hooks`

### Primitives (34 components in `src/components/ui/`)

accordion, alert, alert-dialog, avatar, badge, button, calendar, card, checkbox, collapsible, command, dialog, dropdown-menu, form, input, label, month-picker, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, skeleton, slider, switch, table, tabs, textarea, toast, toaster, tooltip

### Customizations Beyond Default shadcn

| Component | Customization |
|-----------|--------------|
| `badge.tsx` | Added `warning`, `confidence-high`, `confidence-medium`, `confidence-low` variants via `cva` |
| `month-picker.tsx` | Fully custom component (Popover + year navigation + month grid) not from shadcn registry |
| `toast.tsx` | Standard shadcn with Radix toast primitives, `default` and `destructive` variants |

All other UI primitives are unmodified shadcn defaults. Custom behavior is implemented via wrapper components in `src/components/features/`.

---

## 3. Frontend Patterns

### 3A. Form Pattern (React Hook Form + Zod + shadcn Form)

**Standard stack**: `useForm` + `zodResolver` + shadcn `<Form>`, `<FormField>`, `<FormItem>`, `<FormLabel>`, `<FormControl>`, `<FormMessage>`.

**Canonical example** (`ExchangeRateForm.tsx`):

```tsx
const formSchema = z.object({
  fromCurrency: z.string().length(3),
  rate: z.string().min(1).refine((val) => !isNaN(Number(val)) && Number(val) > 0),
  effectiveYear: z.number().int().min(2000).max(2100),
});
type FormValues = z.infer<typeof formSchema>;

const form = useForm<FormValues>({
  resolver: zodResolver(formSchema),
  defaultValues: { fromCurrency: '', rate: '', effectiveYear: new Date().getFullYear() },
});
```

**Validation display**: `<FormMessage />` renders error text below each field in `text-sm font-medium text-destructive`. For simpler forms without `<Form>` wrapper (e.g., `LoginForm`), inline `<p className="text-sm text-destructive">` is used with `errors.fieldName.message`.

**Submit pattern**: Async `onSubmit` with loading state, `toast()` for success/error feedback, `router.push()` or `onSuccess` callback for navigation.

### 3B. Table Pattern (@tanstack/react-table)

**Usage**: Near-zero adoption -- only 1 file (`AuditResultTable.tsx`) out of 371 component files (0.3%). All other list views use plain shadcn `<Table>` directly without react-table. No shared `DataTable` wrapper exists.

**react-table pattern** (`AuditResultTable.tsx`):

```tsx
const table = useReactTable({
  data,
  columns,
  getCoreRowModel: getCoreRowModel(),
  getSortedRowModel: getSortedRowModel(),
  getFilteredRowModel: getFilteredRowModel(),
  state: { globalFilter, sorting },
  onGlobalFilterChange: setGlobalFilter,
  onSortingChange: setSorting,
});
```

Column definitions use `useMemo` with `ColumnDef<T>[]`. Sortable headers render ghost `<Button>` with `<ArrowUpDown>` icon. Pagination is server-driven (page/pageSize props) with prev/next buttons, not react-table's built-in pagination.

**No shared DataTable wrapper** exists -- each table component implements its own rendering loop with `flexRender`.

### 3C. Dialog/Modal Pattern

**Standard dialog** (shadcn Radix-based):

```tsx
<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>{t('dialog.title')}</DialogTitle>
      <DialogDescription>{t('dialog.desc')}</DialogDescription>
    </DialogHeader>
    {/* Body content */}
    <DialogFooter>
      <Button variant="outline" onClick={onCancel}>{t('cancel')}</Button>
      <Button onClick={onConfirm}>{t('confirm')}</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**Confirmation dialog** (`ReferenceNumberDeleteDialog.tsx`): Uses `AlertDialog` with `AlertDialogAction` styled `bg-destructive`. Open state controlled by nullable ID prop (`open={!!id}`).

**Form-in-dialog** (`CreateInstanceDialog.tsx`): Full `<Form>` with `useForm` + `zodResolver` nested inside `<DialogContent>`. Dialog open state reset clears form via `form.reset()`. Submit disables button and shows `<Loader2 className="animate-spin" />`.

### 3D. Data Fetching Pattern (React Query)

**Standard hook structure** (`use-documents.ts`):

```tsx
export const documentsQueryKeys = {
  all: ['documents'] as const,
  list: (params) => ['documents', 'list', params] as const,
  detail: (id: string) => ['documents', 'detail', id] as const,
};

export function useDocuments(params: UseDocumentsParams = {}) {
  const queryClient = useQueryClient();
  const query = useQuery<DocumentsResponse>({
    queryKey: documentsQueryKeys.list(params),
    queryFn: async () => {
      const res = await fetch(`/api/documents?${searchParams}`);
      if (!res.ok) throw new Error((await res.json()).error);
      return res.json();
    },
    refetchInterval: (query) => hasProcessingDocuments(...) ? 5000 : 30000,
    staleTime: 2000,
  });
  // ...
}
```

**Key patterns observed**:
- Query key factory objects for consistent cache management
- Dynamic `refetchInterval` (5s while processing, 30s idle)
- `staleTime: 2000` (2s) as common default
- Mutations use `invalidateQueries` on success (not optimistic updates -- no `onMutate` rollback patterns found)
- Return spread: `{ ...query, retry: retryMutation.mutate }` pattern to expose mutations alongside query

**Loading states**: `Skeleton` component (`animate-pulse rounded-md bg-muted`), custom spinners (`animate-spin rounded-full border-b-2 border-primary`), and button-level `<Loader2 className="animate-spin" />`.

**Error feedback**: `useToast()` hook with `toast({ variant: 'destructive', title, description })`.

---

## 4. Layout & Responsive Design

### Dashboard Layout (`DashboardLayout.tsx`)

Two-mode sidebar with responsive breakpoint at `lg` (1024px):

| Viewport | Sidebar | Behavior |
|----------|---------|----------|
| >= `lg` | Fixed left (`lg:fixed lg:inset-y-0`), 72px collapsed / 288px expanded | Toggle via chevron button |
| < `lg` | Hidden; hamburger menu opens overlay with backdrop | Escape key closes, body scroll locked |

```tsx
<div className={cn(
  'hidden lg:fixed lg:inset-y-0 lg:flex',
  isSidebarCollapsed ? 'lg:w-16' : 'lg:w-72'
)}>
```

Main content uses `lg:pl-72` / `lg:pl-16` with `transition-all duration-300`. Max width: `max-w-[1600px]`.

### TopBar Responsive Patterns

- Mobile menu button: `lg:hidden mr-2`
- Search bar: `w-full max-w-lg lg:max-w-xs`
- User name/email: `hidden lg:block`
- Spacing: `space-x-2 sm:space-x-4`

### Sidebar Collapsed State

When collapsed, nav items show only icons centered with `<Tooltip>` on hover (side="right"). Section dividers use `<Separator>` instead of text headers. Version info hidden.

### Responsive Form Layouts

Grid-based: `grid grid-cols-1 sm:grid-cols-2 gap-4` for side-by-side date fields. Flex-based: `flex items-end gap-4` with `flex-1` children for currency pair selectors.

### No Responsive Tables

Tables use `overflow-auto` wrapper (`<div className="relative w-full overflow-auto">`) for horizontal scrolling on small screens. No column hiding or stacking for mobile.

---

## 5. State Management

### Zustand (UI State) -- 2 stores

| Store | Purpose |
|-------|---------|
| `reviewStore.ts` | PDF review UI: selected field, page, zoom, dirty fields, pending corrections |
| `document-preview-test-store.ts` | Dev tool state for document preview testing |

Zustand pattern uses `create<State>((set, get) => ({...}))` with immutable updates (new `Set`/`Map` instances). No middleware (persist, devtools) observed.

### React Query (Server State) -- 101 hooks

Organized by domain (12 categories). Standard pattern: `useQuery` for reads, `useMutation` + `invalidateQueries` for writes.

---

## 6. Accessibility

### Built-in from shadcn/Radix

All shadcn components inherit Radix UI's accessibility primitives:
- **Form**: `aria-describedby` linking to description/error IDs, `aria-invalid` on error
- **Dialog**: Focus trap, `DialogDescription` for screen readers, close button with `<span className="sr-only">Close</span>`
- **AlertDialog**: Semantic alert dialog role for confirmations
- **Toast**: Radix toast with swipe gestures and proper ARIA live regions

### Manual Accessibility Patterns (verified in layout components)

- `sr-only` screen reader text on icon-only buttons (menu, theme toggle, notifications)
- `aria-hidden="true"` on decorative search icon
- `htmlFor` on search label (screen-reader only)
- `role="combobox"` + `aria-expanded` on MonthPicker trigger
- Escape key handler for mobile sidebar overlay
- Body scroll lock when modal overlay open

### Gaps Noted

- `AuditResultTable` does not declare `role="table"` or use `aria-sort` on sortable columns (relies on native `<table>` semantics)
- No skip-to-content link found in layout
- Keyboard navigation for sidebar items not explicitly implemented beyond native link behavior

---

## 7. Domain-Specific UI: Confidence Triple-Encoding

A standout design pattern is the confidence score visualization system that uses three simultaneous visual channels:

1. **Color** -- Green/Yellow/Red via `confidence-high/medium/low` badge variants
2. **Text label** -- "High/Medium/Low Confidence" (bilingual via `locale` prop)
3. **Numeric score** -- Optional percentage display

```tsx
<ConfidenceBadge score={95} showScore locale="zh" size="md" />
// Renders: green badge "高信心 95%"
```

CSS variables (`--confidence-high-bg`, `--confidence-low-text`, etc.) provide theme-aware backgrounds with separate dark mode values.

---

## Summary Statistics

| Metric | Count |
|--------|-------|
| shadcn/ui primitives | 34 |
| Feature component directories | 37 |
| Total component files | 356+ |
| Custom hooks | 101 |
| Zustand stores | 2 |
| Icon library | lucide-react v0.561 |
| CSS framework | Tailwind 3.4 + tailwindcss-animate |
| Form stack | React Hook Form + Zod + shadcn Form |
| Table library | @tanstack/react-table (1 file only: AuditResultTable; all others use plain shadcn Table) |
| Theme engine | next-themes (class-based, system default) |
