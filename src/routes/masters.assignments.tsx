import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { ScreenGuard } from "@/components/ScreenGuard";
import { PageHeader } from "@/components/PageHeader";
import { ProjectAssignments } from "@/components/ProjectAssignments";
import { ProjectCombobox } from "@/components/ProjectCombobox";

export const Route = createFileRoute("/masters/assignments")({
  component: () => <ScreenGuard screen="masters_assignments"><AssignmentsPage /></ScreenGuard>,
});

function AssignmentsPage() {
  const [projects, setProjects] = useState<{ id: string; name: string; code: string | null }[]>([]);
  const [projectId, setProjectId] = useState<string>("");

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("projects").select("id,name,code").order("name");
      setProjects(data || []);
      if (data && data.length && !projectId) setProjectId(data[0].id);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <PageHeader title="Project Assignments" subtitle="Assign contractors, departments and categories to a project" />
      <Card>
        <CardContent className="p-4">
          <Label className="text-xs text-muted-foreground">Project</Label>
          <Select value={projectId} onValueChange={setProjectId}>
            <SelectTrigger className="max-w-md"><SelectValue placeholder="Select a project" /></SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ""}{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <ProjectAssignments projectId={projectId} />
        </CardContent>
      </Card>
    </div>
  );
}
