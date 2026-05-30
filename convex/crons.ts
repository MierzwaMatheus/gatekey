// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2024 GateKey Contributors

import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "export audit logs to cold storage",
  { hours: 24 },
  internal.coldStorage.exportAuditLogs,
  {},
);

export default crons;
