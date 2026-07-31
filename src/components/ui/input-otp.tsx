'use client'

import { OTPField } from '@base-ui/react/otp-field'
import { MinusIcon } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

type InputOTPProps = Omit<OTPField.Root.Props, 'className' | 'length' | 'onValueChange'> & {
  autoFocus?: boolean
  className?: string
  containerClassName?: string
  maxLength: number
  onChange?: (value: string) => void
}

type InputOTPContextValue = {
  autoFocus: boolean
  maxLength: number
}

const InputOTPContext = React.createContext<InputOTPContextValue | null>(null)

function InputOTP({
  autoFocus = false,
  children,
  className,
  containerClassName,
  maxLength,
  onChange,
  ...props
}: InputOTPProps) {
  return (
    <InputOTPContext.Provider value={{ autoFocus, maxLength }}>
      <OTPField.Root
        data-slot="input-otp"
        length={maxLength}
        onValueChange={onChange}
        className={cn(
          'flex items-center gap-2 data-disabled:cursor-not-allowed data-disabled:opacity-50',
          containerClassName,
          className,
        )}
        {...props}
      >
        {children}
      </OTPField.Root>
    </InputOTPContext.Provider>
  )
}

function InputOTPGroup({ className, ...props }: React.ComponentProps<'div'>) {
  return <div data-slot="input-otp-group" className={cn('flex items-center', className)} {...props} />
}

function InputOTPSlot({
  index,
  className,
  ...props
}: Omit<OTPField.Input.Props, 'className'> & {
  className?: string
  index: number
}) {
  const context = React.use(InputOTPContext)

  if (!context) {
    throw new Error('InputOTPSlot must be used within InputOTP')
  }

  return (
    <OTPField.Input
      data-slot="input-otp-slot"
      autoFocus={context.autoFocus && index === 0}
      aria-label={index === 0 ? undefined : `Digit ${index + 1} of ${context.maxLength}`}
      className={cn(
        `relative size-9 border border-y border-r bg-background text-center text-sm shadow-xs transition-all outline-none first:rounded-l-md first:border-l last:rounded-r-md focus:z-10 focus:border-ring focus:ring-[3px] focus:ring-ring/50 aria-invalid:border-destructive focus:aria-invalid:border-destructive focus:aria-invalid:ring-destructive/20 dark:bg-input/30 dark:focus:aria-invalid:ring-destructive/40`,
        className,
      )}
      {...props}
    />
  )
}

function InputOTPSeparator({ className, ...props }: OTPField.Separator.Props) {
  return (
    <OTPField.Separator data-slot="input-otp-separator" className={className} {...props}>
      <MinusIcon />
    </OTPField.Separator>
  )
}

export { InputOTP, InputOTPGroup, InputOTPSeparator, InputOTPSlot }
