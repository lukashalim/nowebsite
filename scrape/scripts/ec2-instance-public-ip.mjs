/**
 * Resolve public IP for an EC2 instance (reads AWS_* from repo .env.local).
 * Usage (from scrape/): node scripts/ec2-instance-public-ip.mjs i-0123abcd...
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { EC2Client, DescribeInstancesCommand } from "@aws-sdk/client-ec2";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");

function loadEnv(path) {
  const raw = readFileSync(path, "utf8");
  for (const line of raw.split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
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

const envPath = resolve(repoRoot, ".env.local");
if (!existsSync(envPath)) {
  console.error("Missing ../../.env.local");
  process.exit(1);
}
loadEnv(envPath);

const id = process.argv[2];
if (!id?.startsWith("i-")) {
  console.error("Usage: node scripts/ec2-instance-public-ip.mjs i-xxxxxxxx");
  process.exit(1);
}

const region = process.env.AWS_REGION || "us-east-2";
const client = new EC2Client({ region });
const out = await client.send(new DescribeInstancesCommand({ InstanceIds: [id] }));
const inst = out.Reservations?.[0]?.Instances?.[0];
if (!inst) {
  console.error("Instance not found");
  process.exit(1);
}
console.log(inst.PublicIpAddress ?? "");
