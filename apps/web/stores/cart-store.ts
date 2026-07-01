import { create } from "zustand";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
  eligibility: "eligible" | "ineligible";
  imageDataUrl?: string;
}

interface CartState {
  items: CartItem[];
  inputSource: "ai" | "manual" | null;
  addItem: (item: Omit<CartItem, "id">) => void;
  removeItem: (id: string) => void;
  setInputSource: (source: "ai" | "manual") => void;
  clearCart: () => void;
}

let nextId = 1;

export const useCartStore = create<CartState>((set) => ({
  items: [],
  inputSource: null,

  addItem: (item) =>
    set((state) => ({
      items: [...state.items, { ...item, id: `cart-${nextId++}` }],
    })),

  removeItem: (id) =>
    set((state) => ({
      items: state.items.filter((i) => i.id !== id),
    })),

  setInputSource: (source) => set({ inputSource: source }),

  clearCart: () => set({ items: [], inputSource: null }),
}));
