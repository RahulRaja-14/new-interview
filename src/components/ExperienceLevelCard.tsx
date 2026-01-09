import { cn } from "@/lib/utils";
import { GraduationCap, Briefcase, Building2 } from "lucide-react";

export type ExperienceLevel = "entry" | "mid" | "senior";

interface ExperienceLevelCardProps {
  level: ExperienceLevel;
  title: string;
  description: string;
  isSelected: boolean;
  onSelect: () => void;
}

const iconMap = {
  entry: GraduationCap,
  mid: Briefcase,
  senior: Building2,
};

export function ExperienceLevelCard({
  level,
  title,
  description,
  isSelected,
  onSelect,
}: ExperienceLevelCardProps) {
  const Icon = iconMap[level];

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-4 p-4 rounded-lg",
        "bg-card border transition-all duration-200",
        isSelected
          ? "border-primary glow-primary"
          : "border-border hover:border-primary/50 card-hover"
      )}
    >
      <div
        className={cn(
          "p-2 rounded-lg",
          isSelected ? "bg-primary/20" : "bg-secondary"
        )}
      >
        <Icon
          className={cn(
            "h-5 w-5",
            isSelected ? "text-primary" : "text-muted-foreground"
          )}
        />
      </div>
      <div className="flex-1 text-left">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <div
        className={cn(
          "px-4 py-2 rounded-lg text-sm font-medium transition-colors",
          isSelected
            ? "bg-primary text-primary-foreground"
            : "bg-secondary text-foreground hover:bg-secondary/80"
        )}
      >
        {isSelected ? "Selected" : "Choose"}
      </div>
    </button>
  );
}
