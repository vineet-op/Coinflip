"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Coins, Wallet } from "lucide-react"
import { BrowserProvider, Contract, formatEther, parseEther } from "ethers"
import CoinFlip from "../../../contract/artifacts/contracts/CoinFlip.sol/CoinFlip.json"

// Contract Configuration
const CONTRACT_ADDRESS = "0x5B36E238d823e01B0363Ee128F59d2d4d9c60668"

const CONTRACT_ABI = CoinFlip.abi

type GameResult = {
    result: "heads" | "tails"
    won: boolean
    payout: string
    txHash: string
} | null

declare global {
    interface Window {
        ethereum?: any
    }
}

export default function Coin_Flip() {
    const [walletAddress, setWalletAddress] = useState("")
    const [betAmount, setBetAmount] = useState("")
    const [selectedSide, setSelectedSide] = useState<"heads" | "tails">("heads")
    const [isFlipping, setIsFlipping] = useState(false)
    const [gameResult, setGameResult] = useState<GameResult>(null)
    const [balance, setBalance] = useState("0")
    const [contractBalance, setContractBalance] = useState("0")
    const [provider, setProvider] = useState<BrowserProvider | null>(null)
    const [contract, setContract] = useState<Contract | null>(null)
    const [isConnecting, setIsConnecting] = useState(false)
    const [error, setError] = useState("")

    const connectWallet = async () => {
        try {
            setIsConnecting(true)
            setError("")

            if (!window.ethereum) {
                setError("MetaMask is not installed!")
                return
            }

            const browserProvider = new BrowserProvider(window.ethereum)
            await browserProvider.send("eth_requestAccounts", [])
            const signer = await browserProvider.getSigner()
            const address = await signer.getAddress()
            const userBalance = await browserProvider.getBalance(address)

            // Initialize contract
            const contractInstance = new Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer)

            setProvider(browserProvider)
            setContract(contractInstance)
            setWalletAddress(address)
            setBalance(formatEther(userBalance))

            // Get contract balance
            const contractBal = await contractInstance.getBalance()
            setContractBalance(formatEther(contractBal))

            console.log("Connected wallet address:", address)
        } catch (error) {
            console.error("Wallet connection failed:", error)
            setError("Failed to connect wallet. Please try again.")
        } finally {
            setIsConnecting(false)
        }
    }

    // Add this function to your component
    const addFundsToContract = async () => {
        if (!contract) {
            setError("Contract not connected")
            return
        }

        try {
            setError("")
            // Add 0.1 ETH to contract (adjust amount as needed)
            const fundAmount = parseEther("0.044")

            const tx = await contract.addFunds({ value: fundAmount })
            console.log("Adding funds transaction:", tx.hash)

            await tx.wait()
            console.log("Funds added successfully")

            // Update contract balance
            const newContractBalance = await contract.getBalance()
            setContractBalance(formatEther(newContractBalance))

            // Update user balance
            const newUserBalance = await provider!.getBalance(walletAddress)
            setBalance(formatEther(newUserBalance))

        } catch (error) {
            console.error("Add funds failed:", error)
            setError("Failed to add funds to contract")
        }
    }

    const flipCoin = async () => {
        if (!contract || !walletAddress || !betAmount || Number.parseFloat(betAmount) <= 0) {
            setError("Please enter a valid bet amount")
            return
        }

        const bet = parseFloat(betAmount)
        if (bet > parseFloat(balance)) {
            setError("Insufficient balance")
            return
        }

        try {
            setIsFlipping(true)
            setGameResult(null)
            setError("")

            // Convert bet to wei
            const betInWei = parseEther(betAmount)

            // Check if contract has enough funds for potential payout
            // @ts-ignore
            const potentialPayout = (betInWei * 3n) / 2n
            const currentContractBalance = await contract.getBalance()

            if (currentContractBalance < potentialPayout) {
                setError("Contract doesn't have enough funds for this bet")
                setIsFlipping(false)
                return
            }

            // Call flipCoin function
            const choice = selectedSide === "heads" // true for heads, false for tails
            const tx = await contract.flipCoin(choice, { value: betInWei })

            console.log("Transaction sent:", tx.hash)

            // Wait for transaction to be mined
            const receipt = await tx.wait()
            console.log("Transaction mined:", receipt)

            // Parse the GameResult event
            const gameResultEvent = receipt.logs.find((log: any) => {
                try {
                    const parsed = contract.interface.parseLog(log)
                    return parsed?.name === "GameResult"
                } catch {
                    return false
                }
            })

            if (gameResultEvent) {
                const parsed = contract.interface.parseLog(gameResultEvent)

                if (!parsed) {
                    console.error("Failed to parse event log")
                    return
                }
                const [player, betAmt, playerChoice, result, won, payout] = parsed.args

                setGameResult({
                    result: result ? "heads" : "tails",
                    won: won,
                    payout: formatEther(payout),
                    txHash: tx.hash
                })

                console.log("Game Result:", {
                    betAmount,
                    selectedSide,
                    result,
                    won,
                    payout,
                });


                // Update balances
                const newBalance = await provider!.getBalance(walletAddress)
                setBalance(formatEther(newBalance))

                const newContractBalance = await contract.getBalance()
                setContractBalance(formatEther(newContractBalance))

                console.log("User balance before:", formatEther(await provider!.getBalance(walletAddress)))
                console.log("Transferring winnings:", formatEther(payout))
                console.log("User balance after:", formatEther(await provider!.getBalance(walletAddress)))

            }

        } catch (error: any) {
            console.error("Flip coin failed:", error)
            if (error.code === "INSUFFICIENT_FUNDS") {
                setError("Insufficient funds for gas fee")
            } else if (error.code === "USER_REJECTED") {
                setError("Transaction rejected by user")
            } else {
                setError("Transaction failed. Please try again.")
            }
        } finally {
            setIsFlipping(false)
        }
    }

    const resetGame = () => {
        setGameResult(null)
        setBetAmount("")
        setError("")
    }

    const switchToSepolia = async () => {
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: '0xaa36a7' }], // Sepolia chainId
            })
        } catch (error: any) {
            if (error.code === 4902) {
                // Chain not added to MetaMask
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: '0xaa36a7',
                        chainName: 'Sepolia Test Network',
                        nativeCurrency: {
                            name: 'ETH',
                            symbol: 'ETH',
                            decimals: 18
                        },
                        rpcUrls: ['https://sepolia.infura.io/v3/'],
                        blockExplorerUrls: ['https://sepolia.etherscan.io/']
                    }]
                })
            }
        }
    }

    useEffect(() => {
        // Auto-connect on page load
        if (window.ethereum) {
            connectWallet()
        }
    }, [])

    return (
        <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
            <div className="w-full max-w-md font-sans">
                <div className="text-center mb-8">
                    <h1 className="text-4xl font-bold text-white mb-2 flex items-center justify-center gap-2">
                        <Coins className="h-8 w-8" />
                        Crypto Coin Flip
                    </h1>
                    <p className="text-blue-200">Bet on heads or tails - Win 1.5x your bet!</p>
                    <p className="text-sm text-blue-300 mt-2">Contract Balance: {contractBalance} ETH</p>
                </div>

                <Card className="backdrop-blur-sm bg-white/10 border-white/20 text-white">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Wallet className="h-5 w-5" />
                            Place Your Bet
                        </CardTitle>
                        <CardDescription className="text-blue-200">
                            Balance: {balance} ETH
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {/* Error Display */}
                        {error && (
                            <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-3 text-red-200 text-sm">
                                {error}
                            </div>
                        )}

                        {/* Wallet Connection */}
                        {!walletAddress ? (
                            <div className="text-center">
                                <Button
                                    onClick={connectWallet}
                                    disabled={isConnecting}
                                    className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                                >
                                    {isConnecting ? "Connecting..." : "Connect Wallet"}
                                </Button>
                                <p className="text-xs text-blue-200 mt-2">
                                    Make sure you're on Sepolia testnet
                                </p>
                                <Button
                                    onClick={switchToSepolia}
                                    variant="outline"
                                    size="sm"
                                    className="mt-2 text-xs border-white/20 text-white hover:bg-white/10"
                                >
                                    Switch to Sepolia
                                </Button>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    <Label htmlFor="wallet" className="text-white">
                                        Wallet Address
                                    </Label>
                                    <Input
                                        id="wallet"
                                        value={walletAddress}
                                        disabled
                                        className="bg-white/10 border-white/20 text-white"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="bet" className="text-white">
                                        Bet Amount (ETH)
                                    </Label>
                                    <Input
                                        id="bet"
                                        type="number"
                                        placeholder="0.01"
                                        value={betAmount}
                                        onChange={(e) => setBetAmount(e.target.value)}
                                        className="bg-white/10 border-white/20 text-white placeholder:text-gray-300"
                                        min="0"
                                        step="0.01"
                                    />
                                </div>

                                <div className="space-y-3">
                                    <Label className="text-white">Choose Your Side</Label>
                                    <RadioGroup
                                        value={selectedSide}
                                        onValueChange={(value: "heads" | "tails") => setSelectedSide(value)}
                                        className="grid grid-cols-2 gap-4"
                                    >
                                        <div>
                                            <RadioGroupItem value="heads" id="heads" className="peer sr-only" />
                                            <Label
                                                htmlFor="heads"
                                                className="flex flex-col items-center justify-center rounded-lg border-2 border-white/20 bg-white/5 p-4 hover:bg-white/10 peer-data-[state=checked]:border-yellow-400 peer-data-[state=checked]:bg-yellow-400/20 cursor-pointer transition-all"
                                            >
                                                <div className="text-2xl mb-2">👑</div>
                                                <div className="font-semibold">HEADS</div>
                                            </Label>
                                        </div>
                                        <div>
                                            <RadioGroupItem value="tails" id="tails" className="peer sr-only" />
                                            <Label
                                                htmlFor="tails"
                                                className="flex flex-col items-center justify-center rounded-lg border-2 border-white/20 bg-white/5 p-4 hover:bg-white/10 peer-data-[state=checked]:border-yellow-400 peer-data-[state=checked]:bg-yellow-400/20 cursor-pointer transition-all"
                                            >
                                                <div className="text-2xl mb-2">🦅</div>
                                                <div className="font-semibold">TAILS</div>
                                            </Label>
                                        </div>
                                    </RadioGroup>
                                </div>

                                {/* Coin Animation */}
                                <div className="flex justify-center py-6">
                                    <div
                                        className={`w-20 h-20 rounded-full bg-gradient-to-br from-yellow-400 to-yellow-600 flex items-center justify-center text-2xl shadow-lg ${isFlipping ? "animate-spin" : ""}`}
                                    >
                                        {isFlipping ? "🪙" : gameResult ? (gameResult.result === "heads" ? "👑" : "🦅") : "🪙"}
                                    </div>
                                </div>

                                {/* Game Result */}
                                {gameResult && (
                                    <div
                                        className={`text-center p-4 rounded-lg ${gameResult.won ? "bg-green-500/20 border border-green-500/30" : "bg-red-500/20 border border-red-500/30"}`}
                                    >
                                        <div className="text-lg font-bold mb-2">
                                            {gameResult.won ? "🎉 YOU WON!" : "😔 YOU LOST!"}
                                        </div>
                                        <div className="text-sm">
                                            Coin landed on: <span className="font-semibold uppercase">{gameResult.result}</span>
                                        </div>
                                        {gameResult.won && (
                                            <div className="text-sm mt-1">
                                                Payout: <span className="font-bold text-green-400">{gameResult.payout} ETH</span>
                                            </div>
                                        )}
                                        <div className="text-xs text-blue-200 mt-2">
                                            <a
                                                href={`https://sepolia.etherscan.io/tx/${gameResult.txHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="underline hover:text-blue-100"
                                            >
                                                View on Etherscan
                                            </a>
                                        </div>
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="space-y-2">
                                    <Button
                                        onClick={flipCoin}
                                        disabled={isFlipping || !betAmount || parseFloat(betAmount) <= 0}
                                        className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 font-sans"
                                    >
                                        {isFlipping ? "Flipping..." : "FLIP COIN"}
                                    </Button>

                                    {gameResult && (
                                        <Button
                                            onClick={resetGame}
                                            variant="outline"
                                            className="w-full border-white/20 text-white hover:bg-white/10 bg-black font-sans"
                                        >
                                            Play Again
                                        </Button>
                                    )}
                                </div>
                            </>
                        )}

                        <div className="text-xs text-center text-blue-200 mt-4">
                            * Real transactions on Sepolia testnet. Get testnet ETH from faucets.
                        </div>

                        {walletAddress && (
                            <div className="mb-4">
                                <Button
                                    onClick={addFundsToContract}
                                    variant="outline"
                                    className="w-full border-white/20 text-white hover:bg-white/10 mb-2 bg-black font-sans rounded-2xl cursor-pointer"
                                >
                                    Add 0.044 ETH to Contract
                                </Button>
                                <p className="text-xs text-blue-200 text-center">
                                    Contract needs funds to pay out winnings
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}