import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { HumanInputProvider, ScreenObservation } from "../types.ts";

export class CliHumanInputProvider implements HumanInputProvider {
  async requestHelp(reason: string, screen?: ScreenObservation, options: string[] = []): Promise<{ kind: "provided"; value: string } | { kind: "resolved" } | { kind: "skip" } | { kind: "abort" }> {
    console.log("\nHuman input required");
    console.log(`Reason: ${reason}`);
    if (screen?.screenshotPath) {
      console.log(`Screenshot: ${screen.screenshotPath}`);
    }
    if (options.length) {
      console.log(`Options from model: ${options.join(", ")}`);
    }
    console.log("Enter text to send to the agent, or one of: /resolved, /skip, /abort");
    const rl = createInterface({ input, output });
    const answer = (await rl.question("> ")).trim();
    rl.close();
    if (answer === "/abort") return { kind: "abort" };
    if (answer === "/skip") return { kind: "skip" };
    if (answer === "/resolved" || answer === "") return { kind: "resolved" };
    return { kind: "provided", value: answer };
  }
}

