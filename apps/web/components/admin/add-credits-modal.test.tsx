import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AddCreditsModal } from "./add-credits-modal";

vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>{children}</a>
  ),
}));

describe("AddCreditsModal", () => {
  it("links to the program fund before a grant is requested", () => {
    const html = renderToStaticMarkup(
      <AddCreditsModal
        open={true}
        onClose={() => {}}
        beneficiaryId="b-123"
        beneficiaryName="Juan dela Cruz"
        tier="TIER_1_CRITICAL"
        onSuccess={() => {}}
        lguBalance={10000}
      />
    );
    expect(html).toContain('href="/admin/fund"');
    expect(html).toContain("LGU Available Balance");
    expect(html).toContain("View program fund ledger");
  });
});
