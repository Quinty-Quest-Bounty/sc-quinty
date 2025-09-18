import axios from 'axios';
import FormData from 'form-data';

// IPFS utilities for handling file uploads and metadata
export const IPFS_GATEWAY = "https://ipfs.io/ipfs/";
export const PINATA_GATEWAY = "https://gateway.pinata.cloud/ipfs/";

// Interface for IPFS metadata
export interface BountyMetadata {
  title: string;
  description: string;
  requirements: string[];
  deliverables: string[];
  skills: string[];
  images?: string[];
  deadline: number;
  bountyType: "development" | "design" | "marketing" | "research" | "other";
}

export interface SubmissionMetadata {
  description: string;
  deliverables: string[];
  attachments: string[];
  screenshots?: string[];
  demoUrl?: string;
  sourceCode?: string;
  submittedAt: number;
}

// Helper function to format IPFS URLs
export const formatIpfsUrl = (
  cid: string,
  gateway: string = IPFS_GATEWAY
): string => {
  if (!cid) return "";

  // Remove ipfs:// prefix if present
  const cleanCid = cid.replace("ipfs://", "");

  return `${gateway}${cleanCid}`;
};

// Helper function to extract CID from IPFS URL
export const extractCidFromUrl = (url: string): string => {
  if (url.startsWith("ipfs://")) {
    return url.replace("ipfs://", "");
  }

  // Extract from gateway URL
  const match = url.match(/\/ipfs\/([a-zA-Z0-9]+)/);
  return match ? match[1] : url;
};

// Validate IPFS CID format
export const isValidIpfsCid = (cid: string): boolean => {
  const cleanCid = extractCidFromUrl(cid);

  // Basic CID validation (simplified)
  return /^Qm[1-9A-HJ-NP-Za-km-z]{44}$|^[0-9a-f]{64}$|^[a-z2-7]{59}$/.test(
    cleanCid
  );
};

// Upload file to IPFS using Pinata
export const uploadToIpfs = async (
  file: File | Blob,
  metadata?: any
): Promise<string> => {
  const url = `https://api.pinata.cloud/pinning/pinFileToIPFS`;

  const data = new FormData();
  data.append('file', file);

  if (metadata) {
    const pinataMetadata = JSON.stringify({ name: (file as File).name, keyvalues: metadata });
    data.append('pinataMetadata', pinataMetadata);
  }

  const headers = {
    'Authorization': `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT || ''}`
  };

  try {
    const res = await axios.post(url, data, { headers });
    return res.data.IpfsHash;
  } catch (error) {
    console.error("IPFS upload failed:", error);
    throw new Error("Failed to upload to IPFS");
  }
};

// Upload JSON metadata to IPFS
export const uploadMetadataToIpfs = async (
  metadata: BountyMetadata | SubmissionMetadata
): Promise<string> => {
  const url = `https://api.pinata.cloud/pinning/pinJSONToIPFS`;

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.NEXT_PUBLIC_PINATA_JWT || ''}`
  };

  try {
    const res = await axios.post(url, metadata, { headers });
    return res.data.IpfsHash;
  } catch (error) {
    console.error("Metadata upload failed:", error);
    throw new Error("Failed to upload metadata to IPFS");
  }
};

// Fetch metadata from IPFS
export const fetchMetadataFromIpfs = async (cid: string): Promise<any> => {
  try {
    const url = formatIpfsUrl(cid);
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to fetch metadata from IPFS:", error);
    throw new Error("Failed to fetch metadata from IPFS");
  }
};

// Create blinded IPFS CID for submissions (simple hash-based approach)
export const createBlindedCid = (realCid: string, secret: string): string => {
  // In production, use proper cryptographic blinding
  // This is a simplified approach for demonstration
  const combined = realCid + secret;
  const hash = btoa(combined).replace(/[/+=]/g, "").substring(0, 46);
  return "Qm" + hash;
};

// Reveal blinded CID (verify against real CID)
export const revealBlindedCid = (
  blindedCid: string,
  realCid: string,
  secret: string
): boolean => {
  const expectedBlinded = createBlindedCid(realCid, secret);
  return blindedCid === expectedBlinded;
};

// Helper to display IPFS images with fallback
import React, { useState } from "react";

interface IpfsImageProps {
  cid: string;
  alt: string;
  className?: string;
  fallback?: string;
}

export const IpfsImage: React.FC<IpfsImageProps> = ({
  cid,
  alt,
  className,
  fallback,
}) => {
  const [imageSrc, setImageSrc] = useState<string>(() => formatIpfsUrl(cid));
  const [hasError, setHasError] = useState<boolean>(false);

  const handleError = () => {
    if (!hasError) {
      setHasError(true);
      // Try alternative gateway
      setImageSrc(formatIpfsUrl(cid, PINATA_GATEWAY));
    }
  };

  if (hasError && fallback) {
    return React.createElement("img", { src: fallback, alt, className });
  }

  return React.createElement("img", {
    src: imageSrc,
    alt,
    className,
    onError: handleError,
  });
};

const ipfsUtils = {
  formatIpfsUrl,
  extractCidFromUrl,
  isValidIpfsCid,
  uploadToIpfs,
  uploadMetadataToIpfs,
  fetchMetadataFromIpfs,
  createBlindedCid,
  revealBlindedCid,
  IpfsImage,
};

export default ipfsUtils;
