/**
 * packages/types/src/index.js
 *
 * Shared Zod schemas and type definitions for DressApp API payloads.
 * Schemas are extracted progressively as mobile screens are ported.
 *
 * Phase 1 skeleton — add schemas here as Phase 3+ screens are built.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
export const LoginPayload = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const RegisterPayload = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().min(1).optional(),
});

export const AuthToken = z.object({
  access_token: z.string(),
  token_type: z.string().default('bearer'),
});

// ---------------------------------------------------------------------------
// User
// ---------------------------------------------------------------------------
export const User = z.object({
  id: z.string(),
  email: z.string().email(),
  full_name: z.string().nullable().optional(),
  avatar_url: z.string().nullable().optional(),
  face_photo_url: z.string().nullable().optional(),
  preferred_language: z.string().nullable().optional(),
  migration_flag: z.boolean().optional(),
  scheduler_settings: z.object({ enabled: z.boolean() }).optional(),
});

// ---------------------------------------------------------------------------
// Closet Item (abbreviated — expand as ItemDetail screen is ported)
// ---------------------------------------------------------------------------
export const ClosetItem = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  color: z.string().nullable().optional(),
  image_url: z.string().nullable().optional(),
  thumbnail_data_url: z.string().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const ClosetListResponse = z.object({
  items: z.array(ClosetItem),
  total: z.number().optional(),
});

// ---------------------------------------------------------------------------
// More schemas added per phase:
// Phase 4: Marketplace listing, Transaction, Campaign, Suitcase, Outfit
// ---------------------------------------------------------------------------
