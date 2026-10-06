import { Sparkles } from "lucide-react";

export function TechnologyBadges() {
  return (
    <div className="my-8 flex flex-col justify-center gap-4 sm:my-24 sm:flex-row">
      <div className="inline-flex items-center rounded-full border border-zinc-200 bg-linear-to-r from-zinc-100 to-zinc-200 px-4 py-2 text-sm shadow-sm dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-800">
        <Sparkles className="mr-2 h-4 w-4 text-emerald-500" />
        <span className="bg-linear-to-r from-zinc-800 to-zinc-600 bg-clip-text text-transparent dark:from-zinc-200 dark:to-zinc-400">
          Crafted with Next.js 15 & Tailwind CSS
        </span>
      </div>

      <div className="inline-flex items-center rounded-full border border-orange-200 bg-linear-to-r from-orange-100 to-orange-200 px-4 py-2 text-sm shadow-sm dark:border-orange-800/30 dark:from-orange-900/30 dark:to-orange-800/30">
        <Sparkles className="mr-2 h-4 w-4 text-orange-500" />
        <span className="bg-linear-to-r from-orange-800 to-orange-600 bg-clip-text text-transparent dark:from-orange-200 dark:to-orange-400">
          Optionally with shadcn/ui and Framer Motion
        </span>
      </div>
    </div>
  );
}
