import type { Config } from "@netlify/functions";
import { runMonitor } from "../lib/monitor.js";

// Checks every monitored news & social source once a minute.
export default async () => {
  await runMonitor();
};

export const config: Config = {
  schedule: "* * * * *",
};
