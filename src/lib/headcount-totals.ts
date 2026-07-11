import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch total headcount per sheet, batching the .in() filter into small
 * chunks so the request URL stays well under the gateway's header/URI
 * buffer limits (nginx/Kong default ~8 KB).
 */
export async function fetchHeadcountTotals(
  sheetIds: string[],
  chunkSize = 25,
): Promise<Record<string, number>> {
  const totals: Record<string, number> = {};
  if (!sheetIds || sheetIds.length === 0) return totals;
  const unique = Array.from(new Set(sheetIds.filter(Boolean)));
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("daily_manpower")
      .select("sheet_id, headcount")
      .in("sheet_id", chunk);
    if (error) throw error;
    (data || []).forEach((r: any) => {
      totals[r.sheet_id] = (totals[r.sheet_id] || 0) + (r.headcount || 0);
    });
  }
  return totals;
}
