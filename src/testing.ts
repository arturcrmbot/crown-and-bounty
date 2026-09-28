/**
 * A slow test's timeout (a bot playing a commission, sample battles): as given on a laptop, and five
 * times that on CI, whose runners are slower and busier.
 */
export const timeout = (ms: number) => (import.meta.env.CI ? ms * 5 : ms);
