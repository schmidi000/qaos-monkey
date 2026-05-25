let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  input += chunk;
});
process.stdin.on("end", () => {
  const step = Number(input.match(/Current step:\s*(\d+)/)?.[1] ?? "0");
  const generalRef = input.match(/(@e\d+)\s+\[cell\]\s+"General"/)?.[1];
  if (step === 0 && generalRef) {
    console.log(JSON.stringify({ action: "tap", ref: generalRef, reason: "Open General from Settings for iOS smoke test." }));
    return;
  }
  console.log(JSON.stringify({ action: "finish", reason: "iOS simulator smoke test completed." }));
});
