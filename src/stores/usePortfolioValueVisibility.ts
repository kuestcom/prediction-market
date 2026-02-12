import { create } from 'zustand'

interface PortfolioValueVisibilityState {
  isHidden: boolean
  toggle: () => void
}

export const usePortfolioValueVisibility = create<PortfolioValueVisibilityState>(set => ({
  isHidden: false,
  toggle: () => set(state => ({ isHidden: !state.isHidden })),
}))
