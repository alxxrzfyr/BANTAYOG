import { createPublicClient, createWalletClient, http, defineChain, keccak256, toBytes } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

// Define Ronin Saigon chain
const saigon = defineChain({
  id: 202601,
  name: 'Ronin Saigon Testnet',
  nativeCurrency: { name: 'RON', symbol: 'RON', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://saigon-testnet.roninchain.com/rpc'] },
  },
})

// Define local localhost chain for development
const localChain = defineChain({
  id: 31337,
  name: 'Hardhat Localhost',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
  },
})

export const PHPC_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  }
] as const

export const PHPC_SUBSIDY_ABI = [
  {
    inputs: [
      { name: 'beneficiaryId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' }
    ],
    name: 'allocateCredits',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'beneficiaryId', type: 'bytes32' },
      { name: 'merchantAddress', type: 'address' },
      { name: 'amount', type: 'uint256' },
      { name: 'transactionId', type: 'bytes32' }
    ],
    name: 'processTransaction',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ name: 'beneficiaryId', type: 'bytes32' }],
    name: 'getBalance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  }
] as const

export class ChainClient {
  private publicClient: any
  private walletClient: any
  private account: any
  private phpcAddress: `0x${string}`
  private subsidyAddress: `0x${string}`

  constructor() {
    const rpcUrl = process.env.RONIN_SAIGON_RPC_URL || 'http://127.0.0.1:8545'
    const isLocal = rpcUrl.includes('127.0.0.1') || rpcUrl.includes('localhost')
    const chain = isLocal ? localChain : saigon

    this.phpcAddress = (process.env.PHPC_TOKEN_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3') as `0x${string}`
    this.subsidyAddress = (process.env.PHPC_SUBSIDY_ADDRESS || '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512') as `0x${string}`

    this.publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl),
    })

    const privateKey = process.env.DEPLOYER_PRIVATE_KEY
    if (privateKey) {
      // Hex private key validation
      const formattedKey = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`
      this.account = privateKeyToAccount(formattedKey as `0x${string}`)
      this.walletClient = createWalletClient({
        account: this.account,
        chain,
        transport: http(rpcUrl),
      })
    }
  }

  /**
   * Hashes a UUID string to bytes32 index for Solidity
   */
  hashUuid(uuid: string): `0x${string}` {
    return keccak256(toBytes(uuid))
  }

  /**
   * Gets the token balance of an address on chain
   */
  async getBalance(address: string): Promise<bigint> {
    return await this.publicClient.readContract({
      address: this.phpcAddress,
      abi: PHPC_ABI,
      functionName: 'balanceOf',
      args: [address as `0x${string}`],
    })
  }

  /**
   * Gets the beneficiary credit balance from the subsidy contract
   */
  async getBeneficiaryBalance(beneficiaryUuid: string): Promise<bigint> {
    const idHash = this.hashUuid(beneficiaryUuid)
    return await this.publicClient.readContract({
      address: this.subsidyAddress,
      abi: PHPC_SUBSIDY_ABI,
      functionName: 'getBalance',
      args: [idHash],
    })
  }

  /**
   * Submits credit allocation transaction on chain (requires deployer/owner private key)
   */
  async allocateCredits(beneficiaryUuid: string, amountWei: bigint): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error('Wallet client not initialized (missing DEPLOYER_PRIVATE_KEY)')
    }

    const idHash = this.hashUuid(beneficiaryUuid)
    const hash = await this.walletClient.writeContract({
      address: this.subsidyAddress,
      abi: PHPC_SUBSIDY_ABI,
      functionName: 'allocateCredits',
      args: [idHash, amountWei],
    })

    return hash
  }

  /**
   * Processes a transaction on-chain by deducting from beneficiary and transferring to merchant
   */
  async processTransaction(
    beneficiaryUuid: string,
    merchantAddress: string,
    amountWei: bigint,
    transactionUuid: string
  ): Promise<`0x${string}`> {
    if (!this.walletClient) {
      throw new Error('Wallet client not initialized (missing DEPLOYER_PRIVATE_KEY)')
    }

    const benHash = this.hashUuid(beneficiaryUuid)
    const txHash = this.hashUuid(transactionUuid)

    const hash = await this.walletClient.writeContract({
      address: this.subsidyAddress,
      abi: PHPC_SUBSIDY_ABI,
      functionName: 'processTransaction',
      args: [benHash, merchantAddress as `0x${string}`, amountWei, txHash],
    })

    return hash
  }

  /**
   * Waits for a transaction receipt
   */
  async waitForTransactionReceipt(hash: `0x${string}`) {
    return await this.publicClient.waitForTransactionReceipt({ hash })
  }
}
