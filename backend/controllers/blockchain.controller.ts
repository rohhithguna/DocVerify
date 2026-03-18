import type { Request, Response } from "express";
import { storage } from "../storage";
import { blockchainService } from "../services/blockchain";
import { asyncHandler } from "../middleware/error-handler";

// Get blockchain status
export const getStatus = asyncHandler(async (req: Request, res: Response) => {
    const networkStatus = await blockchainService.getNetworkStatus();

    // Update status in storage
    await storage.updateBlockchainStatus({
        network: "sepolia",
        blockHeight: networkStatus.blockHeight.toString(),
        gasPrice: networkStatus.gasPrice,
        status: networkStatus.isConnected ? "connected" : "disconnected",
    });

    const updatedStatus = await storage.getBlockchainStatus();
    res.json(updatedStatus);
});

// Get recent activity
export const getRecentActivity = asyncHandler(async (req: Request, res: Response) => {
    const verifications = await storage.getRecentVerifications(10);
    res.json(verifications);
});
