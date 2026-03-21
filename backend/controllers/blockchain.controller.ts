import type { Request, Response } from "express";
import { storage } from "../storage";
import { blockchainService } from "../services/blockchain";
import { asyncHandler } from "../middleware/error-handler";

// Get blockchain status
export const getStatus = asyncHandler(async (req: Request, res: Response) => {
    const networkStatus = await blockchainService.getNetworkStatus();
    const persistedStatus =
        networkStatus.status === "CONNECTED"
            ? "connected"
            : networkStatus.status === "DISCONNECTED"
                ? "disconnected"
                : "syncing";

    // Update status in storage
    await storage.updateBlockchainStatus({
        network: process.env.BLOCKCHAIN_NETWORK || "sepolia",
        blockHeight: networkStatus.blockHeight.toString(),
        gasPrice: networkStatus.gasPrice,
        status: persistedStatus,
    });

    const updatedStatus = await storage.getBlockchainStatus();
    res.json({
        ...updatedStatus,
        network: process.env.BLOCKCHAIN_NETWORK || "sepolia",
        status: networkStatus.status,
        connectionStatus: networkStatus.status,
        legacyStatus: persistedStatus,
        ...(networkStatus.error ? { error: networkStatus.error } : {}),
    });
});

// Get recent activity
export const getRecentActivity = asyncHandler(async (req: Request, res: Response) => {
    const verifications = await storage.getRecentVerifications(10);
    res.json(verifications);
});
