下面是你这份 README 的**完整中文版**（已经按学术/项目文档风格整理，可以直接用）：

---

# 📦 全链路论文上链流程（Full Chain Pipeline）

本项目实现了一个**完整的链上学术出版流程**，涵盖数据收集、压缩、加密、分块（chunking）以及区块链执行等关键步骤。该系统支持对论文进行端到端的可复现实验，实现**学术论文内容的完全上链存储**。

---

# 🧱 环境配置

## Python 环境

- Python 3.14

安装依赖：

```bash
pip install -r requirements.txt
```

---

## Node.js 环境

- Node.js 24.11
- npm 11.6

安装依赖：

```bash
npm install
```

---

# 📊 数据收集

使用：

```
analysis/datasets.ipynb
```

从 arXiv 按实验要求收集数据集。

输出文件：

```
analysis/files/arxiv_dataset.xlsx
```

筛选后的数据文件：

```
analysis/files/work_dataset.xlsx
```

---

# 🗜️ 压缩性能测试

使用：

```
analysis/compression.ipynb
```

评估不同压缩算法的性能。

输出文件：

```
analysis/files/compression.xlsx
```

---

# 🔐 压缩与加密处理

使用：

```
analysis/hex.ipynb
```

对数据进行以下处理：

- 数据压缩
- 数据加密
- 压缩率、加密时间、解密时间统计

输出文件：

```
analysis/files/hex.xlsx
```

此外，在：

```
analysis/files/hexs/
```

每篇论文会生成一个 JSON 文件，包含：

- 压缩并加密后的数据（hex 格式）
- 使用 RSA 加密的解密密钥

---

# 🔐 密码学性能分析

使用：

```
analysis/crypto.ipynb
```

对所有样本的加密性能进行分析，包括：

- 对称加密（AES）
- 非对称加密（RSA）

---

# ⛓️ 分块（Chunk）分析（本地模拟）

该实验需要使用 Hardhat 进行区块链本地模拟。

启动本地区块链节点：

```bash
npx hardhat node
```

---

## 单样本分块测试

设置：

```
PAPER_JSON_FILE
```

运行：

```bash
npx hardhat run scripts/chunk-gas-latency.ts
```

输出文件：

```
analysis/files/chunk-gas-latency.csv
```

使用：

```
analysis/chunk.ipynb
```

分析实验结果。

---

## 全数据集分块测试

设置：

```
CHUNK_SIZE
```

运行：

```bash
npx hardhat run scripts/chunk-sample.ts
```

输出文件：

```
analysis/files/chunk-sample.csv
```

使用：

```
analysis/chunk.ipynb
```

进行分析。

> 实验完成后可关闭 Hardhat 节点。

---

# 🌐 全流程执行（测试网 / 主网）

⚠️ 本阶段涉及真实区块链交互，可能产生费用。

---

## 🔧 环境变量配置

创建环境文件：

```bash
cp .env.example .env
```

配置如下内容：

```ini
PRIVATE_KEY=用于部署合约的账户私钥
FLAT_KEY=用于部署 flat-directory 的私钥（需不同于 PRIVATE_KEY）
RPC_URL=区块链 RPC 接口地址
ETHSTORAGE_RPC=EthStorage RPC 接口地址
JOURNAL_CONTRACT=已部署的 JournalManager 合约地址
```

---

## 🧪 测试 JournalManager 合约

```bash
npx hardhat test
```

---

## 📦 部署 EthStorage Flat Directory

```bash
npx hardhat run scripts/flat-deploy.ts
```

该步骤会返回 flat-directory 合约地址，下一步要用。

---

## 🏛️ 部署 JournalManager 合约

部署时需要提供 flat-directory 地址。

可选择网络：

- local（本地）
- testnet（如 Sepolia）
- mainnet（主网）

```bash
npx hardhat ignition deploy ./ignition/modules/JournalManager.ts --network sepolia
```

---

## 🚀 执行完整上链流程

确保以下参数正确：

```
paperJsonFile
batch()
```

对应的 JSON 文件格式如下：

```json
{
  "id": "论文ID",
  "title": "论文标题",
  "authors": ["作者1", "作者2"],
  "tar": "论文源码 tar.gz",
  "extraMetadataURI": "论文URI",
  "key": "RSA加密后的密钥",
  "data": "压缩并加密后的hex数据"
}
```

运行：

```bash
npx hardhat run scripts/article-event.ts
```

该过程将：

- 将论文内容写入链上
- 将资源文件上传至 EthStorage
- 统计 gas / wei 消耗

输出文件：

```
analysis/files/event-[paper ID].csv
```

---

## 📈 流程分析

使用：

```
analysis/trace.ipynb
```

对流程结果进行分析，生成：

- 图表
- 表格
- 性能总结

---

# 📌 总结

本项目实现了一个完整的链上学术出版流程：

```
数据收集 → 压缩 → 加密 → 分块 → 链上存储 → 重建
```

适用于以下研究方向：

- 区块链存储系统研究
- 去中心化学术出版（DeSci）
- 链上数据持久化实验

---

如果你后面准备投稿，我也可以帮你把这段 README **再改成论文里的 “Artifact / Reproducibility / Code Availability” 那种风格**，Reviewer 会更喜欢。
