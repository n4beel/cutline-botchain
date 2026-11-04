import { spawn } from "child_process";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const ANVIL_PORT = 8756;
const RPC_URL = `http://127.0.0.1:${ANVIL_PORT}`;

const localChain = defineChain({
  id: 31337,
  name: "Anvil Local",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
});

// Anvil test keys
const HOST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Acct 0
// People A-H (Accts 1-8)
const PEOPLE_KEYS = [
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
  "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6",
  "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a",
  "0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba",
  "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e",
  "0x4bbbf85ce3377467afe5d46f804f221813b2bb87f24d81f60f1fcdbf7cbf4356",
  "0xdbda1821b80551c9d65939329250298aa3472ba22feea921c0cf5d620ea67b97"
];
// Connected "You" role in local dev is commonly Account 1 (Person A) or Outsider (Acct 9)
const OUTSIDER_KEY = "0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6"; // Acct 9

async function main() {
  console.log(`Starting Anvil on port ${ANVIL_PORT}...`);
  const anvil = spawn("anvil", ["--port", String(ANVIL_PORT), "--silent"], {
    stdio: "inherit",
  });

  process.on("SIGINT", () => {
    anvil.kill();
    process.exit();
  });
  process.on("SIGTERM", () => {
    anvil.kill();
    process.exit();
  });

  const publicClient = createPublicClient({
    chain: localChain,
    transport: http(RPC_URL),
  });

  let connected = false;
  for (let i = 0; i < 30; i++) {
    try {
      await publicClient.getBlockNumber();
      connected = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  if (!connected) throw new Error("Could not connect to Anvil");

  const hostAccount = privateKeyToAccount(HOST_KEY);
  const hostClient = createWalletClient({
    account: hostAccount,
    chain: localChain,
    transport: http(RPC_URL),
  });

  const artifactPath = resolve(__dirname, "../contracts/out/Cutline.sol/Cutline.json");
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
  const abi = artifact.abi;
  const bytecode = artifact.bytecode.object as `0x${string}`;

  console.log("Deploying Cutline contract...");
  const deployHash = await hostClient.deployContract({
    abi,
    bytecode,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
  const contractAddress = receipt.contractAddress!;
  console.log(`Cutline deployed at: ${contractAddress}`);

  // Write .env.local
  const envContent = [
    `NEXT_PUBLIC_CONTRACT_31337=${contractAddress}`,
    `NEXT_PUBLIC_DEPLOY_BLOCK_31337=${receipt.blockNumber}`,
    `NEXT_PUBLIC_CHAIN_ID=31337`,
    `NEXT_PUBLIC_RPC_URL=${RPC_URL}`,
  ].join("\n");
  writeFileSync(resolve(__dirname, "../.env.local"), envContent + "\n");
  console.log("Wrote .env.local");

  // SEED DATA per 56-cutline.md §5:
  // - Line 1: with eight people (stepPrice 0.01 BOT)
  // - Line 2: empty
  // - Line 3: closed with three people
  // - Line 4: where connected "you" role (Person A, Account 1) is at the front
  console.log("Seeding lines...");

  // Line 1: 8 people (A-H), stepPrice 0.01 BOT, entry fee 0.02 BOT
  const l1Hash = await hostClient.writeContract({
    address: contractAddress,
    abi,
    functionName: "create",
    args: ["Main Clinic Waiting List", parseEther("0.02"), parseEther("0.01")],
  });
  await publicClient.waitForTransactionReceipt({ hash: l1Hash });

  for (let i = 0; i < 8; i++) {
    const acct = privateKeyToAccount(PEOPLE_KEYS[i] as `0x${string}`);
    const client = createWalletClient({ account: acct, chain: localChain, transport: http(RPC_URL) });
    const joinHash = await client.writeContract({
      address: contractAddress,
      abi,
      functionName: "join",
      args: [1n],
      value: parseEther("0.02"),
    });
    await publicClient.waitForTransactionReceipt({ hash: joinHash });
  }

  // Line 2: Empty, entry fee 0.05 BOT, step price 0.02 BOT
  const l2Hash = await hostClient.writeContract({
    address: contractAddress,
    abi,
    functionName: "create",
    args: ["VIP Demo Session", parseEther("0.05"), parseEther("0.02")],
  });
  await publicClient.waitForTransactionReceipt({ hash: l2Hash });

  // Line 3: Closed with three people
  const l3Hash = await hostClient.writeContract({
    address: contractAddress,
    abi,
    functionName: "create",
    args: ["Author Book Signing", parseEther("0.01"), parseEther("0.01")],
  });
  await publicClient.waitForTransactionReceipt({ hash: l3Hash });

  for (let i = 0; i < 3; i++) {
    const acct = privateKeyToAccount(PEOPLE_KEYS[i] as `0x${string}`);
    const client = createWalletClient({ account: acct, chain: localChain, transport: http(RPC_URL) });
    const joinHash = await client.writeContract({
      address: contractAddress,
      abi,
      functionName: "join",
      args: [3n],
      value: parseEther("0.01"),
    });
    await publicClient.waitForTransactionReceipt({ hash: joinHash });
  }
  const closeHash = await hostClient.writeContract({
    address: contractAddress,
    abi,
    functionName: "close",
    args: [3n],
  });
  await publicClient.waitForTransactionReceipt({ hash: closeHash });

  // Line 4: where Person A (Account 1) is at the front, followed by B and C
  const l4Hash = await hostClient.writeContract({
    address: contractAddress,
    abi,
    functionName: "create",
    args: ["Coffee Bar Fast Pass", parseEther("0.01"), parseEther("0.005")],
  });
  await publicClient.waitForTransactionReceipt({ hash: l4Hash });

  for (let i = 0; i < 3; i++) {
    const acct = privateKeyToAccount(PEOPLE_KEYS[i] as `0x${string}`);
    const client = createWalletClient({ account: acct, chain: localChain, transport: http(RPC_URL) });
    const joinHash = await client.writeContract({
      address: contractAddress,
      abi,
      functionName: "join",
      args: [4n],
      value: parseEther("0.01"),
    });
    await publicClient.waitForTransactionReceipt({ hash: joinHash });
  }

  console.log("Local stack ready! Running indefinitely. Press Ctrl+C to exit.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
