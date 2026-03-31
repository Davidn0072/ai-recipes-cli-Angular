export type RecipeRecord = {
  _id: string;
  title: string;
  ingredients?: string[];
  instructions?: string;
  difficulty?: string;
  cooking_time?: number;
};

export function normalizeRecipe(row: unknown): RecipeRecord {
  const o = row as Record<string, unknown>;
  const id = o['_id'] != null ? String(o['_id']) : '';
  return {
    _id: id,
    title: typeof o['title'] === 'string' ? o['title'] : '',
    ingredients: Array.isArray(o['ingredients'])
      ? o['ingredients'].filter((x): x is string => typeof x === 'string')
      : [],
    instructions:
      typeof o['instructions'] === 'string'
        ? o['instructions']
        : o['instructions'] != null
          ? String(o['instructions'])
          : undefined,
    difficulty: typeof o['difficulty'] === 'string' ? o['difficulty'] : undefined,
    cooking_time: typeof o['cooking_time'] === 'number' ? o['cooking_time'] : undefined,
  };
}
