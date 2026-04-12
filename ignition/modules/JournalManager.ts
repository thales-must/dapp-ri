import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const JournalManagerModule = buildModule("JournalManagerModule", (m) => {
  // 部署合约（无构造参数）
  const JournalManager = m.contract("JournalManager", [
    "0x7bF77D7ab72B8F75799FFd0fbE3c491b4BBB8f84",
  ]);

  return { JournalManager };
});

export default JournalManagerModule;
