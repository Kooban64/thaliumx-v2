require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config({ path: __dirname + "/.env" });

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required for this network configuration`);
  }
  return value;
}

function getOptionalEnv(name) {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

function getAccounts() {
  return process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [];
}

function createNetworkConfig({ urlEnvVar, chainId, gasPrice }) {
  const url = getOptionalEnv(urlEnvVar);

  if (!url) {
    return undefined;
  }

  return {
    url,
    chainId,
    accounts: getAccounts(),
    gasPrice,
  };
}

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
      viaIR: true,
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
      gas: 12000000,
      blockGasLimit: 12000000,
      allowUnlimitedContractSize: true,
    },
    localhost: {
      url: "http://127.0.0.1:8545",
      chainId: 31337,
    },
    ...(createNetworkConfig({
      urlEnvVar: "RPC_URL",
      chainId: 97,
      gasPrice: 10000000000,
    })
      ? {
          bscTestnet: createNetworkConfig({
            urlEnvVar: "RPC_URL",
            chainId: 97,
            gasPrice: 10000000000,
          }),
        }
      : {}),
    ...(createNetworkConfig({
      urlEnvVar: "ETH_MAINNET_RPC_URL",
      chainId: 1,
      gasPrice: 20000000000,
    })
      ? {
          mainnet: createNetworkConfig({
            urlEnvVar: "ETH_MAINNET_RPC_URL",
            chainId: 1,
            gasPrice: 20000000000,
          }),
        }
      : {}),
    },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: "USD",
    gasPrice: 20,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
  contractSizer: {
    alphaSort: true,
    disambiguatePaths: false,
    runOnCompile: true,
    strict: true,
    only: [
      "ThaliumToken",
      "ThaliumNFT",
      "ThaliumGovernance",
      "ThaliumBridge",
      "ThaliumOracle",
      "ThaliumPresale",
      "ThaliumSecurity",
      "ThaliumDEX",
      "ThaliumMarginVault",
      "EmergencyControls",
      "ThaliumVesting",
    ],
  },
  etherscan: {
    apiKey: {
      mainnet: process.env.ETHERSCAN_API_KEY,
      bscTestnet: process.env.BSCSCAN_API_KEY,
    },
  },
  mocha: {
    timeout: 40000,
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};
