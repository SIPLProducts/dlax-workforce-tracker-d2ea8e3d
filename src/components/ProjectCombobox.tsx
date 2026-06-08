import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type ProjectOption = {
  id: string;
  name: string;
  code: string | null;
  project_group?: string | null;
};

interface Props {
  value: string;
  onChange: (id: string) => void;
  projects: ProjectOption[];
  placeholder?: string;
  includeAllOption?: boolean;
  allLabel?: string;
  disabled?: boolean;
  className?: string;
  formatLabel?: (p: ProjectOption) => string;
}

const defaultFormat = (p: ProjectOption) => `${p.code ? `${p.code} — ` : ""}${p.name}`;

export function ProjectCombobox({
  value,
  onChange,
  projects,
  placeholder = "Select project",
  includeAllOption = false,
  allLabel = "All Projects",
  disabled,
  className,
  formatLabel = defaultFormat,
}: Props) {
  const [open, setOpen] = useState(false);

  // If multiple projects render to the same label, append a short id suffix so the user can tell them apart.
  const labelCounts = new Map<string, number>();
  for (const p of projects) {
    const l = formatLabel(p);
    labelCounts.set(l, (labelCounts.get(l) || 0) + 1);
  }
  const labelFor = (p: ProjectOption) => {
    const base = formatLabel(p);
    return (labelCounts.get(base) || 0) > 1 ? `${base} · #${p.id.slice(0, 4)}` : base;
  };

  const selected =
    includeAllOption && value === "all"
      ? allLabel
      : projects.find((p) => p.id === value)
      ? labelFor(projects.find((p) => p.id === value)!)
      : "";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          disabled={disabled}
          aria-expanded={open}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className={cn("truncate", !selected && "text-muted-foreground")}>
            {selected || placeholder}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="p-0 w-[--radix-popover-trigger-width] min-w-[260px]" align="start">
        <Command
          filter={(itemValue, search) => {
            return itemValue.toLowerCase().includes(search.toLowerCase()) ? 1 : 0;
          }}
        >
          <CommandInput placeholder="Search projects..." />
          <CommandList>
            <CommandEmpty>No project found.</CommandEmpty>
            <CommandGroup>
              {includeAllOption && (
                <CommandItem
                  value={allLabel}
                  onSelect={() => {
                    onChange("all");
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === "all" ? "opacity-100" : "opacity-0")} />
                  {allLabel}
                </CommandItem>
              )}
              {projects.map((p) => {
                const label = labelFor(p);
                return (
                  <CommandItem
                    key={p.id}
                    value={`${p.code ?? ""} ${p.name} ${p.project_group ?? ""}`}
                    onSelect={() => {
                      onChange(p.id);
                      setOpen(false);
                    }}
                  >
                    <Check className={cn("mr-2 h-4 w-4", value === p.id ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
