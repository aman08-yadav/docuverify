import { z } from 'zod';

const email = z.string().trim().email().max(254).transform((value) => value.toLowerCase());
const password = z.string().min(10).max(128).refine((value) => /[A-Za-z]/.test(value) && /\d/.test(value), 'Use letters and numbers in the password.');

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email,
  password,
  institution: z.string().trim().max(160).optional().default('')
}).strict();

export const loginSchema = z.object({ email, password: z.string().min(1).max(128) }).strict();

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  institution: z.string().trim().max(160).optional()
}).strict().refine((value) => Object.keys(value).length > 0, 'At least one profile field is required.');

export const fieldCorrectionsSchema = z.object({
  fields: z.array(z.object({
    key: z.string().min(1).max(80),
    value: z.union([z.string().max(500), z.number().finite(), z.null()]),
    reason: z.string().max(240).optional()
  }).strict()).min(1).max(40)
}).strict();

export const adminReviewSchema = z.object({ note: z.string().trim().min(5).max(500) }).strict();
