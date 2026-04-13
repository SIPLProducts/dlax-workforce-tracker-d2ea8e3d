import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { AuthGuard } from "@/components/AuthGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, ClipboardList, HardHat } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { format, subDays } from "date-fns";

export const Route = createFileRoute("/")({
  component: IndexPage,
});

function IndexPage() {
  return (
    <AuthGuard>
      <DashboardContent />
    </AuthGuard>
  );
}

function DashboardContent() {
  const [stats, setStats] = useState({ totalWorkers: 0, totalProjects: 0, totalContractors: 0, totalEntries: 0 });
  const [chartData, setChartData] = useState<{ date: string; workers: number }[]>([]);

  useEffect(() => {
    loadStats();
    loadChart();
  }, []);

  const loadStats = async () => {
    const today = format(new Date(), "yyyy-MM-dd");
    const [manpower, projects, contractors] = await Promise.all([
      supabase.from("daily_manpower").select("headcount").eq("entry_date", today),
      supabase.from("projects").select("id", { count: "exact" }).eq("status", "Active"),
      supabase.from("contractors").select("id", { count: "exact" }),
    ]);
    const totalWorkers = (manpower.data || []).reduce((s, r) => s + (r.headcount || 0), 0);
    setStats({
      totalWorkers,
      totalProjects: projects.count || 0,
      totalContractors: contractors.count || 0,
      totalEntries: manpower.data?.length || 0,
    });
  };

  const loadChart = async () => {
    const days = Array.from({ length: 7 }, (_, i) => format(subDays(new Date(), 6 - i), "yyyy-MM-dd"));
    const { data } = await supabase.from("daily_manpower").select("entry_date, headcount").gte("entry_date", days[0]).lte("entry_date", days[6]);
    const grouped = days.map((d) => ({
      date: format(new Date(d + "T00:00:00"), "dd MMM"),
      workers: (data || []).filter((r) => r.entry_date === d).reduce((s, r) => s + (r.headcount || 0), 0),
    }));
    setChartData(grouped);
  };

  const cards = [
    { title: "Today's Workers", value: stats.totalWorkers, icon: Users, color: "text-primary" },
    { title: "Active Projects", value: stats.totalProjects, icon: Building2, color: "text-accent" },
    { title: "Contractors", value: stats.totalContractors, icon: HardHat, color: "text-chart-3" },
    { title: "Today's Entries", value: stats.totalEntries, icon: ClipboardList, color: "text-chart-4" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground">Today's workforce overview — {format(new Date(), "dd MMM yyyy")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.title}</CardTitle>
              <c.icon className={`h-5 w-5 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Worker Trend (Last 7 Days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip />
                <Bar dataKey="workers" fill="oklch(0.45 0.18 250)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
