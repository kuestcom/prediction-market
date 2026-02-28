import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { MarketSearchModal } from "@/components/market-search/MarketSearchModal";

// ── Mocks ─────────────────────────────────────────────────────────────────────

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

vi.mock("@/hooks/useMarketSearch", () => ({
  useMarketSearch: vi.fn(),
}));

import { useMarketSearch } from "@/hooks/useMarketSearch";

const MOCK_RESULTS = [
  {
    id: "1",
    slug: "will-btc-100k",
    question: "Will BTC hit $100k?",
    probability: 0.72,
    closeTime: "2025-12-31T00:00:00Z",
    volumeUsdc: 500000,
    active: true,
  },
  {
    id: "2",
    slug: "will-eth-flip",
    question: "Will ETH flip BTC?",
    probability: 0.18,
    closeTime: "2025-06-30T00:00:00Z",
    volumeUsdc: 120000,
    active: true,
  },
];

function setupMock(overrides = {}) {
  (useMarketSearch as ReturnType<typeof vi.fn>).mockReturnValue({
    results: [],
    isLoading: false,
    error: null,
    clear: vi.fn(),
    ...overrides,
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("MarketSearchModal", () => {
  beforeEach(() => {
    setupMock();
    mockPush.mockClear();

    // jsdom doesn't implement showModal/close on <dialog> — polyfill.
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.setAttribute("open", "");
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.removeAttribute("open");
      this.dispatchEvent(new Event("close"));
    });
  });

  it("renders nothing when closed", () => {
    render(<MarketSearchModal open={false} onOpenChange={vi.fn()} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
  });

  it("shows the input when open", async () => {
    render(<MarketSearchModal open onOpenChange={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByRole("combobox")).toBeInTheDocument()
    );
  });

  it("renders results from the hook", async () => {
    setupMock({ results: MOCK_RESULTS });
    render(<MarketSearchModal open onOpenChange={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText("Will BTC hit $100k?")).toBeInTheDocument();
      expect(screen.getByText("Will ETH flip BTC?")).toBeInTheDocument();
    });
  });

  it("navigates to market page on result click", async () => {
    setupMock({ results: MOCK_RESULTS });
    render(<MarketSearchModal open onOpenChange={vi.fn()} />);

    await waitFor(() => screen.getByText("Will BTC hit $100k?"));
    fireEvent.click(screen.getByText("Will BTC hit $100k?"));

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/markets/will-btc-100k")
    );
  });

  it("navigates via keyboard Enter on active result", async () => {
    const user = userEvent.setup({ delay: null });
    setupMock({ results: MOCK_RESULTS });
    render(<MarketSearchModal open onOpenChange={vi.fn()} />);

    await waitFor(() => screen.getByRole("combobox"));
    await user.keyboard("{ArrowDown}{Enter}");

    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith("/markets/will-btc-100k")
    );
  });

  it("shows empty state when query is long enough but no results", async () => {
    setupMock({ results: [] });
    render(<MarketSearchModal open onOpenChange={vi.fn()} />);

    const input = screen.getByRole("combobox");
    fireEvent.change(input, { target: { value: "xyzunknown" } });

    // The empty state text is rendered by the parent — simulate the hook
    // returning empty with a long-enough query.
    await waitFor(() =>
      expect(screen.getByText(/No markets found/i)).toBeInTheDocument()
    );
  });

  it("shows error state from the hook", async () => {
    setupMock({ error: "Search failed. Please try again." });
    render(<MarketSearchModal open onOpenChange={vi.fn()} />);

    await waitFor(() =>
      expect(
        screen.getByText("Search failed. Please try again.")
      ).toBeInTheDocument()
    );
  });

  it("calls onOpenChange(false) when backdrop is clicked", async () => {
    const onOpenChange = vi.fn();
    const { container } = render(
      <MarketSearchModal open onOpenChange={onOpenChange} />
    );

    const dialog = container.querySelector("dialog")!;
    fireEvent.click(dialog);

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
