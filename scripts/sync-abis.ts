
import fs from 'fs';
import path from 'path';

const scDir = '/Users/askar/Documents/hackathon/incuBase/sc-quinty/artifacts/contracts';
const feDir = '/Users/askar/Documents/hackathon/incuBase/fe-quinty/contracts';

const contracts = [
  { name: 'Quinty', path: 'Quinty.sol/Quinty.json' },
  { name: 'QuintyNFT', path: 'QuintyNFT.sol/QuintyNFT.json' },
  { name: 'QuintyReputation', path: 'QuintyReputation.sol/QuintyReputation.json' },
  { name: 'AirdropBounty', path: 'AirdropBounty.sol/AirdropBounty.json' }
];

contracts.forEach(c => {
  const fullPath = path.join(scDir, c.path);
  if (fs.existsSync(fullPath)) {
    const artifact = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
    fs.writeFileSync(path.join(feDir, `${c.name}.json`), JSON.stringify(artifact.abi, null, 2));
    console.log(`Synced ${c.name} ABI`);
  } else {
    console.log(`Artifact not found for ${c.name} at ${fullPath}`);
  }
});
