import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "child_process";
import {
  createWalletClient,
  createPublicClient,
  http,
  parseEther,
  type Address,
  defineChain,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { BOTCHAIN_ABI } from "../../lib/botchain/abi";
import { readFileSync } from "fs";
import { resolve } from "path";

const ANVIL_PORT = 8656;
const RPC_URL = `http://127.0.0.1:${ANVIL_PORT}`;

const localChain = defineChain({
  id: 31337,
  name: "Anvil Local",
  nativeCurrency: { name: "BOT", symbol: "BOT", decimals: 18 },
  rpcUrls: {
    default: { http: [RPC_URL] },
  },
});

// Anvil default accounts
const HOST_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // Account 0
const ALICE_KEY = "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"; // Account 1
const BOB_KEY = "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a";   // Account 2
const CHARLIE_KEY = "0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6"; // Account 3
const DAVE_KEY = "0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a"; // Account 4

const hostAccount = privateKeyToAccount(HOST_KEY);
const aliceAccount = privateKeyToAccount(ALICE_KEY);
const bobAccount = privateKeyToAccount(BOB_KEY);
const charlieAccount = privateKeyToAccount(CHARLIE_KEY);
const daveAccount = privateKeyToAccount(DAVE_KEY);

describe("Cutline integration test (Anvil)", () => {
  let anvilProcess: ChildProcess;
  let contractAddress: Address;

  const publicClient = createPublicClient({
    chain: localChain,
    transport: http(RPC_URL),
  });

  const hostClient = createWalletClient({
    account: hostAccount,
    chain: localChain,
    transport: http(RPC_URL),
  });

  const aliceClient = createWalletClient({
    account: aliceAccount,
    chain: localChain,
    transport: http(RPC_URL),
  });

  const bobClient = createWalletClient({
    account: bobAccount,
    chain: localChain,
    transport: http(RPC_URL),
  });

  const charlieClient = createWalletClient({
    account: charlieAccount,
    chain: localChain,
    transport: http(RPC_URL),
  });

  const daveClient = createWalletClient({
    account: daveAccount,
    chain: localChain,
    transport: http(RPC_URL),
  });

  beforeAll(async () => {
    anvilProcess = spawn("anvil", ["--port", String(ANVIL_PORT), "--silent"], {
      stdio: "ignore",
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
    if (!connected) throw new Error("Could not connect to Anvil on port " + ANVIL_PORT);

    const artifactPath = resolve(__dirname, "../../contracts/out/Cutline.sol/Cutline.json");
    const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
    const bytecode = artifact.bytecode.object as `0x${string}`;

    const deployHash = await hostClient.deployContract({
      abi: BOTCHAIN_ABI,
      bytecode,
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: deployHash });
    if (!receipt.contractAddress) throw new Error("Contract deployment failed");
    contractAddress = receipt.contractAddress;
  });

  afterAll(() => {
    if (anvilProcess) {
      anvilProcess.kill();
    }
  });

  it("completes full queue lifecycle: join, skip with sideways compensation, serve, and rejoin", async () => {
    const entryFee = parseEther("0.02");
    const stepPrice = parseEther("0.01");

    // 1. Host creates line
    const createTx = await hostClient.writeContract({
      address: contractAddress,
      abi: BOTCHAIN_ABI,
      functionName: "create",
      args: ["Integration Queue", entryFee, stepPrice],
    });
    await publicClient.waitForTransactionReceipt({ hash: createTx });

    const lineId = 1n;

    // 2. Alice, Bob, Charlie, Dave join in sequence
    for (const [client, acct] of [
      [aliceClient, aliceAccount],
      [bobClient, bobAccount],
      [charlieClient, charlieAccount],
      [daveClient, daveAccount],
    ] as const) {
      const tx = await client.writeContract({
        address: contractAddress,
        abi: BOTCHAIN_ABI,
        functionName: "join",
        args: [lineId],
        value: entryFee,
      });
      await publicClient.waitForTransactionReceipt({ hash: tx });
    }

    // Host should have pending entry fees: 4 * 0.02 = 0.08 BOT
    const hostPending = (await publicClient.readContract({
      address: contractAddress,
      abi: BOTCHAIN_ABI,
      functionName: "pending",
      args: [hostAccount.address],
    })) as bigint;
    expect(hostPending).toBe(entryFee * 4n);

    // Initial order: Alice (1), Bob (2), Charlie (3), Dave (4)
    let slice = (await publicClient.readContract({
      address: contractAddress,
      abi: BOTCHAIN_ABI,
      functionName: "queueSlice",
      args: [lineId, 0, 10],
    })) as `0x${string}`[];
    expect(slice).toEqual([
      aliceAccount.address,
      bobAccount.address,
      charlieAccount.address,
      daveAccount.address,
    ]);

    // 3. Dave skips 2 places (from pos 4 to pos 2)
    // Dave pays 2 * stepPrice (0.02 BOT)
    // Charlie (pos 3) and Bob (pos 2) are passed and each get credited 0.01 BOT
    const skipTx = await daveClient.writeContract({
      address: contractAddress,
      abi: BOTCHAIN_ABI,
      functionName: "skip",
      args: [lineId, 2],
      value: stepPrice * 2n,
    });
    await publicClient.waitForTransactionReceipt({ hash: skipTx });

    // Verify positions: Alice (1), Dave (2), Bob (3), Charlie (4)
    slice = (await publicClient.readContract({
      address: contractAddress,
      abi: BOTCHAIN_ABI,
      functionName: "queueSlice",
      args: [lineId, 0, 10],
    })) as `0x${string}`[];
    expect(slice).toEqual([
      aliceAccount.address,
      daveAccount.address,
      bobAccount.address,
      charlieAccount.address,
    ]);

    // Verify payments: Bob and Charlie received stepPrice
    const bobPending = (await publicClient.readContract({
      address: contractAddress,
      abi: BOTCHAIN_ABI,
      functionName: "pending",
      args: [bobAccount.address],
    })) as bigint;
    const charliePending = (await publicClient.readContract({
      address: contractAddress,
      abi: BOTCHAIN_ABI,
      functionName: "pending",
      args: [charlieAccount.address],
    })) as bigint;
    expect(bobPending).toBe(stepPrice);
    expect(charliePending).toBe(stepPrice);

    // 4. Host serves Alice (pos 1)
    const serveTx1 = await hostClient.writeContract({
      address: contractAddress,
      abi: BOTCHAIN_ABI,
      functionName: "serve",
      args: [lineId],
    });
    await publicClient.waitForTransactionReceipt({ hash: serveTx1 });

    // Alice is now out
    const alicePos1 = (await publicClient.readContract({
      address: contractAddress,
      abi: BOTCHAIN_ABI,
      functionName: "positionOf",
      args: [lineId, aliceAccount.address],
    })) as [boolean, number, number];
    expect(alicePos1[0]).toBe(false);

    // Dave is now at the front (pos 1)
    const davePos = (await publicClient.readContract({
      address: contractAddress,
      abi: BOTCHAIN_ABI,
      functionName: "positionOf",
      args: [lineId, daveAccount.address],
    })) as [boolean, number, number];
    expect(davePos[0]).toBe(true);
    expect(davePos[1]).toBe(1);

    // 5. Alice rejoins at the back (pos 4)
    const rejoinTx = await aliceClient.writeContract({
      address: contractAddress,
      abi: BOTCHAIN_ABI,
      functionName: "join",
      args: [lineId],
      value: entryFee,
    });
    await publicClient.waitForTransactionReceipt({ hash: rejoinTx });

    const alicePos2 = (await publicClient.readContract({
      address: contractAddress,
      abi: BOTCHAIN_ABI,
      functionName: "positionOf",
      args: [lineId, aliceAccount.address],
    })) as [boolean, number, number];
    expect(alicePos2[0]).toBe(true);
    expect(alicePos2[1]).toBe(4);

    // 6. Bob withdraws compensation
    const bobBalanceBefore = await publicClient.getBalance({ address: bobAccount.address });
    const withdrawTx = await bobClient.writeContract({
      address: contractAddress,
      abi: BOTCHAIN_ABI,
      functionName: "withdraw",
    });
    const withdrawReceipt = await publicClient.waitForTransactionReceipt({ hash: withdrawTx });
    const gasUsed = withdrawReceipt.gasUsed * withdrawReceipt.effectiveGasPrice;
    const bobBalanceAfter = await publicClient.getBalance({ address: bobAccount.address });

    expect(bobBalanceAfter).toBe(bobBalanceBefore + stepPrice - gasUsed);
  });
});
