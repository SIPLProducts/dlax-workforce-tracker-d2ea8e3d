import { supabase } from "@/integrations/supabase/client";

/**
 * Fetch total headcount per sheet, batching the .in() filter into small
 * chunks so the request URL stays well under the gateway's header/URI
 * buffer limits (nginx/Kong default ~8 KB).
 */
export async function fetchHeadcountTotals(
  sheetIds: string[],
  chunkSize = 100,
): Promise<Record<string, number>> {
  const totals: Record<string, number> = {};
  if (!sheetIds || sheetIds.length === 0) return totals;
  for (let i = 0; i < sheetIds.length; i += chunkSize) {
    const chunk = sheetIds.slice(i, i + chunkSize);
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
