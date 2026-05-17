/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as apiKeys from "../apiKeys.js";
import type * as apiKeysActions from "../apiKeysActions.js";
import type * as auditLog from "../auditLog.js";
import type * as auth from "../auth.js";
import type * as authStore from "../authStore.js";
import type * as bindings from "../bindings.js";
import type * as check from "../check.js";
import type * as emailTemplates from "../emailTemplates.js";
import type * as hierarchy from "../hierarchy.js";
import type * as http from "../http.js";
import type * as jwt from "../jwt.js";
import type * as jwtStore from "../jwtStore.js";
import type * as jwtVerify from "../jwtVerify.js";
import type * as pdp from "../pdp.js";
import type * as pep from "../pep.js";
import type * as pepMutation from "../pepMutation.js";
import type * as pepUtils from "../pepUtils.js";
import type * as resourceTypes from "../resourceTypes.js";
import type * as roles from "../roles.js";
import type * as seed from "../seed.js";
import type * as sessions from "../sessions.js";
import type * as setup from "../setup.js";
import type * as setupStore from "../setupStore.js";
import type * as users from "../users.js";
import type * as usersActions from "../usersActions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  apiKeys: typeof apiKeys;
  apiKeysActions: typeof apiKeysActions;
  auditLog: typeof auditLog;
  auth: typeof auth;
  authStore: typeof authStore;
  bindings: typeof bindings;
  check: typeof check;
  emailTemplates: typeof emailTemplates;
  hierarchy: typeof hierarchy;
  http: typeof http;
  jwt: typeof jwt;
  jwtStore: typeof jwtStore;
  jwtVerify: typeof jwtVerify;
  pdp: typeof pdp;
  pep: typeof pep;
  pepMutation: typeof pepMutation;
  pepUtils: typeof pepUtils;
  resourceTypes: typeof resourceTypes;
  roles: typeof roles;
  seed: typeof seed;
  sessions: typeof sessions;
  setup: typeof setup;
  setupStore: typeof setupStore;
  users: typeof users;
  usersActions: typeof usersActions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
