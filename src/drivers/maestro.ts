import type { QAosMonkeyConfig, DeviceDriver } from "../types.ts";
import { runCommand, runCommandOrThrow } from "../utils/subprocess.ts";

export class MaestroDriver implements DeviceDriver {
  private baseCommand: string[];

  constructor(private config: QAosMonkeyConfig) {
    this.baseCommand = config.device.command ?? ["maestro"];
  }

  async snapshot(): Promise<string> {
    const mapped = this.config.device.commandMap?.snapshot ?? ["hierarchy"];
    return runCommandOrThrow([...this.baseCommand, ...mapped]);
  }

  async tap(input: { ref?: string; x?: number; y?: number }): Promise<void> {
    if (input.ref) {
      await this.runFlow([{ tapOn: { id: input.ref.replace(/^@/, "") } }]);
      return;
    }
    await this.runFlow([{ tapOn: { point: `${input.x},${input.y}` } }]);
  }

  async type(input: { ref?: string; value: string }): Promise<void> {
    if (input.ref) {
      await this.tap({ ref: input.ref });
    }
    await this.runFlow([{ inputText: input.value }]);
  }

  async scroll(input: { direction: "up" | "down" | "left" | "right" }): Promise<void> {
    await this.runFlow([{ scroll: { direction: input.direction.toUpperCase() } }]);
  }

  async swipe(input: { direction: "up" | "down" | "left" | "right" }): Promise<void> {
    await this.runFlow([{ swipe: { direction: input.direction.toUpperCase() } }]);
  }

  async pressBack(): Promise<void> {
    await this.runFlow([{ back: true }]);
  }

  async dismissOverlay(): Promise<void> {
    throw new Error("dismiss_overlay is only implemented by the agent-device driver.");
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
      await this.runFlow([{ launchApp: appId }]);
    }
  }

  async getLogs(): Promise<string> {
    const result = await runCommand([...this.baseCommand, ...(this.config.device.commandMap?.logs ?? ["logs"])], undefined, 15000);
    return result.code === 0 ? result.stdout.trim() : result.stderr.trim();
  }

  async screenshot(outputPath: string): Promise<string | undefined> {
    const result = await runCommand([...this.baseCommand, ...(this.config.device.commandMap?.screenshot ?? ["screenshot", outputPath])]);
    return result.code === 0 ? outputPath : undefined;
  }

  private async runFlow(commands: unknown[]): Promise<void> {
    const yaml = commands.map((command) => `- ${JSON.stringify(command)}`).join("\n");
    await runCommandOrThrow([...this.baseCommand, "test", "-"], yaml);
  }
}
