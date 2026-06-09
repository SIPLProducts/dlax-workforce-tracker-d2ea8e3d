import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
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

  const [projects, contractors, depts, cats, sheets, users] = await Promise.all([
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
    supabase
      .from("profiles")
      .select("user_id,login_id,display_name,email")
      .or(`login_id.ilike.${like},display_name.ilike.${like},email.ilike.${like}`)
      .order("login_id")
      .limit(LIMIT),
  ]);

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
  const seen: Record<string, Set<string>> = {
    project: new Set(),
    contractor: new Set(),
    department: new Set(),
    category: new Set(),
    sheet: new Set(),
    user: new Set(),
  };
  const norm = (v?: string | null) => (v || "").trim().toLowerCase();
  const take = (kind: keyof typeof seen, key: string) => {
    if (!key) return true;
    if (seen[kind].has(key)) return false;
    seen[kind].add(key);
    return true;
  };

  (projects.data || []).forEach((p: any) => {
    if (!take("project", norm(p.code) || norm(p.name))) return;
    out.push({
      kind: "project",
      id: p.id,
      title: p.name,
      subtitle: [p.code, p.project_group].filter(Boolean).join(" · "),
    });
  });

  contractorRows.forEach((c: any) => {
    if (!take("contractor", norm(c.contractor_code) || norm(c.company_name))) return;
    out.push({
      kind: "contractor",
      id: c.id,
      title: c.company_name,
      subtitle: [c.contractor_code, c.contact_person, c.contact_number || c.phone]
        .filter(Boolean)
        .join(" · "),
      projectId: contractorProjectMap[c.id],
    });
  });

  (depts.data || []).forEach((d: any) => {
    if (!take("department", norm(d.department_code) || norm(d.name))) return;
    out.push({
      kind: "department",
      id: d.id,
      title: d.name,
      subtitle: d.department_code || undefined,
    });
  });

  (cats.data || []).forEach((c: any) => {
    if (!take("category", norm(c.category_code) || norm(c.name))) return;
    out.push({
      kind: "category",
      id: c.id,
      title: c.name,
      subtitle: [c.category_code, c.category_group].filter(Boolean).join(" · "),
    });
  });

  (sheets.data || []).forEach((s: any) => {
    if (!take("sheet", norm(s.sheet_code))) return;
    out.push({
      kind: "sheet",
      id: s.id,
      title: s.sheet_code,
      subtitle: `${s.project?.code ? s.project.code + " — " : ""}${s.project?.name || ""} · ${s.entry_date}`,
      projectId: s.project_id,
      date: s.entry_date,
    });
  });

  (users.data || []).forEach((u: any) => {
    if (!take("user", norm(u.login_id) || norm(u.email) || u.user_id)) return;
    out.push({
      kind: "user",
      id: u.user_id,
      title: u.display_name || u.login_id || u.email || "User",
      subtitle: [u.login_id, u.email].filter(Boolean).join(" · "),
    });
  });


  return out;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 0 });
  const navigate = useNavigate();
  const reqId = useRef(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut: Cmd/Ctrl + K — focus the input and open the dropdown
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Click outside closes the dropdown
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapperRef.current?.contains(target)) return;
      const panel = document.getElementById("global-search-panel");
      if (panel?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  // Position the fixed overlay just below the input; track resize/scroll
  useEffect(() => {
    if (!open) return;
    const update = () => {
      const el = wrapperRef.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      setPanelPos({ top: r.bottom + 8, left: r.left, width: r.width });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, results.length]);

  // Debounced query
  useEffect(() => {
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
  }, [query]);

  const groups = useMemo(() => {
    return {
      project: results.filter((r) => r.kind === "project"),
      contractor: results.filter((r) => r.kind === "contractor"),
      department: results.filter((r) => r.kind === "department"),
      category: results.filter((r) => r.kind === "category"),
      sheet: results.filter((r) => r.kind === "sheet"),
      user: results.filter((r) => r.kind === "user"),
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
      case "user":
        navigate({ to: "/users", search: { highlight: r.id } as any });
        break;
    }
  };

  return (
    <div ref={wrapperRef} className="relative w-full md:w-72">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpen(false);
              inputRef.current?.blur();
            }
          }}
          placeholder="Search anything…"
          aria-label="Global search"
          className="h-9 pl-8 pr-12"
        />
        <kbd className="hidden md:inline-flex absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none select-none items-center rounded border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
          ⌘K
        </kbd>
      </div>

      {open && (
        <div
          id="global-search-panel"
          style={{ position: "fixed", top: panelPos.top, left: panelPos.left, width: panelPos.width }}
          className="z-[1000] rounded-md border bg-popover text-popover-foreground shadow-lg overflow-hidden"
        >
          <Command shouldFilter={false} className="bg-popover">
            <CommandList className="max-h-[55vh] bg-popover">
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

              {groups.user.length > 0 && (
                <>
                  <CommandSeparator />
                  <CommandGroup heading="Users">
                    {groups.user.map((r) => (
                      <CommandItem
                        key={`u-${r.id}`}
                        value={`user ${r.title} ${r.subtitle || ""}`}
                        onSelect={() => handleSelect(r)}
                      >
                        <User className="mr-2 h-4 w-4 text-chart-5 group-data-[selected=true]:text-accent-foreground" />
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
          </Command>
        </div>
      )}
    </div>
  );
}
