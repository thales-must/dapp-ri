import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const JournalManagerModule = buildModule("JournalManagerModule", (m) => {
  // 部署合约（无构造参数）
  const JournalManager = m.contract("JournalManager", [
    "0x9a17DE4452161Efa70E3E1C5E2Acc4ADa998EC97",
  ]);

  return { JournalManager };
});

export default JournalManagerModule;
