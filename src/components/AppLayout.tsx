import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileTabBar } from "@/components/MobileTabBar";
import type { ReactNode } from "react";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <div className="flex items-center gap-2 border-b px-4 py-2">
            <SidebarTrigger />
            <span className="font-bold text-foreground lg:hidden">DLAX</span>
          </div>
          <div className="p-3 sm:p-4 md:p-6 lg:p-8 pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-8">
            {children}
          </div>
        </main>
        <MobileTabBar />
      </div>
    </SidebarProvider>
  );
}
