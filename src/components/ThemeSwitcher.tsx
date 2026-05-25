import { Sun, Moon, Palette, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useTheme, THEMES, type ThemeName } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";

export function ThemeSwitcher() {
  const { theme, mode, setTheme, toggleMode } = useTheme();

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <TooltipProvider delayDuration={300}>
          <Tooltip>
            <TooltipTrigger asChild>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" aria-label="Change theme">
                  <Palette className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
            </TooltipTrigger>
            <TooltipContent>Change theme</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Theme</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {THEMES.map((t) => (
            <DropdownMenuItem
              key={t.id}
              onClick={() => setTheme(t.id as ThemeName)}
              className="flex items-center gap-2 cursor-pointer"
            >
              <div className="flex h-5 w-10 overflow-hidden rounded-sm border">
                {t.swatch.map((c, i) => (
                  <div key={i} className="flex-1" style={{ backgroundColor: c }} />
                ))}
              </div>
              <span className="flex-1 text-sm">{t.label}</span>
              {theme === t.id && <Check className="h-3.5 w-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleMode}
              aria-label="Toggle light/dark"
            >
              <Sun className={cn("h-4 w-4 transition-all", mode === "dark" && "scale-0 -rotate-90 absolute")} />
              <Moon className={cn("h-4 w-4 transition-all", mode === "light" && "scale-0 rotate-90 absolute")} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{mode === "light" ? "Switch to dark" : "Switch to light"}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}
