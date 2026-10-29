export const CATEGORIES = [
  { id: "tops", label: "Tops", slot: "top" },
  { id: "dresses", label: "Dresses", slot: "outfit" },
  { id: "bottoms", label: "Bottoms", slot: "trousers or skirt" },
  { id: "outerwear", label: "Outerwear", slot: "top layer" },
  { id: "traditional", label: "Traditional", slot: "outfit" },
  { id: "hats", label: "Caps & hats", slot: "headwear", small: true },
  { id: "glasses", label: "Glasses", slot: "eyewear", small: true },
  { id: "jewellery", label: "Jewellery", slot: "jewellery", small: true },
  { id: "accessories", label: "Other accessories", slot: "accessory", small: true },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];
export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as [CategoryId, ...CategoryId[]];

export type Product = {
  id: string;
  name: string;
  category: CategoryId;
  /** Same-origin path under /public. */
  image: string;
  /** Fixed edit instruction. No user-written text ever reaches the model. */
  prompt: string;
  /** The image is a real product photo, so it is sent to the model as a reference. Illustrations are not. */
  reference: boolean;
  /** Works with the realtime clothing model (Decart lucy-vton), which is built for garments only. */
  live: boolean;
};

// Photos: DecartAI/tryon-examples (MIT, see public/garments/LICENSE). Illustrations in /catalog are original to this repo.
export const PRODUCTS: readonly Product[] = [
  { id: "hoodie", name: "Navy hoodie", category: "tops", image: "/garments/hoodie.jpg", reference: true, live: true,
    prompt: "Substitute the current top with a navy blue hoodie with a white cross logo on the chest and a kangaroo pocket" },
  { id: "crewneck", name: "Grey crewneck", category: "tops", image: "/garments/crewneck.jpg", reference: true, live: true,
    prompt: "Substitute the current top with a grey crewneck sweatshirt with a large blue cross logo on the front" },
  { id: "linen-shirt", name: "White linen shirt", category: "tops", image: "/catalog/linen-shirt.svg", reference: false, live: false,
    prompt: "Substitute the current top with a white long-sleeve linen button-up shirt" },
  { id: "rain-jacket", name: "Yellow rain jacket", category: "outerwear", image: "/garments/rain-jacket.jpg", reference: true, live: true,
    prompt: "Substitute the current top with a yellow hooded rain jacket with a grey cross logo on the chest and zip front" },
  { id: "bomber", name: "Black bomber", category: "outerwear", image: "/garments/bomber.jpg", reference: true, live: true,
    prompt: "Substitute the current top with a black bomber jacket with a blue cross logo on the chest and a zip front" },
  { id: "wrap-dress", name: "Red wrap dress", category: "dresses", image: "/catalog/wrap-dress.svg", reference: false, live: false,
    prompt: "Dress the person in a red knee-length wrap dress with short sleeves" },
  { id: "jeans", name: "Blue jeans", category: "bottoms", image: "/catalog/jeans.svg", reference: false, live: false,
    prompt: "Substitute the current trousers with classic straight-leg mid-blue denim jeans" },
  { id: "kurta", name: "Ivory kurta", category: "traditional", image: "/catalog/kurta.svg", reference: false, live: false,
    prompt: "Dress the person in an ivory knee-length cotton kurta with a mandarin collar and matching straight trousers" },
  { id: "saree", name: "Maroon saree", category: "traditional", image: "/catalog/saree.svg", reference: false, live: false,
    prompt: "Dress the person in a maroon silk saree with a gold border, draped in the Nivi style over a matching blouse" },
  { id: "cap", name: "Black cap", category: "hats", image: "/catalog/cap.svg", reference: false, live: false,
    prompt: "Add a plain black baseball cap on the person's head, facing forward" },
  { id: "round-glasses", name: "Round glasses", category: "glasses", image: "/catalog/round-glasses.svg", reference: false, live: false,
    prompt: "Add round tortoiseshell eyeglasses with clear lenses on the person's face" },
  { id: "sunglasses", name: "Sunglasses", category: "glasses", image: "/catalog/sunglasses.svg", reference: false, live: false,
    prompt: "Add black rectangular sunglasses with dark lenses on the person's face" },
  { id: "necklace", name: "Gold chain", category: "jewellery", image: "/catalog/necklace.svg", reference: false, live: false,
    prompt: "Add a thin gold chain necklace around the person's neck" },
  { id: "earrings", name: "Pearl studs", category: "jewellery", image: "/catalog/earrings.svg", reference: false, live: false,
    prompt: "Add small white pearl stud earrings to the person's visible ears" },
  { id: "scarf", name: "Silk scarf", category: "accessories", image: "/catalog/scarf.svg", reference: false, live: false,
    prompt: "Add a navy and cream patterned silk scarf loosely tied around the person's neck" },
];

export const findProduct = (id: string) => PRODUCTS.find((p) => p.id === id);
export const findCategory = (id: CategoryId) => CATEGORIES.find((c) => c.id === id)!;

/** Prompt for a product image the user uploaded. The category picks the wording; the image is the reference. */
export function customItemPrompt(category: CategoryId): string {
  const c = findCategory(category);
  return "small" in c
    ? `Add the ${c.slot} shown in the reference image to the person`
    : `Substitute the person's current ${c.slot} with the one shown in the reference image`;
}

/** Appended to every photo edit so only the item changes. */
export const KEEP_PERSON = ". Keep the person's face, hair, body shape, pose and the background exactly the same.";
