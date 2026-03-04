import * as React from "react";

import { cn } from "@/lib/utils";
import { TEAM_CONFIG, TeamCode } from "@/theme/team-config";
import { getTeamAccentBorder, getTeamGradient } from "@/theme/team-styles";

interface TeamCardProps extends React.HTMLAttributes<HTMLDivElement> {
  team: TeamCode;
  title: string;
  icon?: React.ReactNode;
  subtitle?: string;
  gradient?: boolean;
}

export function TeamCard({
  team,
  title,
  icon,
  subtitle,
  gradient = false,
  children,
  className,
  ...props
}: TeamCardProps) {
  const config = TEAM_CONFIG[team];

  return (
    <div
      className={cn(
        "bg-card text-card-foreground overflow-hidden rounded-xl border shadow-sm",
        getTeamAccentBorder(team),
        config.visual.shadow,
        className,
      )}
      {...props}
    >
      <div
        className={cn(
          "flex items-center justify-between px-6 py-4",
          gradient && getTeamGradient(team) + " text-white",
        )}
      >
        <div className="space-y-0.5">
          <h3 className="flex items-center gap-2 font-semibold leading-none tracking-tight">
            {icon || config.icon} {title}
          </h3>
          {subtitle && (
            <p
              className={cn(
                "text-sm opacity-80",
                !gradient && "text-muted-foreground",
              )}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="p-6 pt-0">{children}</div>
    </div>
  );
}
