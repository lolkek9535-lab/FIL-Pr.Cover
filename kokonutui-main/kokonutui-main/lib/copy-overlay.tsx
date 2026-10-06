import { Check } from "lucide-react";
import { motion } from "motion/react";

interface CopyOverlayProps {
  show: boolean;
}

export function CopyOverlay({ show }: CopyOverlayProps) {
  if (!show) return null;

  return (
    <motion.div
      animate={{ opacity: 1 }}
      className="absolute inset-0 z-50 flex items-center justify-center overflow-hidden rounded-xl px-4 sm:px-0"
      exit={{ opacity: 0 }}
      initial={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="absolute inset-0 bg-linear-to-b from-white/90 via-gray-50/90 to-white/90 backdrop-blur-md dark:from-zinc-900/90 dark:via-zinc-800/90 dark:to-zinc-900/90" />

      <motion.div
        animate={{ scale: 1, opacity: 1 }}
        className="relative flex flex-col items-center gap-1.5 sm:gap-2"
        initial={{ scale: 0.5, opacity: 0 }}
        transition={{
          type: "spring",
          stiffness: 200,
          damping: 15,
        }}
      >
        <div className="flex h-10 w-10 items-center justify-center rounded-full border border-green-200 bg-green-100 sm:h-12 sm:w-12 dark:border-white/25 dark:bg-white/15">
          <Check className="h-5 w-5 text-green-600 sm:h-6 sm:w-6 dark:text-white/90" />
        </div>
        <span className="font-semibold text-sm text-zinc-600 sm:text-base dark:text-white/90">
          Copied to clipboard
        </span>
      </motion.div>
    </motion.div>
  );
}
