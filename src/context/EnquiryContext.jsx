
import React, { createContext, useContext, useState } from "react";

const EnquiryContext = createContext(null);

export function EnquiryProvider({ children }) {
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);

  const addItem = (product, variant, qty = 1) => {
    setItems(prev => {
      const existing = prev.find(
        i => i.product.id === product.id && i.variant.id === variant.id
      );
      if (existing) {
        return prev.map(i =>
          i === existing ? { ...i, quantity: i.quantity + qty } : i
        );
      }
      return [...prev, { product, variant, quantity: qty }];
    });
  };

  const addItemAndOpen = (product, variant, qty = 1) => {
    addItem(product, variant, qty);
    setOpen(true);
  };

  const updateQty = (index, qty) => {
    setItems(prev =>
      prev.map((item, i) =>
        i === index ? { ...item, quantity: Math.max(1, qty) } : item
      )
    );
  };

  const removeItem = index => {
    setItems(prev => prev.filter((_, i) => i !== index));
  };

  const clear = () => setItems([]);

  return (
    <EnquiryContext.Provider
      value={{ items, open, setOpen, addItem, addItemAndOpen, updateQty, removeItem, clear }}
    >
      {children}
    </EnquiryContext.Provider>
  );
}

export function useEnquiry() {
  const ctx = useContext(EnquiryContext);
  if (!ctx) throw new Error("useEnquiry must be used inside EnquiryProvider");
  return ctx;
}
