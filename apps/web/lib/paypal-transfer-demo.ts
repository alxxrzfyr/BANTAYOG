import { z } from "zod";

// Display-only demo inputs. Never use these as a cash-out authorization or payment record.
export const PayPalDemoDetails = z.object({
  amount: z.string().regex(/^(?=.*[1-9])(?:0|[1-9]\d{0,8})(?:\.\d{1,2})?$/, "Enter a positive demo amount with at most two decimal places."),
  recipient: z.email("Enter a valid example email address.").max(254),
});
export type PayPalDemoDetails = z.infer<typeof PayPalDemoDetails>;

export function maskDemoRecipient(recipient: string): string {
  const [name, domain] = recipient.split("@");
  return `${name[0]}***@${domain}`;
}
