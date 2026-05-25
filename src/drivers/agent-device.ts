import type { QAosMonkeyConfig, DeviceDriver } from "../types.ts";
import { runCommand, runCommandOrThrow } from "../utils/subprocess.ts";

export class AgentDeviceDriver implements DeviceDriver {
  private baseCommand: string[];

  constructor(private config: QAosMonkeyConfig) {
    this.baseCommand = config.device.command ?? ["agent-device"];
  }

  async snapshot(): Promise<string> {
    return this.runMapped("snapshot", ["snapshot", "-i"]);
  }

  async tap(input: { ref?: string; x?: number; y?: number }): Promise<void> {
    const args = input.ref ? ["click", input.ref] : ["click", String(input.x), String(input.y)];
    await this.runMapped("tap", args);
  }

  async type(input: { ref?: string; value: string; submit?: boolean }): Promise<void> {
    const args = input.ref ? ["fill", input.ref, input.value] : ["type", input.value];
    if (input.submit) args.push("--submit");
    await this.runMapped("type", args);
  }

  async scroll(input: { direction: "up" | "down" | "left" | "right"; ref?: string }): Promise<void> {
    await this.runMapped("scroll", input.ref ? ["scroll", input.direction, input.ref] : ["scroll", input.direction]);
  }

  async swipe(input: { direction: "up" | "down" | "left" | "right"; ref?: string }): Promise<void> {
    await this.runMapped("swipe", input.ref ? ["swipe", input.direction, input.ref] : ["swipe", input.direction]);
  }

  async pressBack(): Promise<void> {
    await this.runMapped("press_back", ["back"]);
  }

  async dismissOverlay(): Promise<void> {
    await this.runMapped("dismiss_overlay", ["react-native", "dismiss-overlay"]);
  }

  async wait(milliseconds: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, milliseconds));
  }

  async launchApp(): Promise<void> {
    if (this.config.app.launchCommand?.length) {
      await runCommandOrThrow(this.config.app.launchCommand);
      return;
    }
    const appId = this.config.app.packageName ?? this.config.app.bundleId;
    if (appId) {
      await this.runMapped("launch", ["open", appId]);
    }
  }

  async getLogs(): Promise<string> {
    const result = await runCommand([...this.baseCommand, ...(this.config.device.commandMap?.logs ?? ["logs"])], undefined, 15000);
    return result.code === 0 ? result.stdout.trim() : result.stderr.trim();
  }

  async screenshot(outputPath: string): Promise<string | undefined> {
    const mapped = this.config.device.commandMap?.screenshot ?? ["screenshot", outputPath];
    const result = await runCommand([...this.baseCommand, ...mapped], undefined, 30000);
    if (result.code !== 0) {
      return undefined;
    }
    return outputPath;
  }

  private async runMapped(key: string, fallback: string[]): Promise<string> {
    const mapped = this.config.device.commandMap?.[key as keyof NonNullable<QAosMonkeyConfig["device"]["commandMap"]>] ?? fallback;
    return runCommandOrThrow([...this.baseCommand, ...mapped]);
  }
}
