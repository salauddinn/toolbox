import { MarketingLanding } from "./components/marketing-landing";
import { ProductShell } from "./components/shell/product-shell";

export default function HomePage() {
  return (
    <ProductShell>
      <MarketingLanding />
    </ProductShell>
  );
}
