import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { Search, Briefcase, HardHat, Layers, Tag, FileText, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Result =
  | { kind: "project"; id: string; title: string; subtitle?: string }
  | { kind: "contractor"; id: string; title: string; subtitle?: string; projectId?: string }
  | { kind: "department"; id: string; title: string; subtitle?: string }
  | { kind: "category"; id: string; title: string; subtitle?: string }
  | {
      kind: "sheet";
      id: string;
      title: string;
      subtitle?: string;
      projectId: string;
      date: string;
    }
  | { kind: "user"; id: string; title: string; subtitle?: string };


const LIMIT = 8;

async function searchAll(term: string): Promise<Result[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  const like = `%${q}%`;

  const [projects, contractors, depts, cats, sheets] = await Promise.all([
    supabase
      .from("projects")
      .select("id,name,code,project_group")
      .or(`name.ilike.${like},code.ilike.${like},project_group.ilike.${like}`)
      .order("name")
      .limit(LIMIT),
    supabase
      .from("contractors")
      .select("id,company_name,contractor_code,contact_person,phone,contact_number")
      .or(
        `company_name.ilike.${like},contractor_code.ilike.${like},contact_person.ilike.${like},phone.ilike.${like},contact_number.ilike.${like}`
      )
      .order("company_name")
      .limit(LIMIT),
    supabase
      .from("departments")
      .select("id,name,department_code")
      .or(`name.ilike.${like},department_code.ilike.${like}`)
      .order("name")
      .limit(LIMIT),
    supabase
      .from("worker_categories")
      .select("id,name,category_code,category_group")
      .or(`name.ilike.${like},category_code.ilike.${like}`)
      .order("name")
      .limit(LIMIT),
    supabase
      .from("daily_manpower_sheets")
      .select("id,sheet_code,entry_date,project_id,project:projects(name,code)")
      .ilike("sheet_code", like)
      .order("entry_date", { ascending: false })
      .limit(LIMIT),
  ]);

  // For contractors, look up one project they belong to (so the contractors
  // page can preselect it — that page is project-scoped).
  const contractorRows = contractors.data || [];
  let contractorProjectMap: Record<string, string> = {};
  if (contractorRows.length) {
    const ids = contractorRows.map((c: any) => c.id);
    const { data: links } = await supabase
      .from("project_contractors")
      .select("contractor_id,project_id")
      .in("contractor_id", ids);
    (links || []).forEach((l: any) => {
      if (!contractorProjectMap[l.contractor_id]) {
        contractorProjectMap[l.contractor_id] = l.project_id;
      }
    });
  }

  const out: Result[] = [];

  (projects.data || []).forEach((p: any) =>
    out.push({
      kind: "project",
      id: p.id,
      title: p.name,
      subtitle: [p.code, p.project_group].filter(Boolean).join(" · "),
    })
  );

  contractorRows.forEach((c: any) =>
    out.push({
      kind: "contractor",
      id: c.id,
      title: c.company_name,
      subtitle: [
        c.contractor_code,
        c.contact_person,
        c.contact_number || c.phone,
      ]
        .filter(Boolean)
        .join(" · "),
      projectId: contractorProjectMap[c.id],
    })
  );

  (depts.data || []).forEach((d: any) =>
    out.push({
      kind: "department",
      id: d.id,
      title: d.name,
      subtitle: d.department_code || undefined,
    })
  );

  (cats.data || []).forEach((c: any) =>
    out.push({
      kind: "category",
      id: c.id,
      title: c.name,
      subtitle: [c.category_code, c.category_group].filter(Boolean).join(" · "),
    })
  );

  (sheets.data || []).forEach((s: any) =>
    out.push({
      kind: "sheet",
      id: s.id,
      title: s.sheet_code,
      subtitle: `${s.project?.code ? s.project.code + " — " : ""}${s.project?.name || ""} · ${s.entry_date}`,
      projectId: s.project_id,
      date: s.entry_date,
    })
  );

  return out;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const reqId = useRef(0);

  // Keyboard shortcut: Cmd/Ctrl + K
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Debounced query
  useEffect(() => {
    if (!open) return;
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const id = ++reqId.current;
    const t = setTimeout(async () => {
      try {
        const data = await searchAll(term);
        if (id === reqId.current) setResults(data);
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [query, open]);

  const groups = useMemo(() => {
    return {
      project: results.filter((r) => r.kind === "project"),
      contractor: results.filter((r) => r.kind === "contractor"),
      department: results.filter((r) => r.kind === "department"),
      category: results.filter((r) => r.kind === "category"),
      sheet: results.filter((r) => r.kind === "sheet"),
    } as Record<Result["kind"], Result[]>;
  }, [results]);

  const handleSelect = (r: Result) => {
    setOpen(false);
    setQuery("");
    switch (r.kind) {
      case "project":
        navigate({ to: "/masters/projects", search: { highlight: r.id } as any });
        break;
      case "contractor": {
        const search: any = { highlight: r.id };
        if ((r as any).projectId) search.project = (r as any).projectId;
        navigate({ to: "/masters/contractors", search });
        break;
      }
      case "department":
        navigate({ to: "/masters/departments", search: { highlight: r.id } as any });
        break;
      case "category":
        navigate({ to: "/masters/categories", search: { highlight: r.id } as any });
        break;
      case "sheet":
        navigate({
          to: "/daily-entry",
          search: { project: r.projectId, date: r.date } as any,
        });
        break;
    }
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        className="h-9 gap-2 text-muted-foreground justify-start px-2 md:px-3 md:w-64"
        onClick={() => setOpen(true)}
        aria-label="Open global search"
      >
        <Search className="h-4 w-4" />
        <span className="hidden md:inline text-sm">Search anything…</span>
        <kbd className="hidden md:inline ml-auto pointer-events-none select-none rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium">
          ⌘K
        </kbd>
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search projects, contractors, SC codes, sheets…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {query.trim().length < 2 ? (
            <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>
          ) : loading ? (
            <CommandEmpty>Searching…</CommandEmpty>
          ) : results.length === 0 ? (
            <CommandEmpty>No results found.</CommandEmpty>
          ) : null}

          {groups.project.length > 0 && (
            <CommandGroup heading="Projects">
              {groups.project.map((r) => (
                <CommandItem
                  key={`p-${r.id}`}
                  value={`project ${r.title} ${r.subtitle || ""}`}
                  onSelect={() => handleSelect(r)}
                >
                  <Briefcase className="mr-2 h-4 w-4 text-primary group-data-[selected=true]:text-accent-foreground" />
                  <div className="flex flex-col">
                    <span className="font-medium">{r.title}</span>
                    {r.subtitle && (
                      <span className="text-xs text-muted-foreground group-data-[selected=true]:text-accent-foreground/80">{r.subtitle}</span>
                    )}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {groups.contractor.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Contractors">
                {groups.contractor.map((r) => (
                  <CommandItem
                    key={`c-${r.id}`}
                    value={`contractor ${r.title} ${r.subtitle || ""}`}
                    onSelect={() => handleSelect(r)}
                  >
                    <HardHat className="mr-2 h-4 w-4 text-accent group-data-[selected=true]:text-accent-foreground" />
                    <div className="flex flex-col">
                      <span className="font-medium">{r.title}</span>
                      {r.subtitle && (
                        <span className="text-xs text-muted-foreground group-data-[selected=true]:text-accent-foreground/80">{r.subtitle}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {groups.department.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Category of Labour">
                {groups.department.map((r) => (
                  <CommandItem
                    key={`d-${r.id}`}
                    value={`department ${r.title} ${r.subtitle || ""}`}
                    onSelect={() => handleSelect(r)}
                  >
                    <Layers className="mr-2 h-4 w-4 text-chart-3 group-data-[selected=true]:text-accent-foreground" />
                    <div className="flex flex-col">
                      <span className="font-medium">{r.title}</span>
                      {r.subtitle && (
                        <span className="text-xs text-muted-foreground group-data-[selected=true]:text-accent-foreground/80">{r.subtitle}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {groups.category.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Categories">
                {groups.category.map((r) => (
                  <CommandItem
                    key={`cat-${r.id}`}
                    value={`category ${r.title} ${r.subtitle || ""}`}
                    onSelect={() => handleSelect(r)}
                  >
                    <Tag className="mr-2 h-4 w-4 text-chart-4 group-data-[selected=true]:text-accent-foreground" />
                    <div className="flex flex-col">
                      <span className="font-medium">{r.title}</span>
                      {r.subtitle && (
                        <span className="text-xs text-muted-foreground group-data-[selected=true]:text-accent-foreground/80">{r.subtitle}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}

          {groups.sheet.length > 0 && (
            <>
              <CommandSeparator />
              <CommandGroup heading="Daily Entry Sheets">
                {groups.sheet.map((r) => (
                  <CommandItem
                    key={`s-${r.id}`}
                    value={`sheet ${r.title} ${r.subtitle || ""}`}
                    onSelect={() => handleSelect(r)}
                  >
                    <FileText className="mr-2 h-4 w-4 text-chart-2 group-data-[selected=true]:text-accent-foreground" />
                    <div className="flex flex-col">
                      <span className="font-medium">{r.title}</span>
                      {r.subtitle && (
                        <span className="text-xs text-muted-foreground group-data-[selected=true]:text-accent-foreground/80">{r.subtitle}</span>
                      )}
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
