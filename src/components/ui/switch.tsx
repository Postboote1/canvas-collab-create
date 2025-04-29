import * as React from "react"

import { cn } from "@/lib/utils"

interface SwitchProps extends React.HTMLAttributes<HTMLDivElement> {
  checked?: boolean
  onCheckedChange?: (checked: boolean) => void
  disabled?: boolean
}

const Switch = React.forwardRef<HTMLDivElement, SwitchProps>(
  ({ className, checked = false, onCheckedChange, disabled = false, ...props }, ref) => {
    const handleClick = () => {
      if (!disabled && onCheckedChange) {
        onCheckedChange(!checked)
      }
    }

    return (
      <div
        className={cn(
          "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
          checked ? "bg-primary" : "bg-input",
          disabled ? "cursor-not-allowed opacity-50" : "",
          className
        )}
        onClick={handleClick}
        ref={ref}
        role="switch"
        aria-checked={checked}
        aria-disabled={disabled}
        style={{
          borderRadius: '9999px',
          WebkitBorderRadius: '9999px',
          MozBorderRadius: '9999px',
          WebkitAppearance: 'none',
          WebkitMaskImage: '-webkit-radial-gradient(white, black)'
        }}
        {...props}
      >
        <div
          className={cn(
            "pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg transition-transform",
            checked ? "translate-x-5" : "translate-x-0"
          )}
          style={{
            borderRadius: '9999px',
            WebkitBorderRadius: '9999px',
            MozBorderRadius: '9999px'
          }}
        />
      </div>
    )
  }
)
Switch.displayName = "Switch"

export { Switch }