import * as React from "react"
import { cn } from "@/lib/utils"
const Input = React.forwardRef(({ className, type, ...props }, ref) => {
  return (
    <input
      type={type}
      className={cn(
        "px-[12px] py-[6px] mb-[15px] h-11 w-full rounded-[8px] border border-gray-200 bg-white text-sm text-gray-900 shadow-none outline-none transition-[var(--transition-smooth)] placeholder:text-gray-400 focus:border-[var(--primary-color)] focus:shadow-[0_0_0_3px_rgba(31,92,69,0.1)]",
        className
      )}
      ref={ref}
      {...props} />
  );
})
Input.displayName = "Input"
export { Input }
