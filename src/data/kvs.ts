import { fetch } from "@forge/api";
import { kvs } from "@forge/kvs";
import { OpenF1 } from "../openf1/client";
import type { Store } from "./session";

export const store: Store = {
  async get<T>(key: string) {
    return (await kvs.get<T>(key)) ?? undefined;
  },
  async set(key, value, ttlDays) {
    await kvs.set(key, value, ttlDays > 0 ? { ttl: { value: ttlDays, unit: "DAYS" } } : undefined);
  },
};

// Forge's fetch goes through the egress allow-list in the manifest (api.openf1.org).
export const openf1 = () => new OpenF1((url) => fetch(url));
