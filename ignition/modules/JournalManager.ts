import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const JournalManagerModule = buildModule("JournalManagerModule", (m) => {
  // 部署合约（无构造参数）
  const JournalManager = m.contract("JournalManager", []);

  return { JournalManager };
});

export default JournalManagerModule;
