import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative grid w-full grid-cols-[0_1fr] items-start gap-y-0.5 rounded-lg border border-zinc-200 px-4 py-3 text-sm has-[>svg]:grid-cols-[calc(var(--spacing)*4)_1fr] has-[>svg]:gap-x-3 dark:border-zinc-800 [&>svg]:size-4 [&>svg]:translate-y-0.5 [&>svg]:text-current",
  {
    variants: {
      variant: {
        default: "bg-white text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50",
        destructive:
          "bg-white text-red-500 *:data-[slot=alert-description]:text-red-500/90 dark:bg-zinc-950 dark:text-red-900 dark:*:data-[slot=alert-description]:text-red-900/90 [&>svg]:text-current",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      className={cn(alertVariants({ variant }), className)}
      data-slot="alert"
      role="alert"
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "col-start-2 line-clamp-1 min-h-4 font-medium tracking-tight",
        className
      )}
      data-slot="alert-title"
      {...props}
    />
  );
}

function AlertDescription({
  className,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div
      className={cn(
        "col-start-2 grid justify-items-start gap-1 text-sm text-zinc-500 dark:text-zinc-400 [&_p]:leading-relaxed",
        className
      )}
      data-slot="alert-description"
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };
