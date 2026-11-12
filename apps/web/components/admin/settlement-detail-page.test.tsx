import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

const mocks = vi.hoisted(() => ({
  approved: true,
  approve: vi.fn(), reject: vi.fn(), refresh: vi.fn(),
  useMutation: vi.fn(),
  onApprove: null as null | ((release: string[]) => void),
  onReject: null as null | ((reason: string) => void),
}));

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "invoice" }) }));
vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({}),
  useQuery: () => ({ data: { id: "invoice", status: "PROPOSED", approved: mocks.approved, paypalInvoiceId: null } }),
  useMutation: mocks.useMutation,
}));
vi.mock("@/components/admin/settlement-detail", () => ({
  SettlementDetailSkeleton: () => null,
  SettlementDetailError: () => null,
  SettlementDetailView: (props: { onApprove: (release: string[]) => void; onReject: (reason: string) => void }) => {
    mocks.onApprove = props.onApprove;
    mocks.onReject = props.onReject;
    return null;
  },
}));

import AdminSettlementDetailPage from "@/app/admin/settlements/[id]/page";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.approved = true;
  mocks.useMutation
    .mockReturnValueOnce({ isPending: false, mutateAsync: mocks.approve })
    .mockReturnValueOnce({ isPending: false, mutateAsync: mocks.reject })
    .mockReturnValueOnce({ isPending: false, mutateAsync: mocks.refresh });
});

describe("Settlement detail page approval controls", () => {
  it("blocks rejection after approval even before draft creation", () => {
    renderToStaticMarkup(<AdminSettlementDetailPage />);
    mocks.onReject?.("Review price.");
    expect(mocks.reject).not.toHaveBeenCalled();
  });

  it("retries approval without a new release selection before draft creation", () => {
    renderToStaticMarkup(<AdminSettlementDetailPage />);
    mocks.onApprove?.(["new-held-sale"]);
    expect(mocks.approve).toHaveBeenCalledWith([]);
  });

  it("allows rejection before approval", () => {
    mocks.approved = false;
    renderToStaticMarkup(<AdminSettlementDetailPage />);
    mocks.onReject?.("Review price.");
    expect(mocks.reject).toHaveBeenCalledWith("Review price.");
  });
});
