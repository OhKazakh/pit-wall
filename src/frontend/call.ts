import { invoke } from "@forge/bridge";

// The bridge may hand back the resolver's reply as is or wrapped as { body, metadata }.
export async function call<T>(name: string, payload?: Record<string, unknown>): Promise<T> {
  const reply = (await invoke<T>(name, payload)) as unknown;
  if (reply && typeof reply === "object" && "body" in reply && Object.keys(reply).every((k) => k === "body" || k === "metadata")) {
    return (reply as { body: T }).body;
  }
  return reply as T;
}
