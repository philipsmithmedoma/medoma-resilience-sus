import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { PlusIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Slot } from "radix-ui"

// DESIGN.md § 4 Buttons: 36 px high, radius 6, 16 px horizontal padding, 15/500.
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 rounded-md text-body font-medium whitespace-nowrap transition-colors duration-150 outline-none focus-visible:outline-2 focus-visible:outline-primary-text focus-visible:outline-offset-1 disabled:pointer-events-none disabled:bg-border-input disabled:border-border-input disabled:text-primary-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        // Primary: primary fill, white text.
        default: "bg-primary text-primary-foreground hover:bg-primary-hover",
        // Secondary: white fill, 1 px primary border, primary text.
        secondary: "border border-primary-text bg-surface text-primary-text hover:bg-bg-muted",
        // Tertiary/create: text link in primary with a leading plus icon.
        tertiary: "h-auto px-0 text-primary-text hover:text-primary-hover hover:underline disabled:bg-transparent disabled:text-text-muted",
        // Text link without the plus icon.
        link: "h-auto px-0 text-primary-text hover:text-primary-hover hover:underline disabled:bg-transparent disabled:text-text-muted",
        // Destructive: secondary styling with red text and border.
        destructive: "border border-red bg-surface text-red hover:bg-red-light",
        ghost: "hover:bg-bg-muted",
      },
      size: {
        default: "h-9 px-4",
        sm: "h-8 px-3",
        icon: "size-9 px-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

type ButtonProps = React.ComponentPropsWithoutRef<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

// forwardRef so that Radix triggers (asChild) can anchor to the rendered button under React 18.
const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "default", size = "default", asChild = false, children, type, ...props },
  ref
) {
  const Comp = asChild ? Slot.Root : "button"

  return (
    <Comp
      ref={ref}
      data-slot="button"
      data-variant={variant}
      data-size={size}
      type={asChild ? undefined : (type ?? "button")}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    >
      {variant === "tertiary" ? <PlusIcon className="size-4" strokeWidth={1.5} aria-hidden /> : null}
      {children}
    </Comp>
  )
})

export { Button, buttonVariants }
