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
  symbol: z.string().min(1, "Symbol is required").max(20, "Symbol too long").regex(/^[A-Z0-9]+$/, "Invalid symbol format"),
  side: z.enum(["buy", "sell"]),
  type: z.enum(["market", "limit"]),
  quantity: z.number().positive("Quantity must be positive").max(1000, "Quantity too large").min(0.00001, "Quantity too small"),
  price: z.number().positive("Price must be positive").max(1000000, "Price too high").optional(),
})

export const tokenPurchaseSchema = z.object({
  amount: z.number()
    .min(50, "Minimum purchase is $50")
    .max(100000, "Maximum purchase is $100,000"),
  paymentMethod: z.enum(["USDT", "BANK_TRANSFER"]),
  walletAddress: z.string().optional(),
  brokerCode: z.string().optional(),
})

// Rate limiting utility
class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  isAllowed(key: string, maxRequests: number, windowMs: number): boolean {
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }

    const requests = this.requests.get(key)!;
    // Remove old requests outside the window
    const validRequests = requests.filter(time => time > windowStart);

    if (validRequests.length >= maxRequests) {
      return false;
    }

    validRequests.push(now);
    this.requests.set(key, validRequests);
    return true;
  }

  getRemainingRequests(key: string, maxRequests: number, windowMs: number): number {
    const now = Date.now();
    const windowStart = now - windowMs;

    if (!this.requests.has(key)) {
      return maxRequests;
    }

    const requests = this.requests.get(key)!;
    const validRequests = requests.filter(time => time > windowStart);

    return Math.max(0, maxRequests - validRequests.length);
  }
}

export const rateLimiter = new RateLimiter();

// API rate limiting helper
export async function rateLimitedApiCall<T>(
  apiCall: () => Promise<T>,
  key: string = 'default',
  maxRequests: number = 10,
  windowMs: number = 60000 // 1 minute
): Promise<T> {
  if (!rateLimiter.isAllowed(key, maxRequests, windowMs)) {
    throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(windowMs / 1000)} seconds.`);
  }

  return apiCall();
}

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
