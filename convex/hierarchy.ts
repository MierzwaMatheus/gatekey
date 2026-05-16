import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

const DEFAULT_QUOTAS: Record<string, number> = {
  users_per_org: 50,
  workspaces_per_org: 10,
  users_per_workspace: 30,
  capabilities_per_org: 50,
  roles_per_workspace: 20,
  sessions_per_user: 5,
  api_keys_per_org: 10,
};

async function assertRoot(ctx: { db: { get: (id: Id<"users">) => Promise<{ isRoot?: boolean } | null> } }, callerId: Id<"users">) {
  const caller = await ctx.db.get(callerId);
  if (!caller || !caller.isRoot) {
    throw new Error("forbidden: root_required");
  }
}

export const createOrg = internalMutation({
  args: {
    callerId: v.id("users"),
    name: v.string(),
    adminEmail: v.string(),
  },
  returns: v.id("orgs"),
  handler: async (ctx, args) => {
    await assertRoot(ctx, args.callerId);

    const orgId = await ctx.db.insert("orgs", {
      name: args.name,
      status: "active",
      updatedAt: Date.now(),
    });

    await ctx.db.insert("org_settings", {
      orgId,
      loginMethods: ["email_password"],
      mfaRequired: false,
      jwtExpiryAccess: 3600,
      jwtExpiryRefresh: 2592000,
      quotas: DEFAULT_QUOTAS,
    });

    const adminUser = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.adminEmail))
      .first();

    let adminUserId: Id<"users">;
    if (adminUser) {
      adminUserId = adminUser._id;
    } else {
      adminUserId = await ctx.db.insert("users", {
        email: args.adminEmail,
        passwordHash: "",
        status: "active",
        loginAttempts: 0,
        updatedAt: Date.now(),
      });
    }

    await ctx.db.insert("org_members", {
      userId: adminUserId,
      orgId,
      role: "admin",
      status: "active",
    });

    return orgId;
  },
});

export const suspendOrg = internalMutation({
  args: {
    callerId: v.id("users"),
    orgId: v.id("orgs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await assertRoot(ctx, args.callerId);
    await ctx.db.patch(args.orgId, { status: "suspended", updatedAt: Date.now() });
    return null;
  },
});

export const deleteOrg = internalMutation({
  args: {
    callerId: v.id("users"),
    orgId: v.id("orgs"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await assertRoot(ctx, args.callerId);
    await ctx.db.patch(args.orgId, { status: "deleted", updatedAt: Date.now() });
    return null;
  },
});

export const createWorkspace = internalMutation({
  args: {
    callerId: v.id("users"),
    orgId: v.id("orgs"),
    name: v.string(),
  },
  returns: v.id("workspaces"),
  handler: async (ctx, args) => {
    const caller = await ctx.db.get(args.callerId);
    if (!caller) throw new Error("forbidden: user_not_found");

    if (!caller.isRoot) {
      const membership = await ctx.db
        .query("org_members")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), args.callerId),
            q.eq(q.field("orgId"), args.orgId),
            q.eq(q.field("status"), "active"),
          ),
        )
        .first();
      if (!membership || membership.role !== "admin") {
        throw new Error("forbidden: org_admin_required");
      }
    }

    return await ctx.db.insert("workspaces", {
      orgId: args.orgId,
      name: args.name,
      status: "active",
    });
  },
});

export const suspendWorkspace = internalMutation({
  args: {
    callerId: v.id("users"),
    workspaceId: v.id("workspaces"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const caller = await ctx.db.get(args.callerId);
    if (!caller) throw new Error("forbidden: user_not_found");

    const workspace = await ctx.db.get(args.workspaceId);
    if (!workspace) throw new Error("not_found: workspace");

    if (!caller.isRoot) {
      const membership = await ctx.db
        .query("org_members")
        .filter((q) =>
          q.and(
            q.eq(q.field("userId"), args.callerId),
            q.eq(q.field("orgId"), workspace.orgId),
            q.eq(q.field("status"), "active"),
          ),
        )
        .first();
      if (!membership || membership.role !== "admin") {
        throw new Error("forbidden: org_admin_required");
      }
    }

    await ctx.db.patch(args.workspaceId, { status: "suspended" });
    return null;
  },
});
