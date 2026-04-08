import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const CalldataBenchmarkModule = buildModule("CalldataBenchmarkModule", (m) => {
  // 部署合约（无构造参数）
  const calldataBenchmark = m.contract("CalldataBenchmark", []);

  return { calldataBenchmark };
});

export default CalldataBenchmarkModule;
