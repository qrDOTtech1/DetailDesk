import Image from "next/image";
import { cn } from "@/lib/utils";

export function Logo({ size = 28, withText = true, className }: {
  size?: number; withText?: boolean; className?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image src="/brand/logo.png" alt="DetailDesk" width={size} height={size}
        className="shrink-0" priority />
      {withText && <span className="font-bold tracking-tight">DetailDesk</span>}
    </span>
  );
}
