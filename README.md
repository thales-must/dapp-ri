# Sample Hardhat 3 Beta Project (`node:test` and `viem`)

This project showcases a Hardhat 3 Beta project using the native Node.js test runner (`node:test`) and the `viem` library for Ethereum interactions.

To learn more about the Hardhat 3 Beta, please visit the [Getting Started guide](https://hardhat.org/docs/getting-started#getting-started-with-hardhat-3). To share your feedback, join our [Hardhat 3 Beta](https://hardhat.org/hardhat3-beta-telegram-group) Telegram group or [open an issue](https://github.com/NomicFoundation/hardhat/issues/new) in our GitHub issue tracker.

## Project Overview

This example project includes:

- A simple Hardhat configuration file.
- Foundry-compatible Solidity unit tests.
- TypeScript integration tests using [`node:test`](nodejs.org/api/test.html), the new Node.js native test runner, and [`viem`](https://viem.sh/).
- Examples demonstrating how to connect to different types of networks, including locally simulating OP mainnet.

## Usage

### Running Tests

To run all the tests in the project, execute the following command:

```shell
npx hardhat test
```

You can also selectively run the Solidity or `node:test` tests:

```shell
npx hardhat test solidity
npx hardhat test nodejs
```

### Make a deployment to Sepolia

This project includes an example Ignition module to deploy the contract. You can deploy this module to a locally simulated chain or to Sepolia.

To run the deployment to a local chain:

```shell
npx hardhat ignition deploy ignition/modules/Counter.ts
```

To run the deployment to Sepolia, you need an account with funds to send the transaction. The provided Hardhat configuration includes a Configuration Variable called `SEPOLIA_PRIVATE_KEY`, which you can use to set the private key of the account you want to use.

You can set the `SEPOLIA_PRIVATE_KEY` variable using the `hardhat-keystore` plugin or by setting it as an environment variable.

To set the `SEPOLIA_PRIVATE_KEY` config variable using `hardhat-keystore`:

```shell
npx hardhat keystore set SEPOLIA_PRIVATE_KEY
```

After setting the variable, you can run the deployment with the Sepolia network:

```shell
npx hardhat ignition deploy --network sepolia ignition/modules/Counter.ts
```

# pipeline合约

准备好合约

## 环境变量

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

## 测试JournalManager合约

```bash
npx hardhat test
```

## 部署ethstorage的flat-directory

```bash
npx hardhat run script/flat-deploy.ts
```

会获得合约flat-directory的地址

## 部署JournalManager合约

部署时候需要携带合约flat-directory的地址

network可以选本地网，测试网，或者主网

```bash
npx hardhat ignition deploy ./ignition/modules/JournalManager.ts --network sepolia
```

## 测试pipline

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

## 解析pipeline

用`analysis/pipline.ipynb`可解析pipeline生成的json文件

可生成图片图片和表格
