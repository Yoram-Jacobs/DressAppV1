import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef(({ className, ...props }, ref) => {
  return (
    <textarea
      className={cn( 
        "min-h-[60px] mb-[15px] block w-full rounded-[12px] border border-gray-200 bg-white text-sm text-gray-900 shadow-none transition-[var(--transition-smooth)] outline-none resize-y px-[12px] py-[6px] focus:border-[var(--primary-color)] focus:shadow-[0_0_0_3px_rgba(31,92,69,0.1)]",
        className
      )}
      ref={ref}
      {...props} />
  );
})
Textarea.displayName = "Textarea"

export { Textarea }
