import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("PaperModule", (m) => {
  const sol = m.contract("PaperManager");

  m.call(sol, "incBy", [5n]);

  return { sol };
});
