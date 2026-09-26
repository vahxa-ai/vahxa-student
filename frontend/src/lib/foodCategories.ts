// Shared food/drink categories used by the Shopping List and Meal Planner.

export const CATEGORIES = [
  "Produce",
  "Fruits",
  "Dairy",
  "Meat",
  "Bakery",
  "Pantry",
  "Frozen",
  "Beverages",
  "Household",
  "Other",
];

export const CATEGORY_COLORS: Record<string, string> = {
  Produce: "bg-lime-100 text-lime-700",
  Fruits: "bg-pink-100 text-pink-700",
  Dairy: "bg-blue-100 text-blue-700",
  Meat: "bg-red-100 text-red-700",
  Bakery: "bg-amber-100 text-amber-700",
  Pantry: "bg-yellow-100 text-yellow-700",
  Frozen: "bg-cyan-100 text-cyan-700",
  Beverages: "bg-purple-100 text-purple-700",
  Household: "bg-gray-100 text-gray-600",
  Other: "bg-gray-100 text-gray-500",
};

export const categoryColor = (category?: string | null): string =>
  (category && CATEGORY_COLORS[category]) || CATEGORY_COLORS.Other;
