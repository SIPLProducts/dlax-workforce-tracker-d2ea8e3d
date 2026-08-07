import { useMemo, useState } from "react";
import { ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type ProjectMultiOption = {
  id: string;
  name: string;
  code?: string | null;
};

interface Props {
  projects: ProjectMultiOption[];
  /** Empty array = all projects */
  value: string[];
  onChange: (ids: string[]) => void;
  className?: string;
  allLabel?: string;
}

const fmt = (p: ProjectMultiOption) => p.name;

export function ProjectMultiCombobox({ projects, value, onChange, className, allLabel = "All Projects" }: Props) {
  const [open, setOpen] = useState(false);
  const sortedProjects = useMemo(
    () => [...projects].sort((a, b) => a.name.localeCompare(b.name)),
    [projects]
  );
  const selectedSet = new Set(value);

  const label =
    value.length === 0
      ? allLabel
      : value.length === 1
      ? (() => {
          const p = sortedProjects.find((x) => x.id === value[0]);
          return p ? fmt(p) : "1 project selected";
        })()
      : `${value.length} projects selected`;

  const toggle = (id: string) => {
    if (selectedSet.has(id)) onChange(value.filter((v) => v !== id));
    else onChange([...value, id]);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="truncate">{label}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[280px]" align="start">
        <Command filter={(itemValue, search) => (itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0)}>
          <CommandInput placeholder="Search projects..." />
          <CommandList>
            <CommandEmpty>No project found.</CommandEmpty>
            <CommandGroup>
              <CommandItem value={allLabel} onSelect={() => onChange([])}>
                <Checkbox checked={value.length === 0} className="mr-2" />
                <span className="font-medium">{allLabel}</span>
              </CommandItem>
              {sortedProjects.map((p) => (
                <CommandItem key={p.id} value={`${p.code ?? ""} ${p.name}`} onSelect={() => toggle(p.id)}>
                  <Checkbox checked={selectedSet.has(p.id)} className="mr-2" />
                  <span className="truncate">{fmt(p)}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
