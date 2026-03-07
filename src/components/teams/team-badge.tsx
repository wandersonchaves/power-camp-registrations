import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { TeamCode } from "@/theme/team-config";
import { getTeamBadgeClasses, getTeamDisplayName } from "@/theme/team-styles";

interface TeamBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  team: TeamCode;
  showIcon?: boolean;
}

export function TeamBadge({
  team,
  showIcon = true,
  className,
  ...props
}: TeamBadgeProps) {
  return (
    <Badge
      className={cn(
        "font-bold uppercase tracking-wider",
        getTeamBadgeClasses(team),
        className,
      )}
      {...props}
    >
      {showIcon ? getTeamDisplayName(team) : team}
    </Badge>
  );
}
