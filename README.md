# 📦 Full Chain Pipeline

This project implements a **complete on-chain academic publishing pipeline**, including data collection, compression, encryption, chunking, and full blockchain execution. It enables end-to-end reproducible experiments for storing academic papers fully on-chain.

---

# 🧱 Environment Setup

## Python

- Python 3.14

Install dependencies:

```bash
pip install -r requirements.txt
```

---

## Node.js

- Node.js 24.11
- npm 11.6

Install dependencies:

```bash
npm install
```

---

# 📊 Data Collection

Use:

```
analysis/datasets.ipynb
```

to collect dataset from arXiv according to requirements.

Output file:

```
analysis/files/arxiv_tex_dataset.xlsx
```

---

# 🗜️ Compression Benchmark

Use:

```
analysis/compression.ipynb
```

to evaluate different compression algorithms.

Output file:

```
analysis/files/compression.xlsx
```

---

# 🔐 Compression & Encryption

Use:

```
analysis/hex.ipynb
```

to process data with:

- Compression
- Encryption
- Measurement of compression ratio, encryption time, and decryption time

Output file:

```
analysis/files/hex.xlsx
```

Additionally, in:

```
analysis/files/hexs/
```

each paper generates a JSON file containing:

- Compressed & encrypted data (hex)
- RSA-encrypted decryption key

---

# 🔐 Cryptographic Analysis

Use:

```
analysis/crypto.ipynb
```

to analyze encryption performance across all samples, including:

- Symmetric encryption (AES)
- Asymmetric encryption (RSA)

---

# ⛓️ Chunk Analysis (Local Simulation)

This experiment requires blockchain simulation using Hardhat.

Start local node:

```bash
npx hardhat node
```

---

## Single Sample Chunk Test

Set:

```
PAPER_JSON_FILE
```

Run:

```bash
npx hardhat run scripts/chunk-gas-latency.ts
```

Output:

```
analysis/files/chunk-gas-latency.csv
```

Analyze results using:

```
analysis/chunk.ipynb
```

---

## Full Dataset Chunk Test

Set:

```
CHUNK_SIZE
```

Run:

```bash
npx hardhat run scripts/chunk-sample.ts
```

Output:

```
analysis/files/chunk-sample.csv
```

Analyze results using:

```
analysis/chunk.ipynb
```

> You can stop the Hardhat node after experiments are completed.

---

# 🌐 Full Pipeline (Testnet / Mainnet)

⚠️ This stage interacts with real blockchain networks and may incur costs.

---

## 🔧 Environment Variables

Create environment file:

```bash
cp .env.example .env
```

Configure:

```ini
PRIVATE_KEY=Account private key for contract deployment
FLAT_KEY=Private key for flat-directory deployment (should differ from PRIVATE_KEY)
RPC_URL=Blockchain RPC endpoint
ETHSTORAGE_RPC=EthStorage RPC endpoint
JOURNAL_CONTRACT=Deployed JournalManager contract address
PAPER_JSON_FILE=Path to paper metadata JSON file
```

---

## 🧪 Test JournalManager Contract

```bash
npx hardhat test
```

---

## 📦 Deploy EthStorage Flat Directory

```bash
npx hardhat run scripts/flat-deploy.ts
```

This returns the flat-directory contract address, which should be added to `.env`.

---

## 🏛️ Deploy JournalManager Contract

Deployment requires the flat-directory address.

You can choose network:

- local
- testnet (e.g., Sepolia)
- mainnet

```bash
npx hardhat ignition deploy ./ignition/modules/JournalManager.ts --network sepolia
```

---

## 🚀 Run Full Pipeline

Ensure:

```
PAPER_JSON_FILE
```

points to a valid paper JSON file:

```json
{
  "id": "paper ID",
  "title": "paper title",
  "authors": ["author1", "author2"],
  "tar": "paper source tar.gz",
  "extraMetadataURI": "paper URI",
  "key": "RSA-encrypted private key",
  "data": "compressed & encrypted hex data"
}
```

Run:

```bash
npx hardhat run scripts/article-submit.ts
```

This will:

- Store paper content on-chain
- Upload assets to EthStorage
- Measure gas / wei consumption

Output file:

```
analysis/files/result_[paper ID].json
```

---

## 📈 Pipeline Analysis

Use:

```
analysis/pipeline.ipynb
```

to analyze pipeline outputs and generate:

- Figures
- Tables
- Performance summaries

---

# 📌 Summary

This project implements a full pipeline for on-chain academic publishing:

```
Data Collection → Compression → Encryption → Chunking → On-chain Storage → Reconstruction
```

It is suitable for:

- Blockchain storage research
- Decentralized scientific publishing (DeSci)
- On-chain data persistence experiments
