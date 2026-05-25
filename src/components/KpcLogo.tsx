import logoWhite from "@/assets/kpc-logo-white.png";
import logoDark from "@/assets/kpc-logo-dark.png";
import { cn } from "@/lib/utils";

type Props = {
  /** Which surface this logo sits on. Picks the right variant for contrast. */
  variant?: "on-dark" | "on-light";
  className?: string;
};

export function KpcLogo({ variant = "on-dark", className }: Props) {
  const src = variant === "on-dark" ? logoWhite : logoDark;
  return (
    <img
      src={src}
      alt="KPC"
      className={cn("h-auto select-none", className)}
      draggable={false}
    />
  );
}
