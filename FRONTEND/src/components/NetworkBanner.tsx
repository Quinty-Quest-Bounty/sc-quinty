"use client";

import { useChainId } from "wagmi";
import { SOMNIA_TESTNET_ID } from "../utils/contracts";
import { ensureSomniaNetwork } from "../utils/network";
import { Alert, AlertDescription } from "./ui/alert";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

export default function NetworkBanner() {
  const chainId = useChainId();
  const isOnSomnia = chainId === SOMNIA_TESTNET_ID;

  const handleSwitchNetwork = async () => {
    const success = await ensureSomniaNetwork();
    if (success) {
      // Force page refresh to update chain state
      window.location.reload();
    }
  };

  if (isOnSomnia) {
    return (
      <Alert variant="success" className="py-2">
        {/* <CheckCircle className="h-3 w-3 mt-0.5" /> */}
        <AlertDescription className="flex items-center justify-between min-h-[20px]">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium leading-5">
              Somnia Testnet
            </span>
            <Badge
              variant="outline"
              className="text-xs h-5 px-2 flex items-center bg-green-100 text-green-700 border-green-300"
            >
              STT
            </Badge>
          </div>
          <span className="text-xs text-green-600 leading-5">
            Chain {chainId}
          </span>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert variant="warning" className="py-2">
      {/* <AlertTriangle className="h-3 w-3 mt-0.5" /> */}
      <AlertDescription className="flex items-center justify-between min-h-[20px]">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium leading-5">Wrong Network</span>
          <Badge
            variant="outline"
            className="text-xs h-5 px-2 flex items-center bg-yellow-100 text-yellow-700 border-yellow-300"
          >
            {chainId}
          </Badge>
        </div>
        <Button
          onClick={handleSwitchNetwork}
          size="sm"
          className="h-6 px-2 text-xs flex items-center"
        >
          Switch
        </Button>
      </AlertDescription>
    </Alert>
  );
}
