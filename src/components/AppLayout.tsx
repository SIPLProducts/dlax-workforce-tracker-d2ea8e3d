import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { MobileTabBar } from "@/components/MobileTabBar";
import { TopBar } from "@/components/TopBar";
import type { ReactNode } from "react";

export function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto">
          <TopBar />
          <div className="p-3 sm:p-4 md:p-6 lg:p-8 pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-8">
            {children}
          </div>
        </main>
        <MobileTabBar />
      </div>
    </SidebarProvider>
  );
}
