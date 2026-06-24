import { z } from "zod";

export const linkWalletSchema = z.object({
  address: z.string().min(1),
  signature: z.string().min(1),
  challenge: z.string().min(1),
});

export type LinkWalletInput = z.infer<typeof linkWalletSchema>;
