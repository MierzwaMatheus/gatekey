// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

"use node";

import { internalAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export const createUserWithPassword = internalAction({
  args: {
    callerId: v.string(),
    orgId: v.string(),
    email: v.string(),
    password: v.string(),
    role: v.string(),
  },
  handler: async (ctx, args) => {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(args.password, 10);
    // Explicit cast to avoid TS circularity errors on cross-file mutation call
    const result: unknown = await ctx.runMutation(internal.users.createUser, {
      callerId: args.callerId as never,
      orgId: args.orgId as never,
      email: args.email,
      passwordHash,
      role: args.role,
    });
    return result;
  },
});

export const updateUserPassword = internalAction({
  args: {
    callerId: v.string(),
    userId: v.string(),
    orgId: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const bcrypt = await import("bcryptjs");
    const passwordHash = await bcrypt.hash(args.password, 10);
    await ctx.runMutation(internal.users.updateUser, {
      callerId: args.callerId as never,
      userId: args.userId as never,
      orgId: args.orgId as never,
      passwordHash,
    });
    return null;
  },
});
