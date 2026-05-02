import { BadgeCheck } from "lucide-react";

export type BadgePill = {
  code: string;
  displayName: string;
};

export function BadgePills({ badges }: { badges?: BadgePill[] }) {
  if (!badges || badges.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {badges.map((badge) => (
        <span
          className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-black text-amber-800"
          key={badge.code}
        >
          <BadgeCheck size={14} />
          {badge.displayName}
        </span>
      ))}
    </div>
  );
}
