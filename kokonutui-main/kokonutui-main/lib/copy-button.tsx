import { Copy } from "lucide-react";

interface CopyButtonProps {
  onClick?: () => void;
}

export function CopyButton({ onClick }: CopyButtonProps) {
  return (
    <button
      className="relative flex touch-manipulation items-center gap-1 rounded-lg bg-zinc-100 px-3 py-2 text-sm text-zinc-600 transition-colors hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
      onClick={onClick}
      type="button"
    >
      <Copy className="h-4 w-4" />
    </button>
  );
}
