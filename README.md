# Quinty: Decentralized Bounty & Airdrop Platform

Quinty is a fully on-chain bounty and airdrop platform designed to foster trust and transparency between creators and contributors. It features a robust, soulbound reputation system to reward participation and ensure fairness within the ecosystem.

## Core Features

-   **Decentralized Bounties**: Creators can fund bounties for specific tasks, and solvers can submit their work for a reward.
-   **Airdrop Campaigns**: Launch promotional campaigns where rewards are distributed based on verifiable, on-chain proof of engagement.
-   **On-Chain Reputation**: A soulbound (non-transferable) ERC721 NFT system that represents a user's reputation as both a creator and a solver.
-   **Dispute Resolution**: A community-driven voting mechanism to fairly resolve disputes that may arise from bounty resolutions.

## Architecture

The Quinty ecosystem is comprised of a set of smart contracts and a frontend dApp for user interaction.

### Smart Contracts (`/contracts`)

-   `Quinty.sol`: The core contract that manages the entire lifecycle of bounties, from creation and submission to resolution.
-   `AirdropBounty.sol`: Manages the creation, participation, and reward distribution for promotional airdrop campaigns.
-   `QuintyReputation.sol`: An ERC721-based contract for minting and updating soulbound reputation tokens (badges) for users.
-   `DisputeResolver.sol`: Manages the community voting process to handle bounty disputes.

### Frontend (`/FRONTEND`)

A decentralized application (dApp) built with Next.js that provides a user-friendly interface for interacting with all features of the Quinty platform.

## Tech Stack

-   **Blockchain**: Solidity, Hardhat, Ethers.js, OpenZeppelin
-   **Frontend**: Next.js, React, TypeScript, Wagmi, Viem, Tailwind CSS

## Local Development

Follow these steps to set up and run the project locally.

### Prerequisites

-   [Git](https://git-scm.com/)
-   [Node.js](https://nodejs.org/en/) (v18 or later recommended)
-   `npm` or `yarn`

### Installation

1.  **Clone the repository:**
    ```shell
    git clone <your-repository-url>
    cd sc-quinty
    ```

2.  **Install root dependencies:**
    ```shell
    npm install
    ```

3.  **Install frontend dependencies:**
    ```shell
    cd FRONTEND
    npm install
    ```

4.  **Set up environment variables:**
    Return to the root directory (`cd ..`). This project uses `.env` files for configuration.
    -   In the root directory, copy `.env.example` to `.env` and add your private key and network RPC URL (e.g., for Somnia Testnet).
    -   In the `FRONTEND` directory, copy `.env.example` to `.env.local` if you need to override any frontend-specific variables.

## Usage & Scripts

### Smart Contracts

-   **Compile Contracts:**
    ```shell
    npx hardhat compile
    ```

-   **Run Tests:**
    ```shell
    npx hardhat test
    ```

-   **Run a Local Blockchain Node:**
    ```shell
    npx hardhat node
    ```

-   **Deploy Contracts:**
    The `scripts/deploy.ts` script handles the deployment of all contracts and configures their interconnections. Run it with the desired network.
    ```shell
    npx hardhat run scripts/deploy.ts --network <your-network-name>
    ```
    After a successful deployment, contract addresses will be saved in `deployments.json`.

### Frontend

-   **Run the development server:**
    ```shell
    cd FRONTEND
    npm run dev
    ```
    Open [http://localhost:3000](http://localhost:3000) in your browser to see the application.