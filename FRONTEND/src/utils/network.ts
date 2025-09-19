// Network switching and adding utilities
export const SOMNIA_TESTNET_PARAMS = {
  chainId: '0xC478', // 50312 in hex
  chainName: 'Somnia Testnet',
  nativeCurrency: {
    name: 'Somnia Test Token',
    symbol: 'STT',
    decimals: 18,
  },
  rpcUrls: ['https://dream-rpc.somnia.network/'],
  blockExplorerUrls: ['https://shannon-explorer.somnia.network'],
};

export const addSomniaNetwork = async () => {
  try {
    await window.ethereum?.request({
      method: 'wallet_addEthereumChain',
      params: [SOMNIA_TESTNET_PARAMS],
    });
    console.log('Somnia Testnet added to wallet');
    return true;
  } catch (error) {
    console.error('Failed to add Somnia Testnet:', error);
    return false;
  }
};

export const switchToSomnia = async () => {
  try {
    await window.ethereum?.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: SOMNIA_TESTNET_PARAMS.chainId }],
    });
    console.log('Switched to Somnia Testnet');
    return true;
  } catch (error: any) {
    // This error code indicates that the chain has not been added to MetaMask
    if (error.code === 4902) {
      console.log('Somnia Testnet not found, adding it...');
      return await addSomniaNetwork();
    }
    console.error('Failed to switch to Somnia Testnet:', error);
    return false;
  }
};

export const ensureSomniaNetwork = async () => {
  if (!window.ethereum) {
    alert('Please install MetaMask or another Web3 wallet');
    return false;
  }

  try {
    const chainId = await window.ethereum.request({ method: 'eth_chainId' });

    if (chainId !== SOMNIA_TESTNET_PARAMS.chainId) {
      console.log('Not on Somnia Testnet, switching...');
      return await switchToSomnia();
    }

    console.log('Already on Somnia Testnet');
    return true;
  } catch (error) {
    console.error('Error checking network:', error);
    return false;
  }
};