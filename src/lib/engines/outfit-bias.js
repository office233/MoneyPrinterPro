// Pillar-specific outfit style constraints
const pillarOutfitRules = {
  "ava": {
    "urban_power": {
      "style": "structured, sharp, professional",
      "allowed": ["blazer", "tailored", "leather", "structured", "minimal"],
      "preferred_fabrics": ["wool", "leather", "cotton", "cashmere"],
      "avoid": ["overly casual", "beachwear"]
    },
    "music_life": {
      "style": "edgy, performance-ready, bold",
      "allowed": ["leather", "crop top", "boots", "statement pieces"],
      "preferred_fabrics": ["leather", "denim", "cotton"],
      "avoid": ["corporate", "business formal"]
    },
    "executive": {
      "style": "corporate, refined, luxury professional",
      "allowed": ["blazer", "tailored", "silk blouse", "structured"],
      "preferred_fabrics": ["wool", "silk", "cashmere"],
      "avoid": ["casual", "streetwear"]
    },
    "travel": {
      "style": "luxury casual, travel-ready, comfortable elegant",
      "allowed": ["cashmere", "relaxed tailored", "comfortable luxury"],
      "preferred_fabrics": ["cashmere", "linen", "cotton"],
      "avoid": ["overly formal", "restrictive"]
    },
    "nature_escape": {
      "style": "soft, relaxed, natural, minimal",
      "allowed": ["soft knit", "relaxed", "natural tones", "comfortable"],
      "preferred_fabrics": ["cotton", "knit", "linen", "wool"],
      "avoid": ["leather corporate", "structured blazer", "high heels", "business formal"],
      "force_casual": true
    }
  },
  "selena": {
    "luxury_editorial": {
      "style": "ultra high-end, editorial polish, designer",
      "allowed": ["silk", "satin", "designer", "statement pieces"],
      "preferred_fabrics": ["silk", "satin", "cashmere"],
      "avoid": ["casual", "streetwear"]
    },
    "yacht_travel": {
      "style": "luxury resort, beach glam, high-end vacation",
      "allowed": ["silk", "designer swimwear", "resort wear"],
      "preferred_fabrics": ["silk", "linen", "designer fabrics"],
      "avoid": ["corporate", "urban streetwear"]
    }
  }
};

export function applyPillarOutfitBias(persona, pillar, outfit) {
  const rules = pillarOutfitRules[persona]?.[pillar];
  
  if (!rules) return { outfit, modified: false };
  
  let modified = false;
  let adjustedOutfit = outfit;
  
  // Check if outfit contains forbidden items for this pillar
  if (rules.avoid) {
    rules.avoid.forEach(forbidden => {
      if (adjustedOutfit.toLowerCase().includes(forbidden.toLowerCase())) {
        modified = true;
      }
    });
  }
  
  // Special case: nature_escape force casual
  if (rules.force_casual && (adjustedOutfit.includes('leather') || adjustedOutfit.includes('structured') || adjustedOutfit.includes('blazer'))) {
    // Replace with natural casual
    adjustedOutfit = `soft cotton knit sweater, relaxed linen pants, natural tone sneakers`;
    modified = true;
  }
  
  return {
    outfit: adjustedOutfit,
    modified,
    pillar_style: rules.style
  };
}
