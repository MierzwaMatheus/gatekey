import { render, screen } from "@testing-library/react";
import React from "react";

test("debug bare jsx", async () => {
  render(<div data-testid="hello">world</div>);
  const el = await screen.findByTestId("hello");
  console.log("el:", el.textContent);
  console.log("body:", document.body.innerHTML);
});
