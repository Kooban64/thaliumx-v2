import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
import { z } from "zod"

export function cn(...inputs: ClassValue[]) {
   return twMerge(clsx(inputs))
}

// Validation Schemas
export const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  mfaCode: z.string().optional(),
})

export const registerSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Password must contain at least one uppercase letter, one lowercase letter, and one number"),
  firstName: z.string().min(1, "First name is required").max(50, "First name too long"),
  lastName: z.string().min(1, "Last name is required").max(50, "Last name too long"),
  phone: z.string().optional(),
})

export const tradingOrderSchema = z.object({
  symbol: z.string().min(1, "Symbol is required"),
  side: z.enum(["buy", "sell"]),
  type: z.enum(["market", "limit"]),
  quantity: z.number().positive("Quantity must be positive").max(1000, "Quantity too large"),
  price: z.number().positive("Price must be positive").optional(),
})

export const tokenPurchaseSchema = z.object({
  amount: z.number()
    .min(50, "Minimum purchase is $50")
    .max(100000, "Maximum purchase is $100,000"),
  paymentMethod: z.enum(["USDT", "BANK_TRANSFER"]),
  walletAddress: z.string().optional(),
  brokerCode: z.string().optional(),
})

// Validation helper
export function validateForm<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: Record<string, string> } {
  try {
    const result = schema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {}
      error.issues.forEach((issue) => {
        if (issue.path.length > 0) {
          errors[issue.path[0] as string] = issue.message
        }
      })
      return { success: false, errors }
    }
    return { success: false, errors: { general: "Validation failed" } }
  }
}
