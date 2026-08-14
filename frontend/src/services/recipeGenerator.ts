import type { PantryItem } from '../types';

interface OfflineRecipe {
  name: string;
  ingredients: string[]; // lowercase keywords
  instruction: string;
  icon: string;
  difficulty: 'EASY' | 'MEDIUM' | 'CHEF TIER';
}

const OFFLINE_RECIPES: OfflineRecipe[] = [
  {
    name: 'French Toast',
    ingredients: ['milk', 'eggs', 'bread'],
    instruction: 'Whisk eggs and milk, dip bread slices, and fry in a skillet until golden brown on both sides.',
    icon: '🍞',
    difficulty: 'EASY'
  },
  {
    name: 'Veggie Omelet',
    ingredients: ['eggs', 'vegetables', 'cheese'],
    instruction: 'Saute chopped vegetables, pour in whisked eggs, top with cheese, and fold once cooked.',
    icon: '🍳',
    difficulty: 'EASY'
  },
  {
    name: 'Chicken & Veggie Stir Fry',
    ingredients: ['chicken', 'vegetables'],
    instruction: 'Saute sliced chicken and vegetables in a hot pan with soy sauce and spices until tender.',
    icon: '🥘',
    difficulty: 'MEDIUM'
  },
  {
    name: 'Fruit Smoothie',
    ingredients: ['milk', 'fruit'],
    instruction: 'Blend fresh fruits with milk and a touch of honey or sugar for a refreshing drink.',
    icon: '🥤',
    difficulty: 'EASY'
  },
  {
    name: 'Grilled Cheese',
    ingredients: ['bread', 'cheese'],
    instruction: 'Sandwich cheese between buttered bread slices and grill on a skillet until crispy and melted.',
    icon: '🥪',
    difficulty: 'EASY'
  },
  {
    name: 'Egg in a Hole',
    ingredients: ['eggs', 'bread'],
    instruction: 'Cut a hole in a bread slice, place on a greased skillet, crack an egg into the hole, and flip.',
    icon: '🍳',
    difficulty: 'EASY'
  },
  {
    name: 'Yogurt & Fruit Bowl',
    ingredients: ['yogurt', 'fruit'],
    instruction: 'Spoon yogurt into a bowl, layer with sliced fruits, and garnish with nuts or honey if available.',
    icon: '🥣',
    difficulty: 'EASY'
  },
  {
    name: 'Cheesy Roasted Vegetables',
    ingredients: ['vegetables', 'cheese'],
    instruction: 'Toss vegetables in olive oil, roast at 200°C (400°F) for 20 minutes, and top with cheese.',
    icon: '🥗',
    difficulty: 'MEDIUM'
  },
  {
    name: 'Chicken Salad',
    ingredients: ['chicken', 'vegetables', 'yogurt'],
    instruction: 'Shred cooked chicken, mix with diced vegetables, and bind with yogurt and herbs.',
    icon: '🥗',
    difficulty: 'EASY'
  },
  {
    name: 'Scrambled Eggs on Toast',
    ingredients: ['eggs', 'bread', 'milk'],
    instruction: 'Scramble eggs with a splash of milk in a pan, and serve over toasted bread.',
    icon: '🍳',
    difficulty: 'EASY'
  },
  {
    name: 'Cheesy Chicken Bake',
    ingredients: ['chicken', 'cheese'],
    instruction: 'Bake chicken breasts topped with cheese and herbs until juicy and cooked through.',
    icon: '🍗',
    difficulty: 'CHEF TIER'
  },
  {
    name: 'Bread Pudding',
    ingredients: ['bread', 'milk', 'eggs'],
    instruction: 'Tear bread, soak in a mixture of beaten eggs and milk, and bake until set and golden.',
    icon: '🍮',
    difficulty: 'MEDIUM'
  }
];

export async function generateRecipe(itemNames: string[], userApiKey?: string): Promise<string> {
  if (itemNames.length === 0) {
    return 'Add some items to your pantry to get recipe suggestions!';
  }

  // 1. Try Gemini API if key is provided
  if (userApiKey && userApiKey.trim().length > 0) {
    const modelsToTry = ['gemini-1.5-flash', 'gemini-2.0-flash'];
    for (const model of modelsToTry) {
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${userApiKey}`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      text: `Suggest 1 quick, simple recipe using these ingredients: ${itemNames.join(
                        ', '
                      )}. Keep the recipe instruction to exactly 1-2 short sentences. Focus on avoiding food waste.`,
                    },
                  ],
                },
              ],
            }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          const recipeText = data.candidates?.[0]?.content?.parts?.[0]?.text;
          if (recipeText && recipeText.trim().length > 0) {
            return recipeText.trim();
          }
        }
      } catch (error) {
        console.warn(`Gemini API call (${model}) failed, trying next:`, error);
      }
    }
  }

  // 2. Local Fallback Matching Logic
  const normalizedInputs = itemNames.map((n) => n.toLowerCase());

  let bestMatch: OfflineRecipe | null = null;
  let maxMatchedIngredients = 0;

  for (const recipe of OFFLINE_RECIPES) {
    // Check how many of the recipe's ingredients are present in the user's pantry
    const matchedCount = recipe.ingredients.filter((ingredient) =>
      normalizedInputs.some((input) => input.includes(ingredient) || ingredient.includes(input))
    ).length;

    // We require at least 1 match, and we want to maximize the matching ingredients
    if (matchedCount > 0 && matchedCount > maxMatchedIngredients) {
      bestMatch = recipe;
      maxMatchedIngredients = matchedCount;
    }
  }

  if (bestMatch) {
    return `[Local Quest Recipe: ${bestMatch.name}] ${bestMatch.instruction}`;
  }

  // Default absolute fallback
  const firstTwoItems = itemNames.slice(0, 2).join(' and ');
  return `Try making a quick, healthy scramble or stir-fry using your expiring ${firstTwoItems || 'ingredients'} today!`;
}

export interface DynamicQuestItem {
  id: string;
  title: string;
  recipeName: string;
  instruction: string;
  xpReward: number;
  icon: string;
  difficulty: 'EASY' | 'MEDIUM' | 'CHEF TIER';
  ingredients: { name: string; inPantry: boolean }[];
}

export function getDynamicPantryQuests(activeItems: PantryItem[]): DynamicQuestItem[] {
  const itemNames = activeItems.map((i) => i.name.toLowerCase());

  const matched = OFFLINE_RECIPES.filter((r) =>
    r.ingredients.some((ing) => itemNames.some((n) => n.includes(ing) || ing.includes(n)))
  );

  const selectedRecipes = matched.length > 0 ? matched.slice(0, 3) : OFFLINE_RECIPES.slice(0, 2);

  return selectedRecipes.map((r, idx) => {
    const list = r.ingredients.map((ing) => {
      const inPantry = itemNames.some((n) => n.includes(ing) || ing.includes(n));
      const formattedName = ing.charAt(0).toUpperCase() + ing.slice(1);
      return {
        name: `${formattedName}${inPantry ? ' (In Pantry ✔️)' : ''}`,
        inPantry
      };
    });

    // Add staple ingredients
    if (r.name.includes('Toast') || r.name.includes('Pudding')) {
      list.push({ name: '1 tbsp Butter for Pan', inPantry: false });
      list.push({ name: 'Maple Syrup or Honey', inPantry: false });
    } else if (r.name.includes('Omelet') || r.name.includes('Fry') || r.name.includes('Eggs')) {
      list.push({ name: '1 Pinch Salt & Pepper', inPantry: false });
      list.push({ name: '1 tbsp Cooking Oil', inPantry: false });
    } else {
      list.push({ name: 'Seasoning & Herbs', inPantry: false });
    }

    return {
      id: `quest_${idx}_${r.name.replace(/\s+/g, '_')}`,
      title: `Quest: Waste Rescue (${r.name})`,
      recipeName: r.name,
      instruction: r.instruction,
      xpReward: r.difficulty === 'CHEF TIER' ? 120 : r.difficulty === 'MEDIUM' ? 90 : 75,
      icon: r.icon,
      difficulty: r.difficulty,
      ingredients: list
    };
  });
}
