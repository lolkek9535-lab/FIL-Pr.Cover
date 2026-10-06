"use client";

import { Code, Palette, Zap } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface Feature {
  icon: React.ReactNode;
  title: string;
  description: string;
  preview: React.ReactNode;
}

const FEATURES: Feature[] = [
  {
    icon: <Code className="h-5 w-5" />,
    title: "Copy & Paste Ready",
    description:
      "Every component is ready to be copied directly into your project.",
    preview: (
      <div className="h-full w-full rounded-lg bg-linear-to-br from-zinc-900 to-zinc-800 p-4 dark:from-zinc-200 dark:to-zinc-100">
        <pre className="text-white text-xs dark:text-zinc-900">
          <code>{`export function Button() {\n  return (\n    <button className="...">\n      Click me\n    </button>\n  );\n}`}</code>
        </pre>
      </div>
    ),
  },
  {
    icon: <Palette className="h-5 w-5" />,
    title: "Fully Customizable",
    description: "Tailwind-based styling that's easy to modify and extend.",
    preview: (
      <div className="grid grid-cols-3 gap-2">
        {[
          "bg-blue-500",
          "bg-emerald-500",
          "bg-purple-500",
          "bg-amber-500",
          "bg-pink-500",
          "bg-cyan-500",
        ].map((color, i) => (
          <div
            className={cn(
              "aspect-square rounded-lg transition-transform hover:scale-105",
              color
            )}
            key={i}
          />
        ))}
      </div>
    ),
  },
  {
    icon: <Zap className="h-5 w-5" />,
    title: "Interactive Elements",
    description: "Smooth animations and transitions built-in.",
    preview: (
      <div className="flex items-center justify-center">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360],
          }}
          className="h-16 w-16 rounded-2xl bg-linear-to-r from-indigo-500 via-purple-500 to-pink-500"
          transition={{
            duration: 2,
            repeat: Number.POSITIVE_INFINITY,
            ease: "easeInOut",
          }}
        />
      </div>
    ),
  },
];

export function InteractivePreview() {
  const [activeFeature, setActiveFeature] = useState(0);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-16">
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_1.5fr]">
        <div className="space-y-8">
          {FEATURES.map((feature, index) => (
            <motion.div
              className={cn(
                "cursor-pointer rounded-2xl p-6",
                activeFeature === index
                  ? "bg-zinc-100 dark:bg-zinc-800/50"
                  : "hover:bg-zinc-50 dark:hover:bg-zinc-800/30"
              )}
              key={index}
              onClick={() => setActiveFeature(index)}
              transition={{ duration: 0.2 }}
              whileHover={{ x: 5 }}
            >
              <div className="flex items-start gap-4">
                <div className="rounded-lg bg-zinc-200 p-2 dark:bg-zinc-700">
                  {feature.icon}
                </div>
                <div>
                  <h3 className="mb-1 font-semibold text-lg">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {feature.description}
                  </p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="rounded-3xl border border-zinc-200 bg-linear-to-b from-white to-zinc-50 p-8 lg:h-[400px] dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-900/50">
          <motion.div
            animate={{ opacity: 1, y: 0 }}
            className="h-full w-full"
            initial={{ opacity: 0, y: 20 }}
            key={activeFeature}
            transition={{ duration: 0.3 }}
          >
            {FEATURES[activeFeature].preview}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
