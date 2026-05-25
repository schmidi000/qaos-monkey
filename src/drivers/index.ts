import type { QAosMonkeyConfig, DeviceDriver } from "../types.ts";
import { AgentDeviceDriver } from "./agent-device.ts";
import { MaestroDriver } from "./maestro.ts";

export function createDeviceDriver(config: QAosMonkeyConfig): DeviceDriver {
  if (config.device.driver === "maestro") {
    return new MaestroDriver(config);
  }
  return new AgentDeviceDriver(config);
}

