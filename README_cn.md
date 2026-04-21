# full chain pipeline

论文上链全部流程

## 环境

python 3.14

安装python依赖库

```bash
pip install -r requirements.txt
```

node24.11

npm 11.6

安装npm依赖库

```bash
npm i
```

## 数据收集

`analysis/datasets.ipynb`文件可以按照要求收集需要的数据

输出文件`arxiv_tex_dataset.xlsx`

## 测试压缩算法

`analysis/compression.ipynb`文件可以测试压缩算法

输出文件`compression.xlsx`

## 压缩加密实施

`analysis/hex.ipynb`把现有数据做压缩加密处理并统计压缩率，加密时间和解密时间

输出文件`hex.xlsx`

在`hexs`目录，会为每个文件生成一个json文件，有压缩加密后的数据以及rsa加密后的解密密钥

## 加密数据统计

`analysis/crypto.ipynb`统计所有的样本的压缩时间以及解压时间，包含对称加密和非对称加密

## chunk统计

本实验需要上链模拟，使用hardhat

```bash
npx hardhat node
```

chunk上链测试，设置好`PAPER_JSON_FILE`为上链测试的样本

```bash
npx hardhat run scripts/chunk-gas-latency.ts
```

输出文件`chunk-gas-latency.csv`

`chunk.ipynb`对输出文件做统计

## chunk全部样本

全部样本chunk统计，设置好`CHUNK_SIZE`为选的chunk size

```bash
npx hardhat run scripts/chunk-sample.ts
```

输出文件`chunk-sample.csv`

`chunk.ipynb`对输出文件做统计

> 实验完毕后可以关闭hardhat node

## 完整pipeline

真链测试数据，实验过程可能产生费用

### 环境变量

设置一下环境变量

```bash
cp .env.example .env
```

```ini
PRIVATE_KEY=用于部署合约的account私钥
FLAT_KEY=用于部署flat-directory的account私钥，尽量不要跟PRIVATE_KEY相同，否则会有冲突
RPC_URL=区块链网址
ETHSTORAGE_RPC=ethstorage网址
JOURNAL_CONTRACT=journalManager合约部署之后的合约地址
PAPER_JSON_FILE=执行流水线的论文的metadata信息
```

### 测试JournalManager合约

```bash
npx hardhat test
```

### 部署ethstorage的flat-directory

```bash
npx hardhat run script/flat-deploy.ts
```

会获得合约flat-directory的地址，然后写在环境变量中

### 部署JournalManager合约

部署时候需要携带合约flat-directory的地址，然后写在环境变量中

network可以选本地网，测试网，或者主网

```bash
npx hardhat ignition deploy ./ignition/modules/JournalManager.ts --network sepolia
```

### 测试pipline

必须设置`PAPER_JSON_FILE`为要执行流水线的`paper`的`.json`文件

```json
{
  "id": paper ID,
  "title": paper title,
  "authors": paper authors，[string]格式,
  "tar": paper源文件tar.gz打包,
  "extraMetadataURI": paper URI,
  "key": rsa加密后的解密私钥,
  "data": tex内容压缩加密后的hex文件
}
```

把论文上全链，并且assets上传至ethstorage，并计算消耗的gas或者wei

```bash
npx hardhat run .\scripts\article-submit.ts
```

最后会生成文件`analysis/files/result_[paper ID].json`

### 解析pipeline

用`analysis/pipline.ipynb`可解析pipeline生成的json文件

可生成图片图片和表格
