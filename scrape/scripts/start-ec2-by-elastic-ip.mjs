import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import {
  EC2Client,
  DescribeInstancesCommand,
  StartInstancesCommand,
  waitUntilInstanceRunning,
} from "@aws-sdk/client-ec2";

function loadEnv(path) {
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const key = t.slice(0, i).trim();
    let val = t.slice(i + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

loadEnv(resolve(process.cwd(), "..", ".env.local"));

const region = process.env.AWS_REGION || "us-east-2";
const publicIp = (process.env.elastic_id || "").trim();
if (!publicIp) {
  throw new Error("Missing elastic_id in .env.local");
}

const client = new EC2Client({ region });
const described = await client.send(
  new DescribeInstancesCommand({
    Filters: [
      {
        Name: "network-interface.addresses.association.public-ip",
        Values: [publicIp],
      },
    ],
  }),
);

const instance = described.Reservations?.flatMap((r) => r.Instances || [])[0];
if (!instance?.InstanceId) {
  throw new Error(`No EC2 instance found with public IP ${publicIp}`);
}

const id = instance.InstanceId;
const state = instance.State?.Name || "unknown";
console.log(`Instance ${id} state: ${state}`);

if (state !== "running") {
  await client.send(new StartInstancesCommand({ InstanceIds: [id] }));
  await waitUntilInstanceRunning({ client, maxWaitTime: 300 }, { InstanceIds: [id] });
}

const after = await client.send(
  new DescribeInstancesCommand({ InstanceIds: [id] }),
);
const running = after.Reservations?.[0]?.Instances?.[0];
console.log(
  `Instance ${id} now ${running?.State?.Name ?? "unknown"} at ${running?.PublicIpAddress ?? ""}`,
);
