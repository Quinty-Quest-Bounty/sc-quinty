# Quinty Achievements NFT Assets

## 🎨 Badge Image Structure

### Image Requirements:
- **Format**: PNG with transparent background
- **Size**: 512x512 pixels
- **Style**: Consistent design language across all badges

### Badge Categories & Design Themes:

#### 🔧 Solver Badges (Blue Theme):
```
first-solver.png     - Simple circuit icon
active-solver.png    - Circuit with gears
skilled-solver.png   - Advanced circuit pattern
expert-solver.png    - Complex circuit with shine
legend-solver.png    - Legendary circuit with aura
```

#### 🏆 Winner Badges (Gold Theme):
```
first-win.png        - Simple trophy
skilled-winner.png   - Trophy with laurels
expert-winner.png    - Ornate trophy
champion-winner.png  - Champion cup
legend-winner.png    - Legendary crown
```

#### 💡 Creator Badges (Green Theme):
```
first-creator.png    - Light bulb icon
active-creator.png   - Light bulb with gears
skilled-creator.png  - Multiple light bulbs
expert-creator.png   - Bright shining bulb
legend-creator.png   - Cosmic light bulb
```

#### 👑 Season Badges (Purple Theme):
```
monthly-champion.png - Crown with "M"
monthly-builder.png  - Builder crown with "M"
seasonal-champion.png - Crown with "S"
seasonal-builder.png - Builder crown with "S"
```

### Rarity Visual Indicators:
- **Common**: Simple design, single color
- **Uncommon**: Two-tone colors, slight glow
- **Rare**: Gradient colors, medium glow
- **Epic**: Multi-color gradient, strong glow
- **Legendary**: Animated-style, rainbow aura

## 📝 Example Metadata Output:

When user earns "First Solver Badge", the NFT will show:

```json
{
  "name": "First Solver Badge",
  "description": "Congratulations! You've submitted your first solution to a Quinty bounty. This achievement marks the beginning of your journey as a problem solver.",
  "image": "ipfs://QmHash.../first-solver.png",
  "attributes": [
    {
      "trait_type": "Category",
      "value": "Solver"
    },
    {
      "trait_type": "Milestone",
      "value": "1"
    },
    {
      "trait_type": "Rarity",
      "value": "Common"
    },
    {
      "trait_type": "Earned Date",
      "value": "1640995200"
    }
  ]
}
```

## 🔗 IPFS Setup:

1. **Upload badge images** to IPFS
2. **Set baseTokenURI** to IPFS folder: `ipfs://QmYourHashHere/`
3. **Images accessible** as: `ipfs://QmYourHashHere/first-solver.png`

## 🎯 Next Steps:

1. Design badge images (atau use placeholder icons)
2. Upload to IPFS
3. Deploy QuintyAchievements contract with IPFS baseURI
4. Test metadata generation